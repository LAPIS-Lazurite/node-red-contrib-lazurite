const fs = require("fs");
const util = require("util");
const data = JSON.parse(fs.readFileSync("/home/pi/.lazurite/database/machine.json","utf-8"));
const remap_machine = require("../remap_machine");
const eack = require("./index.js");
const machines = remap_machine(data);

global.gateway = global.gateway || {
	panid: 0xabcd,
	shortaddr: 0xfffd
};

console.log("init");
let eack_data = eack.init(machines);
console.log("activate1");
let rxdata = [
	{"tag":0,"header":59393,"seq_num":2,"dst_panid":65535,"dst_addr":[65535,0,0,0],"src_panid":65535,"src_addr":[20394,1024,4816,29],"sec":1619762930,"nsec":534159491,"payload":"factory-iot,ALSensor2,6","rssi":255,"length":23},
	{"tag":0,"header":59393,"seq_num":2,"dst_panid":65535,"dst_addr":[65535,0,0,0],"src_panid":65535,"src_addr":[0x1234,1024,4816,29],"sec":1619762930,"nsec":534159491,"payload":"factory-iot,ALSensor2,6","rssi":255,"length":23},
];
rxdata.forEach((elm,i) => {
	let message = eack.activate(elm,machines,eack_data);
	console.log(util.inspect({
		num: i,
		message:message,
		rxdata:elm,
		eack:eack_data
	},{colors:true,depth:3}));
});
