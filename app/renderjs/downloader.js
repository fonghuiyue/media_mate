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
const bugsnag = require('bugsnag');
const f = require('util').format;
const ipc = require('electron').ipcRenderer;
const PouchDB = require('pouchdb');
require('events').EventEmitter.prototype._maxListeners = 1000;
const moment = require('moment');
const swal = require('sweetalert2');

const RSSParse = require(`${__dirname}/lib/rssparse.js`).RSSParse;
const ProgressBar = require('progressbar.js');
const _ = require('underscore');
const storage = require('electron-json-storage');
const WebTorrent = require('webtorrent');

let db;
PouchDB.plugin(require('pouchdb-find'));
const version = require('electron').remote.app.getVersion();
bugsnag.register('03b389d77abc2d10136d8c859391f952', {appVersion: version, sendCode: true});
const client = new WebTorrent();
let i = 0;
let bar;
const dbindex = 0;
const allTorrents = [];
const prog = _.throttle(dlProgress, 10000);

process.on('unhandledRejection', function (err, promise) {
	console.error('Unhandled rejection: ' + (err && err.stack || err)); // eslint-disable-line
	bugsnag.notify(new Error(err));
});

function handleErrs(err) {
	console.error('Unhandled rejection: ' + (err && err.stack || err)); // eslint-disable-line
	bugsnag.notify(new Error(err));
}

/**
 * Make sure that everything is loaded before doing the good stuff.
 */
window.onload = () => {
	findDocuments();
	indexDB();
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
	handleErrs(err);
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
			if (err.status === 404) {
				callback('');
			} else {
				handleErrs(err);
			}
		});
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
			_id: torrent.link
		},
		fields: ['_id', 'magnet', 'downloaded']
	}).then(res => {
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
				callback();
			}).catch(err => {
				handleErrs(err);
			});
		}
	}).catch(err => {
		handleErrs(err);
	});
}
/**
 * Drop the torrent database. Mainly for testing purpose.
 * @param callback - let em know.
 */
function dropTorrents(callback) {
	let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
	db.allDocs({
		include_docs: true, // eslint-disable-line camelcase
		attachments: true
	}).then(function (res) {
		_.each(res.rows, elem => {
			if (elem.doc._id !== 'showRSS') {
				db.remove(elem.doc);
			}
		});
	}).catch(function (err) {
		console.log(err);
	});
}
/**
 * Make sure that the ShowRSS URI is updated.
 * @param uri {string} - the ShowRSS URI
 */
function updateURI(uri) {
	let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
	db.get('showRSS').then(doc => {
		return db.put({
			_id: 'showRSS',
			_rev: doc._rev,
			showRSSURI: uri
		});
	}).then(() => {
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
		_.each(result.rows, elem => allTorrents.push(elem.doc.magnet));
		db.close();
	}).catch(function (err) {
		console.log(err);
	});
}

function indexDB() {
	let db = new PouchDB(require('path').join(require('electron').remote.app.getPath('userData'), 'db').toString());
	db.createIndex({
		index: {
			fields: ['_id', 'magnet', 'downloaded']
		}
	}).then(function (result) {
		if (result.result === 'created') {
			console.log('index made');
		} else {
			console.log('already exists');
		}
	}).catch(err => {
		handleErrs(err);
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
		_.each(result.docs, (elem, index) => {
			addTor(elem.magnet, index);
		});
		db.close();
	}).catch(function (err) {
		handleErrs(err);
	});
}
/**
 * Get the path for torrents to be downloaded to, from JSON storage.
 * @param callback
 */
function getDlPath(callback) {
	storage.get('path', (err, data) => {
		if (err) {
			handleErrs(err);
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
				handleErrs(error);
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
			document.getElementsByName(magnet)[0].checked = true;
			document.getElementsByName(magnet)[0].disabled = true;
			torrent.on('download', () => {
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
						document.getElementsByName(magnet)[0].parentNode.style.display = 'none';
						console.log('done');
						ipc.send('dldone', torrent.name);
						torrent.destroy();
					}).catch(err => {
						handleErrs(err);
					});
				});
			});
		});
	});
}

function processTorrents(data) {
	const dlbox = document.getElementById('dlbox');
	ignoreDupeTorrents(data, dupe => {
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
}
/**
 * Called on hitting enter in the Magnet URI box.
 * @param e {object} - the keypress event.
 * @returns {boolean} - whether the key was enter or not.
 */
function runScript(e) {
	if (e.keyCode === 13) {
		const tb = document.getElementById('rss');
		swal(
			'Getting your downloads',
			'Welcome to Media Mate',
			'success'
		);
		// Use connect method to connect to the Server
		updateURI(tb.value);
		document.getElementById('dls').style.display = 'inline';
		const RSS = new RSSParse(tb.value);
		RSS.on('error', err => {
			console.log(err);
		});
		RSS.on('data', data => {
			data = _.omit(data, '_id');
			processTorrents(data);
		});
		return false;
	}
}
