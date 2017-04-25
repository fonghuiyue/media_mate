/**
 * @author William Blythe
 * @fileoverview The main file. Entry point.
 */
/**
 * @module Index
 */
'use strict';
/* eslint-disable no-unused-vars */
console.time('full');
console.time('init');
console.time('require');
require('dotenv').config({path: `${__dirname}/../.env`});
console.time('electron');
import electron, {dialog, ipcMain as ipc} from 'electron';
console.timeEnd('electron');
console.time('updater');
import {autoUpdater} from 'electron-updater';
console.timeEnd('updater');
console.time('is-dev');
import isDev from 'electron-is-dev';
console.timeEnd('is-dev');
console.time('bugsnag');
import bugsnag from 'bugsnag';
console.timeEnd('bugsnag');
console.time('rssparse');
import {RSSParse} from '../lib/rssparse';
console.timeEnd('rssparse');
console.time('menu');
import {init} from './menu.js';
console.timeEnd('menu');
console.time('pouch');
import PouchDB from 'pouchdb';
console.timeEnd('pouch');
console.time('underscore');
import _ from 'underscore';
console.timeEnd('underscore');
console.time('jsonstorage');
import storage from 'electron-json-storage';
console.timeEnd('jsonstorage');
console.time('debug');
require('electron-debug')();
console.timeEnd('debug');
console.time('find');
import * as find from 'pouchdb-find';
PouchDB.plugin(find);
console.timeEnd('find');
console.time('windowstate');
import windowStateKeeper from 'electron-window-state';
console.timeEnd('windowstate');
console.timeEnd('require');
let RSS;
const app = electron.app;
bugsnag.register('03b389d77abc2d10136d8c859391f952', {appVersion: app.getVersion(), sendCode: true});
let win;
// Let MongoClient;
/**
 * Autoupdater on update available
 */
autoUpdater.on('update-available', info => { // eslint-disable-line no-unused-vars
	dialog.showMessageBox({
		type: 'info',
		buttons: [],
		title: 'New update available.',
		message: 'Press OK to download the update, and the application will download the update and then tell you when its done.'
	});
	win.loadURL(`file:///${__dirname}/../index.html`);
});
/**
 * Autoupdater on downloaded
 */
autoUpdater.on('update-downloaded', (event, info) => { // eslint-disable-line no-unused-vars
	dialog.showMessageBox({
		type: 'info',
		buttons: [],
		title: 'Update ready to install.',
		message: 'The update is downloaded, and will be installed on quit. The version downloaded is: ' + event.version
	});
});
/**
 * Autoupdater if error
 */
autoUpdater.on('error', error => {
	dialog.showMessageBox({
		type: 'info',
		buttons: [],
		title: 'Update ready to install.',
		message: `Sorry, we've had an error. The message is ` + error
	});
	if (!isDev) {
		bugsnag.notify(error);
	}
});
/**
 * Emitted on autoupdate progress.
 */
autoUpdater.on('download-progress', percent => {

});
// Adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// Prevent window being garbage collected
let mainWindow;
/**
 * Catch any uncaught errors and report them.
 * @param err {object} - The error to be handled.
 */
process.on('uncaughtError', err => {
	bugsnag.notify(err);
	console.log('ERROR! The error is: ' + err || err.stack);
});
process.on('unhandledRejection', function (err) {
	console.error('Unhandled rejection: ' + (err && err.stack || err)); // eslint-disable-line
	bugsnag.notify(err);
});
/**
 * Called from renderer process when an error occurs
 */
ipc.on('errorInWindow', (event, data) => {
	// Bugsnag.notify(data);
	console.log(data);
	// Console.log('ERROR! The error is: ' + data);
});
/**
 * Dereference the window to make sure that things are collected properly.
 */
