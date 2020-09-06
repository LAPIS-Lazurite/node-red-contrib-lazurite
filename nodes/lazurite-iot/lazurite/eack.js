module.exports = function(lazurite){
	lazurite.eack = {};
	if(!lazurite) {
		throw new Error("parent is not defined");
	}
	let keepAlive = lazurite.keepAlive | 30*60;
	let measInterval = lazurite.measInterval | 5;

	const cmd = {
		NORMAL: 0,
		FORCE_SEND: 1,
		UPDATE: 2,
		DISCONNECT: 3,
		FIRMWARE_UPDATE: 0xF0
	}

	lazurite.eack.data = [];
	lazurite.eack.init = function() {
		for(let d of lazurite.db) {
			if(d.debug === true) {
				lazurite.eack.data.push({
					addr: parseInt(d.id),
					ack: [cmd.FORCE_SEND,measInterval & 0x00FF, (measInterval >> 8) & 0x00FF]
				});
			} else if(d.lowFreq === true) {
				lazurite.eack.data.push({
					addr: parseInt(d.id),
					data: [cmd.FORCE_SEND,keepAlive & 0x00FF, (keepAlive >> 8) & 0x00FF]
				});
			} else {
				lazurite.eack.data.push({
					addr: parseInt(d.id),
					ack: [cmd.UPDATE,d.interval & 0x00FF, (d.interval >> 8) & 0x00FF]
				});
			}
		}
		lazurite.eack.data.push({
			addr: 0xffff,
			ack:[cmd.DISCONNECT,5,0]
		});
		setEack();
	}
	lazurite.eack.update = function(mode,db) {
		if(mode === "activate") {
			let data = lazurite.eack.data.find((elm) => {
				return (elm.addr === db.id);
			});
			if(data) {
				if(db.debug === true) {
					data.ack = [cmd.FORCE_SEND,measInterval & 0x00FF, (measInterval >> 8) & 0x00FF];
				} else if(db.lowFreq === true) {
					data.ack = [cmd.FORCE_SEND,keepAlive & 0x00FF, (keepAlive >> 8) & 0x00FF];
				} else {
					data.ack = [cmd.NORMAL,db.interval & 0x00FF, (db.interval >> 8) & 0x00FF];
				}
				setEack();
			}
		}
	}
	function setEack() {
		let devCount = lazurite.eack.data.length;
		let ackSize = lazurite.eack.data[0].ack.length;
		if(ackSize > 16) {
			lazurite.lib.setEnhanceAck(null,0);
			throw new Error('Lazurite EnhanceAck length error');
		}
		if((devCount == 0) || (ackSize == 0)) {
			lazurite.lib.setEnhanceAck(null,0);
			return;
		}
		let buffSize =  devCount * (ackSize + 2)  + 4;
		let buffer = new ArrayBuffer(buffSize);
		let uint8Array = new Uint8Array(buffer,0,buffSize);
		let index = 4;
		uint8Array[0] = devCount&0x0ff;
		uint8Array[1] = devCount >> 8;
		uint8Array[2] = ackSize&0x0ff;
		uint8Array[3] = ackSize >> 8;
		for(var d of lazurite.eack.data) {
			if(ackSize != d.ack.length) {
				lazurite.lib.setEnhanceAck(null,0);
				throw new Error(`Lazurite EnhanceAck different length is included. ${d}`);
			}
			uint8Array[index] = d.addr&0x0ff,index += 1;
			uint8Array[index] = d.addr>>8,index += 1;
			for(var a of d.ack) {
				uint8Array[index] = a,index += 1;
			}
		}
		lazurite.lib.setEnhanceAck(uint8Array,buffSize);
	}
	lazurite.eack.init();
}
