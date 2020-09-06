module.exports = function(RED,node){
	node.done = [];
	const https = require("https");
	let mqtt = require("./mqtt");
	mqtt(RED,node);

	node.device = {};
	let lazurite = require("./lazurite");
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
	node.connecting = false;
	node.connected = false;
	node.closing = false;

	new Promise((resolve,reject) => {
		switch(node.config.authMethod) {
			case 'lazurite':
				if(node.device.lazurite) {
					node.device.lazurite.auth()
						.then((values) => {
							resolve({
								type: 'lazurite',
								id: values
							});
						}).catch((err) => {
							reject(err);
						});
				} else {
					reject('authorization fail');
				}
				break;
			default:
				reject('unknown auth method');
				break;
		}
	}).then((postData) => {
		return new Promise((resolve,reject) => {
			node.connecting = true;
			for(let id in node.users) {
				node.users[id].status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
			}
			const options = {
				hostname: 'test2.lazurite.io',
				port: 443,
				path: '/v2/config/gateway/auth',
				headers: {
					"lazurite-api-key": node.config.key,
					"lazurite-api-token": node.config.token,
					'Content-Type': 'application/json',
				},
				method: 'POST'
			};
			const req = https.request(options, (res) => {
				res.on('data', (d) => {
					resolve(d);
				});
			});
			req.write(JSON.stringify(postData));
			req.on('error', (e) => {
				reject(e);
			});
			req.end();
		});
	}).then((values) => {
		return Promise.all([
			new Promise((resolve,reject) => {
				node.mqtt.auth(values)
					.then((v) => {
						resolve(v);
					}).catch((e) => {
						reject(e);
					});
			}),
			new Promise((resolve,reject) => {
				const options = {
					hostname: 'test2.lazurite.io',
					port: 443,
					path: '/v2/config/machine',
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
			})
		]);
	}).then(() => {
		return new Promise((resolve,reject) => {
			let promiseArray = [];
			if(node.rf.length === 1) {
				node.device[node.rf[0].type].init(node.rf[0]).then(() => {
					resolve();
				});
			} else {
				for(const r of node.rf) {
					promiseArray.push(node.device[r.type].init(r));
				}
				Promise.all(promiseArray).then(() => {
					resolve();
				}).catch((e) => {
					reject(e);
				});
			}
		});
	}).then(() => {
		delete node.sensors;
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
		node.connecting = false;
		node.connected = false;
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
		}).catch((err) => {
			console.log(err);
			done();
		});
	});

	function updateDatabase() {
		new Promise((resolve,reject) => {
			const options = {
				hostname: 'test2.lazurite.io',
				port: 443,
				path: '/v2/config/machine',
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

