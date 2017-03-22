/* eslint-disable no-unused-vars */
/* eslint-disable max-nested-callbacks */
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

let version;
// Make sure that version can be got from both render and main process
// if (isRenderer) {
// 	version = require('electron').remote.app.getVersion();
// } else {
// 	version = require('electron').app.getVersion();
// }

// bugsnag.register('03b389d77abc2d10136d8c859391f952', {appVersion: version, sendCode: true});
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
	}
	async files() {
		const ret = await this.findFiles();
		console.log(ret.files);
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
				resolve({files: this._files});
			});
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
	let m8 = new GetImgs('/Users/willb/media_matedl/');
	console.log(m8.files());
}
