const { pegase, number } = require("../lib/index");

const G = pegase`
  A: B % "+"
  B: "1"
`;
console.log(G.A.children("1+1+1+1+1"));

/*
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

const fold = (_, [first, ...rest]) => {
  rest.length !== 0 && console.log([first, ...rest]);
  return rest.reduce((acc, op, index) => {
    return index % 2 ? acc : doop(acc, op, rest[index + 1]);
  }, first);
};

const { calc } = pegase`
  calc: expr $
  expr: term % ("+" | "-") ${fold}
  term: fact (("*" | "/") fact)* ${fold}
  fact:
      ${number} ${parseFloat}
    | '(' expr ')'
`;

console.log(">", calc.value("(( ((2)) + 4))*((5)  -1)  "));

const g = pegase`
  A: $B '+' $B
  $B : '1'   '1'
`;

console.log(g.A.parse("   11 +    11 "));
*/
