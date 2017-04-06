/**
 * @author William Blythe
 * @fileoverview The file that allows viewing of downloaded media
 */
/**
 * @module Viewer
 */
/* eslint-disable no-unused-vars */
/* eslint-disable max-nested-callbacks */
require('dotenv').config({path: `${__dirname}/.env`});
require('events').EventEmitter.prototype._maxListeners = 1000;
const Getimg = require(require('path').join(__dirname, 'lib', 'get-imgs.js')).GetImgs;
const path = require('path');
const version = require('electron').remote.app.getVersion();
const fs = require('fs-extra');
const TVDB = require('node-tvdb');
const storage = require('electron-json-storage');
const bugsnag = require('bugsnag');
const moment = require('moment');
const _ = require('underscore');
const parser = require('episode-parser');
const dir = require('node-dir');

const tvdb = new TVDB(process.env.TVDB_KEY);
const vidProgressthrottled = _.throttle(vidProgress, 1000);

bugsnag.register('03b389d77abc2d10136d8c859391f952', {appVersion: version, sendCode: true});
/**
 * Add a context menu so that we can reset time watched.
 */
require('electron-context-menu')({
	prepend: (params, browserWindow) => [{
		label: 'Reset Time Watched',
		click: () => {
			resetTime(params);
		},
		// Only show it when right-clicking images
		visible: params.mediaType === 'image'
	}]
});

const progOpt = {
	template: 3,
	parent: '#media',
	start: true
};
let indeterminateProgress;
/**
 * Make sure that the window is loaded.
 */
window.onload = () => {
	indeterminateProgress = new Mprogress(progOpt); // eslint-disable-line no-undef
	findDL();
};
/**
 * Return true if file is playable
 * @param file {string} - the filename with extension
 * @returns {boolean} - if its playable or not.
 */
function isPlayable(file) {
	return isVideo(file);
}
/**
 * Turn str into Title Case and return it.
 * @param str {string} - the string to transform
 * @returns {string} - Title Cased string
 */
function titleCase(str) {
	return str.split(' ')
		.map(i => i[0].toUpperCase() + i.substr(1).toLowerCase())
		.join(' ');
}

/**
 * Checks whether the file path is playable video
 * @param file {string} - the path to the file
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
 * @param file  {string} - the file name / path
 * @returns {string} - extension of the file.
 */
function getFileExtension(file) {
	const name = typeof file === 'string' ? file : file.name;
	return path.extname(name).toLowerCase();
}
/**
 * Get the path for downloads.
 * @returns {Promise.<string>}
 */
function getPath() {
	return new Promise(resolve => {
		storage.get('path', (err, data) => {
			if (err) {
				throw err;
			}
			if (_.isEmpty(data) === false) {
				resolve({path: data.path});
			} else {
				const dir = path.join(require('os').homedir(), 'media_mate_dl');
				fs.ensureDir(dir, err => {
					if (err) {
						bugsnag.notify(new Error(err), {
							subsystem: {
								name: 'Viewer'
							}
						});
					}
					resolve({path: dir});
				});
			}
		});
	});
}
/**
 * Get images for each of the downloaded files.
 */
async function getImgs() {
	const mediadiv = document.getElementById('media');
	const medianodes = mediadiv.childNodes;
	let dlpath = await getPath();
	console.log(dlpath);
	dlpath = dlpath.path.toString();
	const getimgs = new Getimg(dlpath);
	getimgs.on('episode', data => {
		console.log('ep');
		let elempath = data[2];
		let elem = data[0];
		let tvelem = data[1];
		medianodes.forEach((img, ind) => {
			if (img.id === elempath) {
				tvdb.getEpisodeById(elem.id)
					.then(res => {
						if (ind === medianodes.length - 1) {
							indeterminateProgress.end();
							document.getElementById('Loading').style.display = 'none';
						}
						if (res.filename !== '') {
							img.children[0].src = `http://thetvdb.com/banners/${res.filename}`;
							img.children[0].parentNode.style.display = 'inline-block';
						} else if (res.filename === '') {
							img.children[0].src = `file:///${__dirname}/404.png`;
							img.children[0].parentNode.style.display = 'inline-block';
						}
					})
					.catch(err => {
						console.log(err);
						bugsnag.notify(new Error(err), {
							subsystem: {
								name: 'Viewer'
							}
						});
					});
			}
		});
	});
}
/**
 * Called when a video is finished.
 * @param e {object} - the event.
 */