function onClosed() {
	// Dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}
/**
 * Make the window, get the state, then return.
 * @returns {*}
 */
function createMainWindow() {
	const mainWindowState = windowStateKeeper({
		defaultWidth: 1280,
		defaultHeight: 720
	});
	win = new electron.BrowserWindow({
		x: mainWindowState.x,
		y: mainWindowState.y,
		width: mainWindowState.width,
		height: mainWindowState.height,
		show: false,
		backgroundColor: '#f8f9fa'
	});
	mainWindowState.manage(win);
	win.loadURL(`file://${__dirname}/../index.html`);
	win.on('closed', onClosed);
	win.on('unresponsive', () => {
		console.log('I\'ve frozen. Sorry about that.');
	});
	win.on('responsive', () => {
		console.log('I\'ve unfrozen. Sorry.');
	});
	win.webContents.once('dom-ready', () => {
		console.timeEnd('full');
	});
	win.webContents.on('crashed', (e, killed) => {
		if (killed === true) {
			console.log(e);
			mainWindow = null;
			if (process.platform === 'darwin') {
				app.quit();
			}
		} else {
			console.log(e);
		}
	});
	win.once('ready-to-show', () => {
		win.show();
	});
	return win;
}
/**
 * Ask the user if they want to view the tutorial on first run
 */
function onBoard() {
	storage.get('firstrun', (err, data) => {
		if (err) {
			throw err;
		}
		if (_.isEmpty(data)) {
			mainWindow.webContents.executeJavaScript('firstrun()');
			storage.set('firstrun', {first: false}, err => {
				if (err) {
					throw err;
				}
			});
		}
	});
}

/**
 * When all windows are closed, quit the app.
 */
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
	RSS = null;
});
/**
 * If mainwindow doesn't exist, make it.
 */
app.on('activate', () => {
	if (!mainWindow) {
		mainWindow = createMainWindow();
	}
});
/**
 * @description Make sure to not add torrents that are already in the database / downloaded
 * @param torrent {object} - the torrent object to be checked
 * @param callback - The callback.
 */
function ignoreDupeTorrents(torrent, callback) {
	let db = new PouchDB(require('path').join(app.getPath('userData'), 'dbTor').toString());
	db.get(torrent.link)
				.then(doc => {
					if (doc === null) {
						db.put({
							_id: torrent.link,
							magnet: torrent.link,
							title: torrent.title,
							tvdbID: torrent['tv:show_name']['#'],
							airdate: torrent.pubDate,
							downloaded: false
						}).then(() => {
							db.close();
							callback();
						}).catch(err => {
							if (err) {
								throw err;
							}
						});
					} else if (doc.downloaded === true) {
						db.close();
						callback('dupe');
					} else if (doc.downloaded === false) {
						db.close();
						callback();
					}
				})
				.catch(err => {
					if (err.status === 404) {
						callback();
					} else if (err.status !== 404) {
						throw err;
					}
				});
}
/**
 * @description Get the ShowRSS URI from the DB.
 * @param callback - Callbacks
 */
function getRSSURI(callback) {
	storage.get('showRSS', (err, data) => {
		if (err) {
			throw err;
		}
		if (_.isEmpty(data) === false) {
			callback(data.showRSSURI);
		} else {
			callback('');
		}
	});
}
/**
 * @description Watch the ShowRSS feed for new releases, and notify user when there is one.
 */
function watchRSS() {
	let uri;
	getRSSURI(cb => {
		uri = cb;
		if (cb === '') {
			mainWindow.webContents.executeJavaScript(`notify('Put your ShowRSS URL into the downloader!', 'showrss.info')`);
		} else {
			RSS = new RSSParse(uri);
			RSS.on('data', data => {
				ignoreDupeTorrents(data, dupe => {
					if (dupe) {
						console.log('already DL');
					} else {
						mainWindow.webContents.executeJavaScript(`notify('New Download Available', '${data.title.toString()}')`);
					}
				});
			});
		}
	});
}

ipc.on('dldone', (event, data) => {
	console.log(data);
	mainWindow.webContents.executeJavaScript(`notify('Download Finished', '${data}' )`);
});

/**
 * Make the main window.
 */
app.on('ready', () => {
	mainWindow = createMainWindow();
	init();
	watchRSS();
	onBoard();
	console.timeEnd('init');
});
