const { pegase, raw, number } = require("../lib/index");

const grammar = pegase`
  expr: term (('+' | '-') ${raw()} term)* ${45}
  term: fact (('*' | '/') ${raw()} fact)* ${45}
  fact: unit ('**' ${raw()} unit)* ${45}
  unit: ${number} ${parseFloat} | '(' expr ')'
`;

console.log(grammar);

/*
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

const doop = (left, op, right) => {
  switch (op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "**":
      return left ** right;
  }
};

const fold = doop => (_, [first, ...rest]) =>
  rest.reduce((acc, op, index) => {
    return index % 2 ? acc : doop(acc, op, rest[index + 1]);
  }, first);

const foldRight = doop => (_, children) =>
  fold((left, op, right) => doop(right, op, left))(_, children.reverse());

const expr = rule();

const unit = _(number, parseFloat).or(_("(")(expr)(")"));
const fact = _(unit.mod("**", raw()), foldRight(doop));
const term = _(fact.mod(["*", "/"], raw()), fold(doop));
expr.parser = _(term.mod(["+", "-"], raw()), fold(doop));

const sexpr = rule();

const sunit = bind(number, parseFloat).or("(", sexpr, ")");
const sfact = sunit.mod(bind("**", raw())).do(foldRight(doop));
const sterm = sfact.mod(bind(["*", "/"], raw())).do(fold(doop));
sexpr.parser = sterm.mod(bind(["+", "-"], raw())).do(fold(doop));

const parser = grammar`
  expr: term (('+' | '-') ${raw} term)* ${fold(doop)}
  term: fact (('*' | '/') ${raw} fact)* ${fold(doop)}
  fact: unit ('**' ${raw} unit)* ${foldRight(doop)}
  unit: ${number} ${parseFloat} | '(' expr ')'
`;

console.log(expr.value("  2** 3+( -20.1 -12) *.52")); // -8.692
console.log(expr.value("3 +0.4**2/  (-1.23 - -10)")); // 3.0182440136830104

///////////

const reverse = ([op, a, b]) => [a, b, op].join(" ");

const infx = rule();

infx.parser = _([
  _(number, raw()),
  _(["+", "-", "*", "/"], raw())(infx)(infx).do(children(reverse))
]);

console.log(infx.value("+ 45 - * 20 31 8")); // 45 20 31 * 8 - +
console.log(infx.value("/ * 8 -0.6 37.1")); // 8 -0.6 * 37.1 /
*/
