const { pegase, number, metagrammar } = require("../lib/index");

console.log(pegase`
  A: a  (("salk" | .) v) 
`);

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
