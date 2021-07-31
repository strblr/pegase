# Pegase

![NPM](https://img.shields.io/npm/l/pegase)
![npm](https://img.shields.io/npm/v/pegase)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

Pegase is the last PEG parser generator for JavaScript and TypeScript you will ever need to learn. Pegase is :

- **_Inline_**, meaning parsing expressions and grammars are directly expressed as
  [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates).
  No extra generation step, no CLI.
- **_Intuitive_**, meaning everything is as straightforward as it can get and you will never feel lost.
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights less than 7kB gzipped.
- **_Powerful_**, in that it lets you express complex grammars and semantic actions in simple ways. You can use
  [cut operators](http://ceur-ws.org/Vol-1269/paper232.pdf) to optimize ordered choices, split one big grammar in
  multiple fragments, and a lot more.
- **_Seamlessly integrable_**: Pegase works in symbiosis with JS. As an example, [`RegExp`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
  can be used directly in grammars via tag arguments, its parsing and capturing groups are then handled for you.
- **_Highly extensible_**: You can define your own `Parser` subclasses, create plugins with custom directives and global rules,
  share these plugins on npm, etc.

### Motivation

---

Let's take a look at a quick example. You can write a parser for math expressions with very few lines of code. Adding some directives and semantic
actions, it turns just as quickly into a _calculator_:

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
    num | '(' expr ')'
  
  num @token("integer"):
    '-'? [0-9]+ @number
`;
```

A few explanations here :

- `a % b` is a shortcut for `a (b a)*`.
- `@infix` is a directive. It tells the parser to reduce an _emitted_ sequence representing an infix expression.
- `@number` is another directive. It takes the raw parsed substring, converts it into a number and emits that number.

Let's see how this plays out :

#### `g.parse("2 + (17-2*30) *(-5)+2").value`

```json
219
```

#### `g.parse("2* (4 + )/3").success`

```json
false
```

#### `g.parse("2* (4 + )/3").logs()`

```
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
