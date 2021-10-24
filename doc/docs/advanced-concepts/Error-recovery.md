---
hide:
  - toc
---

Sometimes you may need to keep parsing even after encountering what would otherwise be a fatal input error. This is the case in various compilers to report as many errors and warnings as possible in a single pass. It's also common practice in most advanced code editors in order to provide correct syntax highlighting and autocompletion even when you're not done typing.

The way Pegase works without error recovery is described in [Basic concepts > Failures and warnings](/pegase/basic-concepts/Failures-and-warnings): failures may be an instruction to backtrack or the sign of an actual input error. That's why emitted failures are not directly collected into an array, they are emitted as *candidates* and sorted out using the farthest failure heuristic. The general idea of error recovery is to *commit* the current farthest failure to the final failures array, and resume parsing after *skipping* the erroneous input section. Here is how it's done with Pegase:

- Identify the subsection of your peg expression that you wanna recover from.
- Add an alternative to this subsection. In it:
- Commit the current farthest failure by using the `$commit` hook or the `@commit` directive.
- Identify an expression / terminal / set of terminals you're likely to find *after* the erroneous portion and *from where the parsing can resume from*. This is called a **synchronization expression**. In C-like languages, it could be the semi-colon `;` or a closing block bracket `}` for example.
- Skip input character by character until that expression is found. This is called *synchronization* and can be achieved by using the `...` operator, called sync operator. The peg expression `...a` is in fact syntactic sugar for `(!a .)* a`. See [Basic concepts > Building parsers](/pegase/basic-concepts/Building-parsers/).

Here is a grammar that parses an array of bits:

```ts
const g = peg`
  bitArray: '[' bit % ',' ']'
  bit: 0 | 1
`;
```

Given a erroneous input like `[0, 4, 1, 2, 0, 1]`, the parser won't be able to parse past `4`:

**`g.parse("[0, 4, 1, 2, 0, 1]").logger.toString()`**

```text
(1:5) Failure: Expected "0" or "1"

> 1 | [0, 4, 1, 2, 0, 1]
    |     ^
```

If we want to report *every* faulty bit, we need to add an alternative to `bit` where we'll commit the current farthest failure and sync the parser. To do the latter, we need to identify a synchronization expression. The question to ask here is: *"What can follow a `bit` ?"*. The answer is `','` or `']'`. Which gives us:

```ts
const g = peg`
  bitArray: '[' (bit | sync) % ',' ']'
  bit: 0 | 1
  sync: @@commit ...&(',' | ']')
`;
```

**`g.parse("[0, 4, 1, 2, 0, 1]").logger.toString()`**

```text
(1:5) Failure: Expected "0" or "1"

> 1 | [0, 4, 1, 2, 0, 1]
    |     ^

(1:11) Failure: Expected "0" or "1"

> 1 | [0, 4, 1, 2, 0, 1]
    |           ^
```

**Be aware**: the `success` status of the parsing will be `true`. With error recovery, a successful parsing doesn't necessarily imply "no failure", it just tells you that the parsing was able to finish successfully. This is indeed what *recovery* means. To check if there are any failures, check the size of the `failures` array:

```ts
g.parse("[1, 0, 1, 3, 0, 1, 2, 1]").logger.failures.length !== 0 // true
```
