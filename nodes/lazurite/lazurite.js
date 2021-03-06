/*
 *  Copyright (C) 2016 Lapis Semiconductor Co., Ltd.
 *  file: lazurite.js
 *
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *	  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = function(RED) {

	var lib = require('../../build/Release/lazurite_wrap');
	var param = require('../../param');
	var stream = require('stream');
	var util = require('util');
	var latest_rfparam_id="";
	var isConnect = false;
	const lazurite_err = {
		14: "TX FAIL",
		16: "CCA BUSY",
		52: "CCA FAIL",
		110: "NO ACK"
	};

	function Warn(message){
		RED.log.warn(message);
	}

	function Info(message){
		RED.log.info(message);
	}

	function setAckReq(ackreq) {
		if(!lib.setAckReq(ackreq)) { Warn("lazurite_setAckReq fail"); return; }
	}
	function setBroadcast(node) {
		if(!lib.setBroadcastEnb(node.broadcastenb)) { Warn("lazurite_setBroadcastEnb fail"); return; }
	}
	function setEnhanceAck(data,size) {
		if(!lib.setEnhanceAck(data,size)) { Warn("lazurite_setEnhanceAck fail"); return; }
	}
	function connect(node) {
		if(!isConnect) {
			if(!lib.dlopen()) { Warn("dlopen fail"); return; }
			let result = lib.init();
			if(result === false) {
				console.log('lazdriver is loaded in kernel. This Node-RED takes it.');
			}
			if(node.channel.config.defaultaddress==false) {
				if(!lib.setMyAddress(node.channel.config.myaddr)) { Warn("lazurite_setMyAddress fail"); return; }
			}
			if(node.channel.config.key.length==32) {
				if(!lib.setKey(node.channel.config.key)) { Warn("lazurite_setKey fail"); return; }
			}
			var lo = lib.getMyAddr64();
			param.loa = [];
			param.lot = "";
			for(var i=0;i<8;i++) {
				param.loa.push(lo[i]);
				param.lot += (lo[i] < 16 ? "0":"") + lo[i].toString(16);
			}
			var panid;
			if((node.panid === 0xffff)||(node.panid === 0xfffe)) {
				panid = parseInt(Math.random() * 0xfffd);
			} else {
				panid = node.panid;
			}
			global.gateway = {
				panid: panid,
				macaddr: parseInt('0x'+param.lot),
				shortaddr: node.channel.config.myaddr
			}
			if(!lib.begin(node.ch, panid, node.rate, node.pwr)) { Warn("lazurite_begin fail"); return; }
		}
		if(node.channel.config.status === true) {
			node.status({fill:"green",shape:"dot",text:"connected"},true);
		} else {
			node.status({fill:"yellow",shape:"dot",text:"connected"},true);
			node.warn("Different LazuriteConfigNode is loaded\nUsing the parameters\n"+JSON.stringify(node.channel.config,null,"  "))
		}
		isConnect = true;
		return isConnect;
	}

	function disconnect(node) {
		if(isConnect) {
			if(!lib.rxDisable()) { Warn("lazurite_rxDisable fail."); }
			node.enable = false;
			if(!lib.close()) { Warn("lazurite_close fail"); }
			if(!lib.remove()) { Warn("lazurite_remove fail"); }
			if(!lib.dlclose()) { Warn("dlclose fail"); }
		}
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		isConnect = false;
		return true;
	}

	function ReadStream(node) {
		this.readable = true;
		this.timer = null;
		this.enable = false;
		this.node = node;
		this.interval = node.interval;
	}
	util.inherits(ReadStream, stream.Stream);

	ReadStream.prototype.resume = function() {
		this.timer = setInterval(function() {
			if(!this.enable) {
				if(!lib.rxEnable()) { Warn("lazurite_rxEnable fail"); clearInterval(this.timer); return; }
				this.enable = true;
			}
			this.emit('data', lib.read(this.node.binary));
		}.bind(this), this.interval);
	};

	ReadStream.prototype.pause = function() {
		clearInterval(this.timer);
	};

	ReadStream.prototype.pipe = function(dest) {};
	ReadStream.prototype.setEncoding = function(encoding) {};
	ReadStream.prototype.destroy = function() {};
	ReadStream.prototype.destroySoon = function() {};

	function LazuriteRxNode(config) {
		RED.nodes.createNode(this,config);
		this.channel = RED.nodes.getNode(config.channel);
		this.ch	= this.channel ? this.channel.config.ch			  : 36;
		this.panid = this.channel ? parseInt(this.channel.config.panid) : 0xabcd;
		this.rate  = this.channel ? this.channel.config.rate			: 100;
		this.pwr   = this.channel ? this.channel.config.pwr			 : 20;
		this.interval   = parseInt(config.interval);
		this.name  = config.name;
		this.enbinterval  = config.enbinterval;
		this.broadcastenb  = config.broadcastenb;
		this.latestpacket  = config.latestpacket;
		this.binary = config.binary;
		var node = this;
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		connect(node);
		setBroadcast(node);
		if(!lib.setRxMode(node.latestpacket)) { Warn("setRxMode fail"); return; }
		if(this.enbinterval) {
			var readStream = new ReadStream(node);
			readStream.on('data', function(data) {
				if(data['length'] > 0) {
					var msg = data;
					node.send(msg);
					//node.send(data);
				};
			});
			readStream.resume(node);
		} else {
			if(!lib.rxEnable()) { Warn("lazurite_rxEnable fail"); }
		}

		node.on('input', function(msg) {
			var data = lib.read(node.binary);
			if(data['length'] > 0) {
				var msg = data;
				node.send(msg);
			}
		});
		node.on('close', function(done) {
			readStream.pause();
			disconnect(node)
			done();
		});
	}
	RED.nodes.registerType("lazurite-rx",LazuriteRxNode);

	function LazuriteTxNode(config) {
		RED.nodes.createNode(this,config);
		if(latest_rfparam_id==""){
			this.channel  = RED.nodes.getNode(config.channel);
		} else {
			this.channel  = RED.nodes.getNode(latest_rfparam_id);
		}
		this.ch	   = this.channel  ? this.channel.config.ch				: 36;
		this.panid	= this.channel  ? this.channel.config.panid			 : 0xabcd;
		this.rate	 = this.channel  ? this.channel.config.rate			  : 100;
		this.pwr	  = this.channel  ? this.channel.config.pwr			   : 20;
		this.dst_addr   = parseInt(config.dst_addr);
		this.dst_panid  = parseInt(config.dst_panid);
		this.name	 = config.name;
		this.enable   = false;
		this.ackreq   = config.ackreq;
		this.binary = config.binary;
		var node = this;
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		connect(node);
		node.on('input', function(msg) {
			var dst_panid;
			var dst_addr;
			if(typeof msg.dst_panid != "undefined") {
				dst_panid = msg.dst_panid;
			} else {
				dst_panid = node.dst_panid;
			}
			if(typeof msg.dst_addr != "undefined") {
				dst_addr = msg.dst_addr[0];
			} else {
				dst_addr = node.dst_addr;
			}
			setAckReq(msg.ackreq || node.ackreq);
			if(typeof msg.payload === 'string') {
					msg.result = lib.send(dst_panid, dst_addr, msg.payload.toString());
			} else if (msg.payload instanceof Buffer) {
				var payload = new Uint8Array(msg.payload);
				msg.result = lib.send(dst_panid, dst_addr, payload);
			} else if (msg.payload instanceof Uint8Array){
				msg.result = lib.send(dst_panid, dst_addr, msg.payload);
			} else {
				Warn(`LazuriteTxNode fail:: payload is unsupported type(${typeof msg.payload})`); 
				msg.result = -1;
				node.send(msg);
				return;
			}
			if(msg.result >= 0) {
				var edat = lib.getEnhanceAck();
				if(edat.length !== 0) { msg.eack = edat; }
			} else {
				Warn(`LazuriteTxNode fail:: ${lazurite_err[-msg.result]}, PANID: 0x${('000'+dst_panid.toString(16)).slice(-4)}, DST:0x${('000'+dst_addr.toString(16)).slice(-4)}, payload: ${msg.payload}`);
			}
			node.send(msg);
		});
		node.on('close', function(done) {
			disconnect(node);
			done();
		});
	}
	RED.nodes.registerType("lazurite-tx",LazuriteTxNode);

	function LazuriteTx64Node(config) {
		RED.nodes.createNode(this,config);
		if(latest_rfparam_id==""){
			this.channel  = RED.nodes.getNode(config.channel);
		} else {
			this.channel  = RED.nodes.getNode(latest_rfparam_id);
		}
		this.ch	   = this.channel  ? this.channel.config.ch				: 36;
		this.panid	= this.channel  ? this.channel.config.panid			 : 0xabcd;
		this.rate	 = this.channel  ? this.channel.config.rate			  : 100;
		this.pwr	  = this.channel  ? this.channel.config.pwr			   : 20;
		this.name	 = config.name;
		this.enable   = false;
		this.ackreq   = config.ackreq;
		this.binary = config.binary;
		this.dst_addr = [
			parseInt("0x"+config.dst_addr0.substr(0,2)),
			parseInt("0x"+config.dst_addr0.substr(2,2)),
			parseInt("0x"+config.dst_addr1.substr(0,2)),
			parseInt("0x"+config.dst_addr1.substr(2,2)),
			parseInt("0x"+config.dst_addr2.substr(0,2)),
			parseInt("0x"+config.dst_addr2.substr(2,2)),
			parseInt("0x"+config.dst_addr3.substr(0,2)),
			parseInt("0x"+config.dst_addr3.substr(2,2))];
		var node = this;
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		connect(node);

		node.on('input', function(msg) {
			var dst_panid;
			var dst_addr;
			if(typeof msg.dst_addr != "undefined") {
				// convert from little endian to big endian
				dst_addr = new Array(8);
				dst_addr[0] = msg.dst_addr[3] >> 8;
				dst_addr[1] = msg.dst_addr[3] & 0x00ff;
				dst_addr[2] = msg.dst_addr[2] >> 8;
				dst_addr[3] = msg.dst_addr[2] & 0x00ff;
				dst_addr[4] = msg.dst_addr[1] >> 8;
				dst_addr[5] = msg.dst_addr[1] & 0x00ff;
				dst_addr[6] = msg.dst_addr[0] >> 8;
				dst_addr[7] = msg.dst_addr[0] & 0x00ff;
			} else {
				dst_addr = node.dst_addr;
			}
			setAckReq(msg.ackreq || node.ackreq);
			if(typeof msg.payload === 'string') {
				msg.result = lib.send64be(dst_addr, msg.payload.toString());
			} else if (msg.payload instanceof Buffer) {
				var payload = new Uint8Array(msg.payload);
				msg.result = lib.send64be(dst_addr, payload);
			} else if (msg.payload instanceof Uint8Array) {
				msg.result = lib.send64be(dst_addr, msg.payload);
			} else {
				Warn(`LazuriteTx64Node fail:: payload is unsupported type(${typeof msg.payload})`); 
				msg.result = -1;
				node.send(msg);
				return;
			}
			if(msg.result >= 0) {
				var edat = lib.getEnhanceAck();
				if(edat.length !== 0) { msg.eack = edat; }
			} else {
				let dst = ('0'+dst_addr[0].toString(16)).slice(-2)+
					('0'+dst_addr[1].toString(16)).slice(-2)+
					('0'+dst_addr[2].toString(16)).slice(-2)+
					('0'+dst_addr[3].toString(16)).slice(-2)+
					('0'+dst_addr[4].toString(16)).slice(-2)+
					('0'+dst_addr[5].toString(16)).slice(-2)+
					('0'+dst_addr[6].toString(16)).slice(-2)+
					('0'+dst_addr[7].toString(16)).slice(-2);
				Warn(`LazuriteTx64Node fail:: ${lazurite_err[-msg.result]}, DST:${dst}, payload: ${msg.payload}`);
			}
			node.send(msg);
		});
		node.on('close', function(done) {
			disconnect(node);
			done();
		});
	}
	RED.nodes.registerType("lazurite-tx64",LazuriteTx64Node);


	function SetEnhanceACKNode(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		//node.status({fill:"red",shape:"ring",text:"disconnected"});
		//connect(node);
		node.on('input', function(msg) {
			//          console.log('DEBUG lazurite.js: Payload:#%s Length:#%d',msg.payload,msg.payload.length);
			var numOfRcv = Array.isArray(msg.payload) ? msg.payload.length : 0;
			var sizeOfEack = Array.isArray(msg.payload[0].data) ? msg.payload[0].data.length : 0;
			var buffSize;
			if((numOfRcv == 0) || (sizeOfEack == 0)) {
				buffSize = 0;
				setEnhanceAck(null,buffSize);
				return;
			}
			buffSize = msg.payload.length * (msg.payload[0].data.length+2) + 4;
			var buffer = new ArrayBuffer(buffSize);
			var uint8Array = new Uint8Array(buffer,0,buffSize);
			if(sizeOfEack > 16) {
				//              console.log("error1");
				return;
			}
			var index = 4;
			uint8Array[0] = numOfRcv&0x0ff;
			uint8Array[1] = numOfRcv >> 8;
			uint8Array[2] = sizeOfEack&0x0ff;
			uint8Array[3] = sizeOfEack >> 8;
			for(var i in msg.payload) {
				if(sizeOfEack != msg.payload[i].data.length) {
					//                  console.log({msg: "error2", sizeOfEack: sizeOfEack, payload: msg.payload[i].data.length});
					return;
				}
				if(sizeOfEack == msg.payload[i].data.length) {
					uint8Array[index] = msg.payload[i].addr&0x0ff,index += 1;
					uint8Array[index] = msg.payload[i].addr>>8,index += 1;
					for(var j in msg.payload[i].data) {
						uint8Array[index] = msg.payload[i].data[j],index += 1;
					}
				}
			}
			if (isConnect === true) {
				setEnhanceAck(uint8Array,buffSize);
				node.send(uint8Array);
			} else {
				Warn("EnhanceAckNode error, cannot file lazurite_wrap");
			}
		});
		/*
		node.on('close', function(done) {
			disconnect(node);
			done();
		});
		*/
	}
	RED.nodes.registerType("SetEnhanceACK",SetEnhanceACKNode);

	var configParams = null;
	function LazuriteChannelNode(config) {
		RED.nodes.createNode(this,config);
		if(configParams === null) {
			var key = "";
			if(typeof config.key == 'string') {
				if (config.key.length == 32) {
					key = config.key;
				}
			}
			this.config = {
				ch: config.ch,
				panid: parseInt(config.panid),
				rate: config.rate,
				pwr: config.pwr,
				defaultaddress: config.defaultaddress,
				myaddr: parseInt(config.myaddr),
				key: key,
				status: true
			}
			configParams = this.config;
		} else {
			this.config = {}
			for(var key in configParams) {
				this.config[key] = configParams[key];
			}
			this.config.status = false;
		}
		this.on("close",()=> {
			configParams = null;
		});
	}
	RED.nodes.registerType("lazurite-channel",LazuriteChannelNode);
}
