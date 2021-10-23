Pegase implements the concept of [cut points](http://ceur-ws.org/Vol-1269/paper232.pdf) in the form of a cut operator: `^`. Sometimes when passing a certain point in an ordered choice expression (or *alternative expression*), you know *for sure* that every remaining options would fail. That "point" can be marked explicitly by `^` in your peg expression and has the effect to **commit to the current alternative**. Thus, even if it were to fail afterwards, the *other alternatives* would not be tried out.

In other words, the cut operator prevents local backtracking which can be a huge performance booster.

Let's say you want to write a compiler for a C-like language. You define an `instr` rule that can match an `if` statement, a `while` loop or a `do...while` loop. If the terminal `'if'` successfully matched, then *even* if the rest of the expression fails, there is just no way for a `while` loop or a `do...while` loop to match. It means that you can insert a *cut point* right after `'if'`. The same reasoning can be applied to the `'while'` terminal, but is useless for `'do'` since it's already the last alternative.

```js
const p = peg`
  instr:
  | 'if' ^ '(' expr ')' instr
  | 'while' ^ '(' expr ')' instr
  | 'do' instr 'while' '(' expr ')'
`;
```

Since `^` is implemented as a no-op `Parser` (always succeeding and nothing is consumed nor emitted), it can **also** be used to implement default cases in alternative expressions. It differs from the empty literal parser in that the latter might skip whitespaces.

```js
const p = peg`
  size:
  | 'small' ${() => new SmallSize()}
  | 'big'   ${() => new BigSize()}
  | ^       ${() => new DefaultSize()}
`;
```

Used outside an ordered choice expression, it's simply a no-op.

The place it appears *inside* the ordered choice doesn't matter. The only thing that would override its effect is another ordered choice expression. Taking it to the extreme, this means that you may use it in a parameter expression of a non-terminal invocation. It would still apply for the ordered choice expression in which the non-terminal is called:

```ts
const p = peg`
	expr: zee('x' ^ 'y') | zee('u')
  zee(prefix): prefix 'z'
`
```

If *"x"* is matched, `zee('u')` would never be tried out.

