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
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = function(RED) {

	var lib = require('../../build/Release/lazurite_wrap');
	var stream = require('stream');
	var util = require('util');
	var latest_rfparam_id="";

	function Warn(message){
		RED.log.warn("LazuriteInNode: " + message);
	}

	function Info(message){
		RED.log.info("LazuriteInNode: " + message);
	}

	function setAckReq(node) {
			if(!lib.lazurite_setAckReq(node.ackreq)) { Warn("lazurite_setAckReq fail"); return; }
	}
	function setBroadcast(node) {
			if(!lib.lazurite_setBroadcastEnb(node.broadcastenb)) { Warn("lazurite_setBroadcastEnb fail"); return; }
	}
	function connect(node) {
		if(!lib.dlopen()) { Warn("dlopen fail"); return; }
		if(!lib.lazurite_init()) { Warn("lazurite_init fail"); return; }
		if(node.channel.config.defaultaddress==false) {
			if(!lib.lazurite_setMyAddress(node.channel.config.myaddr)) { Warn("lazurite_setMyAddress fail"); return; }
		}
		if(node.channel.config.key!=undefined) {
			if(!lib.lazurite_setKey(node.channel.config.key)) { Warn("lazurite_setKey fail"); return; }
		}
		if(!lib.lazurite_begin(node.ch, node.panid, node.rate, node.pwr)) { Warn("lazurite_begin fail"); return; }
		node.status({fill:"green",shape:"dot",text:"connected"},true);
	}

	function disconnect(node) {
		if(node.enable) {
			if(!lib.lazurite_rxDisable()) { Warn("lazurite_rxDisable fail."); }
			node.enable = false;
		}
		if(!lib.lazurite_close()) { Warn("lazurite_close fail"); }
		if(!lib.lazurite_remove()) { Warn("lazurite_remove fail"); }
		if(!lib.dlclose()) { Warn("dlclose fail"); }
		node.status({fill:"red",shape:"ring",text:"disconnected"});
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
				if(!lib.lazurite_rxEnable()) { Warn("lazurite_rxEnable fail"); clearInterval(this.timer); return; }
				this.enable = true;
				}
				this.emit('data', lib.lazurite_read());
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
		this.ch    = this.channel ? this.channel.config.ch              : 36;
		this.panid = this.channel ? parseInt(this.channel.config.panid) : 0xabcd;
		this.rate  = this.channel ? this.channel.config.rate            : 100;
		this.pwr   = this.channel ? this.channel.config.pwr             : 20;
		this.interval   = parseInt(config.interval);
		this.name  = config.name;
		this.enbinterval  = config.enbinterval;
		this.broadcastenb  = config.broadcastenb;
		var node = this;
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		connect(node);
		setBroadcast(node);
		if(!lib.lazurite_setRxMode(node.latestpacket)) { Warn("setRxMode fail"); return; }
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
			if(!lib.lazurite_rxEnable()) { Warn("lazurite_rxEnable fail"); }
		}

		node.on('input', function(msg) {
			var data = lib.lazurite_read();
			if(data['length'] > 0) {
				var msg = data;
				node.send(msg);
			}
		});
		node.on('close', function(done) {
			readStream.pause();
			disconnect(node);
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
		this.ch       = this.channel  ? this.channel.config.ch                : 36;
		this.panid    = this.channel  ? this.channel.config.panid             : 0xabcd;
		this.rate     = this.channel  ? this.channel.config.rate              : 100;
		this.pwr      = this.channel  ? this.channel.config.pwr               : 20;
		this.dst_addr   = parseInt(config.dst_addr);
		this.dst_panid  = parseInt(config.dst_panid);
		this.name     = config.name;
		this.enable   = false;
		this.ackreq   = config.ackreq;
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
			setAckReq(node);
			if(!lib.lazurite_send(dst_panid, dst_addr, msg.payload.toString())) { Warn("lazurite_send fail"); return; }
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
		this.ch       = this.channel  ? this.channel.config.ch                : 36;
		this.panid    = this.channel  ? this.channel.config.panid             : 0xabcd;
		this.rate     = this.channel  ? this.channel.config.rate              : 100;
		this.pwr      = this.channel  ? this.channel.config.pwr               : 20;
		this.name     = config.name;
		this.enable   = false;
		this.ackreq   = config.ackreq;
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
			setAckReq(node);
			if(!lib.lazurite_send64be(dst_addr, msg.payload.toString())) { Warn("lazurite_send fail"); return; }
			node.send(msg);
		});
		node.on('close', function(done) {
			disconnect(node);
			done();
		});
	}
	RED.nodes.registerType("lazurite-tx64",LazuriteTx64Node);


	function LazuriteChannelNode(config) {
		RED.nodes.createNode(this,config);
		if (config.key.length == 32){
			var key = [];
			for (var i = 0; i < 16 ; i++) {
				key.push(parseInt("0x"+config.key.substr(i*2,2)));
			}
		} else {
			var key = undefined;
		}
		this.config = {
			ch: config.ch,
			panid: parseInt(config.panid),
			rate: config.rate,
			pwr: config.pwr,
			defaultaddress: config.defaultaddress,
			myaddr: parseInt(config.myaddr),
			key: key
		}
	}
	RED.nodes.registerType("lazurite-channel",LazuriteChannelNode);
    RED.httpAdmin.post("/lazurite-tx/:id/:state", RED.auth.needsPermission("lazurite-tx.write"), function(req,res) {
        var node = RED.nodes.getNode(req.params.id);
        var state = req.params.state;
        if (node !== null && typeof node !== "undefined" ) {
			latest_rfparam_id = state;
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    });
    RED.httpAdmin.post("/lazurite-tx64/:id/:state", RED.auth.needsPermission("lazurite-tx64.write"), function(req,res) {
        var node = RED.nodes.getNode(req.params.id);
        var state = req.params.state;
        if (node !== null && typeof node !== "undefined" ) {
			latest_rfparam_id = state;
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    });
    RED.httpAdmin.post("/lazurite-rx/:id/:state", RED.auth.needsPermission("lazurite-rx.write"), function(req,res) {
        var node = RED.nodes.getNode(req.params.id);
        var state = req.params.state;
        if (node !== null && typeof node !== "undefined" ) {
			latest_rfparam_id = state;
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    });
}
