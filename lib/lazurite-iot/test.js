let topics = [
	"lapiseva01/gateway/dbupdate",
	"lapiseva01/gateway/gw001/reset",
]

let subscribe = [
	"dbupdate",
	"#",
	"gw001/+",
	"+/reset",
	"gw001/#",
	"dbupdate/#",
]

for(let topic of topics) {
	let localTopic = topic.split("/");
	localTopic.splice(0,2);
	localTopic = localTopic.join("/");
	topic = localTopic;
	for(let s of subscribe) {
		console.log({
			topic: topic,
			subscribe: s,
			result: matchTopic(s,topic)
		});
	}
}

function matchTopic(ts,t) {
	if (ts == "#") {
		return true;
	}
	/* The following allows shared subscriptions (as in MQTT v5)
					 http://docs.oasis-open.org/mqtt/mqtt/v5.0/cs02/mqtt-v5.0-cs02.html#_Toc514345522

					 4.8.2 describes shares like:
					 $share/{ShareName}/{filter}
					 $share is a literal string that marks the Topic Filter as being a Shared Subscription Topic Filter.
					 {ShareName} is a character string that does not include "/", "+" or "#"
					 {filter} The remainder of the string has the same syntax and semantics as a Topic Filter in a non-shared subscription. Refer to section 4.7.
					 */
	else if(ts.startsWith("$share")){
		ts = ts.replace(/^\$share\/[^#+/]+\/(.*)/g,"$1");

	}
	var re = new RegExp("^"+ts.replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g,"\\$1").replace(/\+/g,"[^/]+").replace(/\/#$/,"(\/.*)?")+"$");
	return re.test(t);
}
