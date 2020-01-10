const { $p, number, eps } = require("../lib/index");

const toInt = ({ parsed }) => {
  return parseFloat(parsed);
};

const p = $p([$p(number, toInt)(number, toInt), eps])(eps);

console.log(JSON.stringify(p.json, null, 2));
console.log(p.parse(" 98       78.9  12"));
