# Pegase

![NPM](https://img.shields.io/npm/l/pegase) ![npm](https://img.shields.io/npm/v/pegase) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

<p align="center">  
  <img alt="pegase" src="https://ostrebler.github.io/pegase/assets/images/pegase.png">  
</p>

Pegase is a PEG parser generator for JavaScript and TypeScript. It's:

- **_Inline_**, meaning grammars are directly expressed as [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates). No generation step, no CLI. Pegase works in symbiosis with JS.
- ***Complete***. Pegase has *everything* you will ever need: an elegant grammar syntax with a lot of flexibility, semantic actions, support for native regexps, error recovery, warnings, grammar fragments, AST generation, AST visitors, cut operator, and a lot more.
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights less than 8kB gzipped.
- **_Intuitive_**, in that it lets you express complex grammars and semantic processes in very simple ways. You will never feel lost.
- **_Extensible_**: You can define your own `Parser` subclasses, add plugins, write custom directives, etc.

# [🔗 Go to the official website](https://ostrebler.github.io/pegase/)

## Motivation

The first and main goal of this library is to get you quickly and painlessly into parsing. Let's take a look at an example: parsing math expressions. With very few lines of code, some directives and semantic actions, you already have a parser _and a calculator_:

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
  fact: integer | '(' expr ')'
  $integer @number: '-'? [0-9]+
`;
```

Let's see how this plays out :

#### `g.value("2 + (17-2*30) *(-5)+2")`

```json
219
```

#### `g.test("2* (4 + )/32")`

```json
false
```

#### `g.parse("2* (4 + )/32").logger.print()`

```
(1:9) Failure: Expected integer or "("

> 1 | 2* (4 + )/32
    |         ^
```

A few early notes here :

- `a % b` is a shortcut for `a (b a)*`, meaning _"any sequence of `a` separated by `b`"_.
- Think of parsers as black boxes *emitting* (if they succeed) zero or more values, called `children`. These boxes can be composed together to form more complex parsers.
- `@infix` is a directive. Directives are functions that transform a parser into another, usually to add some desired behavior.
- By default, whitespace *skipping* is automatically handled for you. It's of course entirely configurable.
- Rules starting with `$` are *tokens*. Tokens are parsers with special behavior regarding failure reporting and whitespace skipping.
- Notice how some literals are single-quoted like `')'` or double-quoted like `"+"`. Double-quote literals emit their string match as a single child, while single-quotes are silent. Writing the operators with double quotes allows them to be accumulated and processed with `@infix`.

Don't worry if things aren't so clear yet. The rest of the documentation below is here to go step by step in all the underlying concepts, so that you understand the core philosophy and principles at hand.

## Quick start

First, add Pegase as a dependency:

`npm install pegase` or `yarn add pegase`

Next, import the template literal tag that will become your new best friend and there you go, ready to write your first peg expression.

```js
import peg from "pegase";

const parser = peg`your pegase expression`;
```

What about a parser that recognizes a binary digit ? That's a simple alternative:

```js
const bit = peg`0 | 1`;
```

Ok, `bit` is now a `Parser` instance, which has 4 methods : `parse`, `test`, `value` and `children`. Let's take a look at `test`. It takes a string input and returns `true` or `false` (whether the string conforms to the pattern or not).

```js
if (bit.test("1"))
  console.log("It's a match!");
```

What about an array of bits like `[0, 1, 1, 0, 1]` ?

```js
const bitArray = peg`'[' (0 | 1) % ',' ']'`
```

The `%` operator can be read as "separated by". Let's test it:

```js
if (bitArray.test(" [ 0,1 ,0  ,  1, 1]  "))
  console.log("It's a match!");
```

As you might have spotted, whitespaces are handled automatically by default ([it can be changed](#handling-whitespaces)). The way this works is pretty simple: whitespace characters are parsed and discarded **before every terminal parser** (like `'['`, `1`, etc.). This process is called **skipping**. By default, every parser also adds an implicit "end of input" symbol (`$`) at the end of the peg expression, which is a terminal, thus the trailing space is skipped too and the whole string matches.

Good, but so far, a `RegExp` could have done the job. Things get interesting when we add in **non-terminals**. A non-terminal is an identifier that refers to a more complex peg expression which will be invoked every time the identifier is used. You can think of non-terminals as *variables* whose value is a parser, initialized in what we call `rules`. This allows for recursive patterns. Let's say we want to match possibly infinitely-nested bit arrays:

```js
const nestedBitArray = peg`  
  bitArray: '[' (bit | bitArray) % ',' ']'
  bit: 0 | 1
`;
```

We have two rules: `bitArray` and `bit`. A collection of rules is called a **grammar**. The generated parser, `nestedBitArray`, always points to the topmost rule, `bitArray` in this case.

Testing it:

```js
nestedBitArray.test("[[0]"); // false
nestedBitArray.test("[ [1, 0], 1] "); // true
nestedBitArray.test(" [0, [[0] ]]"); // true
```

If we already defined `bit` as a JS variable, we're not obligated to redefine it as a rule. We can simply inject it as a tag argument:

```js
const bit = peg`0 | 1`;

const nestedBitArray = peg`  
  bitArray: '[' (${bit} | bitArray) % ',' ']'
`;
```

Okay, the `test` method is fun but what if you want to do something more elaborated like collecting values, reading warnings or parse failures ? The `parse` method is what you're asking for. It returns a result object containing all the info you might be interested in after a parsing. In fact, all other `Parser` methods (`test`, `value` and `children`) are *wrappers* around `parse`.

```js
const result = nestedBitArray.parse("[[0]");
if(!result.success)
  console.log(result.logger.print());
```

This will output:

```
(1:5) Failure: Expected "," or "]"

> 1 | [[0]
    |     ^
```

## More

Failures, warnings, semantic actions, tokens, directives, ASTs, there is so much more to uncover. To learn more about Pegase, [please go to the official website](https://ostrebler.github.io/pegase/).

