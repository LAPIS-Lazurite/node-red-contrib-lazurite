module.exports = (machines) => {
	// addressの加工
	for(let m of machines) {
		try {
			genAddress(m);
		} catch(e) {
			console.log(e);
		}
	}
	let new_machines = machines.filter((elm) => elm.hasOwnProperty("multi")).map((elm) => {
		if(elm.multi === false) {
			return elm;
		} else {
			let d = {
				id: elm.id,
				multi: true,
				addr: elm.addr,
				address: elm.address,
				lowfreq: elm.lowfreq,
				interval: elm.interval,
			};
			linkGroup(machines,d);
			return d;
		}
	});
	/*
	new_machines.filter((elm) => elm.multi === true).forEach((elm) => {
		linkGroup(machines,elm);
	});
	*/
	return new_machines;
	function genAddress(m) {
		let tmp = m.addr.split("_");
		if(tmp[0].length === 16) {
			m.address = [];
			for(let i=12;i>=0;i-=4) {
				m.address.push(Number('0x'+tmp[0].substr(i,4)));
			}
		} else {
			m.address = [Number(tmp[0])];
		}
		m.index = isNaN(tmp[1]) ? 0 : Number(tmp[1]);
		if(m.index === 0) {
			if(m.addr.match(/_/)) {
				m.multi = true;
			} else {
				m.multi = false;
			}
		}
	}
	function linkGroup(list,master) {
		master.debug = false;
		let group = list.filter((elm) => {
			let result = elm.address.find((elm,i) => {
				if(i === 0) {
					if(elm === master.address[i]) {
						return false;
					} else {
						return true;
					}
				} else {
					if((master.address[i] === undefined) || (elm === master.address[i])) {
						return false;
					} else {
						return true;
					}
				}
			});
			if(result === undefined) {
				return true;
			} else {
				return false;
			}
		});
		let max = group.reduce((a,b) => (a.index > b.index) ? a : b);
		master.group = [];
		for(let i = 0; i <= max.index ; i ++) {
			let d = group.find((elm) => elm.index === i);
			if(d) {
				if(d.debug === true) master.debug = true;
				master.group.push(d);
			} else {
				master.group.push({
					id: 0xfffe,
					index: i,
					thres0: 0,
					detect0: 0,
					thres1: 0,
					detect1: 0
				});
			}
		}
	}
}
