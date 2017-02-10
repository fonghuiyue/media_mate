var ipc = require('electron').ipcRenderer;
window.onerror = function(err, url, line) {
    	ipc.send('errorInWindow', err);
};
