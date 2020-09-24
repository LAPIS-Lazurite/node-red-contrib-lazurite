module.exports = function (RED) {
	function LazuriteIotDeviceIn(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-device-in")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-device-in",LazuriteIotDeviceIn);

	function LazuriteIotDeviceOut(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-device-out")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-device-out",LazuriteIotDeviceOut);

	function LazuriteIotMqttOut(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-mqtt-out")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-mqtt-out",LazuriteIotMqttOut);

	function LazuriteIotMqttIn(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-mqtt-in")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-mqtt-in",LazuriteIotMqttIn);

	function LazuriteIotCore(config) {
		RED.nodes.createNode(this,config);
		let node = this;
		node.config = config;
		require("./lazurite-iot-core")(RED,node);
	}
	RED.nodes.registerType("lazurite-iot-core",LazuriteIotCore);
}

