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
	function NodeFactory(config) {
		WARN = require('./warning_code.js')
		RED.nodes.createNode(this,config);
		var node = this;
		var outMsg = [];
		node.config = RED.nodes.getNode(config.config).config;

		node.capacity = [];
		node.worklog = [];

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
				ct_addr: src_ct,						// source address of CT
				ct_total: 0,							// total meas count of CT
				ct_active: 0,							// active count of CT
				//ct_stop: 0,								// stop count of CT
				ct_wait: 0,								// wait count of CT
				ct_wait_time: 0,						// wait count of CT
				ct_thres: parseFloat(data.thres),		// threshold of CT
				ct_state: undefined,					// status of CT
				ct_state_time: undefined,				// time of changing state
				hall_addr: src_hall,					// src addr of hall sensor
				hall_state: undefined,					// state of CT sensor
				hall_state_time: undefined,				// time of changing hall state
				hall_warn: false,						// warning state(true: triggered, false: no)
				ct_dead_time: parseFloat(data.detect)*1000,	// dead_time(ms) of wait
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
		});

		// main process to calcurate capacity
		// check addres
		function calCapacity(msg) {
			var rxtime;
			for(var i=0; i < node.capacity.length; i++) {
				// In case of CT sensor
				if(node.capacity[i].ct_addr instanceof Array){
					if(addrComp(node.capacity[i].ct_addr,msg.src_addr)) {
						// calcurate rx time
						rxtime = msg.sec*1000 + Math.round(msg.nsec /1000000);
						var value = parseFloat(msg.payload.split(',')[0]);
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
					node.capacity[index].ct_total += node.capacity[index].ct_wait;
					//node.capacity[index].ct_stop  += node.capacity[index].ct_wait;
					node.capacity[index].ct_wait = 0;
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
			var current_time = new Date(rxtime);
			updateCapInterval(rxtime);
			switch(node.capacity[index].ct_state){
			case undefined:
			case null:						// first time
				node.capacity[index].ct_total += 1;
				if(data > node.capacity[index].ct_thres) {
					node.capacity[index].ct_state = 'act';
					node.capacity[index].ct_active += 1;
					node.capacity[index].ct_state_time = rxtime;
				} else {
					updateWorkLog(index,'wait',rxtime);
					node.capacity[index].ct_state = 'stop';
					node.capacity[index].ct_state_time = rxtime;
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
					node.capacity[index].ct_total += 1;
					node.capacity[index].ct_active += 1;
				} else {
					updateWorkLog(index,'wait',rxtime);
					node.capacity[index].ct_state = 'wait';
					node.capacity[index].ct_wait = 1;
					node.capacity[index].ct_wait_time = rxtime;
				}
				break;
			case 'stop':					// current is stop
				node.capacity[index].ct_total += 1;
				if(data > node.capacity[index].ct_thres) {
					updateWorkLog(index,'act',rxtime);
					node.capacity[index].ct_state = 'act';
					node.capacity[index].ct_active += 1;
					node.capacity[index].ct_state_time = rxtime;
				} else {
					//node.capacity[index].ct_stop += 1;
				}
				break;
			case 'wait':					// dead time from current stop to stop state
				// restart during dead time
				if(data > node.capacity[index].ct_thres) {
					updateWorkLog(index,'reset',rxtime);
					node.capacity[index].ct_state = 'act';
					node.capacity[index].ct_total += (node.capacity[index].ct_wait + 1);
					node.capacity[index].ct_active += (node.capacity[index].ct_wait + 1);
					node.capacity[index].ct_wait = 0;
				} else {
					// move to stop state
					if((rxtime - node.capacity[index].ct_wait_time)>node.capacity[index].ct_dead_time){
						node.capacity[index].ct_state = 'stop';
						node.capacity[index].ct_state_time = node.capacity[index].ct_wait_time;
						node.capacity[index].ct_total += (node.capacity[index].ct_wait + 1);
						//node.capacity[index].ct_stop  += (node.capacity[index].ct_wait + 1);
						node.capacity[index].ct_wait = 0;
					} else {
						node.capacity[index].ct_wait += 1;
					}
				}
				break;
			}
			// message of capacity
			var msg = {
				topic: node.config.rules[index].machine,
				state: node.capacity[index].ct_state,
				interval: intervalFormatter(rxtime - node.capacity[index].ct_state_time),
				payload: ((node.capacity[index].ct_active / node.capacity[index].ct_total)*100).toFixed(2),
			};
			outMsg[0] = msg;
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
			case 'act':
				// restarting
				node.worklog[index].time[3] = rxtime;
				// message of worklog
				msg.payload = [
					Math.round(node.worklog[index].time[0]/1000),
					dateFormatter(node.worklog[index].time[0]),
					isNaN(node.worklog[index].time[1]) ? "" : Math.round(node.worklog[index].time[1]/1000),
					dateFormatter(node.worklog[index].time[1]),
					isNaN(node.worklog[index].time[2]) ? "" : Math.round(node.worklog[index].time[2]/1000),
					dateFormatter(node.worklog[index].time[2]),
					Math.round(node.worklog[index].time[3]/1000),
					dateFormatter(node.worklog[index].time[3]),
					intervalFormatter(node.worklog[index].time[3]-node.worklog[index].time[0]),
					intervalFormatter(node.worklog[index].time[1]-node.worklog[index].time[0]),
					intervalFormatter(node.worklog[index].time[2]-node.worklog[index].time[1]),
					"",
					node.config.rules[index].machine
				];
				outMsg[2] = msg;
				node.worklog[index].time = new Array(4);
				break;
			}
		}

		// function for interval process
		function updateCapInterval(rxtime){
			var st_meas_time,st_reset_time,now_meas_time, now_reset_time;
			if(node.capInterval.meas_time === undefined) {
				node.capInterval.meas_time = rxtime;
			}
			if(node.capInterval.reset_time === undefined) {
				node.capInterval.reset_time = rxtime;
			}
			// generate comparing time according to interval
			switch(node.capInterval.interval) {
			case 0:			//minuites
				st_meas_time = new Date(node.capInterval.meas_time).getMinutes();
				st_reset_time = st_meas_time;
				now_meas_time = new Date(rxtime).getMinutes();
				now_reset_time = now_meas_time;
				break;
			case 1:			// hour
				st_meas_time = new Date(node.capInterval.meas_time).getHours();
				st_reset_time = st_meas_time;
				now_meas_time = new Date(rxtime).getHours();
				now_reset_time = now_meas_time;
				break;
			case 2:			// day
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
			if(st_meas_time != now_meas_time) {
				var msg = new Array(node.capacity.length + 1);
				if(node.capInterval.interval == 0) {
					msg[0] = dateFormatterMinute(node.capInterval.meas_time);
				} else {
					msg[0] = dateFormatterHour(node.capInterval.meas_time);
				}
				for(var i = 0; i < node.capacity.length ; i++) {
					msg[i+1] = ((node.capacity[i].ct_active / node.capacity[i].ct_total)*100).toFixed(2);
				}
				outMsg[1] = { payload: msg };
				node.capInterval.meas_time = rxtime;
			}
			
			// function to reset per interval
			if(node.capInterval.interval < 3) {
				if(st_reset_time !== now_reset_time){
					console.log('reset capacity');
					for(var i = 0; i < node.capacity.length; i++) {
						// reset data
						node.capacity[i].ct_total = 0;
						node.capacity[i].ct_active = 0;
					}
					node.capInterval.reset_time = rxtime;
				}
			}

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
	}
	

	function NodeFactoryConfig(config) {
		RED.nodes.createNode(this,config);
		this.config = config;
	}
	RED.nodes.registerType("lazurite-node-factory", NodeFactory);
	RED.nodes.registerType("lazurite-factory-config", NodeFactoryConfig);
}
