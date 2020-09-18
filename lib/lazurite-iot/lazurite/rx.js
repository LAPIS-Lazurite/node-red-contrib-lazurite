module.exports = function(lazurite) {
	lazurite.rx = {};
	lazurite.rx.on = function(method,msg) {
		if(method === "input") {
			if(Array.isArray(msg.payload) === true) {
				for(let m of msg.payload) {
					delete m.tag;
					input(m);
				}
			} else {
				input(msg);
			}
		}
	}
	function input(msg) {
		let payload = msg.payload.split(",");
		if(payload[0] === "factory-iot") {
			let src = genAddr(msg);
			let conf = lazurite.db.filter((elm) => {
				let addr = parseInt(elm.addr.split("_")[0]);
				if(isNaN(addr) === true) {
					if ((addr.length === 16) && (addr.replace(/[0-9,A-F,a-f]/g,"")==="")) {
						addr = parseInt(`0x${addr}`);
					}
				}
				let result = ((addr === src[64]) || (addr === src[16]));
				return result;
			});
			if(conf.length === 1) {
				let payload = `activate,${lazurite.panid},${lazurite.addr16},${conf[0].id},${conf[0].thres0},${conf[0].detect0},${conf[0].thres1},${conf[0].detect1}`;
				if(src[64] >= 65536) {
					let dst_addr = new Array(8);
					dst_addr[0] = msg.src_addr[3] >> 8;
					dst_addr[1] = msg.src_addr[3] & 0xff;
					dst_addr[2] = msg.src_addr[2] >> 8;
					dst_addr[3] = msg.src_addr[2] & 0xFF;
					dst_addr[4] = msg.src_addr[1] >> 8;
					dst_addr[5] = msg.src_addr[1] & 0xFF;
					dst_addr[6] = msg.src_addr[0] >> 8;
					dst_addr[7] = msg.src_addr[0] & 0xFF;
					if(lazurite.lib.send64be(dst_addr,payload) === 0) {
						lazurite.eack.update('activate',conf[0]);
					}
				} else {
					lazurite.lib.send(lazurite.panid,src[16],payload);
				}
			}
		} else if(payload[0] === "update") {
		} else {
			if((msg.header & 0xFFDF) === 0xa801) {
				const conf = lazurite.db.filter((elm) => {
					return (elm.id === msg.src_addr[0]);
				});
				msg.conf = conf;
				lazurite.emitter.emit("rx",msg);
			}
		}
	}
	function genAddr(msg) {
		let addr64 = 0;
		for(let i=msg.src_addr.length-1;i>=0;i--) {
			addr64 = addr64 * 65536;
			addr64 += msg.src_addr[i];
		}
		return {
			16: msg.src_addr[0],
			64: addr64
		}
	}
}

