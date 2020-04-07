# Proof of concept

```javascript
const g = peg`
   expr: term (("+" | "-") term)*
   term: 
`;
```

https://eli.thegreenplace.net/2010/01/28/generating-random-sentences-from-a-context-free-grammar
