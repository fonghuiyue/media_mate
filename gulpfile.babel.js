'use strict';
import gulp from 'gulp';
import del from 'del';
import inject from 'gulp-inject';
import sourcemaps from "gulp-sourcemaps";
import babel from "gulp-babel";
import concat from "gulp-concat";
import rimraf from "rimraf";
import ava from "gulp-ava";

const builder = require('electron-builder');

gulp.task('default', () => {
	rimraf('app/indexbuild.js*', err => {
	if (err && err.code !== 'ENOENT') {
	console.log(err.codeFrame);
	return err;
} else {
	return gulp.src(['!node_modules',
		'!node_modules/**',
		'!app/menu.js',
		'!dist',
		'!app/renderjs',
		'app/*.js',
		'!app/lib',
		'!app/indexbuild.js',
		'!dist/**'])
		.pipe(sourcemaps.init())
		.pipe(babel({
			presets: ['latest'],
			ignore: 'node_modules/**/*'
		}))
		.pipe(concat('indexbuild.js'))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('app'));
}
});
});

gulp.task('build:pack', ['default'], (cb) => {
	builder.build({
	platform: process.platform,
	arch: "x64",
		config: {
			"appId": "com.willyb321.media_mate",
			"nsis": {
				"oneClick": false,
				"allowToChangeInstallationDirectory": true
			},
			"mac": {
				"category": "public.app-category.entertainment",
				"target": "dmg"
			},
			"win": {
				"target": [
					"nsis"
				],
				"publish": [
					"github"
				]
			}
		}
})
	.then(() => {
	console.log('Built the app in dist/');
cb()
})
.catch(err => {
	console.error(err);
});
});
gulp.task('build:dist', ['default'], (cb) => {
	builder.build({
	platform: process.platform,
	arch: "x64",
	config: {
		"appId": "com.willyb321.media_mate",
		"nsis": {
			"oneClick": false,
			"allowToChangeInstallationDirectory": true
		},
		"mac": {
			"category": "public.app-category.entertainment",
			"target": "dmg"
		},
		"win": {
			"target": [
				"nsis"
			],
			"publish": [
				"github"
			]
		}
	}
})
	.then(() => {
	console.log('Built an installer for the current platform in dist/');
cb();
})
.catch(err => {
	console.error(err);
});
});
gulp.task('clean', () => {
	return del(['dist/**/*', 'node_modules/', 'app/node_modules/']);
});
gulp.task('index', () => {
	gulp.src(['./app/**/*.html', '!./app/node_modules/**'])
	.pipe(inject(gulp.src(['./app/*.css', './app/renderjs/*.js', './app/node_modules/bulma/css/bulma.css', './app/node_modules/izitoast/dist/css/iziToast.min.css'], {read: false}), {relative: true}))
	.pipe(gulp.dest('./app'));
});

gulp.task('build:packCI', (cb) => {
	builder.build({
	platform: process.platform,
	arch: "x64",
		config: {
			"appId": "com.willyb321.media_mate",
			"nsis": {
				"oneClick": false,
				"allowToChangeInstallationDirectory": true
			},
			"mac": {
				"category": "public.app-category.entertainment",
				"target": "dmg"
			},
			"win": {
				"target": [
					"nsis"
				],
				"publish": [
					"github"
				]
			}
		}
})
	.then(() => {
	console.log('Built the app in dist/');
cb()
})
.catch(err => {
	console.error(err);
});
});

gulp.task('test', ['default', 'build:packCI'], (cb) => {
	return gulp.src('test.js')
		.pipe(ava({verbose: true}))
});

