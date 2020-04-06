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
	var param = require('../../param');
	var os = require('os');
	var ready = false;
	//var qs = require('querystring');
	function isConnect(awsiot){
		var result = true;
		for(key in awsiot){
			if(!RED.settings.get('aws-iot'+awsiot[key])) {result = false;};
		}
		return result;
	}
	function NodeFactory(config) {
		WARN = require('./warning_code.js')
		RED.nodes.createNode(this,config);
		var node = this;
		var outMsg = [];
		node.config = RED.nodes.getNode(config.config).config;
		node.capacity = [];
		node.worklog = [];
		node.initialized = false;
		node.awsiot = [];
		node.dbName = config.dbName;

		// convert address
		node.config.rules.forEach(function(data){
			var src_ct,src_hall;
			if(data.ct === null || data.ct === undefined || data.ct === ""){
				src_ct = undefined;
			} else {
				src_ct = (data.ct.length == 16)?
					[parseInt("0x"+data.ct.slice(0,4)),
					parseInt("0x"+data.ct.slice(4,8)),
					parseInt("0x"+data.ct.slice(8,12)),
					parseInt("0x"+ data.ct.slice(12,16))] : 
					[parseInt(data.ct),0,0,0];
			}
			if(data.hall === null || data.hall === undefined || data.hall === ""){
				src_hall = undefined;
			} else {
				src_hall = (data.hall.length == 16)?
					[parseInt("0x"+data.hall.slice(0,4)),
					parseInt("0x"+data.hall.slice(4,8)),
					parseInt("0x"+data.hall.slice(8,12)),
					parseInt("0x"+ data.hall.slice(12,16))] : 
					[parseInt(data.hall),0,0,0];
			}
			node.capacity.push({
				id: parseInt(data.id),					// source address of CT
				ct_addr: src_ct,						// source address of CT
				ct_state: undefined,					// status of CT
				ct_state_time: undefined,				// time of changing state
				ct_total_time: 0,						// total operating time
				ct_active_time: 0,						// total active time
				ct_wait_time: 0,						// time of starting wait
				ct_last_time: 0,						// time of last tx
				count: 0,								// count of receiving
				rssi: 0,								// latest rssi
				vbat: 0,								// battery voltage
				ct_thres: parseFloat(data.thres),		// threshold of CT
				hall_addr: src_hall,					// src addr of hall sensor
				hall_state: undefined,					// state of CT sensor
				hall_state_time: undefined,				// time of changing hall state
				hall_warn: false,						// warning state(true: triggered, false: no)
				ct_dead_time: parseFloat(data.detect)*1000,	// dead_time(ms) of wait
				update: false,
			});
			node.worklog.push({
				time: new Array(4) });
		});

		node.capInterval = {
			interval: parseInt(config.interval),
			meas_time: undefined,			// interval of measurment report
			reset_time: undefined			// interval of reset capacity
		};
		node.on('input', function (msg) {
			if(node.initialized == false) {
				for(i1 in node.wires) {
					for(i2 in node.wires[i1]){
						if(typeof RED.settings.get('aws-iot'+node.wires[i1][i2]) !== 'undefined') {
							node.awsiot.push(node.wires[i1][i2]);
						}
					}
				}
				node.initialized = true;
			}
			if(isConnect(node.awsiot)){
				outMsg = Array(4);
				if(msg.payload instanceof Array) {
					msg.payload.forEach(function(data) {
						data.payload = data.payload.split('\n')[0];
						calCapacity(data);
						node.send(outMsg);
					});
				} else {
						msg.payload = msg.payload.split('\n')[0];
						calCapacity(msg);
						node.send(outMsg);
				}
			} else {
				console.log('aws-iot disconnected');
			}
		});

		// main process to calcurate capacity
		// check addres
		function calCapacity(msg) {
			var rxtime;
			for(i in node.capacity) {
				// In case of CT sensor
				if(node.capacity[i].ct_addr instanceof Array){
					if(addrComp(node.capacity[i].ct_addr,msg.src_addr)) {
						// calcurate rx time
						rxtime = msg.sec*1000 + Math.round(msg.nsec /1000000);
						var value = parseFloat(msg.payload.split(',')[0]);
						node.capacity[i].count++;
						node.capacity[i].rssi = msg.rssi;
						node.capacity[i].vbat = msg.payload.split(',')[1];
						ctState(i,value,rxtime);
						break;
					}
				}
				// In case of Hall sensor
				if(node.capacity[i].hall_addr instanceof Array){
					if(addrComp(node.capacity[i].hall_addr,msg.src_addr)) {
						rxtime = msg.sec*1000 + Math.round(msg.nsec /1000000);
						var value = parseFloat(msg.payload.split(',')[0]);
						hallState(i,value,rxtime);
						break;
					}
				}
			}
		}
		function addrComp(a,b){
			for(var i=0;i<4;i++){
				if(a[i] != b[i]) {
					return false;
				}
			}
			return true;
		}

		// function for hall sensor
		function hallState(index,data,rxtime){
			var current_time = new Date(rxtime);
			node.capacity[index].hall_state_time = rxtime;
			switch(data) {
			case 0:		// open
				node.capacity[index].hall_state = 'open';
				if(node.capacity[index].ct_state == 'wait') {
					// move to stop state in force.
					updateWorkLog(index,'open',rxtime);
					node.capacity[index].ct_state = 'stop';
					node.capacity[index].ct_state_time = node.capacity[index].ct_wait_time;
					node.capacity[index].ct_total_time += (rxtime - node.capacity[index].ct_wait_time);
				} else if(node.capacity[index].ct_state == 'stop') {
					updateWorkLog(index,'open',rxtime);
					// move to stop state in force.
				} else {
					var msg = {
						topic: node.config.rules[index].machine,
						code: WARN.door_open1.code,
						payload: WARN.door_open1.jp
					}
					outMsg[3] = msg;
				}
				break;
			case 1:		// close
				node.capacity[index].hall_state = 'open';
				if(node.capacity[index].ct_state == 'stop') {
					updateWorkLog(index,'close',rxtime);
				}
				break;
			}
		}

		// function to calcurate capacity
		function ctState(index,data,rxtime){
			var delta_time = rxtime - node.capacity[index].ct_last_time;
			updateCapInterval(rxtime);
			switch(node.capacity[index].ct_state){
			case undefined:
			case null:						// first time
				node.capacity[index].ct_active_time= 0;
				node.capacity[index].ct_total_time = 0;
				node.capacity[index].ct_state_time = rxtime;
				if(data > node.capacity[index].ct_thres) {
					node.capacity[index].ct_state = 'act';
					updateWorkLog(index,'act',rxtime);
				} else {
					node.capacity[index].ct_state = 'stop';
					updateWorkLog(index,'stop',rxtime);
				}
				break;
			case 'act':						// current is active
				// notification of door open
				if(node.capacity[index].hall_state === 'open') {
					if(node.capacity[index].hall_warn === false){
						node.capacity[index].hall_warn = true;
						var msg = {
							topic: node.config.rules[index].machine,
							code: WARN.door_open2.code,
							payload: WARN.door_open1.jp
						}
						outMsg[3] = msg;
					} 
				} else {
					node.capacity[index].hall_warn = false;
				}
				// 
				if(data > node.capacity[index].ct_thres) {
					node.capacity[index].ct_total_time += delta_time;
					node.capacity[index].ct_active_time += delta_time;
				} else {
					updateWorkLog(index,'wait',rxtime);
					node.capacity[index].ct_state = 'wait';
					node.capacity[index].ct_wait_time = node.capacity[index].ct_last_time;
				}
				if(node.capacity[index].update) {updateWorkLog(index,'act',rxtime);}
				break;
			case 'stop':					// current is stop
				node.capacity[index].ct_total_time += delta_time;
				if(data > node.capacity[index].ct_thres) {
					node.capacity[index].ct_state = 'act';
					node.capacity[index].ct_active_time += delta_time;
					node.capacity[index].ct_state_time = rxtime;
					updateWorkLog(index,'act',node.capacity[index].ct_state_time);
				} 
				if(node.capacity[index].update) {updateWorkLog(index,'stop',rxtime);}
				break;
			case 'wait':					// dead time from current stop to stop state
				// restart during dead time
				if(data > node.capacity[index].ct_thres) {
					node.capacity[index].ct_state = 'act';
					node.capacity[index].ct_total_time  += (rxtime - node.capacity[index].ct_wait_time);
					node.capacity[index].ct_active_time += (rxtime - node.capacity[index].ct_wait_time);
					node.capacity[index].ct_wait_time = 0;
				} else {
					// move to stop state
					if((rxtime - node.capacity[index].ct_wait_time)>node.capacity[index].ct_dead_time){
						node.capacity[index].ct_state = 'stop';
						node.capacity[index].ct_total_time  += (rxtime - node.capacity[index].ct_wait_time);
						node.capacity[index].ct_state_time = node.capacity[index].ct_wait_time;
						node.capacity[index].ct_wait_time = 0;
						updateWorkLog(index,'stop',node.capacity[index].ct_state_time);
					} else {
					}
				}
				break;
			}
			// message of capacity
			var msg = {
				topic: node.config.rules[index].machine,
				state: node.capacity[index].ct_state,
				interval: intervalFormatter(rxtime - node.capacity[index].ct_state_time),
				payload: ((node.capacity[index].ct_active_time / node.capacity[index].ct_total_time)*100).toFixed(2),
			};
			outMsg[0] = msg;
			node.capacity[index].ct_last_time = rxtime;
			return;
		}
		// generate worklog
		function updateWorkLog(index,state,rxtime){
			var msg = {};
			switch(state){
			case 'reset':
				node.worklog[index].time = new Array(4);
				break;
			case 'wait':
				// current stop
				node.worklog[index].time[0] = rxtime;
				break;
			case 'open':
				// update time of oepnning in case of first time
				if(isNaN(node.worklog[index].time[1])) {
					node.worklog[index].time[1] = rxtime;
				}
				break;
			case 'close':
				// update time of closing
				node.worklog[index].time[2] = rxtime;
				if(isNaN(node.worklog[index].time[1])) {
					node.worklog[index].time[1] = node.worklog[index].time[0];
				}
				break;
			case 'stop':
			case 'act':
				// restarting
				node.worklog[index].time[3] = rxtime;
				// message of worklog
				msg.payload = {
					timestamp: rxtime,			// id of database
					dbName:    node.dbName,
					state:     state,
					from:      node.capacity[index].ct_state_time,
					machine:   node.capacity[index].id,
					type:      'log'
				};
				outMsg[2] = msg;
				node.worklog[index].time = new Array(4);
				node.capacity[index].update = false;
				break;
			}
		}

		// function for interval process
		function updateCapInterval(rxtime){
			var st_meas_time,st_reset_time,now_meas_time, now_reset_time;
			var type;
			var flag = false;
			if(node.capInterval.meas_time === undefined) {
				node.capInterval.meas_time = rxtime;
			}
			if(node.capInterval.reset_time === undefined) {
				node.capInterval.reset_time = rxtime;
			}
			// generate comparing time according to interval
			switch(node.capInterval.interval) {
			case 0:			//minuites
				type = 'min';
				st_meas_time = new Date(node.capInterval.meas_time).getMinutes();
				st_reset_time = st_meas_time;
				now_meas_time = new Date(rxtime).getMinutes();
				now_reset_time = now_meas_time;
				break;
			case 1:			// hour
				type = 'hour';
				st_meas_time = new Date(node.capInterval.meas_time).getHours();
				st_reset_time = st_meas_time;
				now_meas_time = new Date(rxtime).getHours();
				now_reset_time = now_meas_time;
				break;
			case 2:			// day
				type = 'day';
				st_meas_time = new Date(node.capInterval.meas_time).getHours();
				st_reset_time = new Date(node.capInterval.meas_time).getDate();
				now_meas_time = new Date(rxtime).getHours();
				now_reset_time = new Date(rxtime).getDate();
				break;
			case 3:			// no reset
				st_meas_time = new Date(node.capInterval.meas_time).getHours();
				now_meas_time = new Date(rxtime).getHours();
				break;
			}
			// function to report per interval
			var now = new Date();
			if(st_meas_time != now_meas_time) {
				var payload = {
					timestamp: now.getTime(),
					type: type,
					id: param.lot,
				};
				payload.network = getLocalAddress("ppp0")
				payload.capacity = {};
				payload.count = {};
				payload.rssi = {};
				payload.vbat = {};
				//console.log({capacity:node.capacity,config:node.config.rules,param:param});
				for( i  in node.capacity) {
					if(node.capacity[i].count > 0) {
						payload.count[node.capacity[i].id] = node.capacity[i].count;
						payload.rssi[node.capacity[i].id] = node.capacity[i].rssi;
						payload.vbat[node.capacity[i].id] = node.capacity[i].vbat;
						if(node.capacity[i].ct_total_time != 0){
							payload.capacity[node.capacity[i].id] = parseInt((node.capacity[i].ct_active_time/node.capacity[i].ct_total_time*10000))/100;
						} else {
							payload.capacity[node.capacity[i].id] = 0;
						}
					}
					if(now_meas_time == 0){
						node.capacity[i].update = true;
						console.log('reset ct_state',i);
					}
				}
				outMsg[1] = {
					payload: payload,
				};
				console.log({outMsg1: outMsg[1]});
				node.capInterval.meas_time = rxtime;
				flag = true;
			}
			
			// function to reset per interval
			if(node.capInterval.interval < 3) {
				if(st_reset_time !== now_reset_time){
					for(i in node.capacity) {
						// reset data
						node.capacity[i].ct_total_time = 0;
						node.capacity[i].ct_active_time = 0;
						node.capacity[i].count = 0;
						node.capacity[i].rssi = 0;
						node.capacity[i].vbat = 0;
					}
					node.capInterval.reset_time = rxtime;
				}
			}
			return flag;
		}
		function dateFormatter(time) {
			if(isNaN(time)) return "";
			var date = new Date(time);
			return [date.getFullYear(),
				date.getMonth() + 1,
				date.getDate(),
			].join('/') + ' ' + date.toLocaleTimeString();
		}
		function dateFormatterMinute(time) {
			if(isNaN(time)) return "";
			var date = new Date(time);
			return date.getFullYear() + '年'+
				(date.getMonth() + 1) + '月'+
				date.getDate() + '日' +
				date.getHours() + '時' +
				date.getMinutes() + '分';
		}
		function dateFormatterHour(time) {
			if(isNaN(time)) return "";
			var date = new Date(time);
			return date.getFullYear() + '年'+
				(date.getMonth() + 1) + '月'+
				date.getDate() + '日' +
				date.getHours() + '時';
		}
		function intervalFormatter(time) {
			if(isNaN(time)) return "";
			var sec = Math.round(time/1000);
			var hour = Math.floor(sec/3600);
			sec = sec % 3600; 
			var min = Math.floor(sec/60);
			sec = sec % 60; 
			return hour+"時間"+min+"分"+sec+"秒";
		}
		function addr64(_data){
			var _tmp =0;
			for(var i=3;i>=0;i--){
				_tmp = _tmp * 65536 + _data[i];
			}
			return _tmp;
		}
		function getLocalAddress(adaptor){
			var address = os.networkInterfaces();
			if((typeof address[adaptor] !== 'undefined')&&(address[adaptor].length == 1)){
				return address[adaptor][0].address;
			} else {
				return "unknown";
			}
		}
	}
	

	function NodeFactoryConfig(config) {
		RED.nodes.createNode(this,config);
		this.config = config;
	}
	function NodeFactoryViewer(config){
		RED.nodes.createNode(this,config);
		var node = this;
		var outMsg = [];
		node.config = RED.nodes.getNode(config.config).config;
		node.on('input', function (msg) {
			var newMsg = Array(node.config.rules.length*3);
			for(var i=0;i<node.config.rules.length;i++) {
				if(msg.topic === node.config.rules[i].machine) {
					newMsg[i*3] = {
						topic: msg.topic,
						payload: msg.state
					};
					newMsg[i*3+1] = {
						topic: msg.topic,
						payload: msg.interval
					};
					newMsg[i*3+2] = {
						topic: msg.topic,
						payload: msg.payload
					};
					node.send(newMsg);
					break;
				}
			}
		});
	}
	RED.nodes.registerType("lazurite-node-factory", NodeFactory);
	RED.nodes.registerType("lazurite-factory-config", NodeFactoryConfig);
	RED.nodes.registerType("lazurite-factory-viewer", NodeFactoryViewer);
}
