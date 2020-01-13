const { pegase, number } = require("../lib/index");

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
  }
};

const fold = (_, [first, ...rest]) =>
  rest.reduce((acc, op, index) => {
    return index % 2 ? acc : doop(acc, op, rest[index + 1]);
  }, first);

const grammar = pegase`
  calc: expr $
  expr: term (("+" | "-") term)* ${fold}
  term: fact (("*" | "/") fact)* ${fold}
  fact:
      ${number} ${parseFloat}
    | '(' expr ')'
`;

console.log(">", grammar.calc.value("(( ((2)) + 4))*((5)  )  "));

const g = pegase`
  A: $B '+' $B
  $B: '1'
`;

console.log(g);
