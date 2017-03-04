'use strict';
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
import {RSSParse} from './lib/rssparse';
import MongoClient from 'mongodb';

const windowStateKeeper = require('electron-window-state');
let eNotify;
const url = 'mongodb://localhost:27017/media_mate';
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
		show: false
	});
	mainWindowState.manage(win);
	win.loadURL(`file://${__dirname}/index.html`);
	win.once('ready-to-show', () => {
		win.show();
	});
	win.on('closed', onClosed);

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
	const collection = db.collection('torrents');
	if (collection.find() !== null) {
		collection.findOne({magnet: torrent.link}, (err, docs) => {
			if (docs !== null) {
				if (docs.downloaded === true) {
					callback('dupe');
					db.close();
				} else if (docs.downloaded === false) {
					callback();
					db.close();
				}
			} else {
				callback();
			}
		});
	}
	})
}
function getRSSURI(callback) {
	MongoClient.connect(url, (err, db) => {
		const collection = db.collection('uri');
		if (collection.find() !== undefined || collection.find() !== null) {
			collection.find().toArray((err, docs) => {
				// console.log(docs);
				if (docs.length > 0) {
					callback(docs[0].showRSSURI);
					db.close();
				}	else {
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
	const RSS = new RSSParse(uri);
	RSS.on('data', data => {
		ignoreDupeTorrents(data, dupe => {
			if (!dupe) {
				eNotify.notify({title: 'New Download Available', text: data.title});
			} else {
				console.log('already DL')
			}
		});
		})
	});
}

/**
 * Make the main window.
 */
app.on('ready', () => {
	mainWindow = createMainWindow();
	eNotify = require('electron-notify');
	watchRSS();
});
const template = [
	{
		label: 'File',
		submenu: [
			{
				label: 'Homepage',
				click: () => {
					win.loadURL(`file://${__dirname}/index.html`);
				}
			}
		]
	},
	{
		label: 'Edit',
		submenu: [
			{
				role: 'cut'
			},
			{
				role: 'copy'
			},
			{
				role: 'paste'
			}
		]
	},
	{
		label: 'View',
		submenu: [
			{
				role: 'reload'
			},
			{
				role: 'forcereload'
			},
			{
				type: 'separator'
			},
			{
				type: 'separator'
			},
			{
				role: 'togglefullscreen'
			}
		]
	},
	{
		role: 'window',
		submenu: [
			{
				role: 'minimize'
			},
			{
				role: 'close'
			}
		]
	},
	{
		role: 'help',
		submenu: [
			{
				label: 'Learn More about Electron',
				click() {
					require('electron').shell.openExternal('http://electron.atom.io');
				}
			}, {
				label: 'About',
				click: () => openAboutWindow({
					icon_path: path.join(__dirname, 'icon.png'), // eslint-disable-line camelcase // temp icon till i make one
					bug_report_url: 'https://github.com/willyb321/media_mate/issues', // eslint-disable-line camelcase
					homepage: 'https://github.com/willyb321/elite-journal'
				})
			}
		]
	}
];

if (process.platform === 'darwin') {
	template.unshift({
		label: app.getName(),
		submenu: [
			{
				role: 'about'
			},
			{
				type: 'separator'
			},
			{
				role: 'services',
				submenu: []
			},
			{
				type: 'separator'
			},
			{
				role: 'hide'
			},
			{
				role: 'hideothers'
			},
			{
				role: 'unhide'
			},
			{
				type: 'separator'
			},
			{
				role: 'quit'
			}
		]
	});
	// Edit menu.
	template[1].submenu.push(
		{
			type: 'separator'
		}
	);
	// Window menu.
	template[3].submenu = [
		{
			label: 'Close',
			accelerator: 'CmdOrCtrl+W',
			role: 'close'
		},
		{
			label: 'Minimize',
			accelerator: 'CmdOrCtrl+M',
			role: 'minimize'
		},
		{
			label: 'Zoom',
			role: 'zoom'
		},
		{
			type: 'separator'
		},
		{
			label: 'Bring All to Front',
			role: 'front'
		}
	];
}
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
