'use strict'
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
	const LAZURITE = require("lazurite");

	function LazuriteMac(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.channel = RED.nodes.getNode(config.channel);
		node.channel.register(node);
		node.on("input",function(msg) {
			msg.payload = {
				mac : node.channel.lazurite.getMyAddr64(),
				panid : node.channel.options.panid,
				addr : node.channel.lazurite.getMyAddress(),
			}
			node.send(msg);
		});
		node.on("close",function(done) {
			node.channle.deregister(node);
			done();
		});
	}
	RED.nodes.registerType("lazurite-mac",LazuriteMac);

	function LazuriteRxNode(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.channel = RED.nodes.getNode(config.channel);
		node.channel.register(node);
		node.channel.lazurite.on("rx", rxfunc);
		node.on('close', function(done) {
			node.channel.deregister(node);
			done();
		});
		function rxfunc(msg) {
			node.send(msg);
		}
	}
	RED.nodes.registerType("lazurite-rx",LazuriteRxNode);

	function LazuriteTxNode(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.channel = RED.nodes.getNode(config.channel);
		node.channel.register(node);
		node.ackreq   = config.ackreq;
		node.panid = isNaN(config.dst_panid) ? 0xFFFF : parseInt(config.dst_panid);
		node.dst_addr = isNaN(config.dst_addr) ? 0xFFFF : parseInt(config.dst_addr);

		node.on('input', function(msg) {
			node.channel.lazurite.setAckReq(msg.ackreq || node.ackreq);
			let options = {
				panid : node.panid,
				dst_addr : node.dst_addr,
				payload: msg.payload,
			};
			options.panid = isNaN(msg.panid) ? node.panid : msg.panid;
			options.dst_addr = isNaN(msg.dst_addr) ? node.dst_addr : msg.dst_addr;
			msg.ret = node.channel.lazurite.send(options);
			node.send(msg);
		});
		node.on('close', function(done) {
			node.channel.deregister(node);
			done();
		});
	}
	RED.nodes.registerType("lazurite-tx",LazuriteTxNode);

	function LazuriteTx64Node(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.channel = RED.nodes.getNode(config.channel);
		node.channel.register(node);
		node.ackreq   = config.ackreq;
		node.dst_addr = `0x${config.dst_addr0}${config.dst_addr1}${config.dst_addr2}${config.dst_addr3}`;

		node.on('input', function(msg) {
			node.channel.lazurite.setAckReq(msg.ackreq || node.ackreq);
			msg.ret = node.channel.lazurite.send64(
				{
					dst_addr: msg.dst_addr||node.dst_addr,
					payload: msg.payload.toString()
				});
			node.send(msg);
		});
		node.on('close', function(done) {
			node.channel.deregister(node);
			done();
		});
	}
	RED.nodes.registerType("lazurite-tx64",LazuriteTx64Node);


	function SetEnhanceACKNode(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.channel = RED.nodes.getNode(config.channel);
		node.channel.register(node);
		node.on('input', function(msg) {
			try {
				node.channle.lazurite.setEnhacneAck(msg.payload);
			} catch(e) {
				RED.log.warn(`LazuriteSetEnhanceAckNode¥n${JSON.stringify(e)}`);
			}
		});
		node.on('close',(done) => {
			node.channel.deregister(node);
			done();
		});
	}
	RED.nodes.registerType("lazurite-setenhanceack",SetEnhanceACKNode);

	let isReady = false;
	function LazuriteChannelNode(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.lazurite = new LAZURITE();
		node.connecting = false, node.connected = true, node.closing = false;
		if(isReady === false) {
			isReady = true;
			node.config = config;
			let options = {};
			if((config.defaultinterval === false) && (isNaN(config.interval) === false)) {
				options.interval = parseInte(config.interval);
			};
			node.connecting = false, node.connected = true, node.closing = false;
			node.lazurite.init(options);
			let myAddr64 = node.lazurite.getMyAddr64();
			if(config.defaultaddress !== true) {
				node.lazurite.setMyAddress(parseInt(config.myaddr));
			}
			node.options = {
				ch: parseInt(config.ch || 36),
				panid: parseInt(config.panid || 0xabcd),
				baud: parseInt(config.baud || 100),
				pwr: parseInt(config.pwr || 20),
				myaddress: parseInt(config.myaddr)
			}
			node.lazurite.setKey(config.key);
			node.lazurite.begin(node.options);
			node.lazurite.rxEnable();
			node.connecting = false, node.connected = true, node.closing = false;
			for(let id in node.users) {
				if((node.connecting === false) && (node.connected === false)) {
					node.users[n.id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
				} else if((node.connecting === true) && (node.connected === false)) {
					node.users[n.id].status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
				} else {
					node.users[n.id].status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
				}
			}
		} else {
			RED.log.warn(`LazuriteChannelNode is conflict¥nplease delete unusing config node¥nignore ${JSON.stringify(config)}`);
		}
		node.users = {};
		node.register = function(n) {
			if(n) {
				node.users[n.id] = n;
				if((node.connecting === false) && (node.connected === false)) {
					node.users[n.id].status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
				} else if((node.connecting === true) && (node.connected === false)) {
					node.users[n.id].status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
				} else {
					node.users[n.id].status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
				}
			}
		}
		node.deregister = function(n) {
			if(n) {
				delete node.users[n.id];
			}
		}
		node.on("close",(done) => {
			if(isReady === true) {
				node.connecting = false, node.connected = false, node.closing = true;
				node.lazurite.rxDisable();
				node.lazurite.close();
				node.lazurite.remove();
				isReady = false;
			}
			done();
		});
	}
	RED.nodes.registerType("lazurite-channel",LazuriteChannelNode);
}
