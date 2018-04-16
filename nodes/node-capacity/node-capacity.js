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
				var payload = {
					timestamp : now.getTime(),
					type : "hour",
					capacity: {},
					vbat: {},
					rssi: {},
				};

				for(var id in hourCapacity) {
					if((now - sensorInfo[id].last) <3600*1000) {
						payload.capacity[id] = parseInt(hourCapacity[id].ontime/hourCapacity[id].meastime*1000)/10;
						payload.vbat[id] = sensorInfo[id].battery;
						payload.rssi[id] = sensorInfo[id].rssi;
					}
				}
				node.send({payload:payload});
				hour = { reported: now };
				hourCapacity = {};
			}

			if(day.reported.getDate() != now.getDate()) {
				var payload = {
					timestamp : now.getTime()+1,
					type : "day",
					capacity: {},
					count : {},
					on: {},
					off:{},
				};

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
					}
				}
				node.send({payload:payload});
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

			//console.log(global.lazuriteConfig.optimeInfo);
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
			//console.log({id:id,state:state,current:current, battery:battery,rssi:msg.rssi});
			//
			// first data
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
				node.send({
					payload: {
						dbname: node.config.dbname,
						timestamp: rxtime.getTime(),
						machine: id,
						from: sensorInfo[id].from.getTime(),
						type: "log",
						state: (sensorInfo[id].currentStatus === "on" ? "act":"stop"),
					}
				});
			} else {
				if(sensorInfo[id].currentStatus !== state) {
					sensorInfo[id].currentStatus = state;
					var detect;
					if (sensorInfo[id].currentStatus === "on") {
						detect = global.lazuriteConfig.machineInfo[id].detect0;
					}else{
						detect = global.lazuriteConfig.machineInfo[id].detect1;
					}
					detect = detect * 1000;
					sensorInfo[id].from.setTime(rxtime.getTime() - detect);
					//console.log({rxtime: rxtime, from: sensorInfo[id].from});
					node.send({
						payload: {
							dbname: node.config.dbname,
							timestamp: rxtime.getTime() - detect,
							from: sensorInfo[id].from.getTime(),
							machine: id,
							type: "log",
							state: (sensorInfo[id].currentStatus === "on" ? "act":"stop"),
						}
					});
				} else if(sensorInfo[id].last.getDate() !== rxtime.getDate()) {
					node.send({
						payload: {
							dbname: node.config.dbname,
							timestamp: rxtime.getTime(),
							from: sensorInfo[id].from.getTime(),
							machine: id,
							type: "log",
							state: (sensorInfo[id].currentStatus === "on" ? "act":"stop"),
						}
					});
				}
				sensorInfo[id].last = rxtime;
			}
			sensorInfo[id][state].sum += current;
			sensorInfo[id][state].count += 1;
			if( sensorInfo[id][state].min > current ) sensorInfo[id][state].min = current;
			if( sensorInfo[id][state].max < current ) sensorInfo[id][state].max = current;
			sensorInfo[id].battery = battery;
			if(sensorInfo[id].rssi > rssi) sensorInfo[id].rssi = rssi;
			//console.log(sensorInfo);
		});
	}
	RED.nodes.registerType("lazurite-capacity", LazuriteCapacity);
}
