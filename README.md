# Proof of concept

```javascript
const { calc } = peg`
  calc: expr $
  expr: term % ("+" | "-") ${fold}
  term: fact % ("*" | "/") ${fold}
  fact: ${number} | '(' expr ')'
`;

console.log(calc.value('2 + 3'));
```

https://eli.thegreenplace.net/2010/01/28/generating-random-sentences-from-a-context-free-grammar
