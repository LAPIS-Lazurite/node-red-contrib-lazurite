module.exports = (RED,node) => {
	node.auth = RED.nodes.getNode(node.config.auth);
	node.auth.register(node);
	node.auth.device.lazurite.on("rx",function(msg) {
		node.send(msg);
	});
}

