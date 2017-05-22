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
	var sensors = {
		"none": require('./sensors/none'),
		"07.button": require('./sensors/button'),
		"07.env": require('./sensors/env'),
		"07.prox": require('./sensors/prox'),
		"07.hall": require('./sensors/hall'),
		"05.CT": require('./sensors/ct'),
	};
	var rules;
	var mode;
	function sensor_decode(val) {
		console.log(val);
	}
    function NodeManager(config) {
		mode = config.mode;
		rules = config.rules;
		console.log(sensors);
		var num = 0;
		rules.forEach( function(val,index,ar){
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
		});
		console.log(rules);
        this.on('input', function (msg) {
			if (Array.isArray(msg.payload)) {
				msg.payload.forEach( function(val,index,ar) { sensor_decode(val);});
			} else {
				sensor_decode(msg);
			}
        });
    }
    RED.nodes.registerType("node-manager", NodeManager);
}
