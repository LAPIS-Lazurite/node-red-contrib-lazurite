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
	const INTERVAL_GRAPH = 29*1000;
	const INTERVAL_VBAT = 0 * 60*1000;
	//const INTERVAL_VBAT = 60*1000;
	function LazuriteCapacity(config) {
		var node = this;
		var sensorInfo = {};
		var hourCapacity = {};
		var dayCapacity = {};
		var hour = {};
		var day = {};
		RED.nodes.createNode(this,config);
		node.config = config;
		var now = new Date();
		sensorInfo.reported = now;
		// check timing to send capacity data to cloud
		var timer = setInterval(function() {
			now = new Date();
			//now = new Date(now.getTime()-1300*1000);
			//console.log(now);
			if(hour.reported === undefined) {
				hour.reported = now;
				hour.checked = now;
			}
			if(day.reported === undefined) {
				day.reported = now;
				day.checked = now;
			}

			if(hour.reported.getHours() != now.getHours()) {
				let msec = now.getTime()%1000;
				var payload = {
					timestamp : now.getTime()-msec+global.lazuriteConfig.gwid,
					type : "hour",
					capacity: {},
					vbat: {},
					rssi: {},
				};

				var count = 0;
				for(var id in hourCapacity) {
					if((now - sensorInfo[id].last) <3600*1000) {
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
			}

			if(day.reported.getDate() != now.getDate()) {
				var payload = {
					timestamp : now.getTime(),
					type : "day",
					capacity: {},
					count : {},
					on: {},
					off:{},
				};

				var count = 0;
				for(var id in dayCapacity) {
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
				/*
				for(var id in sensorInfo) {
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
				*/
			}

			for (var id in sensorInfo) {
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
			}
			hour.checked = now;
			day.checked = now;
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
			var rxtime = new Date(parseInt(msg.sec * 1000 + msg.nsec / 1000000));
			var id = msg.src_addr[0];
			var state = msg.payload[0];
			var current = parseFloat(msg.payload[1]);
			var battery = parseFloat(msg.payload[2]);
			var rssi = msg.rssi;
			var graph = global.lazuriteConfig.machineInfo.graph;
			var vbat = global.lazuriteConfig.machineInfo.vbat;
			var reason = msg.payload.length === 4 ? parseInt(msg.payload[3]): null;
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
			if(global.lazuriteConfig.machineInfo.worklog[id].log === true) {
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
					var output = {
						payload: {
							dbname: node.config.dbname,
							timestamp: rxtime.getTime(),
							machine: id,
							from: sensorInfo[id].from.getTime(),
							type: "log",
							state: (sensorInfo[id].currentStatus === "on" ? "act":"stop")
						},
						topic: global.lazuriteConfig.capacity.topic
					};
					if(reason) {
						sensorInfo[id].reasonId = reason;
						output.payload.reasonId = reason;
						output.topic = global.lazuriteConfig.capacity.topic
					}
					node.send(output);
				} else {
					if(sensorInfo[id].currentStatus !== state) {
						sensorInfo[id].currentStatus = state;
						var detect;
						//console.log(global.lazuriteConfig.machineInfo);
						if (sensorInfo[id].currentStatus === "on") {
							detect = global.lazuriteConfig.machineInfo.worklog[id].detect0;
							sensorInfo[id].reasonId = null;
						}else{
							detect = global.lazuriteConfig.machineInfo.worklog[id].detect1;
							sensorInfo[id].reasonId = reason;
						}
						detect = detect * 1000;
						sensorInfo[id].from.setTime(rxtime.getTime() - detect);
						//console.log({rxtime: rxtime, from: sensorInfo[id].from});
						var output = {
							payload: {
								dbname: node.config.dbname,
								timestamp: rxtime.getTime() ,
								from: sensorInfo[id].from.getTime(),
								machine: id,
								type: "log",
								state: (sensorInfo[id].currentStatus === "on" ? "act":"stop")
							},
							topic : global.lazuriteConfig.capacity.topic
						};
						if(reason) output.payload.reasonId = reason;
						node.send(output);
					} else if(sensorInfo[id].last.getDate() !== rxtime.getDate()) {
						var output = {
							payload: {
								dbname: node.config.dbname,
								timestamp: rxtime.getTime(),
								from: sensorInfo[id].from.getTime(),
								machine: id,
								type: "log",
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
					graph[id].reported = rxtime;
					//console.log({payload: msg.payload, graph: graph[id]});
				}
			}
		});
		node.on('close',function(done) {
			clearInterval(timer);
			done();
		});
	}
	RED.nodes.registerType("lazurite-capacity", LazuriteCapacity);
}
