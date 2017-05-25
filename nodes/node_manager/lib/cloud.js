module.exports = {
	spreadsheet: function(rcv,node) {
		var output = {}
		output.payload =[];
		output.contents =[];
		output.unit =[];
		var val = rcv.payload.split(",");
		if(node.sensor.size != val.length) {
			console.log("Illigal message::" + String(val.length) + ","+ String(node.sensor.size));
			return false;
		}
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
			output.payload.push(parseInt(val[i]));
			output.contents.push(node.sensor.name[i]);
			output.unit.push(node.sensor.unit[i]);
		}
		output.payload.push(parseInt(rcv.rssi));
		output.contents.push("rssi");
		output.unit.push("");
		return output;
	},
	dashboard: function(rcv,rules,sensors) {
	},
	other: function(rcv,rules,sensors) {
	}
};

