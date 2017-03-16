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

const tvdb = new TVDB(process.env.TVDB_KEY);
const user = process.env.DB_USER;
const password = process.env.DB_PWD;
const dburi = process.env.DB_URL;
const authMechanism = 'DEFAULT';
const url = f('mongodb://%s:%s@%s/media_mate?ssl=true&replicaSet=SDD-Major-shard-0&authSource=admin',
	user, password, dburi);

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
			callback(path.join(require('os').homedir(), 'media_mate_dl'));
		}
	});
}

function getImgs() {
	const mediadiv = document.getElementById('media');
	const medianodes = mediadiv.childNodes;
	getPath(path => {
		dir.files(path, (err, files) => {
			files = _.filter(files, isPlayable);
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
											medianodes.forEach(img => {
												if (img.id === path) {
													tvdb.getEpisodeById(elem.id)
														.then(res => {
															img.children[0].src = `http://thetvdb.com/banners/${res.filename}`;
															img.children[0].parentNode.style.display = 'inline-block';
															indeterminateProgress.end();
															document.getElementById('Loading').style.display = 'none';
														})
														.catch(err => {
															throw err;
														});
												}
											});
										}
									});
								})
								.catch(err => {
									throw err;
								});
						})
						.catch(err => {
							throw err;
						});
				}
			});
		});
	});
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
			console.log(files);
			for (let i = 0; i < files.length; i++) {
				const parsedName = parser(files[i].replace(/^.*[\\\/]/, ''));
				if (parsedName !== null) {
					const figelem = document.createElement('figure');
					const figcap = document.createElement('figcaption');
					const imgelem = document.createElement('img');
					figelem.addEventListener('click', () => {
						const video = document.createElement('video');
						video.src = files[i];
						video.autoPlay = true;
						video.controls = true;
						if (videodiv.childElementCount > 0) {
							videodiv.replaceChild(video, videodiv.firstElementChild);
						} else {
							videodiv.appendChild(video);
						}
					});
					figelem.style.display = 'none';
					// imgelem.id = files[i].replace(/^.*[\\\/]/, '');
					figelem.id = files[i].replace(/^.*[\\\/]/, '');
					imgelem.title = `${parsedName.show}: S${parsedName.season}E${parsedName.episode}`;
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
