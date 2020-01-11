const {
  _,
  any,
  some,
  number,
  word,
  eps,
  raw,
  children,
  rule
} = require("../lib/index");

const mylist = "  42,12  ,8, -63";

const array = _(number, parseInt)
  .any(_(",")(number, parseInt))
  .children(mylist);

console.log(array);

///////////

const mycoords = " (  -12.56  ,423 )";
const coords = {};
_("(")(
  number,
  parsed => (coords.x = parseFloat(parsed))
)(",")(
  number,
  parsed => (coords.y = parseFloat(parsed))
)(")").parse(mycoords);

console.log(coords);

////////////

const mycontacts =
  " Shannon Reid  0645924535 Carrie  McCoy Wells 0912356415   Bobby Connor 0244236459";
const fullname = some(word);
const nameAndNum = _(fullname, raw())(number, raw());
const book = any(nameAndNum, children()).children(mycontacts);

console.log(book);

////////////

class Complex {
  constructor(r, i) {
    this.r = r;
    this.i = i;
  }
}

const create = ([r, i]) => new Complex(r, i || 0);

const complex = _(
  _(number, parseFloat).maybe(_("+")(number, parseFloat)("i")),
  (_, children) => create(children)
);

console.log(complex.value("5.2 + .62i")); // Complex { r: 5.2, i: 0.62 }
console.log(complex.value("12")); // Complex { r: 12, i: 0 }

///////////

const reverse = ([op, a, b]) => [a, b, op].join(" ");

const infx = rule();

infx.parser = _([
  _(number, raw()),
  _(["+", "-", "*", "/"], raw())(infx)(infx).do(children(reverse))
]);

console.log(infx.value("+ 45 - * 20 31 8")); // 45 20 31 * 8 - +
console.log(infx.value("/ * 8 -0.6 37.1")); // 8 -0.6 * 37.1 /
