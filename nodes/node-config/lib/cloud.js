module.exports = {
	googlespreadsheet: {
		// all sensor data is in one json
		genPayload: function(rcv,node) {
			var output = {}
			output.payload =[];
			output.contents =[];
			output.unit =[];
			var val = rcv.payload.replace(/\r?\n/g,"").split(",");
			if(node.info.size != val.length) {
				console.log("Illigal message::" + String(val.length) + ","+ String(node.info.size));
				return false;
			}
			output.topic = node.info.name;
			output.payload.push(node.src);
			output.contents.push("addr");
			output.unit.push("");
			output.payload.push(rcv.sec);
			output.contents.push("sec");
			output.unit.push("");
			output.payload.push(rcv.nsec);
			output.contents.push("nsec");
			output.unit.push("");
			for (var i = 0 ; i < val.length ; i++){
				output.payload.push(val[i]);
				output.contents.push(node.info.sensor[i]);
				output.unit.push(node.info.unit[i]);
			}
			output.payload.push(parseInt(rcv.rssi));
			output.contents.push("rssi");
			output.unit.push("");
			return output;
		},
		outputMode: function() {			// one output
			return 0;
		}
	},
	dashboard:{ 
		genPayload: function(rcv,node) {
			var output = [];
			var offset = node.sensor_num;
			var val = rcv.payload.replace(/\r?\n/g,"").split(",");
			for (var i = 0 ;i < node.info.size; i++)
			{
				if (node.info.nullval == "exist") {
					if ((val[i] === null) || (val[i] === "") || (val[i] === undefined)) continue;
				}
				output[offset+i] = {};
				output[offset+i].topic = node.info.name + "-" + 
					node.src + "-" + node.info.sensor[i];
				output[offset+i].payload = val[i];
				output[offset+i].unit = node.info.unit[i];
				output[offset+i].rssi = rcv.rssi;
			}
			return output;
		},
		outputMode: function() {		// each output of sensor
			return 2;
		}
	},
	LazuriteIoT: {
		// one sensor one json
		// one payload include multiple json as Array
		/*
			{ 
				src: [0x12,0x34] or [0x00,0x1d,0x12,0x90,0x00,0x04,0x12,0x34],	// address of sensor node
				n: 0,							// sequence number
				t: 1498092314737,				// 64bit linux time [ms]
				database: "ENV"					// database
				collection: "YTC6F"				// correction
				data: {
					t: {
						d: 23.3,
						f: 1
					},
					p: {
						d: 1002.4,
						f: 1
					},
					h: {
						d: 50.8,
						f: 0
					},
					v: {
						d: 2.9,
						f: 0
					},
					r: {
						d: 233,
						f: 0
					}
				}
			} 
		*/
		genPayload: function(rcv,node) {
			var output = {};
			var addr = "";
			var val = rcv.payload.replace(/\r?\n/g,"").split(",");
			output.payload = {};
			// collection
			output.payload.collection = node.info.name;
			output.payload.s = []
			// src_address
			switch(node.bit){
				case 64:
					if((rcv.src_addr[3] >> 8) < 16) {
						addr += "0";
					}
					addr += (rcv.src_addr[3] >> 8).toString(16);
					if((rcv.src_addr[3] & 0x00FF ) < 16) {
						addr += "0";
					}
					addr += (rcv.src_addr[3] & 0x00FF).toString(16);

					if((rcv.src_addr[2] >> 8) < 16) {
						addr += "0";
					}
					addr += (rcv.src_addr[2] >> 8).toString(16);
					if((rcv.src_addr[2] & 0x00FF ) < 16) {
						addr += "0";
					}
					addr += (rcv.src_addr[2] & 0x00FF).toString(16);

					if((rcv.src_addr[1] >> 8) < 16) {
						addr += "0";
					}
					addr += (rcv.src_addr[1] >> 8).toString(16);
					if((rcv.src_addr[1] & 0x00FF ) < 16) {
						addr += "0";
					}
					addr += (rcv.src_addr[1] & 0x00FF).toString(16);

				case 16:
					addr = "0x"
					if((rcv.src_addr[0] >> 8) < 16) {
						addr += "0";
					}
					addr += (rcv.src_addr[0] >> 8).toString(16);
					if((rcv.src_addr[0] & 0x00FF ) < 16) {
						addr += "0";
					}
					addr += (rcv.src_addr[0] & 0x00FF).toString(16);
					break;
				default:
					break;
			}
			output.payload.s = addr;

			// seq_num
			output.payload.n = rcv.seq_num;
			// rx time
			output.payload.t = parseInt(rcv.sec*1000+rcv.nsec/1000000);
			// data
			output.payload.data = {};
			for(var i=0;i<node.info.size;i++) {
				if (node.info.nullval == "exist") {
					if ((val[i] === null) || (val[i] === "") || (val[i] === undefined)) continue;
				}
				output.payload.data[node.info.sensor[i]] = parseFloat(val[i]);
			}
			output.payload.data["rs"] = parseInt(rcv.rssi);
			return output;
		},
		outputMode: function() {		// one output
			return 0;
		}
	},
	eachnode: {
		genPayload: function(rcv,node) {
			console.log("rcv");
			console.log(rcv);
			console.log("node");
			console.log(node);
			console.log("outputs");
			console.log(outputs);
		},
		outputMode: function() {
			return 1;
		}
	}
};

