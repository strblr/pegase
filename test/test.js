const { $p, number } = require("../lib/index");

const toInt = ({ parsed }) => parseFloat(parsed);

const p = $p($p(number, toInt)(number, toInt), match => console.log(match));

console.log(JSON.stringify(p.json, null, 2));
console.log(p.parse(" 98       78.9  12"));
