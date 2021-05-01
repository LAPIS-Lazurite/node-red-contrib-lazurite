module.exports = (msg,machines) => {
	const keys = {
		v1: [
			{
				key: "state",
				validation:(d) => {
					if((d === "on") || (d === "off")) {
						return d;
					} else {
						throw new Error(`invalid state(${d})`);
					}
				}
			},
			{
				key: "value",
				validation:(d) => {
					if(isNaN(d)) {
						throw new Error(`invalid value(${d})`)
					}
					return Number(d);
				}
			},
			{
				key: "vbat",
				validation:(d) => {
					if(isNaN(d)) {
						throw new Error(`invalid vbat(${d})`)
					}
					return Number(d);
				}
			},
			{
				key: "reason",
				validation:(d) => {
					if(d === "") {
						return null;
					} else if(isNaN(d)) {
						throw new Error(`invalid reason(${d})`)
					} else {
						return Number(d);
					}
				}
			}
		],
		v2: [
			{
				key: "timestamp",
				validation:(d) => {
					if(isNaN(d)) {
						throw new Error(`id(${d}) is not number`)
					}
					return Number(d);
				}
			},
			{
				key: "state",
				validation:(d) => {
					if((d === "on") || (d === "off")) {
						return d;
					} else {
						throw new Error(`invalid state(${d})`);
					}
				}
			},
			{
				key: "value",
				validation:(d) => {
					if(isNaN(d)) {
						throw new Error(`invalid value(${d})`)
					}
					return Number(d);
				}
			},
			{
				key: "vbat",
				validation:(d) => {
					if(isNaN(d)) {
						throw new Error(`invalid vbat(${d})`)
					}
					return Number(d);
				}
			},
			{
				key: "reason",
				validation:(d) => {
					if(d === "") {
						return null;
					} else if(isNaN(d)) {
						throw new Error(`invalid reason(${d})`)
					} else {
						return Number(d);
					}
				}
			},
			{
				key: "deltaT",
				validation:(d) => {
					if(d === "") {
						return null;
					} else if(isNaN(d)) {
						throw new Error(`invalid deltaT(${d})`)
					} else {
						return Number(d);
					}
				}
			}
		]
	}
	let payload = msg.payload.split(",");
	msg.machine = machines.find((elm) => elm.id === msg.src_addr[0]);
	if(payload[0] === "v2") {
		return parseV2Message(payload);
	} else {
		return parseV1Message(payload);
	}
	function parseV1Message(payload) {
		// 'v2',id,'on'/'off',value,voltage,[reason],[deltaT], ...
		let new_payload = [];
		let timestamp = parseInt(msg.sec*1000 + msg.nsec/1000000);
		let data = {};
		data.timestamp = msg.machine.id;
		data.site = msg.machine.site;
		keys["v1"].forEach((elm,j) => {
			let d = elm.validation(payload[j]);
			if(d !== null) {
				data[elm.key] = d;
			}
		});
		if((data.timestamp >= 0) && (data.timestamp <= 0xFFFC)){
			data.time = timestamp;
			if(msg.machine.invert === true) {
				data.state = (data.state === "on") ? "off" : "on";
			}
			new_payload.push(data);
		}
		return new_payload;
	}
	function parseV2Message(payload) {
		// 'v2',id,'on'/'off',value,voltage,[reason],[deltaT], ...
		let new_payload = [];
		let timestamp = parseInt(msg.sec*1000 + msg.nsec/1000000);
		for(let i=1;i < payload.length; i+=keys["v2"].length) {
			let data = {};
			keys["v2"].forEach((elm,j) => {
				let d = elm.validation(payload[i+j]);
				if(d !== null) {
					data[elm.key] = d;
				}
			});
			if((data.timestamp >= 0) && (data.timestamp <= 0xFFFC)){
				if(msg.machine.invert === true) {
					data.state = (data.state === "on") ? "off" : "on";
				}
				data.time = timestamp - (data.deltaT || 0);
				new_payload.push(data);
			}
		}
		return new_payload;
	}
}
