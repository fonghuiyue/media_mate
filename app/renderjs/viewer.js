require('dotenv').config({path: `${__dirname}/.env`});
const {dialog} = require('electron').remote;
require('events').EventEmitter.prototype._maxListeners = 1000;
const moment = require('moment');
const dir = require('node-dir');
const RSSParse = require(require('path').join(__dirname, 'lib', 'rssparse.js')).RSSParse;
const MongoClient = require('mongodb').MongoClient;
const _ = require('underscore');
const f = require('util').format;
const fs = require('fs-extra');
const path = require('path');

const user = process.env.DB_USER;
const password = process.env.DB_PWD;
const dburi = process.env.DB_URL;
const authMechanism = 'DEFAULT';
const url = f('mongodb://%s:%s@%s/media_mate?ssl=true&replicaSet=SDD-Major-shard-0&authSource=admin',
	user, password, dburi);


function isPlayable (file) {
  return isVideo(file)
}

// Checks whether a fileSummary or file path is playable video
function isVideo (file) {
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

function getFileExtension (file) {
  const name = typeof file === 'string' ? file : file.name
  return path.extname(name).toLowerCase()
}

window.onload = () => {
	findDL()
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
						for (let i = 0; i < files.length; i++) {
							let isVideo = isPlayable(files[i]);
							if (isVideo === true) {
							let elem = document.createElement('p');
							elem.addEventListener('click', () => {
								let video = document.createElement('video');
								video.src = files[i];
								video.autoPlay = true;
								video.controls = true;
								mediadiv.innerHTML = '';
								document.getElementById('video').appendChild(video);
							});
							elem.innerText = files[i]
							mediadiv.appendChild(elem);
						}
						}
					});
					db.close();
				} else {
					db.close();
				}
			});
		} else {}
	});
}
