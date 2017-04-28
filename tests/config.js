const path = require('path');

const TEMP_DIR = require('os').tmpdir();
console.log(TEMP_DIR);
const TEST_DIR = path.join(TEMP_DIR, 'MediaMateTest');
const TEST_DIR_DOWNLOAD = path.join(TEST_DIR, 'Downloads');
const TEST_DIR_DESKTOP = path.join(TEST_DIR, 'Desktop');

module.exports = {
	TEST_DIR,
	TEST_DIR_DOWNLOAD,
	TEST_DIR_DESKTOP
};