function vidFinished(e) {
	const filename = this.getAttribute('data-file-name');
	storage.get(filename, (err, data) => {
		if (err) {
			bugsnag.notify(new Error(err), {
				subsystem: {
					name: 'Viewer'
				}
			});
		}
		storage.set(filename, {file: filename, watched: true, time: this.currentTime}, err => {
			if (err) {
				bugsnag.notify(new Error(err), {
					subsystem: {
						name: 'Viewer'
					}
				});
			}
		});
	});
}
/**
 * On video metadata loaded, add it to the JSON.
 * @param e {object} - event.
 */
function handleVids(e) {
	const filename = this.getAttribute('data-file-name');
	storage.get(filename, (err, data) => {
		if (err) {
			bugsnag.notify(new Error(err), {
				subsystem: {
					name: 'Viewer'
				}
			});
		}
		if (_.isEmpty(data) === true) {
			storage.set(filename, {file: filename, watched: false, time: this.currentTime}, err => {
				if (err) {
					throw err;
				}
			});
		} else {
			this.currentTime = data.time;
		}
	});
}
/**
 * Reset the time watched.
 * @param params {object} - the x / y of the image.
 */
function resetTime(params) {
	const filename = document.elementFromPoint(params.x, params.y).parentNode.getAttribute('data-store-name');
	console.log(document.elementFromPoint(params.x, params.y).parentNode);
	storage.remove(filename, err => {
		if (err) {
			throw err;
		}
	});
}
/**
 * On time update in the video, throttled for every few seconds.
 * @param e {object} - video event.
 */
function vidProgress(e) {
	const filename = this.getAttribute('data-file-name');
	storage.get(filename, (err, data) => {
		if (err) {
			bugsnag.notify(new Error(err), {
				subsystem: {
					name: 'Viewer'
				}
			});
		}
		if (_.isEmpty(data) === false) {
			storage.set(filename, {file: filename, watched: false, time: this.currentTime}, err => {
				if (err) {
					throw err;
				}
			});
		} else {
			console.log('dunno');
		}
	});
}
/**
 * Add and remove event handlers for the stop video button
 */
function handleEventHandlers() {
	const videodiv = document.getElementById('video');
	videodiv.removeChild(videodiv.firstElementChild);
	document.getElementById('stopvid').removeEventListener('click', handleEventHandlers);
}

/**
 * Get files downloaded and process them to the DOM.
 */
async function findDL() {
	const path = await getPath();
	dir.files(path.path, (err, files) => {
		if (err) {
			throw err;
		}
		const mediadiv = document.getElementById('media');
		const videodiv = document.getElementById('video');
		files = _.filter(files, isPlayable);
		files.sort();
		for (let i = 0; i < files.length; i++) {
			const parsedName = parser(files[i].replace(/^.*[\\/]/, ''));
			if (parsedName !== null) {
				const figelem = document.createElement('figure');
				const figcap = document.createElement('figcaption');
				const imgelem = document.createElement('img');
				parsedName.show = titleCase(parsedName.show);
				figelem.addEventListener('click', () => {
					window.scrollTo(0, 0);
					const video = document.createElement('video');
					video.src = files[i];
					video.setAttribute('data-file-name', `${parsedName.show.replace(' ', '')}S${parsedName.season}E${parsedName.episode}`);
					video.autoplay = true;
					video.controls = true;
					video.addEventListener('loadedmetadata', handleVids, false);
					video.addEventListener('ended', vidFinished, false);
					video.addEventListener('timeupdate', vidProgressthrottled, false);
					document.getElementById('stopvid').addEventListener('click', handleEventHandlers);
					if (videodiv.childElementCount > 0) {
						videodiv.replaceChild(video, videodiv.firstElementChild);
					} else {
						videodiv.appendChild(video);
					}
				});
				imgelem.src = `file:///${__dirname}/loading.png`;
				figelem.style.display = 'inline-block';
				figelem.id = files[i].replace(/^.*[\\/]/, '');
				figelem.setAttribute('data-file-name', files[i].replace(/^.*[\\/]/, ''));
				figelem.setAttribute('data-store-name', `${parsedName.show.replace(' ', '')}S${parsedName.season}E${parsedName.episode}`);
				imgelem.title = `${parsedName.show}: S${parsedName.season}E${parsedName.episode}`;
				imgelem.style.width = '400px';
				imgelem.style.height = '225px';
				figcap.innerText = `${parsedName.show}: S${parsedName.season}E${parsedName.episode}`;
				figelem.appendChild(imgelem);
				figelem.appendChild(figcap);
				mediadiv.appendChild(figelem);
			}
		}
		getImgs();
	});
}
