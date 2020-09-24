module.exports = (RED,node) => {
	node.core = RED.nodes.getNode(node.config.core);
	node.core.register(node);
	node.on('input',(msg) => {
		if(!msg.topic) msg.topic = node.config.topic;
		msg.options = msg.options || {};
		if(!msg.options.qos) msg.options.qos = parseInt(node.config.qos);
		node.core.mqtt.publish(msg,(err) => {
			console.log(err);
		});
	});
	node.on('close',(done) => {
		node.core.deregister(node);
		done();
	});
}

