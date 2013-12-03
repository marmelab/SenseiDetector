/**
 * Module dependencies.
 */
var express         = require('express');
var http            = require('http');
var path            = require('path');
var app             = require('express')();
var server          = http.createServer(app);
var io              = require('socket.io').listen(server, { log: false });
var currentSocket   = null;

app.configure(function(){
	app.set('port', process.env.PORT || 9000);

	app.use(express.favicon());
	app.use(express.bodyParser());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

var exitDetected        = 0;
var bossDetected        = 0;
var doorOpened          = 0;
var existStatusInterval = 0;
var intrusion           = 0;
var alarmArmed          = false;

function setExitStatus(){
	exitDetected = 1;

	dispatchInfos();
}

// Called to change the Ninja Blocks eyes
function setAlarmStatus(status, cb){
	var path = status ? '/rest/v0/device/WEBHOOK_0_0_108/subdevice/nGoSH/tickle/xxx' :
			'/rest/v0/device/WEBHOOK_0_0_108/subdevice/qwdld/tickle/xxx';

	var sendSMSOptions = {
		hostname: 'api.ninja.is',
		path: path,
		method: 'POST',
		headers: {accept: 'text/plain'}
	};

	req = http.request(sendSMSOptions, function(res){
		res.on('end', function () {
			cb();
		});

		res.on('error', function(err){
			cb(err);
		})
	})
	.on('error', function(e) {
		cb(e);
	});

	req.end();
}

function dispatchInfos(){
	if (!currentSocket) {
		return;
	}

	currentSocket.emit('status', {
		boss : bossDetected,
		exit: exitDetected,
		intrusion: intrusion
	});

	exitDetected = 0;
	bossDetected = 0;
	intrusion = 0;
}

app.post('/door-open', function (req, res) {
	doorOpened = 1;
	existStatusInterval = setTimeout(setExitStatus, 5000);

	dispatchInfos();
	res.send();
});

// Called by Ninja Block when the remote button is pressed
app.post('/button', function (req, res) {
	alarmArmed = !alarmArmed;

	setAlarmStatus(alarmArmed, function(err){
		if(err){
			console.log('err : '+err);
		}
	});

	dispatchInfos();
	res.send();
});

app.post('/detect', function (req, res) {
	clearTimeout(existStatusInterval);

	if(doorOpened){
		bossDetected = 1;
	}

	if(alarmArmed){
		intrusion = 1;
		alarmArmed = false;
	}

	doorOpened = 0;

	dispatchInfos();
});

if(!module.parent){
	server.listen(app.get('port'), function(){
		console.log("Express server listening on port " + app.get('port'));
	});
}

io.on('connection',function(socket){
	currentSocket = socket;
});

io.on('disconnect',function(socket){
	currentSocket = null;
});

module.exports = app;
