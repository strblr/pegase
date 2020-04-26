# Proof of concept 2

```javascript
const { calc } = peg`
  calc: expr $
  expr: term % ("+" | "-") ${fold}
  term: fact % ("*" | "/") ${fold}
  fact: num | '(' expr ')'
  num @token: '-'? [0-9]+ ('.' [0-9]*)? ${[parseFloat]}
`;

console.log(calc.value("2 + 3"));
```

---

```javascript
const lang = peg`
  prog: (instr | recover)*
  recover: (ε ${shiftErrors}) >> ';'
`;
```
