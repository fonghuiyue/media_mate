/**
 * @author William Blythe
 * @fileoverview File that handles downloading of shows
 */
/**
 * @module Downloader
 */
/* eslint-disable no-unused-vars */
/* eslint-disable max-nested-callbacks */
require('dotenv').config({path: `${__dirname}/.env`});
const {dialog} = require('electron').remote;
const path = require('path');
const f = require('util').format;
const ipc = require('electron').ipcRenderer;
const PouchDB = require('pouchdb');
require('events').EventEmitter.prototype._maxListeners = 1000;
const moment = require('moment');

const RSSParse = require(`${__dirname}/lib/rssparse.js`).RSSParse;
const ProgressBar = require('progressbar.js');
const MongoClient = require('mongodb').MongoClient;
const _ = require('underscore');
const storage = require('electron-json-storage');
const WebTorrent = require('webtorrent');

let db;
PouchDB.plugin(require('pouchdb-find'));
const user = process.env.DB_USER;
const password = process.env.DB_PWD;
const dburi = process.env.DB_URL;
const authMechanism = 'DEFAULT';
const client = new WebTorrent();
const url = f('mongodb://%s:%s@%s/media_mate?ssl=true&replicaSet=SDD-Major-shard-0&authSource=admin',
	user, password, dburi);
let i = 0;
let bar;
const dbindex = 0;
const allTorrents = [];
const prog = _.throttle(dlProgress, 10000);
/**
 * Make sure that everything is loaded before doing the good stuff.
 */
window.onload = () => {
	findDocuments();
	getRSSURI(callback => {
		document.getElementById('rss').value = callback;
	});
	bar = new ProgressBar.Line('#Progress', {
		strokeWidth: 4,
		easing: 'easeInOut',
		duration: 1400,
		color: '#FFEA82',
		trailColor: '#eee',
		trailWidth: 1,
		svgStyle: {
			width: '100%',
			height: '100%'
		},
		text: {
			style: {
				// Text color.
				// Default: same as stroke color (options.color)
				color: '#999',
				position: 'absolute',
				right: '0',
				//				Top: '30px',
				padding: 0,
				margin: 0,
				transform: null
			},
			autoStyleContainer: false
		},
		from: {
			color: '#FFEA82'
		},
		to: {
			color: '#ED6A5A'
		},
		step: (state, bar) => {
			bar.setText(Math.round(bar.value() * 100) + ' %');
		}
	});
};
/**
 * Update the download progress bar, but make sure not to do it too often.
 */
function dlProgress() {
	const animateThrottled = _.throttle(
		_.bind(bar.animate, bar),
		500
	);
	animateThrottled(client.progress);
}
/**
 * WebTorrent on error, handle it.
 */
client.on('error', err => {
	console.error('ERROR: ' + err.message);
});
/**
 * Get the ShowRSS URI from the db
 * @param callback - return it.
 */
function getRSSURI(callback) {
	let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
	db.get('showRSS')
		.then(doc => {
			callback(doc.showRSSURI);
		})
		.catch(err => {
			console.log(err);
			if (err.status === 404) {
				callback('');
			} else {
				throw err;
			}
		});
}
/**
 * Make sure that the torrents are downloaded and in the DB.
 * @param torrent {string} - the torrent object to be checked
 * @param callback
 */
function makeSureAllDL(torrent, callback) {
	if (_.contains(allTorrents, torrent) === true) {
		console.log('got it');
		callback();
	} else {
		console.log('dont got it');
		callback('add it');
	}
}
/**
 * Make sure not to add torrents already downloaded.
 * @param torrent {object} - the torrent object to be checked
 * @param callback - You know what it is.
 */
function ignoreDupeTorrents(torrent, callback) {
	let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
	db.find({
		selector: {
			magnet: torrent.link
		},
		fields: ['_id', 'magnet', 'downloaded']
	}).then(res => {
		console.log(res);
		if (res.docs.length > 0) {
			if (res.docs[0].downloaded === true) {
				callback('dupe');
			} else if (res.docs[0].downloaded === false) {
				callback();
			}
		} else {
			db.put({
				_id: torrent.link,
				magnet: torrent.link,
				title: torrent.title,
				tvdbID: torrent['tv:show_name']['#'],
				airdate: torrent.pubDate,
				downloaded: false
			}).then(res => {
				console.log(res);
				callback();
			}).catch(err => {
				throw err;
			});
		}
	}).catch(err => {
		console.log(err);
		throw err;
	});
}
/**
 * Get the index of the torrent being checked by the magnet URI
 * @param magnet {string} - the magnet URI for checking.
 * @param callback - Do I really need to say what this is :)
 */
function getTorIndex(magnet, callback) {
	MongoClient.connect(url, (err, db) => {
		if (err) {
			throw err;
		}
		const collection = db.collection('torrents');
		collection.findOne({magnet}, (err, docs) => {
			if (err) {
				throw err;
			}
			if (docs !== null) {
				const index = docs.index;
				callback(index);
			}
		});
	});
}
/**
 * Drop the torrent database. Mainly for testing purpose.
 * @param callback - let em know.
 */
function dropTorrents(callback) {
	MongoClient.connect(url, (err, db) => {
		if (err) {
			throw err;
		}
		const collection = db.collection('torrents');
		collection.drop();
	});
}
/**
 * Make sure that the ShowRSS URI is updated.
 * @param uri {string} - the ShowRSS URI
 * @param callback
 */
