const FeedParser = require('feedparser');
const request = require('request'); // for fetching the feed
const events = require('events');

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
		const rssContent = [];
		req.on('error', err => {

		});

		req.on('response', function (res) {
			const stream = this; // `this` is `req`, which is a stream

			if (res.statusCode !== 200) {
				this.emit('error', new Error('Bad status code'));
			} else {
				stream.pipe(feedparser);
				const RSS = [];
				feedparser.on('error', error => {
					// always handle errors
				});

				feedparser.on('readable', function () {
					// This is where the action is!
					const stream = this; // `this` is `feedparser`, which is a stream
					const meta = this.meta; // **NOTE** the "meta" is always available in the context of the feedparser instance
					let item;

					while (item = stream.read()) {
						console.log(item);
						rssThis.emit('data', item);
					}
				});
			}
		});
	}
}
module.exports = {
	RSSParse
};
