Pegase implements the concept of [cut points](http://ceur-ws.org/Vol-1269/paper232.pdf) in the form of a cut operator: `^`. There are times when, passing a certain point in an ordered choice expression (or *alternative expression*), you know *for sure* that every remaining options would fail. That "point" can be marked explicitly by `^` in your peg expression and has the effect to **commit to the current alternative**: even if it were to fail afterwards, the *first parent alternatives* would not be tried out. In other words, the cut operator prevents local backtracking.

Let's say you want to write a compiler for a C-like language. You define an `instr` rule that can match an `if` statement, a `while` loop or a `do...while` loop. If the terminal `'if'` successfully matched, then *even* if the rest of the expression fails, there is just no way for a `while` loop or a `do...while` loop to match. That means you can insert a *cut point* right after `'if'`. The same reasoning can be applied to the `'while'` terminal, but is useless for `'do'` since it's already the last alternative.

```js
peg`
  instr:
  | 'if' ^ '(' expr ')' instr
  | 'while' ^ '(' expr ')' instr
  | 'do' instr 'while' '(' expr ')'
`;
```

Since `^` is implemented as a no-op `Parser` (always succeeds, nothing is consumed nor emitted), it can **also** be used to implement default cases in alternative expressions, with the same effect but faster than the empty string:

```js
peg`
  size:
  | 'small' ${() => new SmallSize()}
  | 'big'   ${() => new BigSize()}
  | ^       ${() => new DefaultSize()}
`;
```
