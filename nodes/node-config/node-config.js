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
	var cloud = require('./lib/cloud');
	var sensors = require('./lib/sensors');
	function NodeConfig(config) {
		RED.nodes.createNode(this,config);
		var rules;
		var mode;
		var outputs;
		var node = this;
		rules = config.rules;
		mode = config.mode;
		var num = 0;
		rules.forEach(function(val,index,ar){
			val.sensor_num = num;
			num += sensors[val.sensor].size;
			val.node_num = index;
			if(val.src.length == 16) {
				val.addr = [
					parseInt("0x"+val.src.substr(12,4)),
					parseInt("0x"+val.src.substr(8,4)),
					parseInt("0x"+val.src.substr(4,4)),
					parseInt("0x"+val.src.substr(0,4))
				];
				val.bit = 64;
			} else {
				val.addr = [parseInt(val.src),0,0,0];
				val.bit = 16;
			}
			val.info = sensors[val.sensor];
		});
		switch(cloud[mode].outputMode())
		{
			case 0:
				outputs = 1;
				break;
			case 1:
				outputs = rules.length;
				break;
			case 2:
				outputs = num;
				break;
		}
		
		node.on('input', function (msg) {
			if (Array.isArray(msg.payload)) {
				for (var i = 0; i < msg.payload.length ; i++) {
					var data = sensor_decode(msg.payload[i]);
					if(data != false) {
						node.send(data);
					}
				}
			} else {
				var data = sensor_decode(msg);
				if(data != false) {
					node.send(data);
				}
			}
		});
		function isAddressMatch(addr1,addr2){
			for (var i = 0; i < 4 ; i++){
				if(addr1[i] != addr2[i]) {
					return false;
				}
			}
			return true;
		}
		function sensor_decode(rcv) {
			for (var i=0 ; i < rules.length ; i++) {
				if(isAddressMatch(rules[i].addr,rcv.src_addr)) {
					var data = cloud[mode].genPayload(rcv,rules[i]);
					return data;
				}
			}
			return false;
		}
	}
	
	function PreMqttPublisher(config) {
		var lib = require('../../build/Release/get_addr');
		var param = require('../../param');
		//var stream = require('stream');
		//var util = require('util');
		RED.nodes.createNode(this,config);

		this.timer = null;
		this.check = true;
		this.sent = false;
		this.packet = [];
		param.ipt =lib.get_ipv4(config.adapter);
		var ip = param.ipt.split(".");
		param.ipa = [];
		for (var i=0; i<4; i++) {
			param.ipa.push(parseInt(ip[i]));
		}
		this.interval = parseInt(config.interval);
		if(this.interval <= 0) this.check = false;
		this.intervalUnit = config.intervalUnit;

		var node = this;
		switch(config.intervalUnit) {
			case 'sec':
			this.unit = 1000;
			break;
			case 'min':
			this.unit = 60000;
			break;
			case 'hour':
			this.unit = 3600000;
			break;
			case 'day':
			this.unit = 3600000*24;
			break;
			default:
			this.check = false;
			break;
		}

		if(this.check) {
			this.timer = setInterval(function(){
				if(this.sent) {
					this.sent = false;
					this.packet = [];
				}
				if(this.packet.length != 0){
					var output = {};
					var payload = {};
					var gw ={};
					gw.ipa = param.ipa;
					gw.ipt = param.ipt;
					gw.loa = param.loa;
					gw.lot = param.lot;
					payload.gw = gw;
					payload.data = this.packet;
					output.payload = payload;
					node.send(output);
					this.sent = true;
				}
			}.bind(this),this.interval * this.unit);
		}

		node.on('input',function(msg){
			if(this.sent) {
				this.sent = false;
				this.packet= [];
			}
			this.packet.push(msg.payload);
		});
		node.on('close',function(msg){
			if(this.timer !== null) clearInterval(this.timer);
			done();
		});
		function get_addr(error,stdout,stderr){
			ip_addr = stdout.replace(/\r?\n/g,"");
		}
	}
	function vmstat(config) {
		var lib = require('../../build/Release/get_vmstat');
		RED.nodes.createNode(this,config);

		this.timer = null;
		this.check = true;
		this.interval = parseInt(config.interval);
		if(this.interval <= 0) this.check = false;
		this.intervalUnit = config.intervalUnit;

		var node = this;
		switch(config.intervalUnit) {
			case 'sec':
			this.unit = 1000;
			break;
			case 'min':
			this.unit = 60000;
			break;
			case 'hour':
			this.unit = 3600000;
			break;
			case 'day':
			this.unit = 3600000*24;
			break;
			default:
			this.check = false;
			break;
		}

		if(this.check) {
			this.timer = setInterval(function(){
				var output = {};
				output.payload = lib.get_vmstat();
				node.send(output);
			}.bind(this),this.interval * this.unit);
		}

		node.on('close',function(msg){
			if(this.timer !== null) clearInterval(this.timer);
			done();
		});
	}

	RED.nodes.registerType("lazurite-node-config", NodeConfig);
	RED.nodes.registerType("lazurite-pre-mqtt-publisher", PreMqttPublisher);
	RED.nodes.registerType("lazurite-vmstat", vmstat);
}
