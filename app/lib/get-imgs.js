/**
 * @author William Blythe
 * @fileoverview The class that gets TVDB info from files
 */
/**
 * @module Get Images
 */
/* eslint-disable no-unused-vars */
/* eslint-disable max-nested-callbacks */
require('dotenv').config({path: `${__dirname}/../.env`});
const events = require('events');
const bugsnag = require('bugsnag'); // Catch bugs / errors
const isRenderer = require('is-electron-renderer');
const TVDB = require('node-tvdb');
// Const storage = require('electron-json-storage');
const parser = require('episode-parser');
const dir = require('node-dir');
const _ = require('underscore');
const path = require('path');

const tvdb = new TVDB(process.env.TVDB_KEY);
const POLL_INTERVAL = 100;
let version;
// Make sure that version can be got from both render and main process
if (isRenderer) {
	version = require('electron').remote.app.getVersion();
} else {
	version = require('electron').app.getVersion();
}

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
/**
 * Class for getting images from files in the download directory
 */
class GetImgs extends events.EventEmitter {
	/**
	 * The constructor for {@link GetImgs}
	 * @param {string} directory - a string with path to downloaded files
	 */
	constructor(directory) {
		super();
		this._directory = directory;
		this._files = [];
		this._ops = [];
		this._operation = 0;
		this.files()
			.then(() => {
				this._loop();
			});
	}

	/**
	 * Promise for getting a list of files in {@link GetImgs}
	 * @returns {Promise.<void>}
	 */
	async files() {
		const ret = await this.findFiles();
		return ret.files;
	}

	/**
	 * Get all the files in {@link GetImgs#files}
	 * @returns {Promise}
	 */
	findFiles() {
		return new Promise(resolve => {
			dir.files(this._directory, (err, files) => {
				if (err) {
					bugsnag.notify(new Error(err), {
						subsystem: {
							name: 'Get Imgs Class'
						}
					});
				}
				files.sort();
				this._files = files;
				this._files = _.filter(this._files, isPlayable);
				console.log(this._files);
				resolve({files: this._files});
			});
		});
	}

	/**
	 * Loop through each file in {@link GetImgs#findFiles}
	 * @returns {Promise.<void>}
	 */
	async _loop() {
		if (this._ops.length === 0) {
			this._timer = setTimeout(() => {
				if (this._operation <= this._files.length - 1) {
					this._ops.push(this._operation);
					setImmediate(() => this._loop());
				}
			}, POLL_INTERVAL);
			return;
		}
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
					} else if (this.tvelem === null) {
						this._operation++;
						setImmediate(() => this._loop());
					} else {
						this._operation++;
						setImmediate(() => this._loop());
					}
				}
			}
		} catch (err) {
			bugsnag.notify(new Error(err), {
				subsystem: {
					name: 'Get Imgs Class'
				}
			});
			setImmediate(() => this._loop());
		}
	}

	/**
	 * Make an api call to TVDB to get the series info from its name.
	 */
	_getSeriesByName() {
		tvdb.getSeriesByName(this.tvelem.show)
			.then(res => {
				console.log(this.tvelem.show);
				this._series = res;
				this._getEpisodes();
			})
			.catch(err => {
				if (err.message === 'Resource not found') {
					setImmediate(() => this._loop());
				} else {
					bugsnag.notify(new Error(err), {
						subsystem: {
							name: 'Get Imgs Class'
						}
					});
				}
			});
	}

	/**
	 * Get episodes from the series id gotten in {@link GetImgs#_getSeriesByName}
	 */
	_getEpisodes() {
		tvdb.getEpisodesBySeriesId(this._series[0].id)
			.then(res => {
				this._episodes = res;
				this._findRightEp();
			})
			.catch(err => {
				if (err.message === 'Resource not found') {
					setImmediate(() => this._loop());
				} else {
					bugsnag.notify(new Error(err), {
						subsystem: {
							name: 'Get Imgs Class'
						}
					});
				}
			});
	}

	/**
	 * Get the right episode from {@link GetImgs#_getEpisodes}
	 */
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
	m8.on('episode', data => {
		console.log(data);
	});
}
