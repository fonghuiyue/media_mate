'use strict';
console.time('init');
require('dotenv').config({path: `${__dirname}/.env`});

import electron, {Menu, dialog, ipcMain as ipc, shell} from 'electron';
import path from 'path';
import os from 'os';
import {autoUpdater} from 'electron-updater';
import fs from 'fs-extra';
import tableify from 'tableify';
import _ from 'underscore';
import isDev from 'electron-is-dev';
import bugsnag from 'bugsnag';
import openAboutWindow from 'about-window';
import moment from 'moment';
import MongoClient from 'mongodb';
import {RSSParse} from './lib/rssparse';
import TVDB from 'node-tvdb';
import {init, getMenuItem} from './menu';
require('electron-debug')();
const tvdb = new TVDB(process.env.TVDB_KEY);
const f = require('util').format;
const windowStateKeeper = require('electron-window-state');
let eNotify;
let notDL = 0;
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
// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// prevent window being garbage collected
let mainWindow;
/**
 * Catch any uncaught errors and report them.
 */
process.on('uncaughtError', err => {
	bugsnag.notify(err);
	console.log('ERROR! The error is: ' + err || err.stack);
});
/**
 * Called from renderer process when an error occurs
 */
ipc.on('errorInWindow', (event, data) => {
	// bugsnag.notify(data);
	console.log(data);
	// console.log('ERROR! The error is: ' + data);
});
/**
 * Called when window closed.
 */
function onClosed() {
	// dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}
/**
 * Called on app ready
 * @returns {BrowserWindow}
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
		backgroundColor: '#ffffff'
	});
	win.once('ready-to-show', () => {
		win.show();
		console.timeEnd('init');
	});
	mainWindowState.manage(win);
	win.loadURL(`file://${__dirname}/index.html`);
	win.on('closed', onClosed);
	win.on('unresponsive', function () {
		console.log("I've frozen. Sorry about that.")
	});
	win.on('responsive', function () {
		console.log("I've unfrozen. Sorry.")
	});
	win.webContents.on('crashed', function (e, killed) {
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
				if (docs !== null) {
					if (docs.downloaded === true) {
						db.close();
						callback('dupe');
					} else if (docs.downloaded === false) {
						notDL++;
						db.close();
						callback();
					}
				} else {
					collection.insertOne({
						magnet: torrent.link,
						title: torrent.title,
						tvdbID: torrent['tv:show_name']['#'],
						airdate: torrent.pubDate,
						downloaded: false
					})
						.then((err, res) => {
							if (err) {
								throw err;
							}
							notDL++;
							db.close();
							callback();
						});
				}
			});
		}
	});
}
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

function watchRSS() {
	let uri;
	getRSSURI(cb => {
		uri = cb;
		if (cb !== '') {
			const RSS = new RSSParse(uri);
			RSS.on('data', data => {
				ignoreDupeTorrents(data, dupe => {
					if (!dupe) {
						eNotify.notify({title: 'New Download Available', text: data.title});
					} else {
						console.log('already DL');
					}
				});
			});
		} else {
			eNotify.notify({title: 'Put your ShowRSS URL into the downloader!', description: 'showrss.info'});
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
