# Pegase

![NPM](https://img.shields.io/npm/l/pegase)
![npm](https://img.shields.io/npm/v/pegase)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

<p align="center">
  <img alt="pegase" src="https://raw.githubusercontent.com/ostrebler/pegase/master/pegase.png">
</p>

Pegase is the last PEG parser generator for JavaScript and TypeScript you will ever need to learn. Pegase is :

- **_Inline_**, meaning parsing expressions and grammars are directly expressed as
  [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates).
  No extra generation step, no CLI.
- **_Intuitive_**, meaning everything is as straightforward as it can get and you will never feel lost.
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights less than 7kB gzipped.
- **_Powerful_**, in that it lets you express complex grammars and semantic actions in simple ways and with excellent error reporting
  (and warnings!).
  You can even implement error _recovery_. You can use [cut operators](http://ceur-ws.org/Vol-1269/paper232.pdf) to optimize
  ordered choices, split one big grammar in multiple fragments, and a lot more.
- **_Seamlessly integrable_**: Pegase works in symbiosis with JS. As an example, [`RegExp`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
  can be used directly in grammars via tag arguments, its parsing and capturing groups are then handled for you.
- **_Highly extensible_**: You can define your own `Parser` subclasses, create plugins with custom directives and global rules,
  share these plugins on npm, etc.

## Table of Contents

- [Overview](#overview)
  - [Motivation](#motivation)
  - [Quick start](#quick-start)

# Overview

## Motivation

The first and main goal of this library is to get you quickly and painlessly into parsing. Let's take a look at an example.
You can write a parser for math expressions with very few lines of code. Adding some directives and semantic actions, it turns
just as quickly into a _calculator_:

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
  expr: term % ("+" | "-") @infix(${calc})
  term: fact % ("*" | "/") @infix(${calc})
  fact: num | '(' expr ')'
  num @token("integer"):
    '-'? [0-9]+ @number
`;
```

A few early explanations here :

- `a % b` is a shortcut for `a (b a)*`.
- `@infix` is a directive. It tells the parser to reduce an _emitted_ sequence representing an infix expression.
- `@number` is another directive. It takes the raw match, converts it into a number and emits that number.
- By default, whitespace skipping is cleverly handled without you having to tweak a single thing. This is entirely configurable.
- Notice how some literals are single-quoted like `')'` or double-quoted like `"+"`. Double-quote literals emit their string
  match as a value, while single-quotes are silent. Writing the operators with double quotes allows them to be accumulated
  and processed in `@infix`.

Let's see how this plays out :

#### `g.parse("2 + (17-2*30) *(-5)+2").value`

```json
219
```

#### `g.parse("2* (4 + )/32").success`

```json
false
```

#### `g.parse("2* (4 + )/32").logs()`

```
Line 1, col 9 | Failure: Expected integer or "("

> 1 | 2* (4 + )/32
    |         ^
```

Don't worry if things aren't so clear yet. The rest of the documentation below is here to go step by step in all the underlying
concepts, so that you're not left with static API sheet but understand the core philosophy and principles at hand.

## Quick start

First, add pegase as a dependency:

`npm install pegase` or `yarn add pegase`

Next step, import the template literal tag that will become your new best friend and there you go, ready to write your first
parsing expression.

```js
import peg from "pegase";

const parser = peg`some pattern`;
```

What about a parser that recognizes integers ? An integer is a series of one or more digits in the range `0` to `9`.
So that would be :

```js
const integer = peg`[0-9]+`;
```

But wait, Whitespace skipping between items like `[0-9]` (which are called _terminals_) is active by default (which has
many benefits as we'll see later), but we don't want that here (`4 3 9` are three integers, not one), so we can disable
it via a directive:

```js
const integer = peg`[0-9]+ @noskip`;
```

Ok, `integer` is now a `Parser` instance, which has three methods : `parse`, `test` and `value`. Let's take a look at `test`.
It takes a string input and returns `true` or `false`, whether the string conforms to the pattern or not.

<!-- prettier-ignore -->
```js
if (integer.test("425"))
  console.log("Yes, 425 is an integer");
```

Good, but so far, a `RegExp` could have done the job. Things get interesting when we add in rules and grammars.
Let's say we want to match bracketed integers, possibly infinitly-bracketed. This implies a recursive pattern :

```js
const bracketInt = peg`
  expr: integer | '(' expr ')'
  integer: [0-9]+ @noskip
`;
```

This is now called a grammar and it has two rules (or _non-terminals_) : `expr` and `integer`. `bracketInt` points to the
topmost rule, `expr`. Here, we actually wanna _allow_ whitespace skipping between brackets, so `@noskip` is only applied to
`integer`. Testing it:

```js
bracketInt.test("()"); // false
bracketInt.test("36"); // true
bracketInt.test("(36"); // false
bracketInt.test("36)"); // false
bracketInt.test("(36)"); // true
bracketInt.test("((36))"); // true
bracketInt.test(" ( (( 36)  ) ) "); // true
```

One fun trick, we're not obligated to redefine `integer` as a rule. We can take our `Parser` instance `integer`
defined previously and inject it as a tag argument :

```js
const bracketInt = peg`
  expr: ${integer} | '(' expr ')'
`;
```
