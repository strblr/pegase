const { $p, number } = require("../lib/index");

const p = $p(number).any($p(",")(number));

console.log(JSON.stringify(p.json, null, 2));
