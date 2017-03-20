require('dotenv').config({path: `${__dirname}/.env`});
const {dialog} = require('electron').remote;
require('events').EventEmitter.prototype._maxListeners = 1000;
const moment = require('moment');
const parser = require('episode-parser');
const dir = require('node-dir');
const RSSParse = require(require('path').join(__dirname, 'lib', 'rssparse.js')).RSSParse;
const MongoClient = require('mongodb').MongoClient;
const _ = require('underscore');
const f = require('util').format;
const fs = require('fs-extra');
const path = require('path');
const TVDB = require('node-tvdb');
const storage = require('electron-json-storage');
const {app, BrowserWindow} = require('electron');
const bugsnag = require('bugsnag');
const version = require('electron').remote.app.getVersion();

const tvdb = new TVDB(process.env.TVDB_KEY);
const user = process.env.DB_USER;
const password = process.env.DB_PWD;
const dburi = process.env.DB_URL;
const authMechanism = 'DEFAULT';
const vidProgressthrottled = _.throttle(vidProgress, 1000);
const url = f('mongodb://%s:%s@%s/media_mate?ssl=true&replicaSet=SDD-Major-shard-0&authSource=admin',
	user, password, dburi);

bugsnag.register('03b389d77abc2d10136d8c859391f952', {appVersion: version, sendCode: true});

require('electron-context-menu')({
	prepend: (params, browserWindow) => [{
		label: 'Reset Time Watched',
		click: () => {resetTime(params)},
		// only show it when right-clicking images
		visible: params.mediaType === 'image'
	}]
});


const progOpt = {
	template: 3,
	parent: '#media',
	start: true
};
let indeterminateProgress;
window.onload = () => {
	indeterminateProgress = new Mprogress(progOpt);
	findDL();
};

function isPlayable(file) {
	return isVideo(file);
}

// Checks whether a fileSummary or file path is playable video
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

function getFileExtension(file) {
	const name = typeof file === 'string' ? file : file.name;
	return path.extname(name).toLowerCase();
}

function getPath(callback) {
	storage.get('path', (err, data) => {
		if (err) {
			throw err;
		}
		if (_.isEmpty(data) === false) {
			callback(data.path);
		} else {
			let dir = path.join(require('os').homedir(), 'media_mate_dl')
			fs.ensureDir(dir, err => {
				if (err !== null) {
					callback(dir);
				} else {
					throw err;
				}
			});
		}
	});
}

function getImgs() {
	const mediadiv = document.getElementById('media');
	const medianodes = mediadiv.childNodes;
	getPath(path => {
		dir.files(path, (err, files) => {
			files.sort();
			files = _.filter(files, isPlayable);
			console.log(files);
			files.forEach(elem => {
				elem = elem.replace(/^.*[\\\/]/, '');
				const path = elem;
				const tvelem = parser(elem);
				if (_.has(tvelem, 'show') === true) {
					tvdb.getSeriesByName(tvelem.show)
						.then(res => {
							tvdb.getEpisodesBySeriesId(res[0].id)
								.then(res => {
									res.forEach(elem => {
										if (_.isMatch(elem, {airedEpisodeNumber: tvelem.episode}) === true && _.isMatch(elem, {airedSeason: tvelem.season}) === true) {
											medianodes.forEach((img, ind) => {
												if (img.id === path) {
													tvdb.getEpisodeById(elem.id)
														.then(res => {
															if (ind === medianodes.length - 1) {
																indeterminateProgress.end();
																document.getElementById('Loading').style.display = 'none';
															}
															if (res.filename !== '') {
																img.children[0].src = `http://thetvdb.com/banners/${res.filename}`;
																img.children[0].parentNode.style.display = 'inline-block';

															} else {
																img.children[0].src = `file:///${__dirname}/404.png`;
																img.children[0].parentNode.style.display = 'inline-block';
															}
														})
														.catch(err => {
															console.log(err);
															bugsnag.notify(new Error(err), {
																subsystem: {
																	name: "Viewer"
																}
															});
														});
												}
											});
										}
									});
								})
								.catch(err => {
									console.log(err);
									bugsnag.notify(new Error(err), {
										subsystem: {
											name: "Viewer"
										}
									});
								});
						})
						.catch(err => {
							if (err.message !== 'Resource not found') {
								bugsnag.notify(new Error(err), {
									subsystem: {
										name: "Viewer"
									}
								});
							} else {
								console.log(err)
							}
						});
				}
			});
		});
	});
}

function vidFinished(e) {
	const filename = this.getAttribute('data-file-name');
	storage.get(filename, (err, data) => {
		storage.set(filename, {file: filename, watched: true, time: this.currentTime}, err => {
			if (err) throw err;
		})
	})
}

function handleVids(e) {
	const filename = this.getAttribute('data-file-name');
	storage.get(filename, (err, data) => {
		if (_.isEmpty(data) === true) {
			storage.set(filename, {file: filename, watched: false, time: this.currentTime}, err => {
				if (err) throw err;
			})
		} else {
			this.currentTime = data.time;
		}
	})
}

function resetTime(params) {
	const filename = document.elementFromPoint(params.x, params.y).parentNode.getAttribute('data-file-name');
	console.log(document.elementFromPoint(params.x, params.y).parentNode);
	storage.remove(filename, (err) => {
		if (err) throw err;
	})
}

function vidProgress(e) {
	const filename = this.getAttribute('data-file-name');
	storage.get(filename, (err, data) => {
		if (_.isEmpty(data) === false) {
			storage.set(filename, {file: filename, watched: false, time: this.currentTime}, err => {
				if (err) throw err;
			})
		} else {
			console.log('dunno');
		}
	})
}

function findDL() {
	getPath(path => {
		dir.files(path, (err, files) => {
			if (err) {
				throw err;
			}
			const mediadiv = document.getElementById('media');
			const videodiv = document.getElementById('video');
			files = _.filter(files, isPlayable);
			files.sort();
			for (let i = 0; i < files.length; i++) {
				const parsedName = parser(files[i].replace(/^.*[\\\/]/, ''));
				if (parsedName !== null) {
					const figelem = document.createElement('figure');
					const figcap = document.createElement('figcaption');
					const imgelem = document.createElement('img');
					figelem.addEventListener('click', () => {
						const video = document.createElement('video');
						video.src = files[i];
						video.setAttribute('data-file-name', `${parsedName.show.replace(' ', '')}S${parsedName.season}E${parsedName.episode}`);
						video.autoplay = true;
						video.controls = true;
						video.addEventListener('loadedmetadata', handleVids, false);
						video.addEventListener('ended', vidFinished, false);
						video.addEventListener('timeupdate', vidProgressthrottled, false);
						if (videodiv.childElementCount > 0) {
							videodiv.replaceChild(video, videodiv.firstElementChild);
						} else {
							videodiv.appendChild(video);
						}
					});
					imgelem.src = `file:///${__dirname}/loading.png`;
					figelem.style.display = 'inline-block';
					// imgelem.id = files[i].replace(/^.*[\\\/]/, '');
					figelem.id = files[i].replace(/^.*[\\\/]/, '');
					figelem.setAttribute('data-file-name', files[i].replace(/^.*[\\\/]/, ''));
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
	});
}
