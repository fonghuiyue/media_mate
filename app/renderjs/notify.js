function notify(title, body) {
	let notif = new Notification(title, {
		body: body.toString()
	});
	notif.onclick = () => {
		console.log('notif clicked');
	};
}
