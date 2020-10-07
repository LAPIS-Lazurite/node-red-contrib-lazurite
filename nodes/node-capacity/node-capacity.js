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
	let fs = require('fs');
	const INTERVAL_GRAPH = 29*1000;
	const INTERVAL_VBAT = 0 * 60*1000;
	//const INTERVAL_VBAT = 60*1000;
	function LazuriteCapacity(config) {
		let node = this;
		let sensorInfo = {};
		let hourCapacity = {};
		let hour = {};
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
		let now = new Date();
		//sensorInfo.reported = now;
		// check timing to send capacity data to cloud
		let timer = setInterval(function() {
			now = new Date();
			//now = new Date(now.getTime()-1300*1000);
			//console.log(now);
			if(hour.reported === undefined) {
				hour.reported = now;
				hour.checked = now;
			}
			if ((hour.reported.getMonth() != now.getMonth()) || (hour.reported.getDate() != now.getDate()) || (hour.reported.getHours() != now.getHours())) {
				let timestamp = new Date(hour.reported.getFullYear(), hour.reported.getMonth(), hour.reported.getDate(),hour.reported.getHours()+1);
				let payload = {
					timestamp : timestamp.getTime()+global.lazuriteConfig.gwid,
					type : "hour",
					capacity: {},
					vbat: {},
					rssi: {},
				};

				let count = 0;
				for(let id in hourCapacity) {
					if((hour.checked - sensorInfo[id].last) <3600*1000) {
						// generate hour capacity data
						payload.capacity[id] = parseInt(hourCapacity[id].ontime/hourCapacity[id].meastime*1000)/10;
						payload.vbat[id] = sensorInfo[id].battery;
						payload.rssi[id] = sensorInfo[id].rssi;
						count+=1;
						delete payload.rssi[id].battery;
						delete payload.rssi[id].rssi;
					}
				}
				if(count > 0) {
					node.send({payload:payload,topic:global.lazuriteConfig.capacity.topic});
				}
				hour = { reported: now };
				hourCapacity = {};
				// update temprary file
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
			}
			for (let id in sensorInfo) {
				if((now - sensorInfo[id].last)<3600*1000)  {
					if(hourCapacity[id] === undefined){
						hourCapacity[id] = {
							ontime: 0,
							meastime: 0
						};
					} else {
						if(sensorInfo[id].currentStatus === 'on') {
							hourCapacity[id].ontime += (now - hour.checked);
						}
						hourCapacity[id].meastime += (now - hour.checked);
					}
				}
			}
			hour.checked = now;
		}, 1000);

		node.on('input', function (msg) {
			// check data
			let capLogType = 'log';
			if(msg.topic !== undefined) {
				if(topicFilter("+/browser/log/update",msg.topic)) {
					rxMqttLogUpdate(msg);
					return;
				} else if(topicFilter("+/browser/event/req",msg.topic)) {
					rxMqttEventReq(msg);
					return;
				}
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
				let reason = msg.payload.length === 4 ? parseInt(msg.payload[3]): 0;
				//console.log({id:id,state:state,current:current, battery:battery,rssi:msg.rssi});
				if(vbat[id] === undefined) {
					vbat[id] = {
						type: "battery",
						timestamp: id,
						vbat: battery,
						rssi: rssi,
						time: rxtime.getTime()
					};
					node.send({payload: vbat[id],topic: global.lazuriteConfig.capacity.topic});
				} else {
					if((rxtime.getTime() - vbat[id].time) > INTERVAL_VBAT) {
						vbat[id] = {
							type: "battery",
							timestamp: id,
							vbat: battery,
							rssi: rssi,
							time: rxtime.getTime()
						};
						node.send({payload: vbat[id],topic: global.lazuriteConfig.capacity.topic});
					}
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
									dbname: node.config.dbname,
									timestamp: sensorInfo[id].from.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									type: capLogType,
									state: "act"
								},
								topic : global.lazuriteConfig.capacity.topic
							};
						} else if((state === 'off') && (sensorInfo[id].currentStatus !== "off")){
							sensorInfo[id].currentStatus = 'off';
							if(reason) {
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
									dbname: node.config.dbname,
									timestamp: sensorInfo[id].from.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									reasonId: sensorInfo[id].reasonId,
									type: capLogType,
									state: "stop"
								},
								topic : global.lazuriteConfig.capacity.topic
							};
						} else if((state === 'off') && (sensorInfo[id].lowFreq === true)) {
							if(reason){
								if(sensorInfo[id].reasonId !== reason) {
									//console.log(`state 3-1 ${(new Date()).toLocaleString()}`);
									sensorInfo[id].reasonId = reason;
									delete sensorInfo[id].nameId;
									delete sensorInfo[id].note;
									sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect1*1000);
									output = {
										payload: {
											dbname: node.config.dbname,
											timestamp: sensorInfo[id].from.getTime(),
											from: sensorInfo[id].from.getTime(),
											machine: id,
											reasonId: sensorInfo[id].reasonId,
											type: capLogType,
											state: "stop"
										},
										topic : global.lazuriteConfig.capacity.topic
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
											dbname: node.config.dbname,
											timestamp: sensorInfo[id].from.getTime(),
											from: sensorInfo[id].from.getTime(),
											machine: id,
											reasonId: sensorInfo[id].reasonId,
											type: capLogType,
											state: "stop"
										},
										topic : global.lazuriteConfig.capacity.topic
									};
								} else {
									//console.log(`state 3-4 ${(new Date()).toLocaleString()}`);
								}
							}
						} else if(sensorInfo[id].reasonId !== reason) {
							if(reason){
								//console.log(`state 4-1 ${(new Date()).toLocaleString()}`);
								sensorInfo[id].reasonId = reason;
								delete sensorInfo[id].nameId;
								delete sensorInfo[id].note;
								sensorInfo[id].from.setTime(rxtime.getTime() - worklog.detect1*1000);
								output = {
									payload: {
										dbname: node.config.dbname,
										timestamp: sensorInfo[id].from.getTime(),
										from: sensorInfo[id].from.getTime(),
										machine: id,
										reasonId: sensorInfo[id].reasonId,
										type: capLogType,
										state: "stop"
									},
									topic : global.lazuriteConfig.capacity.topic
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
									dbname: node.config.dbname,
									timestamp: sensorInfo[id].from.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									type: capLogType,
									state: "act"
								},
								topic : global.lazuriteConfig.capacity.topic
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
									dbname: node.config.dbname,
									timestamp: sensorInfo[id].from.getTime(),
									from: sensorInfo[id].from.getTime(),
									machine: id,
									reasonId: sensorInfo[id].reasonId,
									type: capLogType,
									state: "stop"
								},
								topic : global.lazuriteConfig.capacity.topic
							};
						} else {
							//console.log("state 9");
						}
						sensorInfo[id].lowFreq = true;
					}
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
										dbname: node.config.dbname,
										timestamp: rxtime.getTime(),
										from: sensorInfo[id].from.getTime(),
										machine: id,
										type: capLogType,
										state: "act",
									},
									topic : global.lazuriteConfig.capacity.topic
								};
								break;
							case "off":
								output = {
									payload: {
										dbname: node.config.dbname,
										timestamp: rxtime.getTime(),
										from: sensorInfo[id].from.getTime(),
										machine: id,
										type: capLogType,
										state: "stop",
									},
									topic : global.lazuriteConfig.capacity.topic
								};
								if(sensorInfo[id].reasonId) output.payload.reasonId = sensorInfo[id].reasonId;
								if(sensorInfo[id].nameId) output.payload.nameId = sensorInfo[id].nameId;
								if(sensorInfo[id].note) output.payload.note = sensorInfo[id].note;
								break;
						}
					}
					if(output) node.send(output);
					sensorInfo[id].last = rxtime;
					sensorInfo[id][state].sum += current;
					sensorInfo[id][state].count += 1;
					if( sensorInfo[id][state].min > current ) sensorInfo[id][state].min = current;
					if( sensorInfo[id][state].max < current ) sensorInfo[id][state].max = current;
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
								dbname: node.config.dbname,
								timestamp: rxtime.getTime(),
								type: `graph-${id}-raw`,
								value: current
							},
							topic : global.lazuriteConfig.capacity.topic
						});
					} else if(rxtime - graph[id].reported > INTERVAL_GRAPH) {
						node.send({
							payload: {
								dbname: node.config.dbname,
								timestamp: rxtime.getTime(),
								type: `graph-${id}-raw`,
								value: current
							},
							topic : global.lazuriteConfig.capacity.topic
						});
						if(graph[id].reported.getHours() !== rxtime.getHours()){
							node.send({
								payload: {
									dbname: node.config.dbname,
									timestamp: rxtime.getTime() - 3600*1000,
									type: `graph-${id}-hour`,
									min: graph[id].hour.min,
									max: graph[id].hour.max
								},
								topic : global.lazuriteConfig.capacity.topic
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
						/*
						let output = {
							payload: {
								dbname: node.config.dbname,
								timestamp: now,
								from: now,
								machine: id,
								type: capLogType,
								state: 'stop',
								reasonId: m.reasonId,
								nameId: m.nameId,
							},
							topic: global.lazuriteConfig.capacity.topic
						};
						node.send(output);
						*/
					}
				} catch(e) {
					console.log(e);
				}
			}
		});
		node.on('close',function(done) {
			clearInterval(timer);
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
