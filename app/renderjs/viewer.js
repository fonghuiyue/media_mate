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
	findDL()
};

function isPlayable(file) {
	return isVideo(file)
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
	].includes(getFileExtension(file))
}

function getFileExtension(file) {
	const name = typeof file === 'string' ? file : file.name;
	return path.extname(name).toLowerCase()
}

function getPath(callback) {
	MongoClient.connect(url, (err, db) => {
		const collection = db.collection('path');
		collection.find({}).toArray((err, docs) => {
			if (docs.length > 0) {
				callback(docs[0].path)
			}
		})
	})
}


function getImgs() {
	let mediadiv = document.getElementById('media');
	let medianodes = mediadiv.childNodes;
	getPath(path => {
		dir.files(path, (err, files) => {
			files.forEach((elem, index) => {
				elem = elem.replace(/^.*[\\\/]/, '');
				let path = elem;
				if (isPlayable(elem) === true) {
					let tvelem = parser(elem);
					// console.log(tvelem)
					if (_.has(tvelem, 'show') === true) {
						tvdb.getSeriesByName(tvelem.show)
							.then(res => {
								// console.log(res);
								tvdb.getEpisodesBySeriesId(res[0].id)
									.then(res => {
										res.forEach((elem, index) => {
											// console.log(tvelem)
											// console.log(elem)
											if (_.isMatch(elem, {airedEpisodeNumber: tvelem.episode}) === true && _.isMatch(elem, {airedSeason: tvelem.season}) === true) {
												medianodes.forEach((img, ind) => {
													if (img.id === path) {
														tvdb.getEpisodeById(elem.id)
															.then(res => {
																img.src = `http://thetvdb.com/banners/${res.filename}`;
																img.style.display = 'inline';
															})
															.catch(err => {
																throw err;
															})
													}
												})
											}
										})
									})
									.catch(err => {
										throw err;
									})

							})
							.catch(err => {
								throw err;
							})
					}
					indeterminateProgress.end();
				}
			})
		})
	})
}

function tvdbRen() {
	let mediadiv = document.getElementById('media');
	MongoClient.connect(url, (err, db) => {
		const collection = db.collection('torrents');
		collection.find({}).toArray((err, docs) => {
			if (docs.length > 0) {
				docs.forEach((elem, index) => {
					if (_.has(elem, 'tvdbID') === true) {
						// console.log(elem);
						tvdb.getSeriesByName(elem.tvdbID)
							.then(res => {
								// console.log(res[0]);
								tvdb.getEpisodesByAirDate(parseInt(res[0].id), moment(elem.airdate).subtract(1, 'days').format('YYYY-MM-DD').toString())
									.then(res => {
										// console.log(res[0]);
										tvdb.getEpisodeById(res[0].id)
											.then(res => {
												console.log(res);
												let elem = mediadiv.childNodes[index];
												if (elem.tagName === 'IMG') {
													elem.src = `http://thetvdb.com/banners/${res.filename}`;
													elem.style.display = 'block';
												}
											});
									})
							})
							.catch(err => {
								throw err;
							})
							.catch(err => {
								throw err;
							})
					}
				})
			}
		})
	});
}

function findDL() {
	MongoClient.connect(url, (err, db) => {
		const collection = db.collection('path');
		if (collection.find() !== undefined || collection.find() !== null) {
			collection.find().toArray((err, docs) => {
				if (err) {
					throw err;
				}
				if (docs.length > 0) {
					dir.files(docs[0].path, (err, files) => {
						if (err) throw err;
						console.log(files);
						let mediadiv = document.getElementById('media');
						let videodiv = document.getElementById('video');
						for (let i = 0; i < files.length; i++) {
							let isVideo = isPlayable(files[i]);
							files[i] = files[i].replace(/^.*[\\\/]/, '');
							let parsedName = parser(files[i]);
							if (isVideo === true) {
								let elem = document.createElement('img');
								elem.id = i.toString();
								elem.addEventListener('click', () => {
									let video = document.createElement('video');
									video.src = files[i];
									video.autoPlay = true;
									video.controls = true;

									if (videodiv.childElementCount > 0) {
										videodiv.replaceChild(video, videodiv.firstElementChild);
									} else {
										videodiv.appendChild(video);
									}
								});
								elem.style.display = 'none';
								elem.id = files[i];
								elem.title = parsedName.show + ': ' + `S${parsedName.season}E${parsedName.episode}`
								mediadiv.appendChild(elem);
							}
						}
						getImgs();
						document.getElementById('Loading').style.display = 'none'
					});
					db.close();
				} else {
					db.close();
				}
			});
		} else {}
	});
}
