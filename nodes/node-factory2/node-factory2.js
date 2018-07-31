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
	var fs = require('fs');
	var url = require('url');
	var addr2id = {};
	var isGatewayActive = false;
	var timerThread = null;
	global.lazuriteConfig = {
		machineInfo: {
			worklog: {},
			graph: {},
			vbat: {}
		},
		optimeInfo: []
	}

	const KEEP_ALIVE = 3480*1000; const MEAS_INTERVAL = 5*1000; const EACK_NOP = 0; const EACK_DEBUG = 1; const EACK_UPDATE = 2; const EACK_DISCONNECT = 3;
	const EACK_FIRMWARE_UPDATE = 0xF0;

	function LazuriteFactoryParams(config) {
		RED.nodes.createNode(this,config);
		var u = url.parse(config.server);
		var node = this;
		var https = require(u.protocol.slice(0,-1));
		//node.config = config;
		node.awsiotConfig = JSON.parse(fs.readFileSync(config.awsiotConfig,'utf8'));

		const httpOptions = {
			//host: "api.lazurite.io",
			host: u.hostname,
			port: u.port,
			method: 'GET',
			headers: {
				"Accept": "application/json",
				"Content-Type" : "application/json",
				"LAZURITE-API-KEY": node.awsiotConfig.access.key,
				"LAZURITE-API-TOKEN": node.awsiotConfig.access.token
			}
		};
		new Promise((resolve,reject) => {
			var index = 0;
			getParameter(u.pathname+'/info/machine',(err,res) => {
				if(err){
					reject(err);
				} else {
					node.send({payload:res});
					//console.log(JSON.stringify({cmd:"getParameter.Machine",data:res},null,2));
					genAddressMap(res.Items);
					resolve();
				}
			});
		}).then(() => {
			return new Promise((resolve,reject) => {
				getParameter(u.pathname+'/info/optime',(err,res) => {
					if(err){
						reject(err);
					} else {
						node.send([,{payload:res}]);
						global.lazuriteConfig.optimeInfo = remapOpTime(res.Items);
						initEnhanceAck();
						if(timerThread === null ) {
							timerThread = setInterval(function() {
								if(tickEnhanceAck() === true ) {
									node.send([,,{payload: global.lazuriteConfig.machineInfo.enhanceAck}]);
									//console.log(JSON.stringify(global.lazuriteConfig.machineInfo.enhanceAck,null,2));
								};
							},10000);
						}
						isGatewayActive = true;
						resolve();
					}
				});
			});
		}).then((values) => {
		}).catch((err) => {
			console.log(err);
			node.send([,,,{payload:err}]);
		});
		function getParameter(path,callback) {
			var retry = 0;
			function loop () {
				new Promise((resolve,reject) => {
					var body = "";
					httpOptions.path = path;
					//console.log(httpOptions);
					https.get(httpOptions,(res) => {
						res.setEncoding('utf8');
						res.on('data',(chunk) => {
							body += chunk;
						});
						res.on('end',() => {
							//console.log(body);
							resolve(body);
						});
					}).on('error',(e) => {
						//console.log(e);
						reject(e)
					});
				}).then((values) => {
					callback(null,JSON.parse(values));
				}).catch((err) => {
					console.log(err);
					retry += 1;
					if(retry < 10) {
						setTimeout(loop,30000);
					} else {
						callback(err,null);
					}
				});
			}
			loop();
		}

		node.on('input', function (msg) {
			try {
				var data = JSON.parse(msg.payload);
				switch(data.type) {
					case 'machine':
						//console.log({cmd:'updateMachine',data: data.Items});
						genAddressMap(data.Items);
						initEnhanceAck();
						node.send({payload:data.Items});
						break;
					case 'optime':
						global.lazuriteConfig.optimeInfo = remapOpTime(data.Items);
						initEnhanceAck();
						//console.log({cmd:'updateOptime',data: data.Items});
						node.send([,{payload:data.Items}]);
						break;
					default:
						node.send([,,,{payload:{message: 'invalid type', data: data}}]);
						break;
				}
			} catch (e) {
				node.send([,,,{payload:{message: 'invalid data', data: data}}]);
			}
		});
		function genAddressMap(data) {
			global.lazuriteConfig.machineInfo.worklog = {};
			var worklog = global.lazuriteConfig.machineInfo.worklog;
			var graph = global.lazuriteConfig.machineInfo.graph;
			for(var i in data) {
				var addr;
				if ((!isNaN(parseInt("0x"+data[i].addr)) && (data[i].addr.length == 16))){
					addr = parseInt("0x"+data[i].addr);
					addr = addr & 0xffff;
				} else if(!isNaN(parseInt(data[i].addr))){
					addr = parseInt(data[i].addr);
				} else {
					continue;
				}
				if(data[i].type.match(/worklog/)) {
					//console.log({id: data[i].id,type: "worklog"});
					addr2id[addr] = data[i].id;
					worklog[data[i].id] = {
						log: true,
						thres0: data[i].thres0,
						detect0: data[i].detect0,
						thres1: data[i].thres1,
						detect1: data[i].detect1,
						interval: data[i].interval?data[i].interval*1000:MEAS_INTERVAL,
						invert: (data[i].invert == 1)? true:false,
						debug: (data[i].debug == 0)? false: true,
						disp: (data[i].disp == 0)? false: true
					}
				}
				if(data[i].type.match(/graph/)) {
					//console.log({id: data[i].id,type: "graph"});
					addr2id[addr] = data[i].id;
					graph[data[i].id] = {enabled: true};
					if(worklog[data[i].id]) {
						worklog[data[i].id].debug = true;
					} else {
						worklog[data[i].id] = {
							log: false,
							thres0: data[i].thres0,
							detect0: data[i].detect0,
							thres1: data[i].thres1,
							detect1: data[i].detect1,
							interval: data[i].interval?data[i].interval*1000:MEAS_INTERVAL,
							invert: (data[i].invert == 1)?true:false,
							debug: true,
							disp: false
						}
					}
				} else {
					addr2id[addr] = data[i].id;
					graph[data[i].id] = {enabled: false};
				}
			}
			//console.log(JSON.stringify({cmd: 'genAddressMap',info: global.lazuriteConfig.machineInfo},undefined,2));
		}
		function remapOpTime(values) {
			var data = {};
			for (var i in values) {
				data[values[i].day] = {
					setOff: values[i].setOff,
					setTime : {
						flag: values[i].setTime
					}
				}
				if(values[i].setTime > 0) {
					var tmp = values[i].stTime.split(":");
					data[values[i].day].setTime.st = {
						hour : parseInt(tmp[0]),
						min : parseInt(tmp[1])
					}
					tmp = values[i].endTime.split(":");
					data[values[i].day].setTime.end = {
						hour : parseInt(tmp[0]),
						min : parseInt(tmp[1])
					}
				}
			}
			//console.log(JSON.stringify(data,null,"  "});
			return data;
		}
		function initEnhanceAck() {
			global.lazuriteConfig.machineInfo.enhanceAck = [];
			var worklogs = global.lazuriteConfig.machineInfo.worklog;
			for(var i in worklogs) {
				var interval = parseInt(worklogs[i].interval/1000);
				//updateEnhanceAck(false,calEnhanceAck(i));
				updateEnhanceAck(true,{
					addr: parseInt(i),
					data:[EACK_UPDATE,interval&0xFF,(interval>>8)&0xFF]
				});
			}
			updateEnhanceAck(true,{
				addr: 0xffff,
				data:[EACK_DISCONNECT,5,0]
			});
			//console.log(JSON.stringify(global.lazuriteConfig.machineInfo.enhanceAck,null,2));
			node.send([,,{payload: global.lazuriteConfig.machineInfo.enhanceAck}]);
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
			if(global.lazuriteConfig.machineInfo.worklog === undefined) {
				return;
			}
			var worklogs = global.lazuriteConfig.machineInfo.worklog;
			if(rxdata.dst_panid == global.gateway.panid) {
				rxdata.payload = rxdata.payload.split(",");
				if(rxdata.payload[0] === "update") {
					var id = rxdata.src_addr[0];
					if(worklogs[id]){
						updateEnhanceAck(false,calEnhanceAck(id));
						node.send([,,,{payload: global.lazuriteConfig.machineInfo.enhanceAck}]);		// update EACK
						// send parameters;
						node.send([,{											// send update informaton by uni-cast
							dst_panid: gateway.panid,
							dst_addr: rxdata.src_addr,
							payload: `activate,${global.gateway.panid},${global.gateway.shortaddr},${id},${worklogs[id].thres0},${worklogs[id].detect0},${worklogs[id].thres1},${worklogs[id].detect1}`
						}]);
					} else {
						//console.log(`invalid id = ${rxdata.src_addr[0]}`);
					}
				} else {
					// state information
					var id = rxdata.src_addr[0];
					//console.log({id: id});
					// invert
					if(worklogs[id]){
						if(worklogs[id].invert === true) {
							rxdata.payload[0] = (rxdata.payload[0] === "on") ? "off" : "on";
							//	console.log({id:id, rxdata:rxdata,worklog: worklogs[id]});
						}
						node.send([,,rxdata]);											// send capacity information
						if(worklogs[id].disp) {
							node.send([,,,,{payload: rxdata}]);			// send rxdata to log
						}
					} else {
						//console.log(global.lazuriteConfig.machineInfo.enhanceAck);
					}
				}
			} else if((rxdata.dst_panid == 0xffff) &&
				// state information
				(rxdata.dst_addr[0] == 0xffff) &&
				(rxdata.dst_addr[1] == 0xffff) &&
				(rxdata.dst_addr[2] == 0xffff) &&
				(rxdata.dst_addr[3] == 0xffff)) {
				// broadcast
				//console.log({rxdata:rxdata});
				var id = addr2id[rxdata.src_addr[0]];
				//console.log({id:id, src: rxdata.src_addr[0]});
				if(worklogs[id]){
					updateEnhanceAck(false,calEnhanceAck(id));
					node.send([,,,{payload: global.lazuriteConfig.machineInfo.enhanceAck}]);
					var txdata = {
						dst_panid: 0xffff,
						dst_addr: rxdata.src_addr,
						payload: `activate,${global.gateway.panid},${global.gateway.shortaddr},${id},${worklogs[id].thres0},${worklogs[id].detect0},${worklogs[id].thres1},${worklogs[id].detect1}`
					};
					updateEnhanceAck(false,calEnhanceAck(id));
					node.send(txdata);
				} else {
					//console.log(`invalid id = ${rxdata.src_addr[0]}`);
				}
			} else {
				// broadcast
			}
			//console.log(global.lazuriteConfig.machineInfo.enhanceAck);
		}
	}
	RED.nodes.registerType("lazurite-device-manager", LazuriteDeviceManager);
	function calEnhanceAck(id) {
		var now = new Date();
		var day = now.getDay();
		var optime = global.lazuriteConfig.optimeInfo[day];
		var worklogs = global.lazuriteConfig.machineInfo.worklog;
		var enhanceAck = global.lazuriteConfig.machineInfo.enhanceAck;
		//console.log(optime);
		// off day
		if(optime.setOff > 0) {
			return {
				addr: parseInt(id),
				data: [EACK_DEBUG,parseInt(KEEP_ALIVE/1000)&0xFF,(parseInt(KEEP_ALIVE/1000)>>8)&0xFF]
			};
		} else if(optime.setTime.flag > 0) {
			var stTime = new Date(now.getFullYear(),now.getMonth(),now.getDate(),optime.setTime.st.hour,optime.setTime.st.min);
			var endTime = new Date(now.getFullYear(),now.getMonth(),now.getDate(),optime.setTime.end.hour,optime.setTime.end.min);
			//console.log({cmd:"calEnhanceAck", data: worklogs[id] });
			var diff = stTime - now;
			// workday   now < stTime - KEEP_ALIVE  or  endTime < now
			if(((diff > KEEP_ALIVE) || (now >  endTime )) && (worklogs[id].debug === false)){
				//console.log("off");
				return {
					addr: parseInt(id),
					data: [EACK_DEBUG,parseInt(KEEP_ALIVE/1000)&0xFF,(parseInt(KEEP_ALIVE/1000)>>8)&0xFF]
				};
				// workday   KEEP_ALIVE < now < stTime
			} else if ((diff > 0) && (worklogs[id].debug === false)) {
				//console.log("prepare");
				var interval = diff+worklogs[id].interval
				//console.log({interval: interval, diff:diff, log: worklogs[id].interval});
				return {
					addr: parseInt(id),
					data: [EACK_DEBUG,parseInt(interval/1000)&0xFF,(parseInt(interval/1000)>>8)&0xFF]
				};
				// workday   stTime < now < endTime
			} else {
				/*
				 * console.log({
					worktime:"worktime1",
					mode: worklogs[id].debug === true ? EACK_DEBUG: EACK_NOP,
					debug: worklogs[id].debug,
					interval: worklogs[id].interval
				});
				*/
				return {
					addr: parseInt(id),
					data: [worklogs[id].debug === true? EACK_DEBUG: EACK_NOP,parseInt(worklogs[id].interval/1000)&0xFF,(parseInt(worklogs[id].interval/1000)>>8)&0xFF]
				};
			}
		} else {
			//console.log("workingtime2");
			return {
				addr: parseInt(id),
				data: [worklogs[id].debug === true? EACK_DEBUG: EACK_NOP,parseInt(worklogs[id].interval/1000)&0xFF,(parseInt(worklogs[id].interval/1000)>>8)&0xFF]
			};
		}
	}
	function updateEnhanceAck(rst,data) {
		var enhanceAck = global.lazuriteConfig.machineInfo.enhanceAck;
		if(rst === true) {
			enhanceAck.push(data);
		} else {
			for(var i of enhanceAck) {
				if(i.addr === data.addr) {
					i.data = data.data;
				}
			}
		}
	}
	function tickEnhanceAck() {
		var worklogs = global.lazuriteConfig.machineInfo.worklog;
		var result = false;
		for(var id in worklogs) {
			var enhanceAck = pickupEnhanceAck(id);
			//console.log({func: 'tick',worklog: worklogs[id],enhanceAck: enhanceAck});
			if(enhanceAck.data[0] !== EACK_UPDATE) {
				if(enhanceAck.data[0] !== EACK_UPDATE) {
					var newEnhanceAck = calEnhanceAck(id);
					//console.log(newEnhanceAck);
					if((enhanceAck.data[0] !== newEnhanceAck.data[0]) ||
						(enhanceAck.data[1] !== newEnhanceAck.data[1]) ||
						(enhanceAck.data[2] !== newEnhanceAck.data[2])) {
						updateEnhanceAck(false,newEnhanceAck);
						//console.log({now: enhanceAck,new: newEnhanceAck});
						result = true;
					}
				}
			}
		}
		return result;
	}
	function pickupEnhanceAck(id) {
		//console.log({cmd:"pickupEnhanceAck", id: id, data:global.lazuriteConfig.machineInfo.enhanceAck});
		for(var data of global.lazuriteConfig.machineInfo.enhanceAck) {
			//console.log({cmd:"pickupEnhanceAck",id:id, data:data});
			if(data.addr === parseInt(id)) {
				return data;
			}
		}
		return null;
	}
}
