/*
 *  file: lazurite.js
 *
 *  Copyright (C) 2016 Lapis Semiconductor Co., Ltd.
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
		console.log("node.latestpacket = " + node.latestpacket);
		if(!lib.lazurite_setRxMode(node.latestpacket)) { Warn("setRxMode fail"); return; }
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
		this.enbinterval  = config.enbinterval ? config.enbinterval: false;
		this.latestpacket  = config.latestpacket ? config.latestpacket: false;
		//console.log(config);
		//console.log(this);

		var node = this;
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		connect(node);

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
		this.rxaddr   = parseInt(config.rxaddr);
		this.rxpanid  = parseInt(config.rxpanid);
		this.name     = config.name;

		this.enable   = false;

		var node = this;
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		connect(node);

		node.on('input', function(msg) {
				if(!lib.lazurite_send(node.rxpanid, node.rxaddr, msg.payload.toString())) { Warn("lazurite_send fail"); return; }
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
