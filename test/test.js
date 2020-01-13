const { pegase, number, metagrammar } = require("../lib/index");

const grammar = pegase`
  'a'   {    2   }
`;

console.log(grammar.parse("a a"));

/*console.log(
  pegase`
    pegase:
         rule+
       | derivation
    rule:
         identifier ":" derivation
    derivation:
         alternative ("|" alternative)*
    alternative:
         step+ ("@" integer)?
    step:
         ("&" | "!") atom
       | atom ("?" | "+" | "*" | "{" integer ("," integer)? "}")?
    atom:"ε"
       | "."
       | singleQuotedString
       | doubleQuotedString
       | integer
       | identifier !":"
       | "(" derivation ")"
 `
);*/
