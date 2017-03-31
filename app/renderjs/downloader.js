/* eslint-disable no-unused-vars */
/* eslint-disable max-nested-callbacks */
require('dotenv').config({path: `${__dirname}/.env`});
const {dialog} = require('electron').remote;
const path = require('path');
const f = require('util').format;
const ipc = require('electron').ipcRenderer;
require('events').EventEmitter.prototype._maxListeners = 1000;
const moment = require('moment');

const RSSParse = require(`${__dirname}/lib/rssparse.js`).RSSParse;
const ProgressBar = require('progressbar.js');
const MongoClient = require('mongodb').MongoClient;
const _ = require('underscore');
const storage = require('electron-json-storage');
const WebTorrent = require('webtorrent');

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
	MongoClient.connect(url, (err, db) => {
		if (err) {
			throw err;
		}
		const collection = db.collection('uri');
		if (collection.find() !== undefined || collection.find() !== null) {
			collection.find().toArray((err, docs) => {
				if (err) {
					throw err;
				}
				if (docs.length > 0) {
					callback(docs[0].showRSSURI);
					db.close();
				} else {
					callback('');
					db.close();
				}
			});
		} else {
			callback('');
		}
	});
}
/**
 * Make sure that the torrents are downloaded and in the DB.
 * @param torrent - the torrent object to be checked
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
 * @param torrent - the torrent object to be checked
 * @param db - the MongoDB instance to be checked
 * @param callback - You know what it is.
 */
function ignoreDupeTorrents(torrent, db, callback) {
	const collection = db.collection('torrents');
	if (collection.find() !== null) {
		collection.findOne({
			magnet: torrent.link
		}, (err, docs) => {
			if (err) {
				throw err;
			}
			if (docs === null) {
				collection.insertOne({
					magnet: torrent.link,
					title: torrent.title,
					tvdbID: torrent['tv:show_name']['#'],
					airdate: torrent.pubDate,
					downloaded: false
				}, (err, res) => {
					if (err) {
						throw err;
					}
					callback();
					db.close();
				});
			} else if (docs.downloaded === true) {
				callback('dupe');
				db.close();
			} else if (docs.downloaded === false) {
				callback();
				db.close();
			}
		});
	} else if (collection.find() === null) {
		collection.insertOne({
			magnet: torrent.link,
			title: torrent.title,
			tvdbID: torrent['tv:show_name']['#'],
			airdate: torrent.pubDate,
			downloaded: false
		}, (err, res) => {
			if (err) {
				throw err;
			}
			callback();
			db.close();
		});
	}
}
/**
 * Get the index of the torrent being checked by the magnet URI
 * @param magnet - the magnet URI for checking.
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
				db.close();
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
		db.close();
	});
}
/**
 * Make sure that the ShowRSS URI is update.
 * @param uri - the ShowRSS URI
 * @param db - the MongoDB instance
 * @param callback
 */
function updateURI(uri, db, callback) {
	// Get the documents collection
	const collection = db.collection('uri');
	// Update document where a is 2, set b equal to 1
	collection.drop();
	collection.insertOne({
		showRSSURI: uri
	}, (err, res) => {
		if (err) {
			throw err;
		}
		console.log('Updated the showRSS uri');
		callback(res);
		db.close();
	});
}
/**
 * Initial load, get the torrents in the db.
 * @param db - MongoDB instance
 * @param col - MongoDB Collection
 * @param callback
 */
function findDocuments(db, col, callback) {
	// Get the documents collection
	const collection = db.collection(col || 'uri');
	// Find some documents
	collection.find({}).toArray((err, docs) => {
		if (err) {
			throw err;
		}
		console.log('Current contents of ' + col);
		console.log(docs);
		_.each(docs, elem => allTorrents.push(elem.magnet));
		db.close();
		callback(docs);
	});
}
/**
 * Use connect method to connect to the Server
 */
MongoClient.connect(url, (err, db) => {
	if (err) {
		throw err;
	}
	console.log('Connected correctly to server');
	findDocuments(db, 'torrents', () => {
		db.close();
	});
});
/**
 * Download all of the torrents, after they are added to the DOM.
 */
function dlAll() {
	MongoClient.connect(url, (err, db) => {
		if (err) {
			throw err;
		}
		const collection = db.collection('torrents');
		collection.find({
			downloaded: {
				$ne: true
			}
		}).toArray((err, docs) => {
			if (err) {
				throw err;
			}
			_.each(docs, (elem, index, list) => {
				addTor(elem.magnet, index, document.getElementById(index));
			});
			db.close();
		});
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
 * @param magnet - the magnet URI for WebTorrent
 * @param index - the index of the torrent.
 */
function addTor(magnet, index) {
	document.getElementById('Progress').style.display = '';
	getDlPath(callback => {
		client.add(magnet, {
			path: callback || 'F:\\media_mate'
		}, torrent => {
			torrent.index = index;
			document.getElementsByName(magnet)[0].checked = true;
			document.getElementsByName(magnet)[0].disabled = true;
			torrent.on('download', bytes => {
				prog(torrent, magnet);
				const percent = Math.round(torrent.progress * 100 * 100) / 100;
				document.getElementsByName(magnet)[0].parentNode.childNodes[1].nodeValue = '- ' + percent.toString() + '% downloaded, ' + moment.duration(torrent.timeRemaining / 1000, 'seconds').humanize() + ' remaining.';
			});
			torrent.on('done', () => {
				MongoClient.connect(url, (err, db) => {
					if (err) {
						throw err;
					}
					const collection = db.collection('torrents');
					collection.updateOne({
						magnet: document.getElementsByName(magnet)[0].name
					}, {
						$set: {
							downloaded: true
						}
					}, err => {
						if (err) {
							throw err;
						}
						document.getElementsByName(magnet)[0].parentNode.style.display = 'none';
						db.close();
					});
				});
				console.log('done');
				ipc.send('dldone', torrent.name);
				torrent.destroy();
			});
		});
	});
}
/**
 * Called on hitting enter in the Magnet URI box.
 * @param e - the keypress event.
 * @returns {boolean} - whether the key was enter or not.
 */
function runScript(e) {
	if (e.keyCode === 13) {
		const tb = document.getElementById('rss');
		// Use connect method to connect to the Server
		MongoClient.connect(url, (err, db) => {
			if (err) {
				throw err;
			}
			console.log('Connected correctly to server');
			updateURI(tb.value, db, () => {
				db.close();
			});
		});
		const dlbox = document.getElementById('dlbox');
		document.getElementById('dls').style.display = 'inline';
		const RSS = new RSSParse(tb.value);
		RSS.on('error', err => {
			console.log(err);
		});
		RSS.on('data', data => {
			MongoClient.connect(url, (err, db) => {
				if (err) {
					throw err;
				}
				console.log('Connected correctly to server');
				document.getElementById('dlAll').style.display = 'block';
				data = _.omit(data, '_id');
				ignoreDupeTorrents(data, db, dupe => {
					makeSureAllDL(data.link, toadd => {
						if (toadd || !dupe) {
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
								addTor(input.name, input.id);
							});
							label.appendChild(input);
							dlbox.appendChild(document.createElement('br'));
							document.getElementById('dlbox').appendChild(label);
							i++;
						} else if (dupe) {
							console.log('dupe');
							db.close();
						}
					});
				});
			});
		});
		return false;
	}
}
