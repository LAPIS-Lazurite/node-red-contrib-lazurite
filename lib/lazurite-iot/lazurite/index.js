module.exports = function(RED,node) {
	let lazurite = {};
	node.device.lazurite = lazurite;
	const eack = require("./eack");
	const rx = require("./rx");
	const events = require("events");
	try {
		lazurite.lib = require("../../../build/Release/lazurite_wrap");
	} catch(e) {
		RED.log.warn(e);
		return;
	}
	let ready = false;
	const binaryMode = false;
	lazurite.keepAlive = 30*60;			// [sec] for default keep alive time
	lazurite.measInterval = 5;			// [sec] for default meas interval
	lazurite.auth = function() {
		return new Promise(function(resolve,reject) {
			if(!lazurite.lib.dlopen()) {reject("lazurite dlopen fail"); return; }
			if(!lazurite.lib.init()) {reject("lazurite init fail"); return; }
			let addr64 = lazurite.lib.getMyAddr64();
			lazurite.mac = "";
			for(let a of addr64) {
				lazurite.mac += ('0'+a.toString(16)).substr(-2);
			}
			ready = true;
			resolve(lazurite.mac);
		});
	};
	lazurite.init = function(conf) {
		return new Promise((resolve,reject) => {
			if(ready === false) {
				lazurite.auth();
			}
			let ch = conf.ch | 36;
			let panid = isNaN(conf.panid) ? parseInt(Math.random()*65535) : parseInt(conf.panid);
			let baud = isNaN(conf.baud) ? 100 : parseInt(conf.baud);
			let addr16 = isNaN(conf.addr16) ? parseInt('0x'+lazurite.mac.substr(-4)) : conf.addr16;
			lazurite.lib.begin(ch,panid, baud,20);
			lazurite.lib.setMyAddress(addr16);
			lazurite.lib.rxEnable();
			lazurite.ch = ch;
			lazurite.panid = panid;
			lazurite.baud = baud;
			lazurite.addr16 = addr16;
			node.done.push(lazurite.done);
			lazurite.db = node.sensors;
			eack(lazurite);
			rx(lazurite);

			if(conf.interval) {
				lazurite.timer = setInterval(() => {
					let data = lazurite.lib.read(binaryMode);
					if(data.length > 0) {
						lazurite.rx.on("input",data);
					}
				},conf.interval);
			}
			resolve();
		});
	};
	lazurite.send = function(msg) {
		return new Promise((resolve,reject) => {
		});
	};
	lazurite.users = {};
	lazurite.done = function() {
		return new Promise((resolve,reject) => {
			console.log("lazurite.done");
			lazurite.lib.close();
			lazurite.lib.dlclose();
			ready = false;
			if(lazurite.timer)  {
				clearInterval(lazurite.timer);
				lazurite.timer = null;
				console.log("lazurite.timer clear");
			}
			console.log("lazurite close");
			setTimeout(() => {
				resolve();
			},100);
		})
	};
	lazurite.emitter = new events.EventEmitter(),
		lazurite.on = function(type,callback) {
			lazurite.emitter.on(type,callback);
		}
	//rx: require('./rx-lazurite'),
	lazurite.update = function() {
		console.log("lazurite.update");
		lazurite.eack.init();
	}
}
