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

	var lib = require('./build/Release/lazurite_wrap');
	var stream = require('stream');
	var util = require('util');

	function Warn(message){
		RED.log.warn("LazuriteInNode: " + message);
	}

	function Info(message){
		RED.log.info("LazuriteInNode: " + message);
	}

	function connect(node) {
		if(!lib.dlopen()) { Warn("dlopen fail"); return; }
		if(!lib.lazurite_init()) { Warn("lazurite_init fail"); return; }
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
		this.ch    = this.channel ? this.channel.ch              : 36;
		this.panid = this.channel ? parseInt(this.channel.panid) : 0xabcd;
		this.rate  = this.channel ? this.channel.rate            : 100;
		this.pwr   = this.channel ? this.channel.pwr             : 20;
		this.interval   = config.interval ? config.interval        : 1000;
		this.name  = config.name;
		this.enbinterval  = config.enbinterval ? true : false;
		this.latestpacket  = config.latestpacket ? true : false;
		//console.log(config);
		//console.log(this);

		var node = this;
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		//console.log(node);
		connect(node);
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

		this.channel  = RED.nodes.getNode(config.channel);
		this.ch       = this.channel  ? this.channel.ch                : 36;
		this.panid    = this.channel  ? parseInt(this.channel.panid)   : 0xabcd;
		this.rate     = this.channel  ? this.channel.rate              : 100;
		this.pwr      = this.channel  ? this.channel.pwr               : 20;
		this.dst_addr   = parseInt(config.dst_addr);
		this.dst_panid  = parseInt(config.dst_panid);
		this.name     = config.name;

		this.enable   = false;

		var node = this;
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		connect(node);

		node.on('input', function(msg) {
			//console.log(msg);
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
			if(!lib.lazurite_send(dst_panid, dst_addr, msg.payload.toString())) { Warn("lazurite_send fail"); return; }
			node.send(msg);
		});
		node.on('close', function(done) {
			disconnect(node);
			done();
		});
	}
	RED.nodes.registerType("lazurite-tx",LazuriteTxNode);

	function LazuriteChannelNode(n) {
		RED.nodes.createNode(this,n);
		this.ch = n.ch;
		this.panid = n.panid;
		this.rate = n.rate;
		this.pwr = n.pwr;
	}
	RED.nodes.registerType("lazurite-channel",LazuriteChannelNode);
}
