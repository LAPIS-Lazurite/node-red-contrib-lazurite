const fs = require("fs");
let data = JSON.parse(fs.readFileSync("/home/pi/.lazurite/database/machine.json","utf-8"));
const remap_machine = require("./index.js");
console.log(remap_machine(data));
