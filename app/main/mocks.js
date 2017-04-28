module.exports = function (dialog) {
	dialog.showOpenDialog = (opts, cb) => {
		if (opts.title === 'Open Folder') {
			cb([require('path').join(require('os').tmpdir(), 'MediaMateTest', 'Downloads')]);
		}
	};
};
