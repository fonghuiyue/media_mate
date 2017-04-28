const test = require('tape');
const setup = require('./setup');

test.onFinish(setup.deleteTestDataDir);
test('app runs', function (t) {
	t.timeoutAfter(10e3);
	setup.resetTestDataDir();
	const app = setup.createApp();
	setup.waitForLoad(app, t)
		.then(() => app.browserWindow.focus())
		.then(() => setup.screenshotCreateOrCompare(app, t, 'app-index'))
		.then(() => setup.endTest(app, t),
			err => setup.endTest(app, t, err || 'error'));
});
require('./testdownloader');
require('./testviewer');
