const events = require('events');
const FeedParser = require('feedparser');
const request = require('request'); // For fetching the feed
const bugsnag = require('bugsnag'); // Catch bugs / errors
const isRenderer = require('is-electron-renderer');

let version;
// Make sure that version can be got from both render and main process
isRenderer ? version = require('electron').remote.app.getVersion() : // eslint-disable-line no-unused-expressions
version = require('electron').app.getVersion();

bugsnag.register('03b389d77abc2d10136d8c859391f952', {appVersion: version, sendCode: true});

class RSSParse extends events.EventEmitter {
	constructor(rssFeed) {
		super(rssFeed);
		this.rssFeed = rssFeed;
		this._rssContent = [];
		this.reqFeed();
	}

	reqFeed() {
		const rssThis = this;
		const req = request(this.rssFeed);
		const feedparser = new FeedParser();
		req.on('error', err => {
			bugsnag.notify(new Error(err), {
				subsystem: {
					name: 'RSS Parser'
				}
			});
		});

		req.on('response', function (res) {
			const stream = this; // `this` is `req`, which is a stream

			if (res.statusCode === 200) {
				stream.pipe(feedparser);
				feedparser.on('error', err => {
					bugsnag.notify(new Error(err), {
						subsystem: {
							name: 'RSS Parser'
						}
					});
				});

				feedparser.on('readable', function () {
					// This is where the action is!
					const stream = this; // `this` is `feedparser`, which is a stream
					// **NOTE** the "meta" is always available in the context of the feedparser instance
					const meta = this.meta; // eslint-disable-line no-unused-vars
					let item;

					while (item === stream.read()) {
						// Console.log(item);
						rssThis.emit('data', item);
					}
				});
			} else {
				this.emit('error', new Error('Bad status code'));
			}
		});
	}
}
module.exports = {
	RSSParse
};
