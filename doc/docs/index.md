---
title: Home
hide:
  - toc
---

<p align="center">  
  <img alt="pegase" src="/pegase/assets/images/pegase.png">  
</p>

> ⚠️ This library is still under development. This is a pre-release but some functionalities might still change.

Pegase is a PEG parser generator for JavaScript and TypeScript. It's:

- **_Inline_**, meaning grammars are directly expressed as [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates). No generation step, no CLI. Pegase works in symbiosis with JS.
- ***Complete***. Pegase has *everything* you will ever need: an elegant grammar syntax with a lot of flexibility, semantic actions, support for native regexps, error recovery, warnings, grammar fragments, AST generation, AST visitors, cut operator, and a lot more.
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights less than 8kB gzipped.
- **_Intuitive_**, in that it lets you express complex grammars and semantic processes in very simple ways. You will never feel lost.
- **_Extensible_**: You can define your own `Parser` subclasses, add plugins, write custom directives, etc.

### Motivation

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

const expr = peg`  
  expr: term % ("+" | "-") @infix(${calc})  
  term: fact % ("*" | "/") @infix(${calc})  
  fact: integer | '(' expr ')'
  $integer @number: '-'? [0-9]+
`;
```

Let's see how this plays out :

#### > `expr.value("2 + (17-2*30) *(-5)+2")`

```json
219
```

#### > `expr.test("2* (4 + )/32")`

```json
false
```

#### > `expr.parse("2* (4 + )/32").logger.print()`

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

### Try-it out

You can try everything out while reading this website by accessing the JS console tab. The `peg` tag will be directly available in your namespace. All other named exports from `pegase` are available as properties of `_`. Have fun!

![Console demo](/pegase/assets/images/console-demo.png)

