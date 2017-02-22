module.exports = [
	{
		label: 'File',
		submenu: [
			{

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
				click () {
					require('electron').shell.openExternal('http://electron.atom.io')
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
	]
}
