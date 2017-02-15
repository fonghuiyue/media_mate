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
/**
 * The electron app instance
 */
const app = electron.app;
bugsnag.register('03b389d77abc2d10136d8c859391f952', {appVersion: app.getVersion(), sendCode: true});
let win;
/**
 * Autoupdater on update available
 * @
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
ipc.on('errorInWindow', function(event, data){
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
 * Called on app open
 * @returns {BrowserWindow}
 */
function createMainWindow() {
	const win = new electron.BrowserWindow({
		width: 600,
		height: 400
	});

	win.loadURL(`file://${__dirname}/index.html`);
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
/**
 * Make the main window.
 */
app.on('ready', () => {
	mainWindow = createMainWindow();
});
