var http        = require('http');
var exec        = require('child_process').exec;
var imagemagick = require('imagemagick');
var async       = require('async');
var io          = require('socket.io-client');
var config      = require('config');

// Configuration
var distantAppUrl = 'http://hostname.com';
var socket      = io.connect();

socket.on('status', function(status){

	if(status.exit == 1){
		lockScreen();
	}else if(status.boss == 1){
		launchSite();
	}

	if(status.intrusion){
		takeSnapShotAndCompareTo('me@Detect');
	}
});

function upload(file, cb){
	exec('scp -i ~/.ssh/myKey.pem '+file+' me@hostname.com:/var/app/public', cb);
}

function getMatchValue(url, tag, cb){
	var apiURL = 'http://api.skybiometry.com/fc/faces/recognize.json?api_key='+config.skybiometry.key+'&api_secret='+config.skybiometry.secret+'&uids='+tag+'&urls='+url+'&attributes=all';

	http.get(apiURL, function(res){
		content = '';

		res.on('data', function(chunk){
			content += chunk;
		});

		res.on('end', function(){
			content = JSON.parse(content);

			if(content.photos[0].tags == undefined || content.photos[0].tags.length == 0 || content.photos[0].tags[0].uids.length == 0){
				return cb(null, null);
			}

			cb(null, content.photos[0].tags[0].uids[0].confidence);
		})
	})
	.on('error', function(e) {
		cb(e);
	});
}

function sendSMS(cb){
	var sendSMSOptions = {
		hostname: 'api.ninja.is',
		path: '/rest/v0/device/WEBHOOK_0_0_108/subdevice/RgwyH/tickle/lWd9O8stWCUxDhz1bZo90okmXoTxVxrwDEDhpxcqoN4',
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

function lockScreen(){
	exec('/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend');
}

function launchSite(){
	exec('open -a Google\\ Chrome "http://github.com"');
}

function takeSnapShot(cb){
	var now = new Date();

	exec('imagesnap ~/Desktop/photo-'+now.getTime()+'.jpg', cb);
}

function takeSnapShotAndCompareTo(tag, done){
	var file;
	var fileName;

	async.waterfall([
		function(callback){
			takeSnapShot(callback);
		},

		// Resize snapshot
		function(snapShotRslt, stderr, callback){
			file = snapShotRslt.trim().split('...').pop();
			fileName = file.split('/').pop();

			// Resize file
			imagemagick.resize({
				srcPath: file,
				dstPath: file,
				width:   512
			}, callback);
		},

		// Upload image
		function(stdin, stdout, callback){
			upload(file, callback);
		},

		// Recognize it
		function(stdout, stderr, callback){
			getMatchValue(distantAppUrl+'/'+fileName, tag, callback)
		},

		// Handle result
		function(result, callback){
			if(result != null && result < 50){
				sendSMS(done);
			}

			if(done){
				done()
			}
		}
	], function(err, rslt){
		if(err){
			throw err;
		}
	});
}