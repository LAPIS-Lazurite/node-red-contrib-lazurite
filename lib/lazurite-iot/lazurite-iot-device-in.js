module.exports = (RED,node) => {
	node.core = RED.nodes.getNode(node.config.core);
	node.core.register(node);
	node.core.devices.lazurite.on("rx",function(msg) {
		node.send(msg);
	});
}

