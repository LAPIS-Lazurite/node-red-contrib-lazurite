module.exports = {
	"none": {
		name: "none",
		sensor: ["none"],
		unit: [""],
		size: 1},
	"07.button": {
		name: "07.button",
		sensor : ["button","vbat"],
		unit : ["none","v"],
		size : 2},
	"07.env":{
		name: "07.env",
		sensor: ["temprature","presssure","humidity","brightness","vbat"],
		unit: ["degree","Pa","%","lux","v"],
		size: 5},
	"07.prox": {
		name: "07.prox",
		sensor: ["prox","vbat"],
		unit: ["","v"],
		size: 2},
	"07.hall": {
		name: "07.hall",
		sensor: ["hall","vbat"],
		unit: ["","v"],
		size: 2},
	"05.CT": {
		name: "05.CT",
		sensor: ["ct","vbat"],
		unit: ["mA","v"],
		size: 2},
	"05.PumpMon": {
		name: "05.PumpMon",
		nullval: "exist",
		sensor: ["ct","vbat","ax","ay","az","tcouple","tbase","sound"],
		unit: ["mA","v","g","g","g","degree","degree",""],
		size: 8}
};

