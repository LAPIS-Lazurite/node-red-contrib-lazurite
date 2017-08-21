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
	var exec = require('child_process').exec;
	function RPiReboot(config) {
		RED.nodes.createNode(this,config);
		var node = this;

		node.on('input', function (msg) {
			var child = exec("sudo reboot", function(err, stdout, stderr){
				if(err != null){
					msg.payload("rebooting now");
					node.send(msg);
					return;
				}else if(typeof(stderr) != "string"){
					return;
				}else{
					return;
				}
			});
		});
	}
	RED.nodes.registerType("rpi-reboot", RPiReboot);

	function RPiShutDown(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		
		node.on('input', function (msg) {
			var child = exec("sudo shutdown -h now", function(err, stdout, stderr){
				if(err != null){
					msg.payload("shutdown now");
					node.send(msg);
					return;
				}else if(typeof(stderr) != "string"){
					return;
				}else{
					return;
				}
			});
		});
	}
	RED.nodes.registerType("rpi-shutdown", RPiShutDown);
}

