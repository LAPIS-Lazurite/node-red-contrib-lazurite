module.exports = LazuriteIot;
function LazuriteIot(RED) {
	let node = this;
	const fs = require("fs");
	const https = require("https");
	var mqtt = require('mqtt');
	node.rf = {
		lib:  require("../../build/Release/lazurite_wrap")
	}
	const mqttBrokerUrl = "mqtts://a3er5ucb79dx5t-ats.iot.ap-northeast-1.amazonaws.com:8883";

	let options = {
		ca: fs.readFileSync("/home/pi/.lazurite/aws-iot/root-CA.crt"),
		cert: fs.readFileSync("/home/pi/.lazurite/aws-iot/lapiseva01_testgw01.cert.pem"),
		key: fs.readFileSync("/home/pi/.lazurite/aws-iot/lapiseva01_testgw01.private.key"),
		clientId: "lapiseva01_gw031_nodered",
		keepalive:60,
		reconnectPeriod: 15000,
		rejectUnauthorized: true
	}

	new Promise((resolve,reject) => {
		if(!node.rf.lib.dlopen()) {
			RED.log.warn('cannnot open liblazurite.so');
			return;
		}
		if(!node.rf.lib.init()) {
			RED.log.warn('lazdriver init fail');
			return;
		}
		let addr64 = node.rf.lib.getMyAddr64();
			node.rf.addr64 ="";
		for(let a of addr64) {
			node.rf.addr64 += ('0'+a.toString(16)).substr(-2);
		}
		resolve();
	}).then(() => {
		return new Promise((resolve,reject) => {
			const options = {
				hostname: 'api2.lazurite.io',
				port: 443,
				path: '/login',
				headers: {
					'Content-Type': 'application/json',
				},
				method: 'POST'
			};
			let postData = {
				companyid: "lapiseva01",
				companypass: "lapiseva01",
				//username: "administrator",
				//password: "@Lazurite920"
			}
			const req = https.request(options, (res) => {
				console.log('statusCode:', res.statusCode);
				console.log('headers:', res.headers);
				res.on('data', (d) => {
					console.log(d.toString());
					resolve(d);
				});
			});
			req.write(JSON.stringify(postData));
			req.on('error', (e) => {
				reject(e);
			});
			req.end();
		});
	}).then(() => {
		return new Promise((resolve,reject) => {
			node.mqttclient = mqtt.connect(mqttBrokerUrl,options);
			node.mqttclient.on('connect', function () {
				mqttclient.subscribe('Vh3Kixm6nc0IbNKx/hello',function (err) {
					if (!err) {
						node.mqttclient.publish('Vh3Kixm6nc0IbNKx/hello', JSON.stringify({payload: 'Hello mqtt'}));
					}
				})
			})
			node.mqttclient.on('message', function (topic, message) {
				// message is Buffer
				console.log({topic: topic,message: message.toString()});
				node.mqttclient.end();
				resolve();
			})
		});
	}).then((values) => {
		console.log("hello");
	}).catch((err) => {
		console.log(err);
	});
	/*
	node.on('close',(done) => {
		node.rf.lib.close();
		node.rf.lib.dlclose();
		done();
	});
	*/
}


if(module.filename === process.argv[1]) {
	LazuriteIot({
		log: {
			warn: (message) => {
				console.log(message);
			}
		}
	});
}

