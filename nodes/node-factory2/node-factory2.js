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
	const https = require('https');
	//const https = require('http');
	var fs = require('fs');
	var machineParams = {};
	var addr2id = {};
	var optimeParams = [];
	var isGatewayActive = false;
	function LazuriteFactoryParams(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		//node.config = config;
		node.awsiotConfig = JSON.parse(fs.readFileSync(config.awsiotConfig,'utf8'));

		const httpOptions = {
			host: "api.lazurite.io",
			//host: "192.168.30.27",
			//port: 8081,
			mothod: 'GET',
			headers: {
				"Accept": "application/json",
				"Content-Type" : "application/json",
				"LAZURITE-API-KEY": node.awsiotConfig.access.key,
				"LAZURITE-API-TOKEN": node.awsiotConfig.access.token
			}
		};
		Promise.resolve().then(() =>{
			return new Promise((resolve,reject) => {
				var index = 0;
				getParameter('/v0/info/machine',(err,res) => {
					if(err){
						reject(err);
					} else {
						node.send(res);
						console.log(res);
						machineParams = res.Items;
						resolve();
					}
				});
			});
		}).then(() => {
			return new Promise((resolve,reject) => {
				getParameter('/v0/info/optime',(err,res) => {
					if(err){
						reject(err);
					} else {
						node.send([,res]);
						console.log(res);
						optimeParams = res.Items;
						isGatewayActive = true;
						resolve();
					}
				});
			});
		}).then((values) => {
		}).catch((err) => {
			console.log(err);
			node.send([,,err]);
		});
		function getParameter(path,callback) {
			var retry = 0;
			Promise.resolve().then(function loop() {
				return new Promise((resolve,reject)=>{
					var body = "";
					httpOptions.path = path;
					https.get(httpOptions,(res) => {
						res.setEncoding('utf8');
						res.on('data',(chunk) => {
							body += chunk;
						});
						res.on('end',() => {
							resolve(body);
						});
					}).on('error',(e) => {
						reject(e)
					});
				}).then((values) => {
					callback(null,JSON.parse(values));
				}).catch((err) => {
					retry += 1;
					if(retry < 10) {
						setTimeout(loop,5000);
					} else {
						callback(err,null);
					}
				})
			});
		}

		node.on('input', function (msg) {
			if(isGatewayActive) {
				try {
					var data = JSON.parse(msg.payload);
					switch(data.type) {
						case 'machine':
							genAddressMap(data.Items);
							node.send([{payload:data.Items}]);
							break;
						case 'optime':
							optimeParams = data.Items;
							node.send([,{payload:data.Items}]);
							break;
						default:
							node.send([,,{payload:{message: 'invalid type', data: data}}]);
							break;
					}
				} catch (e) {
					node.send([,,{payload:{message: 'invalid data', data: data}}]);
				}
			}
		});
		function genAddressMap(data) {
			machineParams = {};
			for(var i in data) {
				var addr;
				if ((!isNaN(parseInt("0x"+data[i].ct)) && (data[i].ct.length == 16))){
					addr = parseInt("0x"+data[i].ct);
					addr = addr & 0xffff;
				} else if(!isNaN(parseInt(data[i].ct))){
					addr = parseInt(data[i].ct);
				} else {
					continue;
				}
				addr2id[addr] = data[i].id;
				machineParams[data[i].id] = {
					thres0: data[i].thres0,
					detect0: data[i].detect0,
					thres1: data[i].thres1,
					detect1: data[i].detect1
				}
			}
		}
	}
	RED.nodes.registerType("lazurite-factory-params", LazuriteFactoryParams);
	/*
	 * device manager
	 */
	function LazuriteDeviceManager(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		node.on('input', function (msg) {
			if(Array.isArray(msg.payload)) {
				for(var i in msg.payload) {
					checkRxData(msg.payload[i]);
				}
			} else {
				checkRxData(msg.payload);
			}
		});
		function checkRxData(rxdata) {
			if((rxdata.dst_panid == 0xffff) &&
				(rxdata.dst_addr[0] == 0xffff) &&
				(rxdata.dst_addr[1] == 0xffff) &&
				(rxdata.dst_addr[2] == 0xffff) &&
				(rxdata.dst_addr[3] == 0xffff)) {
				// broadcast
				var id = addr2id[rxdata.src_addr[0]];
				if (id) {
					var txdata = {
						dst_panid: 0xffff,
						dst_addr: rxdata.src_addr,
						payload: `activate,${global.gateway.panid},${global.gateway.shortaddr},${id},${machineParams[id].thres0},${machineParams[id].detect0},${machineParams[id].thres1},${machineParams[id].detect1}`
					};
					node.send(txdata);
				}
				return;
			} else {
				// broadcast
				return;
			}
		}
	}
	RED.nodes.registerType("lazurite-device-manager", LazuriteDeviceManager);
}
