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
	var rules;
	var mode;
	var cloud = require('./lib/cloud')
	var sensors = require('./lib/sensors')
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
				var data = cloud[mode](rcv,rules[i]);
				return data;
			}
		}
		return false;
	}
    function NodeManager(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		rules = config.rules;
		mode = config.mode;
		var num = 0;
		rules.forEach(function(val,index,ar){
			num += sensors[val.sensor].size;
			val.num = num-1;
			val.index = index;
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
			val.sensor = sensors[val.sensor];
		});
		
        node.on('input', function (msg) {
			if (Array.isArray(msg.payload)) {
				for (var i = 0; i < msg.payload.length ; i++) {
					var data = sensor_decode(msg.payload[i]);
					if(data != false) {
						node.send(data);
					}
				}
			} else {
				sensor_decode(msg);
			}
        });
    }
    RED.nodes.registerType("node-manager", NodeManager);
}
