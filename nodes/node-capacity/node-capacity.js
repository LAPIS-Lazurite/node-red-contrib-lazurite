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
		//let dayCapacity = {};
		let hour = {};
		//let day = {};
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
			//dayCapacity = tmp.dayCapacity;
			hour = tmp.hour;
			//day = tmp.day;
		} catch(e) {
			sensorInfo = {};
			hourCapacity = {};
			//dayCapacity = {};
			hour = {};
			//day = {};
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
			/*
			if(day.reported === undefined) {
				day.reported = now;
				day.checked = now;
			}
			*/

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
						// generate battery data
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
					//dayCapacity: dayCapacity,
					hour: hour,
					//day: day
				},null,"  "));
			}

			/*
			if(day.reported.getDate() != now.getDate()) {
				let timestamp = new Date(day.reported.getFullYear(), day.reported.getMonth(), day.reported.getDate()+1);
				let payload = {
					timestamp : timestamp.getTime()+global.lazuriteConfig.gwid,
					type : "day",
					capacity: {},
					count : {},
					on: {},
					off:{},
				};

				let count = 0;
				for(let id in dayCapacity) {
					if((now - sensorInfo[id].last) <3600*1000*24) {
						payload.capacity[id] = parseInt(dayCapacity[id].ontime/dayCapacity[id].meastime*1000)/10;
						payload.count[id] = sensorInfo[id].on.count + sensorInfo[id].off.count;
						payload.on[id] = {
							average: sensorInfo[id].on.sum/sensorInfo[id].on.count,
							max: sensorInfo[id].on.max,
							min: sensorInfo[id].on.min
						}
						payload.off[id] = {
							average: sensorInfo[id].off.sum/sensorInfo[id].off.count,
							max: sensorInfo[id].off.max,
							min: sensorInfo[id].off.min
						}
						count += 1;
					}
				}
				if(count > 0) {
			//					node.send({payload:payload,topic: global.lazuriteConfig.capacity.topic});
				}
				day = { reported: now };
				dayCapacity = {};

				for(let id in sensorInfo) {
					node.send({
						payload: {
							timestamp: rxtime.getTime() + 1 + id, // change index of dynamoDB
							machine: id,
							from: sensorInfo[id].from.getTime(),
							type: "log",
							state: (sensorInfo[id].currentStatus === "on" ? "act":"stop"),
						}
					});
				}
			}
			*/

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
				/*
				if((now - sensorInfo[id].last)<3600*1000*24)  {
					if(dayCapacity[id] === undefined){
						dayCapacity[id] = {
							ontime: 0,
							meastime: 0
						};
					} else {
						if(sensorInfo[id].currentStatus === 'on') {
							dayCapacity[id].ontime += (now - day.checked);
						}
						dayCapacity[id].meastime += (now - day.checked);
					}
				}
				*/
			}
			hour.checked = now;
			//day.checked = now;
			//console.log({hour:hourCapacity,day:dayCapacity});
		}, 1000);

		node.on('input', function (msg) {
			//console.log(msg);
			// check data
			//console.log(global.lazuriteConfig.machineInfo);
			if(Array.isArray(msg.payload)) {
				if((msg.payload[0] != "off") && (msg.payload[0] != "on")){
					return;
				}
			}
			let rxtime = new Date(parseInt(msg.sec * 1000 + msg.nsec / 1000000));
			let id = msg.src_addr[0];
			let state = msg.payload[0];
			let current = parseFloat(msg.payload[1]);
			let battery = parseFloat(msg.payload[2]);
			let rssi = msg.rssi;
			let graph = global.lazuriteConfig.machineInfo.graph;
			let vbat = global.lazuriteConfig.machineInfo.vbat;
			let capLogType = 'log';
			let reason = msg.payload.length === 4 ? parseInt(msg.payload[3]): null;
			//console.log({id:id,state:state,current:current, battery:battery,rssi:msg.rssi});
			//
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
				// override state to off
				let stopReasonChanged = false;
				if (state === 'off') {
					if (worklog.stopReason !== 0) {
						reason = worklog.stopReason;
					} else if (reason === null) {
						reason = 0;
					}
					if (reason !== worklog.prevStopReason) {
						stopReasonChanged = true;
					}
					worklog.prevStopReason = reason;
					//console.log({reason:reason,worklog:worklog});
				}
				if(sensorInfo[id] === undefined ) {
					sensorInfo[id] = {
						from: rxtime,
						last: rxtime,
						currentStatus: state,
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
					let output = {
						payload: {
							dbname: node.config.dbname,
							timestamp: rxtime.getTime(),
							machine: id,
							from: sensorInfo[id].from.getTime(),
							type: capLogType,
							state: (sensorInfo[id].currentStatus === "on" ? "act":"stop")
						},
						topic: global.lazuriteConfig.capacity.topic
					};
					if(reason) {
						sensorInfo[id].reasonId = reason;
						output.payload.reasonId = reason;
						output.topic = global.lazuriteConfig.capacity.topic;
					}
					node.send(output);
				} else {
					if ((sensorInfo[id].currentStatus !== state) || (stopReasonChanged === true)) {
						sensorInfo[id].currentStatus = state;
						let detect;
						//console.log(global.lazuriteConfig.machineInfo);
						if (sensorInfo[id].currentStatus === "on") {
							detect = worklog.detect0;
							sensorInfo[id].reasonId = null;
						}else{
							detect = worklog.detect1;
							sensorInfo[id].reasonId = reason;
						}
						detect = detect * 1000;
						sensorInfo[id].from.setTime(rxtime.getTime() - detect);
						//console.log({rxtime: rxtime, from: sensorInfo[id].from});
						let output = {
							payload: {
								dbname: node.config.dbname,
								timestamp: rxtime.getTime() ,
								from: sensorInfo[id].from.getTime(),
								machine: id,
								type: capLogType,
								state: (sensorInfo[id].currentStatus === "on" ? "act":"stop")
							},
							topic : global.lazuriteConfig.capacity.topic
						};
						if(reason) output.payload.reasonId = reason;
						node.send(output);
					} else if ((sensorInfo[id].last.getMonth() !== rxtime.getMonth()) || (sensorInfo[id].last.getDate() !== rxtime.getDate())) {
						let from;
						if (rxtime.getHours() >= 1) { // after 1:00 AM
							from = rxtime.getTime(); // override
						} else {
							from = sensorInfo[id].from.getTime();
						}
						let output = {
							payload: {
								dbname: node.config.dbname,
								timestamp: rxtime.getTime(),
								from: from,
								machine: id,
								type: capLogType,
								state: (sensorInfo[id].currentStatus === "on" ? "act":"stop")
							},
							topic : global.lazuriteConfig.capacity.topic
						};
						if(sensorInfo[id].reasonId) output.payload.reasonId = sensorInfo[id].reasonId;
						node.send(output);
					}
					sensorInfo[id].last = rxtime;
				}
				sensorInfo[id][state].sum += current;
				sensorInfo[id][state].count += 1;
				if( sensorInfo[id][state].min > current ) sensorInfo[id][state].min = current;
				if( sensorInfo[id][state].max < current ) sensorInfo[id][state].max = current;
				sensorInfo[id].battery = battery;
				if(sensorInfo[id].rssi === undefined) sensorInfo[id].rssi = rssi;
				else if(sensorInfo[id].rssi > rssi) sensorInfo[id].rssi = rssi;
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
							}
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
					/*
					if(graph[id].reported.getDate() !== rxtime.getDate()){
						node.send({
							payload: {
								dbname: node.config.dbname,
								timestamp: rxtime.getTime() - 24*3600*1000,
								type: `graph-${id}-day`,
								min: graph[id].day.min,
								max: graph[id].day.max
							},
							topic : global.lazuriteConfig.capacity.topic
						});
						graph[id].day.min = current;
						graph[id].day.max = current;
					} else {
						if(graph[id].day.min > current) {
							graph[id].day.min =  current;
						} else if(graph[id].day.max < current){
							graph[id].day.max =  current;
						}
					}
					*/
					graph[id].reported = rxtime;
					//console.log({payload: msg.payload, graph: graph[id]});
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
				//dayCapacity: dayCapacity,
				hour: hour,
				//day: day
			},null,"  "));
			done();
		});
	}
	RED.nodes.registerType("lazurite-capacity", LazuriteCapacity);
}
