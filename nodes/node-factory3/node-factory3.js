'use strict'
/**
 * Copyright 2017 Lapis Semiconducor Ltd,.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
module.exports = function(RED) {
	//const server = api.lazurite.io
	//const https = require('http');
	const fs = require('fs');
	//const os = require('os');
	const url = require('url');
	const execSync = require('child_process').execSync;
	const remap_machine = require("./remap_machine");
	const eack = require("./eack");
	const parseMessage = require("./parseMessage");

	global.lazurite = {
		config : require("/home/pi/.lazurite/config.json"),
		access: require("/home/pi/.lazurite/activate/files/config.json").access,
		mqtt: require("/home/pi/.lazurite/activate/files/config.json").mqtt,
		db: {}
	};
	let apiServer = url.parse(global.lazurite.config.domain.api);
	const https = require(apiServer.protocol.slice(0,-1));

	fs.readFile('/home/pi/.lazurite/database/machine.json',(err,data) => {
		if(err) {
			console.log(err);
		} else {
			global.lazurite.db.machine = remap_machine(JSON.parse(data.toString()));
		}
	});
	fs.readFile('/home/pi/.lazurite/database/reason.json',(err,data) => {
		if(err) {
			console.log(err);
		} else {
			global.lazurite.db.reason = JSON.parse(data.toString());
		}
	});

	function LazuriteFactoryParams(config) {
		RED.nodes.createNode(this,config);
		let node = this;

		function getDatabase(db,done) {
			loop();
			let backoff = 1000;
			function loop() {
				let options = {
					hostname: apiServer.hostname,
					port: apiServer.port,
					path: `/v2/info/${db}`,
					method: "GET",
					headers: {
						"Content-Type" : "application/json",
						"LAZURITE-API-KEY": global.lazurite.access.key,
						"LAZURITE-API-TOKEN": global.lazurite.access.token,
					}
				}
				let req = https.request(options,(res) => {
					res.setEncoding("utf8");
					let body = "";
					res.on("data",(chunk) => {
						body += chunk;
					});
					res.on("end",() => {
						if(res.statusCode === 200) {
							let data = JSON.parse(body).Items;
							fs.writeFile(`/home/pi/.lazurite/database/${db}.json`,JSON.stringify(data),(err) => {
								if(err) {
									console.log(err);
									done(err);
								} else {
									done(null,data);
								}
							});
						} else {
							console.log(body);
							setTimeout(loop,backoff);
							backoff = backoff*2;
							if(backoff > 60000) backoff = 60000;
						}
					});
					res.on("error",(err) => {
						console.log(err);
						setTimeout(loop,backoff);
						backoff = backoff*2;
						if(backoff > 60000) backoff = 60000;
					});
				});
				req.end();
			}
		}
		Promise.all([
			new Promise((resolve,reject) => {
				getDatabase('machine',(err,data) => {
					if(err) {
						reject(err);
					} else {
						global.lazurite.db.machine = remap_machine(data);
						resolve();
					}
				});
			}),
			new Promise((resolve,reject) => {
				getDatabase('reason',(err) => {
					if(err) {
						reject(err);
					} else {
						resolve();
					}
				});
			})
		]).then(() => {
			global.lazurite.eack = eack.init(global.lazurite.db.machine);
			node.send([,,global.lazurite.eack]);
			console.log("init done");
		}).catch((err) => {
			console.log(err);
		});
		node.on('input', function (msg) {
			if(msg.payload.hasOwnProperty("type")) {
				switch(msg.payload.type) {
					case "machine":
					case "reason":
						getDatabase(msg.payload.type,(err,data) => {
							if(err) {
								console.log(err);
							} else {
								console.log(`update database(${msg.payload.type})`);
								if(msg.payload.type === "machine") {
									global.lazurite.db.machine = remap_machine(data);
									global.lazurite.eack = eack.init(global.lazurite.db.machine);
									node.send([,,global.lazurite.eack]);
								}
							}
						});
						break;
				}
			}
		});
	}
	RED.nodes.registerType("lazurite-factory-params", LazuriteFactoryParams);
	/*
	 * device manager
	 */
	function LazuriteDeviceManager(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.on('input', function (msg) {
			if(Array.isArray(msg.payload)) {
				for(let i in msg.payload) {
					checkRxData(msg.payload[i]);
				}
			} else {
				checkRxData(msg.payload);
			}
		});
		function checkRxData(rxdata) {
			const payload = rxdata.payload.split(",");
			if(payload[0] === "factory-iot") {
				let message = eack.activate(rxdata,global.lazurite.db.machine,global.lazurite.eack);
				if(message) {
					node.send([{
						dst_panid: rxdata.dst_panid,
						dst_addr: rxdata.src_addr,
						payload: message,
					},,,{payload: global.lazurite.eack}]);
				}
				//if(((broadcast === true ) && (payload[0] === "factory-iot")) || ((unicast === true) && (payload[0] === "update"))) {
			} else if(payload[0] === "update") {
				let message = eack.activate(rxdata,global.lazurite.db.machine,global.lazurite.eack);
				if(message) {
					node.send([,{
						dst_panid: rxdata.dst_panid,
						dst_addr: rxdata.src_addr,
						payload: message,
					},,{payload: global.lazurite.eack}]);
				}
			} else {
				let message = parseMessage(rxdata,global.lazurite.db.machine);
				let promise = Promise.resolve();
				for(let m of message) {
					promise.then(() => {
						return new Promise((resolve) => {
							let topic = `${global.lazurite.mqtt.topic}/lastest/${m.site}/${m.id}`,
							node.send([,,{
								topic: `${global.lazurite.mqtt.topic}/lastest/`,
								payload: m
							}]);
							resolve();
						});
					});
				}
				promise.then(() => {
					node.send([,,,,rxdata]);
				});
			}
		}
	}
	RED.nodes.registerType("lazurite-device-manager", LazuriteDeviceManager);
}
