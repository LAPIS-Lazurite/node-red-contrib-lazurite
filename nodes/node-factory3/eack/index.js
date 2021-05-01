const KEEP_ALIVE = 1800;		// 1800(sec)
const MEAS_INTERVAL = 5;		// 5(sec)
const EACK_NOP = 0;
const EACK_DEBUG = 1;
const EACK_UPDATE = 2;
const EACK_DISCONNECT = 3;
const EACK_FIRMWARE_UPDATE = 0xF0;
const UNIT_SIZE_V2 = 6; // id,'on'or'off',value,voltage,[reason],[deltaT]
module.exports = {
	init: (machines) => {
		let eack = [];
		for(let m of machines) {
			if (m.debug === true) { // グラフ描画を再優先
				eack.push({
					addr: parseInt(m.id),
					data: [EACK_DEBUG,(MEAS_INTERVAL/1000) & 0x00FF, ((MEAS_INTERVAL/1000) >> 8) & 0x00FF]
				});
			} else {
				// 低頻度モードの場合は強制的にKeep Alive時間寝かせる
				if (m.lowfreq !== false) {
					let interval = parseInt(KEEP_ALIVE / 1000);
					eack.push({
						addr: parseInt(m.id),
						data: [EACK_DEBUG,interval & 0x00FF,(interval >> 8) & 0x00FF]
					});
				} else {
					let interval = parseInt(MEAS_INTERVAL / 1000);
					eack.push({
						addr: parseInt(m.id),
						data: [EACK_UPDATE,interval & 0x00FF,(interval >> 8) & 0x00FF]
					});
				}
			}
		}
		eack.push({
			addr: 0xffff,
			data:[EACK_DISCONNECT,5,0]
		});
		return eack;
	},
	activate:(rxdata,machines,eack) => {
		let message = `activate,${global.gateway.panid},${global.gateway.shortaddr}`;
		let machine;
		switch(rxdata.payload.split(",")[0]) {
			case "factory-iot":
				machine = machines.find((elm) => {
					if(elm.address.length === 1) {
						return elm.address[0] === rxdata.src_addr[0];
					} else if(elm.address.length === 4) {
						let unmatch = elm.address.find((elm,i) => elm !== rxdata.src_addr[i]);
						if(unmatch) {
							return false
						} else {
							return true;
						}
					} else {
						return false;
					}
				});
				break;
			case "update":
				machine = machines.find((elm) => {
					return rxdata.src_addr[0] === elm.id;
				});
				break;
			default:
				return null;
		}
		let eack_data = eack.find((elm) => elm.addr === machine.id);
		if (machine.debug === true) {
			let interval = machine.interval < MEAS_INTERVAL ? MEAS_INTERVAL : machine.interval;
			eack_data.data = [EACK_DEBUG,interval & 0x00FF, (interval >> 8) & 0x00FF];
		} else if (machine.lowfreq !== false) { // 稼働時間のイベントがない、低頻度モードはKEEP ALIVE
			eack_data.data = [EACK_DEBUG,KEEP_ALIVE & 0x00FF, ((KEEP_ALIVE) >> 8) & 0x00FF];
		} else { // その他は指定のインターバル
			eack_data.data = [EACK_NOP,(machine.interval) & 0x00FF, ((machine.interval) >> 8) & 0x00FF];
		}
		rxdata.machine = machine;
		if(machine.multi === true) {
			for(let m of machine.group) {
				message += `,${m.id},${m.thres0},${m.detect0},${m.thres1},${m.detect1}`;
			}
		} else {
			message += `,${machine.id},${machine.thres0},${machine.detect0},${machine.thres1},${machine.detect1}`;
		}
		return message;
	}
}
