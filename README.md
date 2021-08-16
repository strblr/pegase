# Pegase

![NPM](https://img.shields.io/npm/l/pegase)  
![npm](https://img.shields.io/npm/v/pegase)  
![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

<p align="center">  
  <img alt="pegase" src="https://raw.githubusercontent.com/ostrebler/pegase/master/pegase.png">  
</p>

Pegase is the last PEG parser generator for JavaScript and TypeScript you will ever need to learn. Pegase is :

- **_Inline_**, meaning parsing expressions and grammars are directly expressed in-code as [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates). No extra generation step, no CLI.
- **_Intuitive_**, meaning everything is as straightforward as it can get and you will never feel lost.
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights less than 7kB gzipped.
- **_Powerful_**, in that it lets you express complex grammars and semantic actions in simple ways and with excellent error reporting, warnings, error recovery, [cut operator](http://ceur-ws.org/Vol-1269/paper232.pdf), grammar fragments, and a lot more.
- **_Seamlessly integrable_**: Pegase works in symbiosis with JS. As an example, [`RegExp`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) can be used directly in grammars via tag arguments, its parsing and capturing groups are then forwarded to pegase.
- **_Highly extensible_**: You can define your own `Parser` subclasses, create plugins with custom directives and global rules, share these plugins on npm, etc.

## Table of Contents

- [Overview](#overview)
  - [Motivation](#motivation)
  - [Quick start](#quick-start)
- [Basic concepts](#basic-concepts)
  - [Building parsers](#building-parsers)

## Overview

### Motivation

---

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
    '-'? [0-9]+ @number`;
```

A few early explanations here :

- `a % b` is a shortcut for `a (b a)*`, meaning _"any sequence of a separated by b"_.
- `@infix` is a directive. It tells the parser to reduce an _emitted_ sequence representing an infix expression.
- `@number` is another directive. It takes the raw match, converts it into a number and emits that number.
- By default, whitespace skipping is automatically handled without you having to tweak a single thing. This is entirely configurable.
- Notice how some literals are single-quoted like `')'` or double-quoted like `"+"`. Double-quote literals emit their string match as a value, while single-quotes are silent. Writing the operators with double quotes allows them to be accumulated and processed in `@infix`.

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
(1:9) Failure: Expected integer or "("

> 1 | 2* (4 + )/32
    |         ^
```

Don't worry if things aren't so clear yet. The rest of the documentation below is here to go step by step in all the underlying concepts, so that you're not left with static API sheet but understand the core philosophy and principles at hand.

---

### Quick start

First, add pegase as a dependency:

`npm install pegase` or `yarn add pegase`

Next step, import the template literal tag that will become your new best friend and there you go, ready to write your first parsing expression.

```js
import peg from "pegase";

const parser = peg`some pattern`;
```

What about a parser that recognizes integers ? An integer is a series of one or more digits in the range `0` to `9`. So that would be :

```js
const integer = peg`[0-9]+`;
```

Ok, `integer` is now a `Parser` instance, which has four methods : `parse`, `test`, `value` and `safeValue`. Let's take a look at `test`. It takes a string input and returns `true` or `false` (whether the string conforms to the pattern or not).

But wait, whitespace skipping between items like `[0-9]` (which are called _terminals_) is active by default (which has many benefits as we'll see later), but we don't want that here (`4 3 9` are three integers, not one). One option would be to disable skipping:

<!-- prettier-ignore -->
```js
if (integer.test("425", { skip: false }))
  console.log("Yes, 425 is an integer");
```

Good, but so far, a `RegExp` could have done the job. Things get interesting when we add in rules and grammars. Let's say we want to match bracketed integers, possibly infinitely-bracketed. This implies a recursive pattern :

```js
const bracketInt = peg`  
  expr: integer | '(' expr ')'
  integer: [0-9]+
`;
```

This is now called a grammar, and it has two rules (or _non-terminals_) : `expr` and `integer`. `bracketInt` points to the topmost rule, `expr`. Here, we actually wanna _allow_ whitespace skipping between brackets, just not between `[0-9]`s. We can't just blindly disable skipping for the entire grammar. There is a directive called `@token` that does exactly what we need: allowing pre-skipping but then disabling skipping for the wrapped parser. Applying this directive to the whole definition of `integer`, we can place it after the rule name:

```js
const bracketInt = peg`  
  expr: integer | '(' expr ')'
  integer @token: [0-9]+
`;
```

Testing it:

```js
bracketInt.test("()"); // false
bracketInt.test("36"); // true
bracketInt.test("(36"); // false
bracketInt.test("36)"); // false
bracketInt.test("(36)"); // true
bracketInt.test("((36))"); // true
bracketInt.test(" ( (( 36)  ) ) "); // true
```

One fun trick, we're not obligated to redefine `integer` as a rule. We can take our `Parser` instance `integer` defined previously and inject it as a tag argument :

```js
const bracketInt = peg`  
  expr: ${integer} @token | '(' expr ')'
`;
```

## Basic concepts

### Building parsers

---

| Pegase expression                          | Description                                                                                                                                                                                                                                                                                                      | Children                                                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                                        | Matches any character                                                                                                                                                                                                                                                                                            | `[]`                                                                                                                                                                        |
| `$`                                        | Matches the end of the input (equivalent to `!.`)                                                                                                                                                                                                                                                                | `[]`                                                                                                                                                                        |
| `ε`                                        | Matches the empty string. This is equivalent to `''` and is always a success, it can be used to implement a default parsing case in alternatives.                                                                                                                                                                | `[]`                                                                                                                                                                        |
| `^`                                        | The cut operator. Always a success, its role is to commit to an alternative and not explore any further in the first parent alternative. Example : <code>peg\`'a' ^ e1 &#124; e2\`</code> **will not** try `e2` if `'a'` was found but `e1` failed.                                                              | `[]`                                                                                                                                                                        |
| `(e)`                                      | Matches `e` (any arbitrary parsing expression)                                                                                                                                                                                                                                                                   | Forwarded from `e`                                                                                                                                                          |
| `id`                                       | Matches the non-terminal `id`                                                                                                                                                                                                                                                                                    | Forwarded from the non-terminal `id`                                                                                                                                        |
| `'literal'`                                | Matches the string `"literal"`                                                                                                                                                                                                                                                                                   | `[]`                                                                                                                                                                        |
| `"literal"`                                | Matches the string `"literal"`                                                                                                                                                                                                                                                                                   | `["literal"]`                                                                                                                                                               |
| `42`, `964`, ...                           | Matches the number literally                                                                                                                                                                                                                                                                                     | `[]`                                                                                                                                                                        |
| `[0-9]`, `[a-zA-Z]`, ...                   | Matches one character in the given character class                                                                                                                                                                                                                                                               | `[]`                                                                                                                                                                        |
| `[^0-9]`, `[^a-zA-Z]`, ...                 | Matches one character **not** in the given character class                                                                                                                                                                                                                                                       | `[]`                                                                                                                                                                        |
| `\n`, `\s`, `\xAF`, `\uA6F1`, ...          | Matches the escaped metacharacter as a `RegExp` expression (i.e. `\s` matches any whitespace, `\S` any non-whitespace, `\uA6F1` matches the unicode character `A6F1`, etc. ([See `RegExp` documentation](https://www.w3schools.com/jsref/jsref_obj_regexp.asp) for a complete list of supported metacharacters), | `[]`                                                                                                                                                                        |
| `e @directive`, `e @directive(a, b)`       | Applies the directive `directive` to the parser `e`. Directives are functions that take a parser and return a new parser. They can take additional arguments (`e @dir(a, b, ...)`) and can be chained (`e @dir1 @dir2 ...`).                                                                                     | Depends entirely on the new parser constructed by the directive                                                                                                             |
| `${arg}`                                   | Template tag argument. It can be a number (matches the number literally), a string (matches the string), a `RegExp` (matches the regular expression), or a `Parser` instance.                                                                                                                                    | If `arg` is a string or a number: `[]`. If `arg` is a `RegExp`, it emits its capturing groups (if any). If `arg` is a `Parser` instance, children are forwarded from `arg`. |
| `e ${func}`                                | Semantic action. `func` can be any js function passed as tag argument. It will be called with a match payload as argument if `e` succeeds. Shortcut for `e @action(${func})`.                                                                                                                                    | `[<return value of func>]` if that value is not `undefined`, `[]` otherwise                                                                                                 |
| <code>e1 &#124; e2</code>                  | Matches `e1` or `e2` (any arbitrary parsing expression)                                                                                                                                                                                                                                                          | Forwarded from `e1` or `e2`                                                                                                                                                 |
| `e1 e2`                                    | Matches `e1` followed by `e2`                                                                                                                                                                                                                                                                                    | Forwarded and concatenated from `e1` and `e2`                                                                                                                               |
| `e?`                                       | Matches zero or one `e`                                                                                                                                                                                                                                                                                          | Forwarded from `e`                                                                                                                                                          |
| `e+`                                       | Matches one or more `e`s                                                                                                                                                                                                                                                                                         | Forwarded and concatenated from `e`                                                                                                                                         |
| `e*`                                       | Matches zero or more `e`s                                                                                                                                                                                                                                                                                        | Forwarded and concatenated from `e`                                                                                                                                         |
| `e{4}`                                     | Matches `e` exactly 4 times                                                                                                                                                                                                                                                                                      | Forwarded and concatenated from `e`                                                                                                                                         |
| `e{4, 7}`                                  | Matches `e` between 4 and 7 times                                                                                                                                                                                                                                                                                | Forwarded and concatenated from `e`                                                                                                                                         |
| `e{4,}`                                    | Matches `e` at least 4 times                                                                                                                                                                                                                                                                                     | Forwarded and concatenated from `e`                                                                                                                                         |
| `e1 % e2`, `e1 %? e2`, `e1 %{1,3} e2`, ... | Matches a sequence of `e1`s separated by `e2`. The `%` operator can be parametrized using the same quantifiers as above.                                                                                                                                                                                         | Forwarded and concatenated from the matched sequence of `e1`s and `e2`s                                                                                                     |
| `rule: e`, `rule @directive: e`, ...       | In context of a grammar, this creates a non-terminal `rule` as an alias to parser `e`. **A grammar is just a stack of rule definitions**. If directives are specified after the rule name, they are applied to the whole expression `e`.                                                                         | The entry point of a grammar is its topmost rule. So children are forwarded from there.                                                                                     |
| `&e`                                       | Matches `e` without consuming any input nor emitting any children                                                                                                                                                                                                                                                | `[]`                                                                                                                                                                        |
| `!e`                                       | Succeeds if `e` fails and vice-versa. No input is consumed, no children is emitted.                                                                                                                                                                                                                              | `[]`                                                                                                                                                                        |
| `e1 - e2`                                  | Matches `e1` but not `e2` (fails if `e2` succeeds). Equivalent to `!e2 e1`.                                                                                                                                                                                                                                      | Forwarded from `e1`                                                                                                                                                         |
| `...e`                                     | Skips input character by character until `e` is matched. This can be used to implement error recovery and is equivalent to `(!e .)* e`.                                                                                                                                                                          | Forwarded from `e`                                                                                                                                                          |
| `<name>e`                                  | Captures the value emitted by `e` and binds it to `name`                                                                                                                                                                                                                                                         | Forwarded from `e`                                                                                                                                                          |
