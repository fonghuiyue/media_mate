const test = require('tape');
const setup = require('./setup');
const config = require('./config');
test('downloader', t => {
	setup.resetTestDataDir();
	t.timeoutAfter(30e3);
	const app = setup.createApp();
	setup.waitForLoad(app, t, {online: true})
		.then(() => app.browserWindow.focus())
		.then(() => app.client.waitUntilTextExists('#downloader', 'Go to Downloader'))
		.then(() => app.client.moveToObject('#downloader'))
		.then(() => setup.wait())
		.then(() => app.client.click('#downloader'))
		.then(() => setup.wait(6e3))
		.then(() => {
			app.electron.clipboard.writeText('http://showrss.info/user/3414.rss?magnets=true&namespaces=true&name=clean&quality=null&re=no')
				.electron.clipboard.readText().then(function (clipboardText) {
					app.client.moveToObject('#rss')
						.then(() => setup.wait())
						.then(() => app.client.click('#rss'))
						.then(() => setup.wait())
						.then(() => app.client.element('#rss').setValue(clipboardText))
						.then(() => app.client.keys(['Enter']))
						.then(() => app.client.keys(['Enter']))
						.then(() => setup.screenshotCreateOrCompare(app, t, 'downloader'))
						.then(() => app.webContents.executeJavaScript('insertDlPath()'))
						.then(() => setup.copy(`${__dirname}/resources/top.gear.s24e07.hdtv.x264-mtb.mp4`, `${config.TEST_DIR_DOWNLOAD}/top.gear.s24e07.hdtv.x264-mtb.mp4`))
						.then(() => setup.endTest(app, t),
							err => setup.endTest(app, t, err || 'error'));
				});
		});
});
