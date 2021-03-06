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
	const os = require('os');
	const url = require('url');
	const execSync = require('child_process').execSync;
	const KEEP_ALIVE = 1800*1000;
	const MEAS_INTERVAL = 5*1000;
	const EACK_NOP = 0;
	const EACK_DEBUG = 1;
	const EACK_UPDATE = 2;
	const EACK_DISCONNECT = 3;
	const EACK_FIRMWARE_UPDATE = 0xF0;
	const UNIT_SIZE_V2 = 6; // id,'on'or'off',value,voltage,[reason],[deltaT]
	let addr2id = {};
	let timerThread = null;

	let https;
	let api_server;
	let api_server_uri;

	function BOOL(d) {
		if(typeof d === "string") {
			d = d.toLowerCase();
		}
		switch(d) {
			case "undefined":
			case "null":
			case "false":
			case false:
			case "0":
			case "":
			case 0:
			case null:
			case undefined:
				return false;
			default:
				return true;
		}
	}
	global.lazuriteConfig = {
		machineInfo: {
			worklog: {},
			graph: {},
			vbat: {}
		},
		bridgeInfo: [],
		sendLogMessage: function(msg,callback) {
			//check network
			//console.log(this);
			let enbNetwork = false;
			for(let socket in os.networkInterfaces()) {
				if(socket !== "lo") {
					enbNetwork = true;
				}
			}
			if(enbNetwork === false) {
				callback({message: 'network error'});
				return;
			}
			if(this.line === undefined) {
				callback({message: 'line config error'});
				return;
			}
			const u = url.parse("https://api.line.me/v2/bot/message/push")
			const lineHttpOptions = {
				host: api_server_uri.hostname,
				port: api_server_uri.port,
				path: api_server_uri.path,
				method: 'POST',
				headers: {
					"Content-Type": "application/json; charset=UTF-8",
					"Authorization" : "Bearer "+this.line.access_token
				}
			};
			// checkNetwork
			let postData = {
				to: this.line.id,
				messages: [
					{
						type: 'text',
						text: msg
					}
				]
			}
			try {
				let req = httpsLine.request(lineHttpOptions,(res) => {
					res.setEncoding("utf8");
					res.on('data',(chunk) => {
						console.log("[awsiot] LINE POST MESSAGE: "+chunk);
						callback(null,chunk);
					});
					res.on('error',(e) => {
						console.log("[awsiot] LINE POST ERROR: " + e.message);
						callback(e,null);
					});
				});
				req.write(JSON.stringify(postData));
				req.end();
			} catch(e) {
				callback(e,null);
			}
		},
		optimeInfo: {
			Items:[],
			getNextEvent: function() {
				let alertTime = [];
				let now = new Date();
				let currentState = null;
				let time;
				for(let i = 0; i < 8; i++) {
					let v = this.Items[(now.getDay()+i)%7];
					if(v.setOff === 0) {
						if(v.setTime === 1) {
							let tmp = v.stTime.split(":");
							let hours = parseInt(tmp[0]);
							let minutes = parseInt(tmp[1]);
							time = new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,0,0,0);
							//console.log({i:i, now: now.toLocaleString(), time: time.toLocaleString(),v:v});
							alertTime.push({state: false,time: time});
							time = new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,hours,minutes,0);
							time.setTime(time.getTime() - KEEP_ALIVE);
							alertTime.push({state: true,time: time});
							tmp = v.endTime.split(":");
							hours = parseInt(tmp[0]);
							minutes = parseInt(tmp[1]);
							time = new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,hours,minutes,0);
							alertTime.push({state: false ,time: time});
						} else {
							time = new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,0,0,0);
							time.setTime(time.getTime() - KEEP_ALIVE);
							alertTime.push({state: true,time: time});
						}
					} else {
						time = new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,0,0,0);
						alertTime.push({state: false,time: time});
					}
				}
				/*
				for(let a of alertTime) {
					console.log({state:a.state,time: a.time.toLocaleString()});
				}
				*/
				for(let a of alertTime) {
					if(currentState === null) {currentState = a.state}
					//console.log({currentState: currentState, state: a.state, time: a.time.toLocaleString(), now: now.toLocaleString()});
					if((now < a.time) && (a.state !== currentState)) return {state:currentState, time: a.time};
					currentState = a.state;
				}
				return {state:currentState};
			},
		},
		isGatewayActive:  false
	}

	function genBridgePayload(type,param) {
		let worklogs = global.lazuriteConfig.machineInfo.worklog;
		let optime = global.lazuriteConfig.optimeInfo;
		let bridges = global.lazuriteConfig.bridgeInfo;
		let arr = [];
		if ((type === 'sensor') && (param !== undefined)) {
			let addr,payload_str = '';
			for (let id of param.node) {
				let thres_str = '', eack_str = '';
				for (let key in addr2id) {
					if (addr2id[key] === id) {
						addr = key;
						break;
					}
				}
				if ((addr !== undefined) && (parseInt(addr) !== 0xffff)) {
					thres_str += `:${addr}:${id}:${worklogs[id].thres0},${worklogs[id].detect0},${worklogs[id].thres1},${worklogs[id].detect1}`
					if (worklogs[id].debug === true) { // グラフ描画を再優先
						eack_str += `:${EACK_DEBUG},${(MEAS_INTERVAL/1000) & 0x00FF},${((MEAS_INTERVAL/1000) >> 8) & 0x00FF}`;
					} else if ((optime.nextEvent.state === false) || (worklogs[id].lowFreq !== false)) { // 稼働時間のイベントがない、低頻度モードはKEEP ALIVE
						eack_str += `:${EACK_DEBUG},${(KEEP_ALIVE/1000) & 0x00FF},${((KEEP_ALIVE/1000) >> 8) & 0x00FF}`;
					} else { // その他は指定のインターバル
						eack_str += `:${EACK_NOP},${(worklogs[id].interval/1000) & 0x00FF},${((worklogs[id].interval/1000) >> 8) & 0x00FF}`;
					}
					payload_str += thres_str+eack_str;
				}
			}
			if (payload_str.length != 0) arr.push({ dst_panid: 0xffff, dst_addr: param.addr64, payload: type+payload_str });
		} else if (type === 'eack') {
			for (let b of bridges) {
				let eack_str = '';
				for (let id of b.node) {
					if (typeof worklogs[id] !== 'undefined') {
						eack_str +=`:${id}`;
						if (worklogs[id].debug === true) { // グラフ描画を再優先
							eack_str += `:${EACK_DEBUG},${(MEAS_INTERVAL/1000) & 0x00FF},${((MEAS_INTERVAL/1000) >> 8) & 0x00FF}`;
						} else if ((optime.nextEvent.state === false) || (worklogs[id].lowFreq !== false)) { // 稼働時間のイベントがない、低頻度モードはKEEP ALIVE
							eack_str += `:${EACK_DEBUG},${(KEEP_ALIVE/1000) & 0x00FF},${((KEEP_ALIVE/1000) >> 8) & 0x00FF}`;
						} else { // その他は指定のインターバル
							eack_str += `:${EACK_NOP},${(worklogs[id].interval/1000) & 0x00FF},${((worklogs[id].interval/1000) >> 8) & 0x00FF}`;
						}
					}
				}
				if (eack_str !== '') arr.push({ dst_panid: 0xffff, dst_addr: b.addr64, payload: type+eack_str });
			}
		} else if (type === 'init') {
			for (let b of bridges) {
				arr.push({ dst_panid: 0xffff, dst_addr: b.addr64, payload: type });
			}
		}
		return arr;
	}

	function genBridgeInfo(items) {
		global.lazuriteConfig.bridgeInfo = items.map((x)=> {
			let addr64 = [];
			addr64.push(parseInt(x.addr64.slice(12,16),16));
			addr64.push(parseInt(x.addr64.slice( 8,12),16));
			addr64.push(parseInt(x.addr64.slice( 4, 8),16));
			addr64.push(parseInt(x.addr64.slice( 0, 4),16));
			return { addr64:addr64, node:x.machine.split('|').map(x => parseInt(x)) };
		});
	}

	try {
		fs.statSync('/home/pi/.lazurite/tmp/lazuriteConfigMachineInfo.json');
		global.lazuriteConfig.machineInfo = JSON.parse(fs.readFileSync('/home/pi/.lazurite/tmp/lazuriteConfigMachineInfo.json','utf8'));
	} catch(e) {
	}

	function LazuriteFactoryParams(config) {
		RED.nodes.createNode(this,config);
		let node = this;

		api_server = config.server;
		api_server_uri = url.parse(config.server);
		https = require(api_server_uri.protocol.slice(0,-1));

		global.lazuriteConfig.awsiotConfig = JSON.parse(fs.readFileSync(config.awsiotConfig,'utf8'));
		global.lazuriteConfig.log = {topic: global.lazuriteConfig.awsiotConfig.topic.split('/')[0]+'/log'};
		global.lazuriteConfig.capacity = {topic: global.lazuriteConfig.awsiotConfig.topic.split('/')[0]+'/capacity'};
		global.lazuriteConfig.gwid = parseInt((global.lazuriteConfig.awsiotConfig.name).slice(-3));

		//node.config = config;
		//console.log(global.lazuriteConfig);
		let httpOptions = {
			//host: "api.lazurite.io",
			host: api_server_uri.hostname,
			port: api_server_uri.port,
			method: 'GET',
			headers: {
				"Accept": "application/json",
				"Content-Type" : "application/json",
				"LAZURITE-API-KEY": global.lazuriteConfig.awsiotConfig.access.key,
				"LAZURITE-API-TOKEN": global.lazuriteConfig.awsiotConfig.access.token
			}
		};
		new Promise((resolve,reject) => {
			getParameter(api_server_uri.pathname+'/info/machine',(err,res) => {
				if(err){
					reject(err);
				} else {
					node.send({payload:res});
					genAddressMap(res.Items);
					resolve();
				}
			});
		}).then(() => {
			return new Promise((resolve,reject) => {
				getParameter(api_server_uri.pathname+'/info/optime',(err,res) => {
					if(err){
						reject(err);
					} else {
						node.send([,{payload:res}]);
						global.lazuriteConfig.optimeInfo.Items = res.Items;
						resolve();
					}
				});
			});
		}).then(() => {
			return new Promise((resolve,reject) => {
				getParameter(api_server_uri.pathname+'/info/bridge',(err,res) => {
					if(err){
						reject(err);
					} else {
						if (res.success === false) {
							//console.log(res);
						} else {
							genBridgeInfo(res.Items);
						}
						resolve();
					}
				});
			});
		}).then((values) => {
			return new Promise((resolve,reject) => {
				getParameter(api_server_uri.pathname+'/info/gateway/line',(err,res) => {
					if(err) {
						reject(err);
					} else {
						global.lazuriteConfig.line = res.line;
						resolve(values);
					}
				});
			});
		}).then(() => {
			//let optime = global.lazuriteConfig.optimeInfo;
			//optime.nextEvent = optime.getNextEvent(null);
			initEnhanceAck(true);
			global.lazuriteConfig.isGatewayActive = true;
			console.log("init done");
		}).catch((err) => {
			node.send([,,,{payload:err}]);
		});

		node.on('input', function (msg) {
			if(timerThread) {
				clearTimeout(timerThread);
				timerThread = null;
			}
			new Promise((resolve,reject) => {
				let m = JSON.parse(msg.payload);
				switch(m.type) {
					case 'machine':
					case 'bridge':
						Promise.all([
							new Promise((res0,rej0) => {
								getParameter(api_server_uri.pathname+'/info/machine',(err,res) => {
									if(err){
										rej0(err);
									} else {
										node.send({payload:res});
										genAddressMap(res.Items);
										res0();
									}
								});
							}),
							new Promise((res1,rej1) => {
								getParameter(api_server_uri.pathname+'/info/bridge',(err,res) => {
									if(err){
										rej1(err);
									} else {
										if (res.success === false) {
											//console.log(res);
										} else {
											genBridgeInfo(res.Items);
										}
										res1();
									}
								});
							})
						]).then(() => {
							resolve();
						}).catch((err) => {
							reject(err);
						});
						break;
					case 'optime':
						getParameter(api_server_uri.pathname+'/info/optime',(err,res) => {
							if(err){
								reject(err);
							} else {
								node.send([,{payload:res}]);
								global.lazuriteConfig.optimeInfo.Items = res.Items;
								//console.log(JSON.stringify(global.lazuriteConfig.optimeInfo,null,"  "));
								resolve();
							}
						});
						break;
					case 'reason': {
						let worklogs = global.lazuriteConfig.machineInfo.worklog;
						if (worklogs[m.id].log === true) {
							if (typeof m.reason !== 'undefined') {
								worklogs[m.id].stopReason = parseInt(m.reason);
							}
						}
						break;
					}
					default:
						reject('LazuriteFactoryParams unsupported message type');
						break;
				}
			}).then(() => {
				//let optime = global.lazuriteConfig.optimeInfo;
				//optime.nextEvent = optime.getNextEvent();
				initEnhanceAck(true);
			}).catch((err) => {
				node.send([,,,{payload:err}]);
			});
		});
		node.on('close',(done) => {
			if(timerThread) {
				clearInterval(timerThread);
				timerThread = null;
			}
			try {
				fs.statSync('/home/pi/.lazurite/tmp');
			} catch(e) {
				fs.mkdifSync('/home/pi/.lazurite/tmp');
			}
			fs.writeFileSync('/home/pi/.lazurite/tmp/lazuriteConfigMachineInfo.json',JSON.stringify(global.lazuriteConfig.machineInfo));
			done();
		});
		function genAddressMap(data) {
			global.lazuriteConfig.machineInfo.worklog = {};
			addr2id = {};
			let worklog = global.lazuriteConfig.machineInfo.worklog;
			let graph = global.lazuriteConfig.machineInfo.graph;
			for(let i in data) {
				let addr,stopReason;
				if ((!isNaN(parseInt("0x"+data[i].addr)) && (data[i].addr.length == 16))){
					addr = parseInt("0x"+data[i].addr);
					addr = addr & 0xffff;
				} else if(!isNaN(Number(data[i].addr))){
					addr = Number(data[i].addr);
				} else {
					let tmp = data[i].addr.split('_');  // multi sensor type such as 0x4321_0, 0x4321_1,...
					if ((tmp.length === 2) && !isNaN(Number(tmp[0])) && !isNaN(Number(tmp[1]))) {
						//console.log({addr:tmp[0],index:tmp[1]});
						addr = Number(tmp[0])+Number(tmp[1])*0x10000;
					} else {
						continue;
					}
				}
				stopReason = data[i].reason || 0; // 0 means 'unselected'
				// restore saved previous stop reason
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
						invert: BOOL(data[i].invert),
						debug: BOOL(data[i].debug),
						disp: BOOL(data[i].disp),
						lowFreq: BOOL(data[i].lowfreq),
						stopReason: stopReason,
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
							invert: BOOL(data[i].invert),
							debug: true,
							disp: false,
							lowFreq: false,
							stopReason: stopReason,
						}
					}
				} else {
					addr2id[addr] = data[i].id;
					graph[data[i].id] = {enabled: false};
				}
			}
			//console.log(JSON.stringify({cmd: 'genAddressMap',info: global.lazuriteConfig.machineInfo},undefined,2));
		}
		function initEnhanceAck(mode) {
			// mode: true		DBが更新された時
			// mode: false	DBが更新されていない時(timer割り込み時)
			global.lazuriteConfig.enhanceAck = [];
			let optime = global.lazuriteConfig.optimeInfo;
			let enhanceAck = global.lazuriteConfig.enhanceAck;
			let worklogs = global.lazuriteConfig.machineInfo.worklog;
			let interval;
			//イベントを更新
			optime.nextEvent = optime.getNextEvent();
			if(optime.nextEvent.time === undefined) {
				//console.log(optime.nextEvent);
			} else {
				//console.log({state: optime.nextEvent.state, time: optime.nextEvent.time.toLocaleString()});
			}
			// 次のenhanceAckを作成
			//console.log({initEnhanceAck:mode,optime: optime.nextEvent});
			for(let i in worklogs) {
				// 変換後のショートアドレス(id)から下4桁のMACアドレスを逆引き
				let real_addr = Object.keys(addr2id).find((key) => {
					return addr2id[key] === parseInt(i);
				});
				// multi sensor typeの従属アドレスはスキップ
				if (parseInt(real_addr) > 0x10000) continue;
				if (worklogs[i].debug === true) { // グラフ描画を再優先
					enhanceAck.push({
						addr: parseInt(i),
						data: [EACK_DEBUG,(MEAS_INTERVAL/1000) & 0x00FF, ((MEAS_INTERVAL/1000) >> 8) & 0x00FF]
					});
				} else {
					if(mode === true) {
						// 低頻度モードの場合は強制的にKeep Alive時間寝かせる
						if (worklogs[i].lowFreq !== false) {
							interval = parseInt(KEEP_ALIVE / 1000);
							enhanceAck.push({
								addr: parseInt(i),
								data: [EACK_DEBUG,interval & 0x00FF,(interval >> 8) & 0x00FF]
							});
						} else {
							interval = parseInt(MEAS_INTERVAL / 1000);
							enhanceAck.push({
								addr: parseInt(i),
								data: [EACK_UPDATE,interval & 0x00FF,(interval >> 8) & 0x00FF]
							});
						}
					} else {
						if(optime.nextEvent.state === true) {
							interval = parseInt(worklogs[i].interval / 1000);
							enhanceAck.push({
								addr: parseInt(i),
								data: [EACK_NOP,interval & 0x00FF,(interval >> 8) & 0x00FF]
							});
						} else {
							interval = parseInt(KEEP_ALIVE / 1000);
							enhanceAck.push({
								addr: parseInt(i),
								data: [EACK_DEBUG,interval & 0x00FF,(interval >> 8) & 0x00FF]
							});
						}
					}
				}
			}
			enhanceAck.push({
				addr: 0xffff,
				data:[EACK_DISCONNECT,5,0]
			});
			node.send([,,{payload: global.lazuriteConfig.enhanceAck}]);

			// setTrigger
			let now = new Date();
			if(timerThread) {
				clearTimeout(timerThread);
				timerThread = null;
			}
			if(optime.nextEvent.time) {
				timerThread = setTimeout(function() {
					initEnhanceAck(false);
				},optime.nextEvent.time - now);
			}
			if (global.lazuriteConfig.bridgeInfo.length !== 0) {
				let payload_type;
				if (mode === true) payload_type = 'init';
				else payload_type = 'eack';
				let delayedSend = function(a) {
					return new Promise((resolve,reject) => {
						setTimeout(function() {
							node.send([,,,,{
								dst_panid: a.dst_panid,
								dst_addr: a.dst_addr,
								payload: a.payload
							}]);
							resolve();
						}, 50);
					});
				}
				let p = Promise.resolve();
				for (let a of genBridgePayload(payload_type)) {
					p = p.then(delayedSend.bind(null,a));
				}
			}
		}
		function getParameter(path,callback) {
			let retry = 0;
			function loop () {
				new Promise((resolve,reject) => {
					try {
						let body = "";
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
					} catch(e) {
						console.log(e);
						reject(e);
					}
				}).then((values) => {
					timerThread = null;
					try {
						callback(null,JSON.parse(values));
					} catch(err) {
						console.log({path:path,values: values,err:err});
					}
				}).catch((err) => {
					console.log(err);
					retry += 1;
					if(retry < 10) {
						timerThread = setTimeout(loop,30000);
					} else {
						callback(err,null);
					}
				});
			}
			loop();
		}
	}
	RED.nodes.registerType("lazurite-factory-params", LazuriteFactoryParams);
	/*
	 * device manager
	 */
	function LazuriteDeviceManager(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.on('input', function (msg) {
			if(global.lazuriteConfig.isGatewayActive === true) {
				if(Array.isArray(msg.payload)) {
					for(let i in msg.payload) {
						checkRxData(msg.payload[i]);
					}
				} else {
					checkRxData(msg.payload);
				}
			}
		});
		function checkRxData(rxdata) {
			if(global.lazuriteConfig.machineInfo.worklog === undefined) {
				return;
			}
			let worklogs = global.lazuriteConfig.machineInfo.worklog;
			let bridges = global.lazuriteConfig.bridgeInfo;
			let dst_addr64 = [];
			for (let i=0;i<4;i++) dst_addr64.unshift(('000'+rxdata.dst_addr[i].toString(16)).slice(-4));
			dst_addr64 = parseInt('0x'+dst_addr64.join(''));
			rxdata.payload = rxdata.payload.split(",");
			let dataFromBridge = false;
			if (bridges.length !== 0) {
				if (dst_addr64 === global.gateway.macaddr) {
					let b = bridges.find(x => x.addr64.toString() === rxdata.src_addr.toString());
					if (b !== undefined) dataFromBridge = true;
				}
			}
			if ((rxdata.dst_panid == global.gateway.panid) || (dataFromBridge === true)) {
				if(rxdata.payload[0] === "update") {
					let id = rxdata.src_addr[0];
					// 変換後のショートアドレス(id)から下4桁のMACアドレスを逆引き
					let real_addr = Object.keys(addr2id).find((key) => {
						return addr2id[key] === id;
					});
					// 下4桁が同一のMACアドレスを持つキーの配列
					let multi_addrs = Object.keys(addr2id).filter((key) => {
						return ((key ^ real_addr) & 0xffff) === 0;
					});
					if(worklogs[id]){
						for(let eack of global.lazuriteConfig.enhanceAck) {
							if(eack.addr === id) {
								// update enhanceAck
								let optime = global.lazuriteConfig.optimeInfo;
								if (worklogs[id].debug === true) { // グラフ描画を再優先
									eack.data = [EACK_DEBUG,(MEAS_INTERVAL/1000) & 0x00FF, ((MEAS_INTERVAL/1000) >> 8) & 0x00FF];
								} else if ((optime.nextEvent.state === false) || (worklogs[id].lowFreq !== false)) { // 稼働時間のイベントがない、低頻度モードはKEEP ALIVE
									eack.data = [EACK_DEBUG,KEEP_ALIVE/1000 & 0x00FF, ((KEEP_ALIVE/1000) >> 8) & 0x00FF];
								} else { // その他は指定のインターバル
									eack.data = [EACK_NOP,(worklogs[id].interval/1000) & 0x00FF, ((worklogs[id].interval/1000) >> 8) & 0x00FF];
								}
								if (multi_addrs.length > 1) {
									// multi sensor type
									let payload = `activate,${global.gateway.panid},${global.gateway.shortaddr}`;
									for (let addr of multi_addrs) {
										let new_id = addr2id[addr];
										if (worklogs[new_id]) {
											payload += `,${new_id},${worklogs[new_id].thres0},${worklogs[new_id].detect0},${worklogs[new_id].thres1},${worklogs[new_id].detect1}`;
										}
									}
									node.send([,{
										dst_panid: rxdata.dst_panid,
										dst_addr: rxdata.src_addr,
										payload: payload,
									},,{payload: global.lazuriteConfig.enhanceAck}]);
								} else {
									// single sensor type
									node.send([,{
										dst_panid: rxdata.dst_panid,
										dst_addr: rxdata.src_addr,
										payload: `activate,${global.gateway.panid},${global.gateway.shortaddr},${id},${worklogs[id].thres0},${worklogs[id].detect0},${worklogs[id].thres1},${worklogs[id].detect1}`
									},,{payload: global.lazuriteConfig.enhanceAck}]);
								}
								break;
							}
						}
					}
				} else if (rxdata.payload[0] === "error") {
					let msg = `[nodered] Lazurite Enhance ACK ERROR\n`;
					msg += `DATE: ${(new Date).toLocaleString()}\n`;
					msg += `GW NAME: ${global.lazuriteConfig.awsiotConfig.name}\n`
					msg += `SRC_ADDR: ${"0x"+("0000"+rxdata.src_addr[0].toString(16)).slice(-4)}\n`;
					msg += `MSG: ${rxdata.payload}\n`;
					//console.log(msg);
					global.lazuriteConfig.sendLogMessage(msg,(err,res) => {
						if(err) {
							msg += `ERR: ${JSON.stringify(err,null,"  ")}\n`;
							fs.writeFileSync("/home/pi/.lazurite/error.log",msg);
						}
						execSync("sudo reboot");
					});
				} else {
					// state information
					let id = rxdata.src_addr[0];
					if ((rxdata.payload[0] === 'v2') && ((rxdata.payload.length-1)%UNIT_SIZE_V2 === 0)) {
						// multi sensor type
						// payload format
						// 'v2',id,'on'/'off',value,voltage,[reason],[deltaT], ...
						let new_id,new_rxdata;
						let p = Promise.resolve();
						let delayedSend = function(n) {
							return new Promise((resolve,reject) => {
								setTimeout(function() {
									new_rxdata = Object.assign({},rxdata); // clone object
									new_rxdata.payload = [];
									new_id = rxdata.payload[1+UNIT_SIZE_V2*n];
									if(worklogs[new_id]){
										new_rxdata.src_addr[0] = parseInt(new_id);
										new_rxdata.src_addr[1] = 0;
										new_rxdata.src_addr[2] = 0;
										new_rxdata.src_addr[3] = 0;
										new_rxdata.payload[0] = rxdata.payload[2+UNIT_SIZE_V2*n]; // "on" or "off"
										new_rxdata.payload[1] = rxdata.payload[3+UNIT_SIZE_V2*n]; // value
										new_rxdata.payload[2] = rxdata.payload[4+UNIT_SIZE_V2*n]; // voltage
										if ((rxdata.payload[5+UNIT_SIZE_V2*n] !== undefined) &&
											(rxdata.payload[5+UNIT_SIZE_V2*n] !== "")) {
											new_rxdata.payload[3] = rxdata.payload[5+UNIT_SIZE_V2*n]; // reason
										}
										new_rxdata.nsec += 1000000 * n; // 1msずらす
										if(worklogs[new_id].invert === true) {
											new_rxdata.payload[0] = (new_rxdata.payload[0] === "on") ? "off" : "on";
										}
										let deltaT = rxdata.payload[6+UNIT_SIZE_V2*n];
										if (deltaT) {
											let time_nsec = new_rxdata.sec*1000*1000*1000 + new_rxdata.nsec - parseInt(deltaT*1000*1000);
											new_rxdata.nsec = time_nsec%(1000*1000*1000);
											new_rxdata.sec = parseInt((time_nsec - new_rxdata.nsec)/(1000*1000*1000));
										}
										node.send([,,new_rxdata]);											// send capacity information
										if(worklogs[new_id].disp) {
											node.send([,,,,{
												payload: {
													a: new_id,
													t: parseInt(new_rxdata.sec*1000+new_rxdata.nsec/1000000),
													d: new_rxdata.payload
												},
												topic: global.lazuriteConfig.log.topic
											}]);			// send rxdata to log
										}
									}
									resolve();
								},50);
							});
						}
						for (let i=0;i<(rxdata.payload.length-1)/UNIT_SIZE_V2;i++) {
							p = p.then(delayedSend.bind(null,i));
						}
					} else if ((rxdata.payload.length >= 3) && (rxdata.payload.length <= 5)) {
						// single sensor type
						if (rxdata.payload.length === 5) {
							let deltaT = rxdata.payload[4];
							if (deltaT) {
								let time_nsec = rxdata.sec*1000*1000*1000 + rxdata.nsec - parseInt(deltaT*1000*1000);
								rxdata.nsec = time_nsec%(1000*1000*1000);
								rxdata.sec = parseInt((time_nsec - rxdata.nsec)/(1000*1000*1000));
							}
							rxdata.payload.pop();
						}
						if ((rxdata.payload.length === 4) && (rxdata.payload[3] === '')) {
							rxdata.payload.pop(); // no reason
						}
						if(worklogs[id]){
							if(worklogs[id].invert === true) {
								rxdata.payload[0] = (rxdata.payload[0] === "on") ? "off" : "on";
								//	console.log({id:id, rxdata:rxdata,worklog: worklogs[id]});
							}
							node.send([,,rxdata]);											// send capacity information
							if(worklogs[id].disp) {
								node.send([,,,,{
									payload: {
										a: rxdata.src_addr,
										t: parseInt(rxdata.sec*1000+rxdata.nsec/1000000),
										d: rxdata.payload
									},
									topic: global.lazuriteConfig.log.topic
								}]);			// send rxdata to log
							}
						}
					}
				}
			} else if (bridges.length !== 0) {
				let b = bridges.find(x => x.addr64.toString() === rxdata.src_addr.toString());
				if (b !== undefined) {
					if (rxdata.payload[0] === "factory-iot") {
						let id = addr2id[parseInt(rxdata.payload[3])];
						let prog_sensor = rxdata.payload[1]+"_"+rxdata.payload[2];
						postActivate(id,prog_sensor);
					} else if (rxdata.payload[0] === "error") {
						if (rxdata.payload[1] === "activate") {
							console.log("[nodered] activation error: "+rxdata.payload[2]);
						} else {
							let delayedSend = function(a) {
								return new Promise((resolve,reject) => {
									setTimeout(function() {
										node.send([{
											dst_panid: a.dst_panid,
											dst_addr: a.dst_addr,
											payload: a.payload
										}]);
										resolve();
									}, 50);
								});
							}
							let p = Promise.resolve();
							for (let a of genBridgePayload('init')) {
								p = p.then(delayedSend.bind(null,a));
							}
							setTimeout(function () {
								let msg = `[nodered] Lazurite Enhance ACK ERROR\n`;
								msg += `DATE: ${(new Date).toLocaleString()}\n`;
								msg += `GW NAME: ${global.lazuriteConfig.awsiotConfig.name}\n`
								msg += `SRC_ADDR: ${"0x"+("0000"+rxdata.src_addr[0].toString(16)).slice(-4)}\n`;
								msg += `MSG: ${rxdata.payload}\n`;
								console.log(msg);
								return;
								global.lazuriteConfig.sendLogMessage(msg,(err) => {
									if(err) {
										msg += `ERR: ${JSON.stringify(err,null,"  ")}\n`;
										fs.writeFileSync("/home/pi/.lazurite/error.log",msg);
									}
									execSync("sudo reboot");
								});
							},1000);
						}
					} else if ((rxdata.payload[0] === 'v2') && ((rxdata.payload.length-1)%UNIT_SIZE_V2 === 0)) {
						// state information
						// single sensor type
						// payload format
						// 'v2',id,'on'/'off',value,voltage,[reason],[deltaT]
						let id = parseInt(rxdata.payload[1]);
						let deltaT = rxdata.payload[6];
						if (deltaT) {
							let time_nsec = rxdata.sec*1000*1000*1000 + rxdata.nsec - parseInt(deltaT*1000*1000);
							rxdata.nsec = time_nsec%(1000*1000*1000);
							rxdata.sec = parseInt((time_nsec - rxdata.nsec)/(1000*1000*1000));
						}
						if (worklogs[id]){
							rxdata.src_addr[0] = id;
							rxdata.src_addr[1] = 0;
							rxdata.src_addr[2] = 0;
							rxdata.src_addr[3] = 0;
							if ((rxdata.payload[5] !== undefined) && (rxdata.payload[5] !== "")) {
								rxdata.payload = rxdata.payload.slice(2,6); // reason exists
							} else {
								rxdata.payload = rxdata.payload.slice(2,5); // no reason
							}
							if (worklogs[id].invert === true) {
								rxdata.payload[0] = (rxdata.payload[0] === "on") ? "off" : "on";
							}
							node.send([,,rxdata]);											// send capacity information
							if (worklogs[id].disp) {
								node.send([,,,,{
									payload: {
										a: rxdata.src_addr,
										t: parseInt(rxdata.sec*1000+rxdata.nsec/1000000),
										d: rxdata.payload
									},
									topic: global.lazuriteConfig.log.topic
								}]);			// send rxdata to log
							}
						}
					}
				}
			} else {
				// state information
				// broadcast
				// from sensor or bridge
				//console.log({rxdata:rxdata});
				if(rxdata.payload[0] === "factory-iot") {
					let id = addr2id[rxdata.src_addr[0]];
					// sensorがbridgeされていたら抜ける
					if (bridges.length !== 0) {
						for (let b of bridges) {
							if (b.node.includes(id) === true) return;
						}
					}
					// 下4桁が同一のMACアドレスを持つキーの配列
					let multi_addrs = Object.keys(addr2id).filter((key) => {
						return ((parseInt(key) ^ rxdata.src_addr[0]) & 0xffff) === 0;
					});
					//console.log({id:id, src: rxdata.src_addr[0]});
					if(worklogs[id]){
						for(let eack of global.lazuriteConfig.enhanceAck) {
							if(eack.addr === id) {
								// update enhanceAck
								let optime = global.lazuriteConfig.optimeInfo;
								if (worklogs[id].debug === true) { // グラフ描画を再優先
									eack.data = [EACK_DEBUG,(MEAS_INTERVAL/1000) & 0x00FF, ((MEAS_INTERVAL/1000) >> 8) & 0x00FF];
								} else if ((optime.nextEvent.state === false) || (worklogs[id].lowFreq !== false)) { // 稼働時間のイベントがない、低頻度モードはKEEP ALIVE
									eack.data = [EACK_DEBUG,KEEP_ALIVE/1000 & 0x00FF, ((KEEP_ALIVE/1000) >> 8) & 0x00FF];
								} else { // その他は指定のインターバル
									eack.data = [EACK_NOP,(worklogs[id].interval/1000) & 0x00FF, ((worklogs[id].interval/1000) >> 8) & 0x00FF];
								}
								if (multi_addrs.length > 1) {
									// multi sensor type
									let payload = `activate,${global.gateway.panid},${global.gateway.shortaddr}`;
									for (let addr of multi_addrs) {
										let new_id = addr2id[addr];
										if (worklogs[new_id]) {
											payload += `,${new_id},${worklogs[new_id].thres0},${worklogs[new_id].detect0},${worklogs[new_id].thres1},${worklogs[new_id].detect1}`;
										}
									}
									node.send([{dst_panid: 0xffff,
										dst_addr: rxdata.src_addr,
										payload: payload
									},,,{payload: global.lazuriteConfig.enhanceAck}]);
								} else {
									// single sensor type
									node.send([{dst_panid: 0xffff,
										dst_addr: rxdata.src_addr,
										payload: `activate,${global.gateway.panid},${global.gateway.shortaddr},${id},${worklogs[id].thres0},${worklogs[id].detect0},${worklogs[id].thres1},${worklogs[id].detect1}`
									},,,{payload: global.lazuriteConfig.enhanceAck}]);
								}
								break;
							}
						}
						//console.log(rxdata.payload);
						let payload = rxdata.payload;
						let prog_sensor;
						if (payload.length >= 3) {
							if (payload[1] === 'CT_Sensor_vDet2') {
								prog_sensor = 'CTSensor2_'+payload[2];
							} else {
								prog_sensor = payload[1]+"_"+payload[2];
							}
						} else if (payload.length === 2) {
							prog_sensor = payload[1];
						}
						if (multi_addrs.length > 1) {
							// multi sensor type
							multi_addrs.forEach((v,i) => {
								setTimeout(postActivate,100*i,addr2id[v],prog_sensor);
							});
						} else {
							// single sensor type
							postActivate(id,prog_sensor);
						}
					}
				} else if (rxdata.payload[0] === "factory-iot-bridge") {
					let b = bridges.find(x => x.addr64.toString() === rxdata.src_addr.toString());
					if (b !== undefined) {
						let delayedSend = function(a) {
							return new Promise((resolve,reject) => {
								setTimeout(function() {
									node.send([{
										dst_panid: a.dst_panid,
										dst_addr: a.dst_addr,
										payload: a.payload
									}]);
									resolve();
								}, 50);
							});
						}
						let p = Promise.resolve();
						for (let a of genBridgePayload('sensor', b)) {
							p = p.then(delayedSend.bind(null,a));
						}
					}
				}
			}
		}

		function postActivate(id,prog_sensor) {
			//host: "api.lazurite.io",
			const httpsOptions = {
				host: api_server_uri.hostname,
				port: api_server_uri.port,
				path: api_server_uri.pathname+'/info/sensor/activate',
				method: 'POST',
				headers: {
					"Accept": "application/json",
					"Content-Type" : "application/json",
					"LAZURITE-API-KEY": global.lazuriteConfig.awsiotConfig.access.key,
					"LAZURITE-API-TOKEN": global.lazuriteConfig.awsiotConfig.access.token
				}
			};
			// checkNetwork
			let postData = {
				id: id,
				prog_sensor: prog_sensor
			};
			try {
				let body = "postActivate:: ";
				let req = https.request(httpsOptions,(res) => {
					res.setEncoding("utf8");
					res.on('data',(chunk) => {
						body += chunk;
						//		console.log("[activate] "+body);
					});
					res.on('end',() => {
					});
				});
				req.on('error',(e) => {
					//		console.log("[activate] " + e);
				});
				req.write(JSON.stringify(postData));
				req.end();
			} catch(e) {
				// console.log("[activate] " + e);
			}
		}
	}
	RED.nodes.registerType("lazurite-device-manager", LazuriteDeviceManager);
}

