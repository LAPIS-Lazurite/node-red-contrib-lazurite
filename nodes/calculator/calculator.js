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
	function LazuriteCalcurator(config) {
		RED.nodes.createNode(this,config);
		var node = this;

		node.mode = config.mode;
		node.minenb = config.minenb;
		node.maxenb = config.maxenb;
		node.min = parseFloat(config.min);
		node.max = parseFloat(config.max);
		node.refreshMode = config.refresh;
		refresh();

		node.on('input', function (msg) {
			var val = parseFloat(msg.payload);
			refresh();
			val = cal[node.mode](val);
			if(val != null) {
				msg.payload = val;
				node.send(msg);
				}
		});
		var cal = {
			through: function(val) {return threshold(val); },
			average: function(val) {
				val = threshold(val);
				if(val != null) {
					node.sum += val;
					node.count++;
					return node.sum/node.count;
				} else {
					return null;
				}
			},
			count: function(val) {
				val = threshold(val);
				if(val != null) {
					node.count++;
					return node.count;
				} else {
					return null;
				}
			},
			sum: function(val) {
				val = threshold(val);
				if(val != null) {
					node.sum += val;
					return node.sum;
				} else {
					return null;
				}
				return node.sum;
			},
			capacity: function(val) {
				node.count ++;
				val = threshold(val);
				if(val != null) {
					node.sum++;
				}
				return node.sum / node.count;
			}
		}
		function threshold(val) {
			if (node.minenb) { if( node.min > val ) { return null; } }
			if (node.maxenb) { if( node.max < val ) { return null; } }
			return val;
		}
		function refresh() {
			if (node.datetime == undefined) {
				node.datetime = [];
				updateDate(node.datetime);
				node.sum = 0;
				node.count = 0;
				return;
			} else if(node.mode != "none"){
				var now = [];
				updateDate(now);
				for(var i = 0; i < node.datetime.length ; i++) {
					if(now[i]!=node.datetime[i]){
						isMatch = false;
						node.sum = 0;
						node.count = 0;
						node.datetime = now;
						break;
					}
				}
			}
			function updateDate(d){
				var now = new Date();
				switch(node.refreshMode){
					case "sec":
						d.push(now.getSeconds())
					case "min":
						d.push(now.getMinutes())
					case "hour":
						d.push(now.getHours())
					case "week":
						var startYear = new Date(now.getFullYear(),0,1);
						var offset = startYear.getDay();
						if(offset == 0) offset = 7;
						d.push(parseInt((now.getTime() - startYear.getTime() + (7-offset) * 24*3600*1000) / (7*24*3600*1000)));
					case "day":
						d.push(now.getDate())
					case "month":
						d.push(now.getMonth())
					case "year":
						d.push(now.getFullYear())
						break;
				}
			}
		}
	}
	RED.nodes.registerType("lazurite-calcurator", LazuriteCalcurator);
}
