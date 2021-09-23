---
hide:
- toc
---

When you write a grammar (a peg expression with rules), `peg` returns an instance of `GrammarParser`, which is a subclass of `Parser`. The `pegase` package exports a utility function named `merge` to, well, merge multiple `GrammarParser`s into one. Basically, this allows you to split long and complex grammars into fragments, possibly across multiple files, as long as you finally join them. Grammar fragments can reference each other's non-terminals without restriction.

If there are conflicting rule declarations, an exception is thrown.

#### `fragment1.js`

```js
import peg from "pegase";

export default peg`
  a: "a" b
  b: "b" c
`;
```

#### `fragment2.js`

```js
import peg from "pegase";

export default peg`
  c: "c" d
  d: "d" a?
`;
```

#### `grammar.js`

```js
import { merge } from "pegase";
import fragment1 from "./fragment1";
import fragment2 from "./fragment1";

const g = merge(fragment1, fragment2);
g.test("abcdabcd"); // true
```
