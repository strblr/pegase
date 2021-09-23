---
hide:
  - toc
---

Sometimes you may need to keep parsing even after encountering what would otherwise be a fatal input error. This is the case in various compilers to report as many errors and warnings as possible in a single pass. It's also common practice in most advanced code editors in order to provide correct syntax highlighting and autocompletion even when you're not done typing.

The way Pegase works without error recovery is described in [Basic concepts > Failures and warnings](#failures-and-warnings): failures may be an instruction to backtrack or the sign of an actual input error. That's why emitted failures are not directly collected into an array, they are emitted as *candidates* and sorted out using the farthest failure heuristic. The general idea of error recovery is to *commit* the current farthest failure to the final failures array, and resume parsing after *skipping* the erroneous input section. Here is how it's done with Pegase:

- Identify the subsection of your peg expression that you wanna recover from.
- Add an alternative to this subsection. In it:
- Commit the current farthest failure by using the `$commit` hook or the `@commit` directive.
- Identify an expression / terminal / set of terminals you're likely to find *after* the erroneous portion and *from where the parsing can resume from*. This is called a **synchronization expression**. In C-like languages, it could be the semi-colon `;` or a closing block bracket `}` for example.
- Skip input character by character until that expression is found. This is called *synchronization* and can be achieved by using the `...` operator, called sync operator. The peg expression `...a` is in fact syntactic sugar for `(!a .)* a`. See [Basic concepts > Building parsers](#building-parsers).

Here is a grammar that parses an array of bits and tries to recover when a bit matching fails:

```ts
const g = peg`
  bitArray: '[' (bit | sync) % ',' ']'
  bit: 0 | 1
  sync: (^ @commit) ...&(',' | ']')
`;
```

#### > `g.parse("[1, 0, 1, 3, 0, 1, 2, 1]").logger.print()`

```
(1:11) Failure: Expected "0" or "1"

> 1 | [1, 0, 1, 3, 0, 1, 2, 1]
    |           ^

(1:20) Failure: Expected "0" or "1"

> 1 | [1, 0, 1, 3, 0, 1, 2, 1]
    |                    ^
```

**Be aware**: the `success` status of the parsing will be `true`. With error recovery, a successful parsing doesn't necessarily imply "no failure", it just tells you that the parsing was able to finish successfully. This is indeed what *recovery* means. To check if there are any failures, call the logger's `hasFailures` method:

```ts
g.parse("[1, 0, 1, 3, 0, 1, 2, 1]").logger.hasFailures() // true
```
