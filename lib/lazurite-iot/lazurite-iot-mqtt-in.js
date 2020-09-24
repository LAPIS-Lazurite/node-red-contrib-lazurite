module.exports = (RED,node) => {
	node.core = RED.nodes.getNode(node.config.core);
	node.core.register(node);
	node.core.mqtt.subscribe(node.config.topic,onMessage)
	function onMessage(topic,message) {
		console.log(topic.message);
		node.send({
			topic: topic,
			payload: message
		})
	}
	node.on('close',(done) => {
		node.core.deregister(node);
		done();
	});
}