function updateURI(uri, callback) {
	let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
	db.get('showRSS').then(doc => {
		return db.put({
			_id: 'showRSS',
			_rev: doc._rev,
			showRSSURI: uri
		});
	}).then(function (response) {
		callback(response);
		db.close();
	}).catch(function (err) {
		console.log(err);
		let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
		if (err.status === 404) {
			db.put({
				_id: 'showRSS',
				showRSSURI: uri
			});
		}
	});
}
/**
 * Initial load, get the torrents in the db.
 */
function findDocuments() {
	let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
	db.allDocs({
		include_docs: true // eslint-disable-line camelcase
	}).then(function (result) {
		console.log(result);
		_.each(result.rows, elem => allTorrents.push(elem.doc.magnet));
		db.close();
	}).catch(function (err) {
		console.log(err);
	});
}

/**
 * Download all of the torrents, after they are added to the DOM.
 */
function dlAll() {
	let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
	db.find({
		selector: {downloaded: false},
		fields: ['_id', 'magnet', 'title', 'airdate', 'downloaded']
	}).then(function (result) {
		_.each(result.docs, (elem, index, list) => {
			addTor(elem.magnet, index);
		});
		db.close();
	}).catch(function (err) {
		throw new Error(err);
	});
}
/**
 * Get the path for torrents to be downloaded to, from JSON storage.
 * @param callback
 */
function getDlPath(callback) {
	storage.get('path', (err, data) => {
		if (err) {
			throw err;
		}
		if (_.isEmpty(data) === false) {
			callback(data.path);
		} else {
			callback('');
		}
	});
}
/**
 * Insert the download path to electron-json-storage
 * @param callback - callback, obviously
 */
function insertDlPath(callback) {
	const tb = document.getElementById('dlpath');
	const dlpath = dialog.showOpenDialog({
		properties: ['openDirectory']
	});
	if (dlpath !== undefined) {
		storage.set('path', {
			path: dlpath[0]
		}, error => {
			if (error) {
				throw error;
			}
		});
	}
}
/**
 * Add a torrent to WebTorrent and the DB.
 * @param magnet {string} - the magnet URI for WebTorrent
 * @param index {number} - the index of the torrent.
 */
function addTor(magnet, index) {
	document.getElementById('Progress').style.display = '';
	getDlPath(callback => {
		client.add(magnet, {
			path: callback
		}, torrent => {
			torrent.index = index;
			console.log(magnet);
			console.log(document.getElementsByName(magnet));
			document.getElementsByName(magnet)[0].checked = true;
			document.getElementsByName(magnet)[0].disabled = true;
			torrent.on('download', bytes => {
				prog(torrent, magnet);
				const percent = Math.round(torrent.progress * 100 * 100) / 100;
				document.getElementsByName(magnet)[0].parentNode.childNodes[1].nodeValue = '- ' + percent.toString() + '% downloaded, ' + moment.duration(torrent.timeRemaining / 1000, 'seconds').humanize() + ' remaining.';
			});
			torrent.on('done', () => {
				let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
				db.get(document.getElementsByName(magnet)[0].name).then(doc => {
					db.put({
						_id: document.getElementsByName(magnet)[0].name,
						_rev: doc._rev,
						magnet: document.getElementsByName(magnet)[0].name,
						downloaded: true
					}).then(res => {
						console.log(res);
						document.getElementsByName(magnet)[0].parentNode.style.display = 'none';
						console.log('done');
						ipc.send('dldone', torrent.name);
						torrent.destroy();
					}).catch(err => {
						throw err;
					});
				});
			});
		});
	});
}
/**
 * Called on hitting enter in the Magnet URI box.
 * @param e {object} - the keypress event.
 * @returns {boolean} - whether the key was enter or not.
 */
function runScript(e) {
	if (e.keyCode === 13) {
		const tb = document.getElementById('rss');
		// Use connect method to connect to the Server
		updateURI(tb.value, () => {
		});
		const dlbox = document.getElementById('dlbox');
		document.getElementById('dls').style.display = 'inline';
		const RSS = new RSSParse(tb.value);
		RSS.on('error', err => {
			console.log(err);
		});
		RSS.on('data', data => {
			document.getElementById('dlAll').style.display = 'block';
			data = _.omit(data, '_id');
			ignoreDupeTorrents(data, dupe => {
					// MakeSureAllDL(data.link, toadd => {
				if (!dupe) {
					const br = document.createElement('br');
					const label = document.createElement('label');
					label.innerText = data.title;
					const input = document.createElement('input');
					const dlprogTitle = document.createTextNode(' ');
					label.appendChild(dlprogTitle);
					label.id = i;
					input.type = 'checkbox';
					input.className = 'checkbox';
					input.name = data.link;
					input.addEventListener('click', () => {
						addTor(input.name, parseInt(input.id, 0));
					});
					label.appendChild(input);
					dlbox.appendChild(document.createElement('br'));
					document.getElementById('dlbox').appendChild(label);
					document.getElementById('dlAll').style.display = 'block';
					i++;
				} else if (dupe) {
					console.log('dupe');
				}
			});
		});
		// });
		return false;
	}
}
