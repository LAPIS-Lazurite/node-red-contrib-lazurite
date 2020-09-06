module.exports = LazuriteIot;
function LazuriteIot(RED) {
	function LazuriteIotDevice(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-device")(RED,node);
	}
	function LazuriteIotAuth(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-auth")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-device",LazuriteIotDevice);
	RED.nodes.registerType("lazurite-iot-auth",LazuriteIotAuth);
}

