module.exports = function(RED,node){
	const fs = require("fs");
	const os = require("os");
	const https = require("https");
	const util = require("util");
	const mqtt = require("./mqtt");
	const lazurite = require("./lazurite");

	if(node.connecting === undefined) node.connecting =  false;
	if(node.connected === undefined) node.connected =  false;
	if(node.closing === undefined) node.closing =  false;

	if((node.connecting !== false) || (node.connected !== false) || (node.closing !== false)) {
		return;
	}
	node.connecting = true;
	node.devices = {};
	node.done = [];

	let local = {};
	let setting = {};
	mqtt(RED,node);
	lazurite(RED,node);


	node.users = {};
	node.register = function(n) {
		node.users[n.id] = n;
		if((node.connecting === false) && (node.connected === false)) {
			node.users[n.id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
		} else if((node.connecting === true) && (node.connected === false)) {
			node.users[n.id].status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
		} else {
			node.users[n.id].status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
		}
	};
	node.deregister = function(n) {
		if(n) delete node.users[n.id];
	}

	getApiKeyAndDeviceInfo()
		.then(httpRequestGatewayConnect)
		.then(() => {
			return Promise.all([
				node.mqtt.auth(local.Keys),
				httpRequestGatewayMachine()
			]);
		}).then(() => {
			return new Promise((resolve,reject) => {
				let rf = local.Keys.config.rf.find((elm) => elm.type === "lazurite");
				if(rf) {
					node.devices.lazurite.setup(rf);
					resolve();
				} else {
					reject("can not find lazurite config");
				}
			});
		}).then(() => {
			node.connecting = false;
			node.connected = true;
			node.mqtt.subscribe("dbupdate",function(topic,message){
				if(message.type === "machine") {
					updateDatabase();
				}
			});
			console.log('lazurite-iot-auth init done');
			for(let id in node.users) {
				node.users[id].status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
			}
		}).catch((err) => {
			console.log(err);
			node.connecting = false;
			node.connected = false;
			if(typeof err === "object") err = JSON.stringify(err,null,"  ");
			RED.log.warn(err);
			for(let id in node.users) {
				node.users[id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
			}
		});
	node.on("close",(done) => {
		node.closing = true;
		for(let id in node.users) {
			delete node.users[id];
		}
		delete node.sensors;
		Promise.all(node.done.map((p) => {
			return p();
		})).then(() => {
			node.connecting = false;
			node.connected = false;
			console.log('lazurite-iot-auth success to close');
			done();
		}).catch((e) => {
			console.log(e);
			RED.log.warn((typeof e === "object") ? JSON.stringify(e,null,"  ") : e);
		});
	});

	function getApiKeyAndDeviceInfo() {
		return new Promise((resolve,reject) => {
			if(fs.existsSync(node.config.keyPath) === false) {
				reject(`keyPath is not found`);
				return;
			}
			try {
				let Body = fs.readFileSync(node.config.keyPath,'utf-8');
				var key = JSON.parse(Body);
				if(!key.apiKey) {
					reject("invalid key");
					return;
				}
			} catch(e) {
				console.log(e);
				reject(`invalid key. ${JSON.stringify(e)}`);
				return;
			}
			const ni = os.networkInterfaces()["wwan0"];
			const subghz = node.devices.lazurite.init();

			local.auth = {
				apiKey : key.apiKey
			}
			if(ni) {
				local.auth.soracom = ni;
			}
			if(subghz) {
				local.auth.subghz = subghz.substr(-16);
			}
			resolve();
		});
	}
	function httpRequestGatewayConnect() {
		return new Promise((resolve,reject) => {
			for(let id in node.users) {
				node.users[id].status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
			}
			const options = {
				hostname: 'test2.lazurite.io',
				port: 443,
				path: '/v2/gateway/connect',
				headers: {
					'Content-Type': 'application/json',
				},
				method: 'POST'
			};
			const req = https.request(options, (res) => {
				let Body = "";
				res.on('data', (d) => {
					Body += d;
				});
				res.on('end',() => {
					if(res.statusCode === 200) {
						local.Keys = JSON.parse(Body).Item;
						resolve();
					} else {
						reject({
							file: module.filename.split("/").pop(),
							path: options.path,
							statusCode: res.statusCode,
							statusMessage: res.statusMessage,
							body: Body
						});
					}
				});
			});
			req.write(JSON.stringify({Item:local.auth}));
			req.on('error', (e) => {
				reject(e);
			});
			req.end();
		});
	}
	function httpRequestGatewayMachine() {
		return new Promise((resolve,reject) => {
			const options = {
				hostname: 'test2.lazurite.io',
				port: 443,
				path: '/v2/gateway/machine',
				headers: {
					'Content-Type': 'application/json',
				},
				method: 'POST'
			};
			const req = https.request(options, (res) => {
				let Body = "";
				res.on('data', (d) => {
					Body += d;
				});
				res.on('end',() => {
					if(res.statusCode === 200) {
						node.db = JSON.parse(Body.toString()).Items;
						resolve();
					} else {
						reject({
							file: module.filename.split("/").pop(),
							path: options.path,
							statusCode: res.statusCode,
							statusMessage: res.statusMessage,
							Body: Body
						});
					}
				});
			});
			req.write(JSON.stringify({Item:local.auth}));
			req.on('error', (e) => {
				console.log(e);
				reject(e);
			});
			req.end();
		});
	}
	function updateDatabase() {
		return new Promise((resolve,reject) => {
			const options = {
				hostname: 'test2.lazurite.io',
				port: 443,
				path: '/v2/gateway/machine',
				headers: {
					"lazurite-api-key": node.config.key,
					"lazurite-api-token": node.config.token,
					'Content-Type': 'application/json',
				},
				method: 'GET'
			};
			const req = https.request(options, (res) => {
				let body = "";
				res.on('data', (d) => {
					body += d;
				});
				res.on('end',() => {
					let machine = body.toString();
					node.sensors = JSON.parse(machine.toString()).Items;
					resolve();
				});
			});
			req.on('error', (e) => {
				reject(e);
			});
			req.end();
		}).then((values) => {
			let device = Object.keys(node.device);
			for(let d of device) {
				node.device[d].update();
			}
		});
	}
}

