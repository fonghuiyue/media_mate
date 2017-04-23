function notify(title, body) {
	let notif = new Notification(title, {
		body: body.toString()
	});
	notif.onclick = () => {
		console.log('notif clicked');
	};
}
function firstrun() {
	require('sweetalert2').swal({
		title: 'Want to check out the tutorial?',
		text: 'I noticed this is your first run.',
		type: 'question',
		showCancelButton: true,
		confirmButtonColor: '#3085d6',
		cancelButtonColor: '#d33',
		confirmButtonText: 'Yes!'
	}).then(function () {
		require('electron').remote.getCurrentWindow().loadURL(`file://${__dirname}/onboard.html`)
	})

}
