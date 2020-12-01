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
	const debug = false;
	let fs = require('fs');
	const INTERVAL_GRAPH = 29*1000;
	const INTERVAL_VBAT = 0 * 60*1000;
	const util = require("util");
	//const INTERVAL_VBAT = 60*1000;
	function LazuriteCapacity(config) {
		let node = this;
		let sensorInfo = {};
		let hourCapacity = {};
		let hour = {};
		let timer1,timer2;
		/*
		 * Restore previous data
		 */
		try {
			fs.statSync('/home/pi/.lazurite/tmp/capacity.json');
			let tmp = JSON.parse(fs.readFileSync('/home/pi/.lazurite/tmp/capacity.json','utf8'));
			for(let t0 in tmp){
				for(let t1 in tmp[t0]) {
					if(typeof tmp[t0][t1] === 'object') {
						for(let t2 in tmp[t0][t1]) {
							if((t2 === 'from') || (t2 === 'last')) {
								tmp[t0][t1][t2] = new Date(tmp[t0][t1][t2]);
							}
						}
					} else if((t1 === 'reported') || (t1 === 'checked')) {
						tmp[t0][t1] = new Date(tmp[t0][t1]);
					}
				}
			}
			// restore data is valid less than one hour
			sensorInfo = tmp.sensorInfo;
			hourCapacity = tmp.hourCapacity;
			hour = tmp.hour;
		} catch(e) {
			sensorInfo = {};
			hourCapacity = {};
			hour = {};
		}
		RED.nodes.createNode(this,config);
		node.config = config;
		//sensorInfo.reported = now;
		// check timing to send capacity data to cloud
		let now = new Date();
		hour.start = new Date(hour.start);

		if(isNaN(hour.start.getTime()) ||
			((hour.start.getMinutes() !== now.getMinutes())&&debug) ||							// debug
			(hour.start.getFullYear() !== now.getFullYear()) ||
			(hour.start.getMonth() !== now.getMonth()) ||
			(hour.start.getHours() !== now.getHours())) {
			if(debug) {
				console.log('reset hourCapacity');
				hour.start = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours(),now.getMinutes());		// debug
			} else {
				hour.start = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours());
			}
			hourCapacity = {};
			hourCapacity.total = 0;
		}
		if(debug) {
			hour.end = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours(),now.getMinutes()+1); // debug
		} else {
			hour.end = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours()+1);
		}
		hour.update = new Date(now);
		console.log({
			start: hour.start.toLocaleString(),
			end: hour.end.toLocaleString(),
			update: hour.update.toLocaleString(),
			hourCapacity: hourCapacity
		});
		timer1 = setTimeout(calHourCapacity ,hour.end.getTime() - now.getTime());
		function calHourCapacity() {
			console.log("calHourCapacity");
			let now = new Date();
			updateCapacity(now);
			if(debug) {
				hour.start = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours(),now.getMinutes());
				hour.end = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours(),now.getMinutes()+1); // debug
			} else {
				hour.start = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours());
				hour.end = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours()+1);
			}
			timer1 = setTimeout(calHourCapacity,hour.end.getTime() - now.getTime())
			if(( (now.getHours() === 12) && (now.getMinutes() === 0))||
				((debug === true) && (now.getHours() == 32) && (now.getMinutes() == 32)
				)) {
				console.log("setTimeout(changeDate())")
				timer2 = setTimeout(() => {
					changeDate();
				}, 30*60*1000+global.lazuriteConfig.gwid*10000);
			}
		}
		function changeDate() {
			console.log(`changeDate   at ${(new Date()).toLocaleString()}`);
			let now = new Date();
			for(let id in sensorInfo) {
				if((sensorInfo[id].active === true) &&
					(sensorInfo[id].last.getDate() !== now.getDate())) {
					sensorInfo[id].last = new Date(now.getTime());
					let output;
					switch(sensorInfo[id].currentStatus) {
						case "on":
							output = {
								payload: {
									//dbname: node.config.dbname,
									timestamp: now.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									//type: capLogType,
									state: "act",
								},
								topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
							};
							break;
						case "off":
							output = {
								payload: {
									//dbname: node.config.dbname,
									timestamp: now.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									//type: capLogType,
									state: "stop",
								},
								topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
							};
							if(sensorInfo[id].reasonId) output.payload.reasonId = sensorInfo[id].reasonId;
							if(sensorInfo[id].nameId) output.payload.nameId = sensorInfo[id].nameId;
							if(sensorInfo[id].note) output.payload.note = sensorInfo[id].note;
							break;
					}
					if(debug) {
						console.log(output);
					} else {
						node.send(output);
					}
					timer2 = setTimeout(() => {
						changeDate();
					},1000)
					return;
				}
			}
		}

		node.on('input', function (msg) {
			// check data
			//let capLogType = 'log';
			if(msg.payload === "dump") {
				console.log(util.inspect({
					sensorInfo: sensorInfo
				},{depth:null,colors:true}));
				return;
			}
			if(msg.topic !== undefined) {
				if(topicFilter("+/browser/log/update",msg.topic)) {
					rxMqttLogUpdate(msg);
				} else if(topicFilter("+/browser/event/req",msg.topic)) {
					rxMqttEventReq(msg);
				} else if(topicFilter("+/data/factory-iot/monitoring/log/+",msg.topic)) {
					rxMqttDataLog(msg);
				}
				return;
			}
			if(Array.isArray(msg.payload)) {
				if((msg.payload[0] != "off") && (msg.payload[0] != "on")){
					return;
				}
				let rxtime = new Date(parseInt(msg.sec * 1000 + msg.nsec / 1000000));
				let id = msg.src_addr[0];
				let state = msg.payload[0];
				let current = parseFloat(msg.payload[1]);
				let battery = parseFloat(msg.payload[2]);
				let rssi = msg.rssi;
				let graph = global.lazuriteConfig.machineInfo.graph;
				let vbat = global.lazuriteConfig.machineInfo.vbat;
				let reason = msg.payload.length === 4 ? parseInt(msg.payload[3]): null;
				//console.log({id:id,state:state,current:current, battery:battery,rssi:msg.rssi});
				updateCapacity(rxtime);
				if((vbat[id] === undefined) ||((rxtime.getTime() - vbat[id].time) > INTERVAL_VBAT)) {
					vbat[id] = {
						timestamp: id,
						vbat: battery,
						rssi: rssi,
						time: rxtime.getTime()
					};
					node.send({
						payload: vbat[id],
						topic: `${global.lazuriteConfig.capacity.topic}/battery/log/${id}`
					});
				}
				//console.log(vbat);
				// first data
				// worklog
				let worklog = global.lazuriteConfig.machineInfo.worklog[id];
				if (worklog.log === true) {
					if(sensorInfo[id] === undefined ) {
						sensorInfo[id] = {
							from: rxtime,
							last: rxtime,
							currentStatus: null,
							// average
							on : {
								sum: 0,
								count: 0,
								min: current,
								max: current,
							},
							off: {
								sum: 0,
								count: 0,
								min: current,
								max: current,
							},
							battery: 0,
							rssi: rssi,
						};
					}
					let output;
					if(worklog.lowFreq === false) { // 通常動作
						if((state === 'on') && (sensorInfo[id].currentStatus !== "on")){
							//console.log(`state 1-1 ${(new Date()).toLocaleString()}`);
							sensorInfo[id].currentStatus = 'on';
							delete	sensorInfo[id].reasonId;
							delete sensorInfo[id].nameId;
							delete sensorInfo[id].note;
							sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect0*1000);
							output = {
								payload: {
									//dbname: node.config.dbname,
									timestamp: sensorInfo[id].from.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									//type: capLogType,
									state: "act"
								},
								topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
							};
						} else if((state === 'off') && (sensorInfo[id].currentStatus !== "off")){
							sensorInfo[id].currentStatus = 'off';
							if(reason !== null) {
								//console.log(`state 2-1 ${(new Date()).toLocaleString()}`);
								sensorInfo[id].reasonId = reason;
							} else {
								//console.log(`state 2-2 ${(new Date()).toLocaleString()}`);
								sensorInfo[id].reasonId = worklog.stopReason;
							}
							delete sensorInfo[id].nameId;
							delete sensorInfo[id].note;
							sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect1*1000);
							output = {
								payload: {
									//dbname: node.config.dbname,
									timestamp: sensorInfo[id].from.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									reasonId: sensorInfo[id].reasonId,
									//type: capLogType,
									state: "stop"
								},
								topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
							};
						} else if((state === 'off') && (sensorInfo[id].lowFreq === true)) {
							if(reason !== null){
								if(sensorInfo[id].reasonId !== reason) {
									//console.log(`state 3-1 ${(new Date()).toLocaleString()}`);
									sensorInfo[id].reasonId = reason;
									delete sensorInfo[id].nameId;
									delete sensorInfo[id].note;
									sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect1*1000);
									output = {
										payload: {
											//dbname: node.config.dbname,
											timestamp: sensorInfo[id].from.getTime(),
											from: sensorInfo[id].from.getTime(),
											machine: id,
											reasonId: sensorInfo[id].reasonId,
											//	type: capLogType,
											state: "stop"
										},
										topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
									};
								} else {
									//console.log(`state 3-2 ${(new Date()).toLocaleString()}`);
								}
							} else {
								if(sensorInfo[id].reasonId !== worklog.stopReason) {
									//console.log(`state 3-3 ${(new Date()).toLocaleString()}`);
									sensorInfo[id].reasonId = worklog.stopReason;
									delete sensorInfo[id].nameId;
									delete sensorInfo[id].note;
									sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect1*1000);
									output = {
										payload: {
											//dbname: node.config.dbname,
											timestamp: sensorInfo[id].from.getTime(),
											from: sensorInfo[id].from.getTime(),
											machine: id,
											reasonId: sensorInfo[id].reasonId,
											//type: capLogType,
											state: "stop"
										},
										topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
									};
								} else {
									//console.log(`state 3-4 ${(new Date()).toLocaleString()}`);
								}
							}
						} else if(sensorInfo[id].reasonId !== reason) {
							if(reason !== null){
								//console.log(`state 4-1 ${(new Date()).toLocaleString()}`);
								sensorInfo[id].reasonId = reason;
								delete sensorInfo[id].nameId;
								delete sensorInfo[id].note;
								sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect1*1000);
								output = {
									payload: {
										//dbname: node.config.dbname,
										timestamp: sensorInfo[id].from.getTime(),
										from: sensorInfo[id].from.getTime(),
										machine: id,
										reasonId: sensorInfo[id].reasonId,
										//type: capLogType,
										state: "stop"
									},
									topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
								};
							} else {
								//console.log(`state 4-2 ${(new Date()).toLocaleString()}`);
							}
						} else {
							//console.log("state 5");
						}
						sensorInfo[id].lowFreq = false;
					} else {												// 低速動作
						if((state === 'on') && (sensorInfo[id].currentStatus !== 'on')){
							//console.log(`state 6-1 ${(new Date()).toLocaleString()}`);
							sensorInfo[id].currentStatus = 'on';
							delete	sensorInfo[id].reasonId;
							delete sensorInfo[id].nameId;
							delete sensorInfo[id].note;
							sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect0*1000);
							output = {
								payload: {
									//dbname: node.config.dbname,
									timestamp: sensorInfo[id].from.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									//type: capLogType,
									state: "act"
								},
								topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
							};
						} else if(((state === 'off') && (sensorInfo[id].currentStatus !== 'off')) ||
							((state === 'off') && (sensorInfo[id].currentStatus === "off") && (sensorInfo[id].lowFreq === false) && (sensorInfo[id].reasonId !== worklog.stopReason))) {
							if(sensorInfo[id].currentStatus !== "off") {
								//console.log(`state 7-1 ${(new Date()).toLocaleString()}`);
							} else {
								//console.log(`state 8-1 ${(new Date()).toLocaleString()}`);
							}
							sensorInfo[id].currentStatus = 'off';
							sensorInfo[id].reasonId = worklog.stopReason;
							delete sensorInfo[id].nameId;
							delete sensorInfo[id].note;
							sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect1*1000);
							output = {
								payload: {
									//dbname: node.config.dbname,
									timestamp: sensorInfo[id].from.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									reasonId: sensorInfo[id].reasonId,
									//type: capLogType,
									state: "stop"
								},
								topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
							};
						} else {
							//console.log("state 9");
						}
						sensorInfo[id].lowFreq = true;
					}
					// 日マタギの処理
					if ((!output) &&
						((sensorInfo[id].last.getMonth() !== rxtime.getMonth()) ||
							(sensorInfo[id].last.getDate() !== rxtime.getDate()))) {
						if (rxtime.getHours() >= 1) { // after 1:00 AM
							sensorInfo[id].from.setTime(rxtime.getTime()); // override
						}
						switch(sensorInfo[id].currentStatus) {
							case "on":
								output = {
									payload: {
										//dbname: node.config.dbname,
										timestamp: rxtime.getTime(),
										from: sensorInfo[id].from.getTime(),
										machine: id,
										//type: capLogType,
										state: "act",
									},
									topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
								};
								break;
							case "off":
								output = {
									payload: {
										//dbname: node.config.dbname,
										timestamp: rxtime.getTime(),
										from: sensorInfo[id].from.getTime(),
										machine: id,
										//type: capLogType,
										state: "stop",
									},
									topic : `${global.lazuriteConfig.capacity.topic}/monitoring/log/${id}`
								};
								if(sensorInfo[id].reasonId) output.payload.reasonId = sensorInfo[id].reasonId;
								if(sensorInfo[id].nameId) output.payload.nameId = sensorInfo[id].nameId;
								if(sensorInfo[id].note) output.payload.note = sensorInfo[id].note;
								break;
						}
					}
					if(output) node.send(output);
					sensorInfo[id].last = rxtime;
					sensorInfo[id].active = true;
					sensorInfo[id][state].sum += current;
					sensorInfo[id][state].count += 1;
					if((sensorInfo[id][state].min || current) >= current ) sensorInfo[id][state].min = current;
					if((sensorInfo[id][state].max || current) <= current ) sensorInfo[id][state].max = current;
					sensorInfo[id].battery = battery;
					sensorInfo[id].rssi = ((sensorInfo[id].rssi || 0)< rssi ) ? rssi : sensorInfo[id].rssi;
					//console.log(sensorInfo[id]);
				}
				// data output for graph
				if(graph[id].enabled ===true) {
					if(!graph[id].reported) {
						graph[id].reported = rxtime;
						graph[id].hour = {
							min: current,
							max: current
						};
						graph[id].day = {
							min: current,
							max: current
						};
						node.send({
							payload: {
								//dbname: node.config.dbname,
								timestamp: rxtime.getTime(),
								//type: `graph-${id}-raw`,
								value: current
							},
							topic : `${global.lazuriteConfig.capacity.topic}/graph/raw/${id}`
						});
					} else if(rxtime - graph[id].reported > INTERVAL_GRAPH) {
						node.send({
							payload: {
								//dbname: node.config.dbname,
								timestamp: rxtime.getTime(),
								//type: `graph-${id}-raw`,
								value: current
							},
							topic : `${global.lazuriteConfig.capacity.topic}/graph/raw/${id}`
						});
						if(graph[id].reported.getHours() !== rxtime.getHours()){
							node.send({
								payload: {
									//dbname: node.config.dbname,
									timestamp: rxtime.getTime() - 3600*1000,
									//type: `graph-${id}-hour`,
									min: graph[id].hour.min,
									max: graph[id].hour.max
								},
								topic : `${global.lazuriteConfig.capacity.topic}/graph/hour/${id}`
							});
							graph[id].hour.min = current;
							graph[id].hour.max = current;
						} else {
							if(graph[id].hour.min > current) {
								graph[id].hour.min =  current;
							} else if(graph[id].hour.max < current){
								graph[id].hour.max =  current;
							}
						}
						graph[id].reported = rxtime;
						//console.log({payload: msg.payload, graph: graph[id]});
					}
				}
			}
			function rxMqttLogUpdate(msg) {
				try {
					let m = JSON.parse(msg.payload);
					//console.log(m);
					let id = m.machine;
					let worklog = global.lazuriteConfig.machineInfo.worklog[id];
					if ((worklog.log === true) && (sensorInfo[id].currentStatus === 'off')) {
						if(sensorInfo[id].from.getTime() > m.from) {
							//console.log("old data");
							return;
						} else if(sensorInfo[id].from.getTime() < m.from) {
							//console.log("new object");
							sensorInfo[id].from = new Date(m.from);
						} else {
							//console.log("from is same");
						}
						if(m.reasonId !== undefined) {
							sensorInfo[id].reasonId = m.reasonId;
						} else {
							sensorInfo[id].reasonId = 0;
						}
						if(m.nameId !== undefined) {
							sensorInfo[id].nameId = m.nameId;
						} else {
							delete sensorInfo[id].nameId;
						}
						if(m.note !== undefined) {
							sensorInfo[id].note = m.note;
						} else {
							delete sensorInfo[id].note;
						}
						/*
							console.log({
							type: 'sensorState update',
							msg: m.lastItem.payload,
							sensorInfo: sensorInfo[id],
							from: {
								msg: m.lastItem.payload.from,
								sensorInfo: sensorInfo[id].from.getTime()
							}
						});
						*/
					}
				} catch(e) {
					console.log(e);
				}
			}
			function rxMqttEventReq(msg) {
				try {
					let m = JSON.parse(msg.payload);
					updateCapacity(new Date(m.timestamp));
					//console.log(m);
					if (m.state !== 'stop') return;
					let id = m.machine;
					let worklog = global.lazuriteConfig.machineInfo.worklog[id];
					if ((worklog.log === true) && (sensorInfo[id].currentStatus === 'off')) {
						sensorInfo[id].from.setTime(m.from);
						sensorInfo[id].last.setTime(m.timestamp);
						if(m.reasonId !== undefined) {
							sensorInfo[id].reasonId = m.reasonId;
						} else {
							delete sensorInfo[id].reasonId;
						}
						if(m.nameId !== undefined) {
							sensorInfo[id].nameId = m.nameId;
						} else {
							delete sensorInfo[id].nameId;
						}
						if(m.note !== undefined) {
							sensorInfo[id].note = m.note;
						} else {
							delete sensorInfo[id].note;
						}
					}
				} catch(e) {
					console.log(e);
				}
			}
			function rxMqttDataLog(msg) {
				let payload = JSON.parse(msg.payload);
				updateCapacity(new Date(payload.timestamp))
				let id = payload.machine;
				if(sensorInfo[id] === undefined) {
					sensorInfo[id] = {
						from: new Date(payload.from),
						last: new Date(payload.timestamp),
						currentStatus: payload.state,
						// average
						active : false,
						on : {
							sum: 0,
							count: 0,
						},
						off: {
							sum: 0,
							count: 0,
						},
						battery: 0,
						rssi: 0,
					};
					if(payload.state === 'off') {
						sensorInfo[id].reasonId = payload.reasonId || 0;
					}
				}
				if(payload.timestamp !== sensorInfo[id].last.getTime()) {
					sensorInfo[id].from = new Date(payload.from);
					sensorInfo[id].last = new Date(payload.timestamp);
					sensorInfo[id].active = false;
					sensorInfo[id].currentStatus = payload.state;
					if(payload.state === "off") {
						sensorInfo[id].reasonId = payload.reasonId || 0;
						delete sensorInfo[id].nameId;
						delete sensorInfo[id].note;
					} else {
						delete	sensorInfo[id].reasonId;
						delete sensorInfo[id].nameId;
						delete sensorInfo[id].note;
					}
				}
			}
		});
		node.on('close',function(done) {
			clearTimeout(timer1);
			clearTimeout(timer2);
			try {
				fs.statSync('/home/pi/.lazurite/tmp');
			} catch(e) {
				fs.mkdirSync('/home/pi/.lazurite/tmp');
			}
			fs.writeFileSync('/home/pi/.lazurite/tmp/capacity.json',JSON.stringify({
				sensorInfo : sensorInfo,
				hourCapacity: hourCapacity,
				hour: hour,
			},null,"  "));
			done();
		});
		function updateCapacity(time) {
			let tt = time.getTime();
			let hs = hour.start.getTime();
			let he = hour.end.getTime();
			let hu = hour.update.getTime();

			if(tt < hu) return;		// 更新時刻より前のデータは無視する (mqtt受信時の遅延など)

			// 前の時間を集計して送信する
			let cal_time = tt > he ? he : tt;
			let add_time = cal_time - hu;
			hourCapacity.total = (hourCapacity.total||0)+ add_time;

			for(let id in sensorInfo) {
				if(!hourCapacity[id]) hourCapacity[id] = {};
				if(sensorInfo[id].currentStatus === "on") {
					hourCapacity[id].ontime = (hourCapacity[id].ontime||0) + add_time;
				}
				hourCapacity[id].meastime = (hourCapacity[id].meastime||0) + add_time;
			}
			// 集計時間が過ぎていたら送信する
			if(he < tt) {
				let payload = {
					timestamp: hs + global.lazuriteConfig.gwid,
					capacity: {},
					vbat: {},
					rssi: {}
				}
				let isSend = false;
				for(let id in hourCapacity) {
					if(sensorInfo[id] === undefined) continue;
					if((hourCapacity[id].meastime !== 0) && (sensorInfo[id].active === true)) {
						payload.capacity[id] = parseInt((hourCapacity[id].ontime||0) /hourCapacity[id].meastime*1000)/10;
						payload.vbat[id] = sensorInfo[id].battery;
						payload.rssi[id] = sensorInfo[id].rssi;
						isSend = true;
					}
				}
				/*
				console.log(util.inspect({
					total: hourCapacity.total,
					end:	hour.end.toLocaleString(),
					time:	time.toLocaleString(),
					hourCapacity: hourCapacity,
					sensorInfo: sensorInfo
				},{depth:null,colors:true}));
				*/
				// 該当時間の送信を行う
				if(isSend) {
					if(debug) {
						console.log({isSend: payload});
					} else {
						node.send({
							payload: payload,
							topic: `${global.lazuriteConfig.capacity.topic}/monitoring/hour/${global.lazuriteConfig.gwid}`
						});
					}
				}
				// 送信後は集計をリセットする
				hourCapacity = {};
				hourCapacity.total = 0;
				for(let id in sensorInfo) {
					sensorInfo[id].on.sum = 0;
					sensorInfo[id].on.count = 0;
					sensorInfo[id].off.sum = 0;
					sensorInfo[id].off.count = 0;
					sensorInfo[id].battery = 0;
					sensorInfo[id].rssi = 0;
				}
			}
			hour.update.setTime(cal_time);
			/*
			console.log(util.inspect({
				time: time,
				hourCapacity: hourCapacity,
				sensorInfo: sensorInfo
			},{depth:null,colors:true}));
			*/
		}
		function topicFilter(ts,t) {
			if (ts == "#") {
				return true;
			}
			/* The following allows shared subscriptions (as in MQTT v5)
			 http://docs.oasis-open.org/mqtt/mqtt/v5.0/cs02/mqtt-v5.0-cs02.html#_Toc514345522

			 4.8.2 describes shares like:
			 $share/{ShareName}/{filter}
			 $share is a literal string that marks the Topic Filter as being a Shared Subscription Topic Filter.
			 {ShareName} is a character string that does not include "/", "+" or "#"
			 {filter} The remainder of the string has the same syntax and semantics as a Topic Filter in a non-shared subscription. Refer to section 4.7.
			 */
			else if(ts.startsWith("$share")){
				ts = ts.replace(/^\$share\/[^#+/]+\/(.*)/g,"$1");
			}
			var re = new RegExp("^"+ts.replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g,"\\$1").replace(/\+/g,"[^/]+").replace(/\/#$/,"(\/.*)?")+"$");
					return re.test(t);
				}
	}
	RED.nodes.registerType("lazurite-capacity", LazuriteCapacity);
}
