
module.exports = function(RED) {
	var lib;
	var opened = false;
	var stream = require('stream');
	var util = require('util');

	function Warn(message){
		RED.log.warn("patlamp: " + message);
	}

	function connect(node) {
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		if(!opened) {
			lib = require('../../build/Release/patlamp_wrap');
			if(!lib.dlopen(node.libFile)) { Warn("dlopen fail"); return false; }
			if(!lib.patlamp_init()) { Warn("patlamp_init fail"); return false; }
			node.status({fill:"green",shape:"dot",text:"connected"},true);
			opened = true;
		} else {
			node.status({fill:"green",shape:"dot",text:"connected"},true);
		}
		return true;
	}

	function disconnect(node) {
		if(opened) {
			if(!lib.patlamp_remove()) { Warn("lazurite_rxDisable fail."); }
			if(!lib.dlclose()) { Warn("dlclose fail"); }
			opened = false;
		}
		node.status({fill:"red",shape:"ring",text:"disconnected"});
		return false;
	}

	function translate(value) {
	    return ("0" + value).slice(-2)
	}
	function patlamp_open() {
		if(!opened) lib = require('../../build/Release/patlamp_wrap');
	}
	function patlamp_init(node) {
		lib.patlamp_setMapfile(node.mapFile);
		lib.patlamp_setReportInterval(node.reportInterval);
		lib.patlamp_setDetectInterval(node.detectInterval);
		lib.patlamp_setExpandMag(node.expandMag);
		node.disp = lib.patlamp_getDisplay();
		return;
	}

	function patlamp_cam(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		this.libFile =config.libFile;
		this.mapFile =config.mapFile;

		if (typeof config.reportInterval === 'string' || config.reportInterval instanceof String) {
			this.reportInterval = parseInt(config.reportInterval);
		} else {
			this.reportInterval = config.reportInterval;
		}
		if (typeof config.detectInterval === 'string' || config.detectInterval instanceof String) {
			this.detectInterval = parseInt(config.detectInterval);
		} else {
			this.detectInterval = config.detectInterval;
		}
		if (typeof config.expandMag === 'string' || config.expandMag instanceof String) {
			this.expandMag = parseInt(config.expandMag);
		} else {
			this.expandMag = config.expandMag;
		}
		opened = connect(node);
		if(!opened) { Warn("[patlamp-cam] open error"); }
		else {console.log("[patlamp-cam]success!");}
		this.timer = null;
		this.interval=1000;
		patlamp_init(node);
		this.timer = setInterval(function() {
			if(this.disp === true) {
				if(!node.active){
					console.log("disp off")
					lib.patlamp_setDisplay(false);
					this.disp = false;
				}
			} else {
				if(node.active) {
					console.log("disp on")
					lib.patlamp_setDisplay(true);
					this.disp = true;
				}
			}
			var msg ={};
			msg.payload = lib.patlamp_readData();
			if(msg.payload != "") node.send(msg);
		}.bind(this),this.interval);
		opened=true;

		node.on('close', function(done) {
//			if(this.opened) {
				if(this.timer) clearInterval(this.timer);
//				disconnect(node);
				done();
//			}
//			this.opened = false;
		});
	}

	function patlamp_photo(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		connect(node);
		this.path=config.path;
		this.extention="jpg";

		node.on('input', function(msg) {
			var util = require("util");
			var date = new Date(Date.now());
			if(this.path=="") return false;
			if(this.path.slice(-1)=="/") {
				this.path = this.path.slice(0,this.path.length-1);
			}
			var fileName = util.format("%s/%d%s%s%s%s%s%s.%s",
				this.path,
				date.getFullYear(),
				translate(date.getMonth() + 1),
				translate(date.getDate()),
				translate(date.getHours()),
				translate(date.getMinutes()),
				translate(date.getSeconds()),
				translate(date.getMilliseconds()),
				this.extention);
			lib.patlamp_snapShot(fileName);
		});
	}

	function patlamp_csv(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		this.mapFile = config.mapFile;
		var mode = config.mode;
		var sum;
		var fs = require('fs');
		var readline = require('readline');
		var rl = readline.createInterface(fs.createReadStream(this.mapFile),{});
		var map = [["sum",0,0,0,0]];
		sum = [];

		rl.on('line',function(line) {
			var data = line.split(",");
			if((data.length == 6)&&(data[0].slice(0,1)!="#")) {
				var name = data[0] + "-" + data[1];
				var x = parseInt(data[2]);
				var y = parseInt(data[3]);
				var size = parseInt(data[4]);
				var threshold = parseInt(data[5]);
				map.push([name,x,y,size,threshold]);
			}
		});
		node.on('input', function(msg) {
			var data = msg.payload.split(",");
			var count;
			msg = [];
			if ((mode == "total ratio") || (mode == "total count")) {
				if(data.length != sum.length) {
					sum = [];
					for(var n in data) {
						sum.push(0);
					}
				}
			}
			data.forEach(function (element,index,array) {
				var newMsg = {};
				if(element) {
					if(index == 0){
						count = parseInt(element);
					}
					if(mode == "ratio") {
						newMsg.payload = parseInt(element) / count;
					} else if(mode == "count") {
						newMsg.payload = parseInt(element);
					} else if(mode == "total ratio") {
						sum[index] += parseInt(element);
						newMsg.payload = sum[index]/sum[0];
					} else {
						sum[index] += parseInt(element);
						newMsg.payload = sum[index];
					}
					newMsg.topic = map[index][0];
					newMsg.x = map[index][1];
					newMsg.y = map[index][2];
					newMsg.size = map[index][3];
					newMsg.threshold = map[index][4];
					msg.push(newMsg);
				}
			});
			node.send(msg);
		});
	}

    // the auth header attached. So do not use RED.auth.needsPermission here.
	RED.nodes.registerType("patlamp-cam",patlamp_cam);
	RED.nodes.registerType("patlamp-photo",patlamp_photo);
	RED.nodes.registerType("patlamp-csv",patlamp_csv);
    RED.httpAdmin.post("/patlamp-cam/:id/:state", RED.auth.needsPermission("patlamp-cam.write"), function(req,res) {
        var node = RED.nodes.getNode(req.params.id);
        var state = req.params.state;
        if (node !== null && typeof node !== "undefined" ) {
            if (state === "enable") {
                node.active = true;
                res.sendStatus(200);
            } else if (state === "disable") {
                node.active = false;
                res.sendStatus(201);
            } else {
                res.sendStatus(404);
            }
        } else {
            res.sendStatus(404);
        }
    });
}
