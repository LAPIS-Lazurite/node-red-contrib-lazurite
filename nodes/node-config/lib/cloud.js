module.exports = {
	googlespreadsheet: {
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
		outputMode: function() {
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
				output[offset+i] = {};
				output[offset+i].topic = node.info.name + "-" + 
					node.src + "-" + node.info.sensor[i];
				output[offset+i].payload = val[i];
				output[offset+i].unit = node.info.unit[i];
				output[offset+i].rssi = rcv.rssi;
			}
			return output;
		},
		outputMode: function() {
			return 2;
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

