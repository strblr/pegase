# Pegase

![NPM](https://img.shields.io/npm/l/pegase)
![npm](https://img.shields.io/npm/v/pegase)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

Pegase is an inline, intuitive, powerful and highly configurable PEG parser generator for JavaScript and
TypeScript.

- _Inline_, meaning parsing expressions and grammars are directly expressed as
  [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates).
  There is no generation step or other CLI-stuff.
- _Intuitive_, meaning everything is as straightforward as it can get and you will never feel lost.
- _Powerful_, in that it lets you express complex expressions, requirements, semantic actions, and directives in simple ways.
  [`RegExp` instances](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
  can be integrated directly into grammars, with capturing groups being automatically forwarded seamlessly to Pegase.
- _Highly configurable_ : You can create your own `Parser` subclasses, add plugins with custom directives and global rules,
  share these plugins on npm, etc.

### Motivation

---

<!-- prettier-ignore -->
```js
import peg from "pegase";

function calc(left, op, right) {
  switch (op) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return left / right;
  }
}

const g = peg`
  expr:
    term % ("+" | "-") @infix(${calc})
    
  term:
    fact % ("*" | "/") @infix(${calc})
    
  fact:
    int | '(' expr ')'
  
  int @token("integer"):
    '-'? [0-9]+ @number
`;
```

#### `g.parse("2 + (17-2*30) *(-5)+2").value`

```json
219
```

#### `g.parse("2* (4 + )/3").success`

```json
false
```

#### `g.parse("2* (4 + )/3").logs()`

```text
Line 1, col 9 | Failure: Expected integer or "("

> 1 | 2* (4 + )/32
    |         ^
```

### Installation

---

`npm install pegase` or `yarn add pegase`

### Documentation

---

The official website with guides and API is still under construction.
