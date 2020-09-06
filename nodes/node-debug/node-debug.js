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
	var fs = require("fs");
	function NodeDebug(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		node.config = config;
		console.log(node.config);
		if(typeof node.config.filename === "string") {
			node.on('input', function (msg) {
				try {
				var out;
					if(Array.isArray(msg.payload)) {
						for(var log of msg.payload) {
							lazuriteRxLog(log);
						}
					} else {
						lazuriteRxLog(msg);
					}
				} catch(err) {
					console.log(err);
				}
				function lazuriteRxLog(msg) {
					if(msg.src_addr) {
						var rxtime = new Date(parseInt(msg.sec * 1000 + msg.nsec / 1000000));
						if(msg.src_addr[3] !== 0) {
							var out = `RX,BC,${rxtime},0x${toHex(msg.src_addr[3])}${toHex(msg.src_addr[2])}${toHex(msg.src_addr[1])}${toHex(msg.src_addr[0])},${msg.rssi},${msg.payload}\n`
							fs.appendFile(node.config.filename,out);
						} else {
							var out = `RX,MSG,${rxtime},${msg.src_addr[0]},${msg.rssi},${msg.payload}`
							fs.appendFile(node.config.filename,out);
						}
					} else if(msg.payload.timestamp && msg.payload.type) {
						if(msg.payload.type === "log") {
							var out = `MQTT,${msg.payload.type},${new Date(msg.payload.timestamp)},${msg.payload.machine},${new Date(msg.payload.from)}, ${msg.payload.state}\n`;
							fs.appendFile(node.config.filename,out);
						} else if(msg.payload.type === "hour") {
							var out = `MQTT,${msg.payload.type},${new Date(msg.payload.timestamp)},${JSON.stringify(msg.payload.capacity)},${JSON.stringify(msg.payload.rssi)}, ${JSON.stringify(msg.payload.vbat)}\n`;
							fs.appendFile(node.config.filename,out);
						} else if(msg.payload.type === "day") {
							var out = `MQTT,${msg.payload.type},${new Date(msg.payload.timestamp)},${JSON.stringify(msg.payload)}\n`;
							fs.appendFile(node.config.filename,out);
						} else if(msg.payload.type === "battery") {
							var out = `MQTT,${msg.payload.type},${new Date(msg.payload.time)},${msg.payload.timestamp},${msg.payload.vbat},${msg.payload.rssi}\n`;
							fs.appendFile(node.config.filename,out);
						} else if(msg.payload.type.match(/graph/)){
							if(msg.payload.type.match(/raw/)) {
								var out = `MQTT,graph-raw,${new Date(msg.payload.timestamp)},${msg.payload.type.split('-')[1]},${msg.payload.value}\n`;
								fs.appendFile(node.config.filename,out);
							} else if(msg.payload.type.match(/hour/)) {
								var out = `MQTT,graph-hour,${new Date(msg.payload.timestamp)},${msg.payload.type.split('-')[1]},${msg.payload.min},${msg.payload.max}\n`;
								fs.appendFile(node.config.filename,out);
							} else if(msg.payload.type.match(/day/)) {
								var out = `MQTT,graph-day,${new Date(msg.payload.timestamp)},${msg.payload.type.split('-')[1]},${msg.payload.min},${msg.payload.max}\n`;
								fs.appendFile(node.config.filename,out);
							}
						}
					}
				}
				function toHex(data) {
					return ('0000'+ data.toString(16).toUpperCase()).substr(-4);
				}
			});
		}
	}

	RED.nodes.registerType("lazurite-node-debug", NodeDebug);
}
