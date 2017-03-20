module.exports = {
	init,
	getMenuItem
};
const electron = require('electron');
const {shell} = require('electron');
const {BrowserWindow} = require('electron');
const path = require('path');
const openAboutWindow = require('about-window').default;

const app = electron.app;
let win;
let menu;

function init() {
	menu = electron.Menu.buildFromTemplate(getMenuTemplate());
	electron.Menu.setApplicationMenu(menu);
	win = BrowserWindow.getAllWindows()[0];
}

function getMenuItem(label) {
	for (let i = 0; i < menu.items.length; i++) {
		const menuItem = menu.items[i].submenu.items.find(item => {
			return item.label === label;
		});
		if (menuItem) {
			return menuItem;
		}
	}
}

function getMenuTemplate() {
	const template = [
		{
			label: 'File',
			submenu: [
				{
					label: 'Homepage',
					click: () => {
						win.loadURL(`file://${__dirname}/index.html`);
					}
				},
				{
					label: 'Downloader',
					click: () => {
						win.loadURL(`file://${__dirname}/downloader.html`);
					}
				},
				{
					label: 'Viewer',
					click: () => {
						win.loadURL(`file://${__dirname}/viewer.html`);
					}
				},
				{
					label: 'Streamer',
					click: () => {
						win.loadURL(`file://${__dirname}/streamer.html`);
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
						shell.openExternal('http://electron.atom.io');
					}
				}, {
					label: 'About',
					click: () => openAboutWindow({
						icon_path: path.join(__dirname, 'icon.png'), // eslint-disable-line camelcase
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
	return template;
}
