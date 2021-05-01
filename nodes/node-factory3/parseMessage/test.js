const fs = require("fs");
const remap_machine = require("../remap_machine");
const rxdata = [
	{"tag":0,"header":43041,"seq_num":85,"dst_panid":39589,"dst_addr":[65533,0,0,0],"src_panid":65535,"src_addr":[13,0,0,0],"sec":1619768874,"nsec":95148992,"payload":"v2,13,off,0,3.2,,,-2,on,0,3.2,,,-2,on,0,3.2,,,-2,on,0,3.2,,,-2,on,0,3.2,,,-2,on,0,3.2,,,-2,on,0,3.2,,,17,off,0,3.2,,","rssi":237,"length":116},
];
const machines = remap_machine(JSON.parse(fs.readFileSync("./machine.json","utf-8")));


const parseMessage = require("./index");

rxdata.forEach((elm,i) => {
	console.log(`rxdata number = ${i}`);
	console.log(parseMessage(elm,machines));
});


