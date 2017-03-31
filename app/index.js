'use strict';
/* eslint-disable no-unused-vars */
console.time('init');
require('dotenv').config({path: `${__dirname}/.env`});

import electron, {Menu, dialog, ipcMain as ipc, shell} from 'electron';
import {autoUpdater} from 'electron-updater';
import fs from 'fs-extra';
import _ from 'underscore';
import isDev from 'electron-is-dev';
import bugsnag from 'bugsnag';
import moment from 'moment';
import MongoClient from 'mongodb';
import {RSSParse} from './lib/rssparse';
import {init, getMenuItem} from './menu.js';
require('electron-debug')();
const f = require('util').format;
const windowStateKeeper = require('electron-window-state');
let eNotify;
const user = process.env.DB_USER;
const password = process.env.DB_PWD;
const dburi = process.env.DB_URL;
const url = f('mongodb://%s:%s@%s/media_mate?ssl=true&replicaSet=SDD-Major-shard-0&authSource=admin',
	user, password, dburi);
/**
 * The electron app instance
 */
const app = electron.app;
bugsnag.register('03b389d77abc2d10136d8c859391f952', {appVersion: app.getVersion(), sendCode: true});
let win;
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
	win.loadURL(`file:///${__dirname}/index.html`);
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
 * @param err - The error to be handled.
 */
process.on('uncaughtError', err => {
	bugsnag.notify(err);
	console.log('ERROR! The error is: ' + err || err.stack);
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
		defaultWidth: 600,
		defaultHeight: 400
	});
	win = new electron.BrowserWindow({
		x: mainWindowState.x,
		y: mainWindowState.y,
		width: mainWindowState.width,
		height: mainWindowState.height,
		show: false,
		backgroundColor: '#eeeeee'
	});
	win.once('ready-to-show', () => {
		win.show();
		console.timeEnd('init');
	});
	mainWindowState.manage(win);
	win.loadURL(`file://${__dirname}/index.html`);
	win.on('closed', onClosed);
	win.on('unresponsive', () => {
		console.log('I\'ve frozen. Sorry about that.');
	});
	win.on('responsive', () => {
		console.log('I\'ve unfrozen. Sorry.');
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
	return win;
}
/**
 * When all windows are closed, quit the app.
 */
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
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
 * @param torrent - the torrent object to be checked
 * @param callback - The callback.
 */
function ignoreDupeTorrents(torrent, callback) {
	MongoClient.connect(url, (err, db) => {
		if (err) {
			throw err;
		}
		const collection = db.collection('torrents');
		if (collection.find() !== null) {
			collection.findOne({magnet: torrent.link}, (err, docs) => {
				if (err) {
					throw err;
				}
				if (docs === null) {
					collection.insertOne({
						magnet: torrent.link,
						title: torrent.title,
						tvdbID: torrent['tv:show_name']['#'],
						airdate: torrent.pubDate,
						downloaded: false
					})
						.then(err => {
							if (err) {
								throw err;
							}
							db.close();
							callback();
						});
				} else if (docs.downloaded === true) {
					db.close();
					callback('dupe');
				} else if (docs.downloaded === false) {
					db.close();
					callback();
				}
			});
		}
	});
}
/**
 * @description Get the ShowRSS URI from the DB.
 * @param callback - Callbacks
 */
function getRSSURI(callback) {
	MongoClient.connect(url, (err, db) => {
		if (err) {
			throw err;
		}
		const collection = db.collection('uri');
		if (collection.find() !== undefined || collection.find() !== null) {
			collection.find().toArray((err, docs) => {
				if (err) {
					throw err;
				}
				if (docs.length > 0) {
					callback(docs[0].showRSSURI);
					db.close();
				} else {
					callback('');
					db.close();
				}
			});
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
			eNotify.notify({title: 'Put your ShowRSS URL into the downloader!', description: 'showrss.info'});
		} else {
			const RSS = new RSSParse(uri);
			RSS.on('data', data => {
				ignoreDupeTorrents(data, dupe => {
					if (dupe) {
						console.log('already DL');
					} else {
						eNotify.notify({title: 'New Download Available', text: data.title});
					}
				});
			});
		}
	});
}

ipc.on('dldone', (event, data) => {
	eNotify.notify({title: 'Download Finished', text: data});
});

/**
 * Make the main window.
 */
app.on('ready', () => {
	mainWindow = createMainWindow();
	init();
	eNotify = require('electron-notify');
	watchRSS();
});
