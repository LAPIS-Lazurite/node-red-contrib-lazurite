module.exports = (RED,node) => {
	node.core = RED.nodes.getNode(node.config.core);
	node.core.register(node);
}

