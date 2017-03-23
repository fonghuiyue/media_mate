/* eslint-disable no-unused-vars */
/* eslint-disable max-nested-callbacks */
require('dotenv').config({path: `${__dirname}/../.env`});
const events = require('events');
const FeedParser = require('feedparser');
const request = require('request'); // For fetching the feed
const bugsnag = require('bugsnag'); // Catch bugs / errors
const isRenderer = require('is-electron-renderer');
const TVDB = require('node-tvdb');
// Const storage = require('electron-json-storage');
const parser = require('episode-parser');
const dir = require('node-dir');
const _ = require('underscore');
const path = require('path');

const tvdb = new TVDB(process.env.TVDB_KEY);
const POLL_INTERVAL = 200;
let version;
// Make sure that version can be got from both render and main process
// if (isRenderer) {
// 	version = require('electron').remote.app.getVersion();
// } else {
// 	version = require('electron').app.getVersion();
// }

bugsnag.register('03b389d77abc2d10136d8c859391f952', {sendCode: true});
/**
 * Return true if file is playable
 * @param file - the filename with extension
 * @returns {boolean} - if its playable or not.
 */
function isPlayable(file) {
	return isVideo(file);
}

/**
 * Checks whether the file path is playable video
 * @param file - the path to the file
 * @returns {boolean}
 */
function isVideo(file) {
	return [
		'.avi',
		'.m4v',
		'.mkv',
		'.mov',
		'.mp4',
		'.mpg',
		'.ogv',
		'.webm',
		'.wmv'
	].includes(getFileExtension(file));
}
/**
 * Get the extension of {file}
 * @param file - the file name / path
 * @returns {string} - extension of the file.
 */
function getFileExtension(file) {
	const name = typeof file === 'string' ? file : file.name;
	return path.extname(name).toLowerCase();
}

class GetImgs extends events.EventEmitter {
	constructor(directory) {
		super();
		this._directory = directory;
		this._files = [];
		this._ops = [];
		this._op = null;
		this._timer = null;
		this._die = false;
		this._operation = 0;
		this.files()
			.then(() => {
				this._loop();
			});
	}
	async files() {
		const ret = await this.findFiles();
		return ret.files;
	}
	findFiles() {
		return new Promise(resolve => {
			dir.files(this._directory, (err, files) => {
				if (err) {
					bugsnag.notify(err);
				}
				files.sort();
				this._files = files;
				this._files = _.filter(this._files, isPlayable);
				console.log(this._files);
				resolve({files: this._files});
			});
		});
	}
	async _loop() {
		this._op = null;
		if (this._ops.length === 0) {
			this._timer = setTimeout(() => {
				if (this._operation <= this._files.length - 1) {
					this._ops.push(this._operation);
					setImmediate(() => this._loop());
				}
			}, POLL_INTERVAL);
			return;
		}

		this._op = this._ops.shift();
		try {
			if (this._operation <= this._files.length - 1) {
				let elem = this._files[this._operation];
				console.log(this._operation, elem);
				if (elem !== undefined) {
					elem = elem.replace(/^.*[\\/]/, '');
					this.elempath = elem;
					this.tvelem = parser(elem);
					if (_.has(this.tvelem, 'show') === true) {
						this._getSeriesByName();
						this._operation++;
					}
				}
			}
		} catch (err) {
			bugsnag.notify(new Error(err));
			setImmediate(() => this._loop());
		}
	}
	_getSeriesByName() {
		tvdb.getSeriesByName(this.tvelem.show)
			.then(res => {
				console.log(this.tvelem.show);
				this._series = res;
				this._getEpisodes();
			})
			.catch(err => {
				bugsnag.notify(new Error(err));
			});
	}
	_getEpisodes() {
		tvdb.getEpisodesBySeriesId(this._series[0].id)
			.then(res => {
				this._episodes = res;
				this._findRightEp();
			})
			.catch(err => {
				bugsnag.notify(new Error(err));
			});
	}
	_findRightEp() {
		this._episodes.forEach(elem => {
			if (_.isMatch(elem, {airedEpisodeNumber: this.tvelem.episode}) === true && _.isMatch(elem, {airedSeason: this.tvelem.season}) === true) {
				this.emit('episode', [elem, this.tvelem, this.elempath]);
				setImmediate(() => this._loop());
			}
		});
	}
}

module.exports = {
	GetImgs,
	getFileExtension,
	isVideo,
	isPlayable
};
if (!module.parent) {
	let m8 = new GetImgs('/Users/willb/media_matedl');
	// Console.log(m8);
	m8.on('episode', data => {
		console.log(data);
	});
}
