# Pegase

![NPM](https://img.shields.io/npm/l/pegase) ![npm](https://img.shields.io/npm/v/pegase) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

<p align="center">  
  <img alt="pegase" src="https://raw.githubusercontent.com/ostrebler/pegase/master/img/pegase.png">  
</p>

> **⚠️ This doc is under active construction. Some passages may change, and more will be added.**

Pegase is a PEG parser generator for JavaScript and TypeScript. It's:

- **_Inline_**, meaning grammars are directly expressed as [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates). No generation step, no CLI. Pegase works in symbiosis with JS.
- ***Complete***. Pegase has *everything* you will ever need: an elegant grammar syntax with a lot of flexibility, semantic actions, support for native regexps, error recovery, warnings, grammar fragments, AST generation, AST visitors, cut operator, and a lot more.
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights less than 8kB gzipped.
- **_Intuitive_**, in that it lets you express complex grammars and semantic processes in very simple ways. You will never feel lost.
- **_Extensible_**: You can define your own `Parser` subclasses, add plugins, write custom directives, etc.

## Table of Contents

- [Overview](#overview)
  - [Motivation](#motivation)
  - [Quick start](#quick-start)
- [Basic concepts](#basic-concepts)
  - [Building parsers](#building-parsers)
  - [Semantic actions and dataflow](#semantic-actions-and-dataflow)
  - [Handling whitespaces](#handling-whitespaces)
  - [Tokens](#tokens)
  - [Directives](#directives)
  - [Failures and warnings](#failures-and-warnings)
- [Advanced concepts](#advanced-concepts)
  - [AST and visitors](#ast-and-visitors)
  - [Working with `RegExp`](#working-with-regexp)
  - [Cut operator](#cut-operator)
  - [Debugging with tracers](#debugging-with-tracers)
  - [Using TypeScript](#using-typescript)
  - [Grammar fragments](#grammar-fragments)
  - [Error recovery](#error-recovery)
  - [Writing a plugin](#writing-a-plugin)
  - [Writing a `Parser` subclass](#writing-a-parser-subclass)
  - [L-attributed grammars](#l-attributed-grammars)
- [API](#api)
  - [`peg`, `createTag`](#peg-createtag)
  - [`Parser`](#parser)
  - [`Logger`](#logger)
  - [`defaultPlugin`](#defaultplugin)
  - [Hooks](#hooks)
  - [Utility functions](#utility-functions)
  - [TypeScript types](#typescript-types)
  - [Metagrammar](#metagrammar)
- [Bug report and discussion](#bug-report-and-discussion)

## Overview

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

---

### Quick start

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

## Basic concepts

### Building parsers

**The `peg` tag accepts any valid Pegase expression and always returns a `Parser` instance.**

Pegase parsers follow the *combinator* paradigm: simple parsers are combined to form more complex parsers. You can read more about it in the [API > `Parser`](#parser) section. In the following table are the different expressions you can use as building blocks (`a` and `b` representing any peg expression of higher precedence):

<table>
  <thead>
    <tr>
      <th>Pegase</th>
      <th>Description</th>
      <th>Children</th>
      <th>Precedence</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><pre>.</pre></td>
      <td>Matches any character</td>
      <td><code>[]</code></td>
      <td align="center" rowspan="13">0</td>
    </tr>
    <tr>
      <td><pre>$</pre></td>
      <td>Matches the end of the input (equivalent to <code>!. @token("end of input")</code>)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>ε</pre></td>
      <td>Matches the empty string. Equivalent to <code>''</code> and always a success.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>^</pre></td>
      <td>The cut operator. Always a success, commits to an alternative to prevent exploring any further in an ordered choice expression. Example : <code>'x' ^ a &#124; b</code> will <b>not</b> try <code>b</code> if <code>'x'</code> was found but <code>a</code> failed.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>(a)</pre></td>
      <td>Matches <code>a</code></td>
      <td>Forwarded from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>identifier</pre></td>
      <td>Matches the non-terminal <code>identifier</code></td>
      <td>Forwarded from the non-terminal <code>identifier</code></td>
    </tr>
    <tr>
      <td><pre>'literal'</pre></td>
      <td>Matches the string <i>"literal"</i></td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>"literal"</pre></td>
      <td>Matches the string <i>"literal"</i></td>
      <td><code>["literal"]</code></td>
    </tr>
    <tr>
      <td><pre>42</pre></td>
      <td>Matches the number literally (equivalent to <code>'42'</code>)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>${arg}</pre></td>
      <td>Template tag argument (<code>arg</code> is a js expression). It can be a number (matches the number literally), a string (matches the string), a <code>RegExp</code> (matches the regular expression), or a <code>Parser</code> instance. Plugins can add support for additionnal values.</td>
      <td>If <code>arg</code> is a string or a number: <code>[]</code>. If <code>arg</code> is a <code>RegExp</code>, it emits its capturing groups (if any). If <code>arg</code> is a <code>Parser</code> instance, its children are forwarded.</td>
    </tr>
    <tr>
      <td><pre>[a-zA-Z]</pre></td>
      <td>Matches one character in the given character class (same syntax as <code>RegExp</code> character classes)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>[^a-zA-Z]</pre></td>
      <td>Matches one character <b>not</b> in the given character class (same syntax as <code>RegExp</code> negated character classes)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>\n<br/>\s<br/>\xAF<br/>\uA6F1</pre>etc.</td>
      <td>Matches the escaped metacharacter as a <code>RegExp</code> expression (i.e. <code>\s</code> matches any whitespace, <code>\S</code> any non-whitespace, <code>\uA6F1</code> matches the unicode character <code>A6F1</code>, etc. (<a href="https://www.w3schools.com/jsref/jsref_obj_regexp.asp">See <code>RegExp</code> documentation</a> for a complete list of supported metacharacters).</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>a?</pre></td>
      <td>Matches zero or one <code>a</code></td>
      <td>Forwarded from <code>a</code></td>
      <td align="center" rowspan="6">1</td>
    </tr>
    <tr>
      <td><pre>a+</pre></td>
      <td>Matches one or more <code>a</code></td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a*</pre></td>
      <td>Matches zero or more <code>a</code></td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a{4}</pre></td>
      <td>Matches <code>a</code> exactly 4 times. Please note that quantifiers can be parametrized by tag argument: <code>a{${n}}</code>, where <code>n</code> is a JS expression.</td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a{4, 15}</pre></td>
      <td>Matches <code>a</code> between 4 and 15 times</td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a{4,}</pre></td>
      <td>Matches <code>a</code> at least 4 times</td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>&amp;a</pre></td>
      <td>Matches <code>a</code> without consuming any input</td>
      <td><code>[]</code></td>
      <td align="center" rowspan="2">2</td>
    </tr>
    <tr>
      <td><pre>!a</pre></td>
      <td>Succeeds if <code>a</code> fails and vice-versa, doesn't consume input</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>&lt;id&gt;a</pre></td>
      <td>If <code>a</code> emits a single child (called <i>value of <code>a</code></i>), it's captured and assigned to the identifier <i>"id"</i>, which can then be used in semantic actions. Otherwise, <i>"id"</i> will be set to <code>undefined</code>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center" rowspan="2">3</td>
    </tr>
    <tr>
      <td><pre>&lt;&gt;id</pre></td>
      <td>Shortcut for <code>&lt;id&gt;id</code>, where <code>id</code> is a non-terminal</td>
      <td>Forwarded from the non-terminal <code>id</code></td>
    </tr>
    <tr>
      <td><pre>...a</pre></td>
      <td>Skips input character by character until <code>a</code> is matched. This can be used to implement <i>synchronization</i> to recover from errors and is equivalent to <code>(!a .)* a</code>. Write <code>...&amp;a</code> if you want to sync to <code>a</code> without consuming <code>a</code>. See <a href="#failure-recovery">Failure recovery</a>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center">4</td>
    </tr>
    <tr>
      <td><pre>a % b<br/>a %? b<br/>a %{3} b<br/>a %{3,} b</pre>etc.</td>
      <td>Matches a sequence of <code>a</code> separated by <code>b</code>. The <code>%</code> operator can be parametrized using the quantifiers described above. <code>a % b</code> is equivalent to <code>a (b a)*</code>, <code>a %? b</code> to <code>a (b a)?</code>, etc.</td>
      <td>Forwarded and concatenated from the matched sequence of <code>a</code> and <code>b</code></td>
      <td align="center">5</td>
    </tr>
    <tr>
      <td><pre>a - b</pre></td>
      <td>Matches <code>a</code> but not <code>b</code> (fails if <code>b</code> succeeds). Equivalent to <code>!b a</code>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center">6</td>
    </tr>
    <tr>
      <td><pre>a b</pre></td>
      <td>Matches <code>a</code> followed by <code>b</code></td>
      <td>Forwarded and concatenated from <code>a</code> and <code>b</code></td>
      <td align="center">7</td>
    </tr>
    <tr>
      <td><pre>a @dir<br/>a @dir(x, y)<br/>a @dir(x, ${y})<br/>a @dir @other</pre>etc.</td>
      <td>Applies the directive(s) to the parser <code>a</code>. Directives are functions that take a parser and return a new parser. They can take additional arguments and can be chained.</td>
      <td>Directives generate new parsers. So <code>children</code> depends on whatever parser is generated.</td>
      <td align="center" rowspan="3">8</td>
    </tr>
    <tr>
      <td><pre>a ${func}</pre></td>
      <td>Semantic action. <code>func</code> is a JS function passed as tag argument. It will be called if <code>a</code> succeeds and will receive <code>a</code>'s captures as a single object argument. This is in fact a shortcut for <code>a @action(${func})</code> and can thus be chained with other directives as described above.</td>
      <td><code>[&lt;return value of func&gt;]</code> if that value is different than <code>undefined</code>, otherwise forwarded from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a => 'label'</pre></td>
      <td>Shortcut for <code>a @node('label')</code>. It will generate a Pegase node labeled <i>"label"</i> and emit it as a single child. See <a href="#ast-and-visitors">AST and visitors</a>. The label value can be inserted via tag argument: <code>a => ${str}</code>, where <code>str</code> is a JS string.</td>
      <td><code>[&lt;the generated node&gt;]</code></td>
    </tr>
    <tr>
      <td><pre>a | b<br/>a / b</pre></td>
      <td>Ordered choice. Succeeds if <code>a</code> or <code>b</code> succeeds (order matters). Please note that you can add a leading bar for aesthetic purposes.</td>
      <td>Forwarded from <code>a</code> or <code>b</code></td>
      <td align="center">9</td>
    </tr>
    <tr>
      <td><pre>id: a<br/>$id: a</br/>id @dir: a</pre>etc.</td>
      <td>Rule. This creates a non-terminal <code>id</code> as an alias to parser <code>a</code>. Rules can be stacked to form <b>grammars</b>. If directives are specified right after the rule name, they are applied to the whole right-side expression <code>a</code>. Adding <code>$</code> at the beginning of a rule name applies an implicit <code>@token</code> directive (the display name in failure reports will be the rule name transformed to space case, i.e. <code>$myToken: a</code> is equivalent to <code>myToken @token("my token"): a</code>).</td>
      <td>Forwarded from the topmost rule</td>
      <td align="center">10</td>
    </tr>
  </tbody>
</table>




---

### Semantic actions and dataflow

Differentiating between faulty and correct inputs is generally only part of the job we expect from a parser. Another big part is to **run routines** and **generate data** as a side-effect. In this section, we'll talk *semantic actions*, *dataflow*, *parse children* and *captures*.

PEG parsers are top-down parsers, meaning the peg expressions are recursively invoked in a depth-first manner, guided by a left-to-right input read. This process can be represented as a tree, called concrete syntax tree. Let's illustrate that with the following grammar:

```js
const prefix = peg`
  expr: op expr expr | \d
  op: '+' | '-' | '*' | '/'
`;
```

The input `"+ 5 * 2 6"` would generate the following syntax tree:

![Parse tree](https://raw.githubusercontent.com/ostrebler/pegase/master/img/dataflow-1.png)

**Pegase implements a mechanism by which every individual parser can emit an array of values called `children`**.

For example, in the `op` rule, `'+'` is a parser in and of itself who will succeed if a *plus* character can be read from the input. It's called a *literal* parser. You can make any literal parser emit the substring it matched as a single child by using double quotes instead of single quotes. More generally, you can make **any** parser emit the substring it matched as a single child by using the `@raw` directive. For example, `\d @raw` will emit the exact digit character it matched, i.e. the input `5` would produce `["5"]` as `children`.

**`children` can be collected and processed in parent parsers through composition**.

Some composition patterns process `children` automatically. This is for example the case with the sequence expression `op expr expr`: The `children` of that sequence is the concatenation of the individual `children` of `op`, `expr` and `expr`. Please refer to the table in [Building parsers](#building-parsers), column *Children*, for more information. We can also customize that processing behavior with the help of semantic actions as we'll discuss in a second. For now, let's rewrite the grammar to make it emit the operators and the digits it matched:

```js
const prefix = peg`
  expr: op expr expr | \d @raw
  op: "+" | "-" | "*" | "/"
`;
```

Now `children` are emitted and propagated during the parsing process:



![Parse tree](https://raw.githubusercontent.com/ostrebler/pegase/master/img/dataflow-2.png)

Indeed:

```js
console.log(prefix.parse("+ 5 * 2 6").children); // ["+", "5", "*", "2", "6"]
console.log(prefix.children("+ 5 * 2 6"));       // ["+", "5", "*", "2", "6"]
```

That can already be pretty useful, but what you usually want to do is to process these `children` in certain ways at strategic steps during parse time in order to incrementally build your desired output. This is where *semantic actions* come into play.

**A semantic action wraps around a `Parser` and calls a callback on success. If it returns `undefined`, children will be forwarded. Any other return value will be emitted as a single child.**

Let's take our `prefix` grammar and say we want to make it generate the input expression in postfix notation (operators *after* operands). All we need to do is wrap a semantic action around `op expr expr`, reorder its `children` to postfix order, join them into a string and emit that string as a single child.

```js
import peg, { $children } from "pegase";

const prefix = peg`
  expr:
  | op expr expr ${() => {
    const [op, a, b] = $children();
    return [a, b, op].join(" ");
  }}
  | \d @raw

  op: "+" | "-" | "*" | "/"
`;
```

`$children` is a hook.

**Hooks are global functions that provide contextual information and operations in semantic actions**, like reading `children`, emitting warnings or failures, getting the current position, etc. Please refer to the [Hooks](#hooks) section for a list of all available hooks.

Recursively, this process will transform the entire input from prefix to postfix:

![Parse tree](https://raw.githubusercontent.com/ostrebler/pegase/master/img/dataflow-3.png)

Let's test this:

```js
console.log(prefix.children("+ 5 * 2 6")); // ["5 2 6 * +"]
```

**When a `Parser` emits only a single child, it's called the *value* of that `Parser`.**

```js
console.log(prefix.parse("+ 5 * 2 6").value); // "5 2 6 * +"
console.log(prefix.value("+ 5 * 2 6"));       // "5 2 6 * +"
```

`value` is `undefined` if there is no child, or multiple children. You can quickly convince yourself that the `prefix` grammar can only ever return one child. Thus, except in case of a parse failure, there is always a `value` to be read from `prefix`. A well designed peg expression should always have easily predictable `children` for itself and all its nested parser parts. A quick glimpse at a grammar should always give you a good general picture of the dataflow. In most cases, a good design choice is to ensure that non-terminals always emit only up to one child but that's ultimately up to you.

Great, but at the end of the day `children` are just unlabeled propagated values. Sometimes that's what you want (typically when you're parsing list-ish data: a list of phone numbers, a list of operators and operands, a list of arguments to a function, etc.), but very often in semantic actions, you want to be able to grab a specific parser's value by name. This is where *captures* will come in handy.

**A capture expression `<id>a` binds the *value* (the single child) of parser `a` to the identifier `id`, which can be used in semantic actions.**

Three things to keep in mind:

- If `a` is a non-terminal `id` and you want to bind its value to its own name, you can simply write `<>id` (equivalent to `<id>id`).
- Captures are propagated and accumulated upwards just like `children`, but are stopped at non-terminals. I.e. `'[' <id>rule ']'` will just capture `id`, but not forward the sub-captures done inside `rule`.
- There are two ways to read captures inside a semantic action: Either as a plain object via its first and unique argument, or as a `Map` by calling the `$captures` hook.

Taking this into consideration, our prefix-to-postfix converter can be rewritten in a slightly nicer way:

```js
const prefix = peg`
  expr:
  | <>op <a>expr <b>expr ${({ op, a, b }) => [a, b, op].join(' ')}
  | \d @raw

  op: "+" | "-" | "*" | "/"
`;
```

As an exercise, try to rewrite the `prefix` grammar so that its value is the actual result of the calculation.

What if you want to emit more than one child, no child at all, or `[undefined]` from a semantic action ? This has to be done explicitly by calling the `$emit` hook which takes a custom `children` array as an argument:

```js
import peg, { $emit } from "pegase";

peg`a ${() => {}}`;                  // forwards a's children (pass-through)
peg`a ${() => undefined}`;           // forwards a's children (pass-through)
peg`a ${() => $emit([undefined])}`;  // emits a single child (undefined)
peg`a ${() => 5}`;                   // emits a single child (5)
peg`a ${() => $emit([])}`;           // emits no child
peg`a ${() => $emit([1, true, 2])}`; // emits multiple children
```

---

### Handling whitespaces

When it comes to parsing, whitespaces are usually an annoying part to handle. Well, not with Pegase which provides you with a set of default behaviors and options to make everything straightforward. For most use cases, you won't even have to think about it.

**By default, whitespaces are skipped before every *terminal* parser.**

Terminal parsers include:

- *Literal* parsers (like `"lit"`, `'lit'`, `42` or `ε`)
- *Regexp* parsers (like `[a-z]`, `\w`, `.` or `${/my_js_regexp/}`)
- *Token* parsers, including the end-of-input token `$` and every parser wrapped with the `@token` directive (we will go to that in the [next section](#tokens)).

This behavior can be changed. All `Parser`'s methods (`parse`, `test`, `value` and `children`) actually accept an optional second argument, an `options` object. These are the parse options, two of which are of interest with the matter at hand here:

- `skipper`, a `Parser` instance that should match the substring you want to skip before every terminal. When you don't provide that option, a default `Parser` is used which skips any sequence of `\s`.
- `skip`, a boolean value that enables or disables skipping (`true` by default).

In the following example, default options are used. Whitespaces are skipped before each `'a'` and before the implicit token `$` (set option `complete` to `false` to avoid having an implicit `$` at the end of your peg expression):

```js
const g = peg`'a'+`;
console.log(g.test("  aa  a  a a   a  ")); // true
```

Next, let's disable skipping entirely:

```js
const g = peg`'a'+`;
console.log(g.test("  aa  a  a a   a  ", { skip: false })); // false
console.log(g.test("aaaaaa", { skip: false }));             // true
```

You can toggle skipping for specific parts of your peg expression by using the `@skip` and/or `@noskip` directives:

```js
const g = peg`('a'+ @noskip) 'b'`;
console.log(g.test("  aa  a  a a   a  b")); // false
console.log(g.test("aaaaaaa   b"));         // true
```

**If none of these options suits your needs, you can use explicit whitespaces and disable auto-skipping once and for all:**

```js
const g = peg`
  array: '[' _ '1' % ',' _ ']'
  _: \s+
`;

g.defaultOptions.skip = false;

console.log(g.test("[1,1,1]"));      // false
console.log(g.test("[  1,1,1  ]"));  // true
console.log(g.test("[  1, 1,1  ]")); // false
```

---

### Tokens

To understand the need for a token concept, let's take a look at a quick example. Let's try and write a grammar to match and extract a coma-separated integer list:

```js
const intList = peg`
  list: integer % ','
  integer @raw: \d+
`;
```

But this doesn't work. Indeed, as whitespace skipping happens before every `\d`, `\d+` can match any space-separated digit list. Thus, `"23 4, 45"` would be a valid input because `23 4` would be considered *one* integer:

```js
console.log(intList.children("23 4, 45")); // ["23 4", "45"]
```

You might intuitively want to disable skipping for the integer rule:

```js
const intList = peg`
  list: integer % ','
  integer @raw @noskip: \d+
`;
```

But this doesn't work either, because now you don't allow for whitespaces *before* integers. So a simple `"1 , 1"` would fail when it should not:

```js
console.log(intList.parse("1 , 1").logger.print());
```

```
(1:4) Failure: Expected /\d/

> 1 | 1 , 1
    |    ^
```

If you think about it, what we need is to skip whitespaces right **before** `integer` but not **inside** it. Something like `\d (\d* @noskip)` but without the repetitiveness. And that's exactly what a token parser does:

**A token parser wraps around a `Parser` and performs pre-skipping before invoking it. Skipping is then disabled inside.**

Essentially, the token parser avoids the need for explicit whitespaces in the grammar *and* for an external tokenizer by allowing you to treat any arbitrary peg expression *as if* it were a terminal. Let's try it out and see that it works as expected:

```js
const intList = peg`
  list: integer % ','
  integer @raw @token: \d+
`;

console.log(intList.parse("23 4, 45").logger.print());
```

```
(1:4) Failure: Expected "," or end of input

> 1 | 23 4, 45
    |    ^
```

**A token can be given a *display name* to improve failure logging.**

Tokens often have a lexeme semantic, meaning we want to label them with names and don't much care about their internal syntactical details. This is indeed what happens with external tokenizers. It can be done with Pegase by passing a string as an argument to the `@token` directive:

```js
const intList = peg`
  list: integer % ','
  integer @raw @token("fancy integer"): \d+
`;

console.log(intList.parse("12, ").logger.print());
```

```
(1:5) Failure: Expected fancy integer

> 1 | 12, 
    |     ^
```

**The `$id` shortcut**: The pattern that will appear the most is probably `fancyToken @token("fancy token")`, there will likely be some repetition between the rule name and the display name. That's why Pegase has a shortcut for it: by starting your rule name with a dollar sign, an implicit `@token` directive is added whose display name is inferred by transforming PascalCase, camelCase and snake_case rule names to space case:

```js
peg`$lowerCaseWord: [a-z]+`;
// is equivalent to
peg`lowerCaseWord @token("lower case word"): [a-z]+`;

peg`$two_digit_integer: \d{2}`;
// is equivalent to
peg`two_digit_integer @token("two digit integer"): \d{2}`;
```

---

### Directives

Directives are functions defined in plugins with the following signature:

```ts
(parser: Parser, ...args: any[]) => Parser
```

**They transform a `Parser` into a new `Parser`.** The first `parser` argument is the parser the directive is applied to. The `args` array are the additional arguments passed to the directive with the bracketed argument syntax. These arguments can include tag arguments.

```js
peg`a @dir`
// is equivalent to
definitionOfDir(peg`a`);

peg`a @dir("str", ${42})`;
// is equivalent to
definitionOfDir(peg`a`, "str", 42);
```

Directives are used for a wide range of purposes, from wrapping parsers in tokens, making some semantic behavior quickly reusable, toggling whitespace skipping, etc. There are a bunch of standard directives defined by default, like `@omit`, `@raw`, `@number`, `@token`, `@reverse`, etc. See [API > `defaultPlugin`](#defaultplugin) for more info. As a quick example, the standard `@test` directive wraps around a `Parser` `a`, and creates a new `Parser` that will always succeed, emitting `true` if `a` succeeds and `false` otherwise. In other words, a definition for `@test` could be:

```js
function test(a) {
  return peg`${a} ${() => true} | ^${() => false}`;
}
```

(The cut operator `^` can be used to implement default cases in alternatives). In the [Creating a plugin](#creating-a-plugin) section, you will learn how such functions are added to plugins, and how plugins are added to the `peg` tag. This will allow you to add support for your **own custom directives**.

---

### Failures and warnings

Producing accurate error messages is notoriously difficult when it comes to PEG parsing. That's because when an input error triggers a parse failure, the parser *backtracks* to all the parent alternatives, tries them out, **fails repetitively**, before ultimately exiting with an error. Thus, failures are being emitted way after the one that's relevant. So which one should be displayed ? You also can't just short-exit on the first failure you encounter, since that would prohibit any backtracking and defeat the purpose of PEGs.

**Because of PEG's backtracking nature, a parse failure isn't necessarily an input *error*.**

This is well explained in [this paper](http://scg.unibe.ch/archive/masters/Ruef16a.pdf) for those who want to dive deeper into the subject matter. Other parsing algorithms like `LL` or `LALR` don't suffer from this problem but are also more difficult to implement and more restrictive in the type of parsing expressions they allow. Fortunately for us, there exists a way out of this. As we've just established, the main problem is to be able to "rank" failures and "guess" which ones are more relevant. By the very design of PEGs, this can never be an exact science and one has to use an approximative method, called **heuristic**, to produce good enough results.

**Pegase implements the *farthest failure heuristic*, which considers the farthest failure(s) in terms of input position to be the most relevant.**

The general idea is that a failure emitted at input position *n* will generally be more relevant than a failure emitted at position *n - x*, where *x* is a positive integer, because *x* more characters have been successfully recognized by the parser at that point.

Failures and warnings (called *log events*) are tracked using a [`Logger`](#logger) instance, which is just a special object. The logger is attached to the parse result, whether the match fails or succeeds (a successful match can produce failures, see [Advanced concepts > Error recovery](#error-recovery)).

**In Pegase, there are two types of failures**:

- **Expectation failures**. These are automatically emitted when a literal, a regexp or a token mismatched, or if a portion of the input matched where it should not have (cf. *negative predicates* (`!a`)).

  ```js
  const g = peg`'a' ('b' | 'c' | 'd' @token("the awesome letter d") | ![b-e] .)`;
  console.log(g.parse('ae').logger.print());
  ```

  ```
  (1:2) Failure: Expected "b", "c", the awesome letter d or mismatch of "e"
  
  > 1 | ae
      |  ^
  ```

  You can also manually emit them in semantic actions using the `$expected` hook (please note that this will override any failure emitted from *inside* the peg expression the action is wrapped around):

  ```js
  const g = peg`'a' ('b' | . ${() => {
    if (!["c", "d"].includes($raw())) $expected(["c", "d"]);
  }})`;
  
  console.log(g.parse("ae").logger.print());
  ```

  ```
  (1:2) Failure: Expected "b", "c" or "d"
  
  > 1 | ae
      |  ^
  ```

- **Semantic failures**. These are emitted by calling the `$fail` hook from a semantic action. They're useful when dealing with errors that can *not* be expressed as missing terminals, like undeclared identifiers, type errors, `break` statements outside of loops, etc. Such errors will also override any failure emitted from *inside* the peg expression the action is wrapped around.

  ```js
  const g = peg`[a-z]+ ${() => {
    const val = $context().get($raw());
    if (!val) $fail(`Undeclared identifier "${$raw()}"`);
    else return val;
  }}`;
  
  const context = new Map([["foo", 42], ["bar", 18]]);
  ```
  
  ##### `g.value("foo", { context })`
  
  ```js
  42
  ```
  
  ##### `g.parse("baz", { context }).logger.print()`
  
  ```
  (1:1) Failure: Undeclared identifier "baz"
  
  > 1 | baz
      | ^
  ```

If there are *several* failures at the farthest position *n*, they are folded into one with the following logic:

- If they're only expectation failures, the expectations are *merged* as illustrated above.
- If there is a semantic failure, it will override everything else. In case of multiple semantic failures at the same position, the last one will win.

If you want to identify multiple input errors at once, you have to do *error recovery*. This is done using failure commits and synchronization expressions (`...a`). See [Advanced concepts > Error recovery](#error-recovery) for more info.

**Warnings can be emitted in semantic actions using the `$warn` hook**. They are collected in a side-effect manner and don't influence the parsing process:

```js
const p = peg`
  declaration:
    'class'
    (identifier ${() => {
      if (!/^[A-Z]/.test($raw()))
        $warn("Class names should be capitalized");
    }})
    '{' '}'
    
  $identifier @raw: [a-zA-Z]+
`;

console.log(p.parse("class test {").logger.print());
```

```
(1:7) Warning: Class names should be capitalized

> 1 | class test {
    |       ^

(1:13) Failure: Expected "}"

> 1 | class test {
    |             ^
```

- If you want to do more elaborated stuff than to simply pretty-print the logs, like processing them programmatically, you have direct access using `logger.warnings` and `logger.failures`. These are just arrays of objects describing the log events. Please see [API > `Logger`](#logger) for more details.
- Warnings and failures can also be emitted during AST visits. See [Advanced concepts > AST and visitors](#ast-and-visitors).

## Advanced concepts

### AST and visitors

We saw in [Basic concepts > Semantic actions and dataflow](#semantic-actions-and-dataflow) that a parsing process can be represented as an invocation tree, called *concrete syntax tree*. This tree doesn't actually exist except temporarily in the JS call stack, thus semantic processes you want to fire at some "nodes" have to be executed at parse time. This is what semantic actions are for. You can do a lot with that, but it might not always be sufficient nor practical. For example, most real-life compilers do several traversals of the syntax tree, some dependent on the previous ones, with a clear separation of concerns. For the tree to be traversed multiple times, it has to be **generated** and **kept** in memory. You generally don't want to generate the whole concrete syntax tree which might have lots of parts only relevant to the syntax analysis but irrelevant in later stages. The actual tree you care about has custom nodes and is called *abstract syntax tree*.

**Pegase provides a clean and elegant way to generate ASTs: the `$node` hook.**

This hook can be called from semantic actions and has the following signature:

```ts
(label: string, fields: Record<string, any>) => Node
```

Given a label to distinguish between node types and some custom fields, it builds and returns a `Node` object with the following signature:

```ts
{
  $label: string;
  $match: Match;
  [field: string]: any;
}
```

The `$label` field and the custom fields simply correspond to `$node`'s arguments. The `$match` key is *automatically* set and stores the success match object that was returned by the parser your semantic action is wrapped around. It contains the keys `from` (where the match started), `to` (where the match ended), `children` and `captures`.

**Nodes can then be emitted, propagated and captured during the parsing process just like any `children`.**

The specifics of how this happens is totally up to you (see [Basic concepts > Semantic actions and dataflow](#semantic-actions-and-dataflow)). Here is an example of a grammar generating an AST for sums written in prefix notation:

```ts
const prefix = peg`
  expr:
  | <>integer ${({ integer }) => $node("INT", { integer })}
  | '+' <a>expr <b>expr ${({ a, b }) => $node("PLUS", { a, b })}

  $integer @raw: \d+
`;

const ast = prefix.value("+ 12 + 42 3");
```

The resulting `ast` will look like this:

![AST](https://raw.githubusercontent.com/ostrebler/pegase/master/img/ast-1.png)

You may have noticed that the custom node fields are the captures. This is actually a very common practice and Pegase offers a shortcut for it: the standard `@node` directive. This directive takes the node label as an argument, and automatically emits a `Node` whose custom fields *are* the captures. In other words, the following is *strictly equivalent* to the previous example:

```ts
const prefix = peg`
  expr:
  | <>integer @node('INT')
  | '+' <a>expr <b>expr @node('PLUS')

  $integer @raw: \d+
`;
```

But it gets even better. Just like `$` rules are syntactic sugar for `@token` rules, the `=>` operator is syntactic sugar for `@node`:

```ts
const prefix = peg`
  expr:
  | <>integer => 'INT'
  | '+' <a>expr <b>expr => 'PLUS'

  $integer @raw: \d+
`;
```

What if you still want to tweak some fields before setting up the `Node` ? Well, the `@node` directive can take as a second argument a function that maps the captures to custom fields. These fields will be merged to the existing captures and the result will be set as the `Node`'s custom fields. It gives you the flexibility of an explicit call to the `$node` hook, with the brevity and expressivity of the directive.

To illustrate that, let's parse complex numbers written in the form *"a + bi"*. The imaginary part is optional, so the `i` capture may be `undefined`. If that's indeed the case, we want our `i` node field to default to zero:

```ts
const complex = peg`
  complex:
    <r>num <i>('+' num 'i')?
      @node('COMPLEX', ${({ i }) => ({ i: i || 0 })})

  $num @number: \d+
`;

complex.value("13+6i"); // { $label: "COMPLEX", $match: (...), r: 13, i: 6 }
complex.value("42");    // { $label: "COMPLEX", $match: (...), r: 42, i: 0 }
```

Once an AST is generated, the next step is obviously to implement traversal procedures. The possibilities are nearly infinite: performing semantic checks (like type checks), fine-tuning a syntactic analysis, mutating the tree (like [Babel plugins](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md)), folding the tree to some output value, etc. To implement traversals of ASTs, Pegase ships with its own [visitor pattern](#https://en.wikipedia.org/wiki/Visitor_pattern#Use_case_example).

**A Pegase visitor is an object whose keys are node labels and whose values are callbacks taking a `Node` as single argument:**

```ts
{ [label: string]: (node: Node) => any }
```

The *result* of a visitor for a given node `n` is the return value of the callback associated with the label of `n`. Visitors are directly passed via the `visit` option to a parser's `parse`, `test`, `value` or `children` method, either as a single visitor or as an array of visitors forming a visitor pipe.

**After the parsing is done, the final `children` array will be mapped through the visitor pipe.**

Every `children` item will individually be sent down the visitor pipe. Each visitor feeds its result to next one. The result of the final visitor will replace the initial child. This mechanism implies two things:

- `children` never changes size as a result of visits, it's just a one-to-one mapping. Thus parsers who produce a `value` (ie. a single child) keep producing a `value` no matter how many visitors you stack. The final `value` will be the result of the visitor pipe applied to the initial `value`.
- Only the last visitor can return a non-`Node` result, since each visitor has to be fed with a `Node` value.

![AST](https://raw.githubusercontent.com/ostrebler/pegase/master/img/ast-2.png)

Let's build a simple visitor that transforms the output `Node` of our previous `prefix` grammar into its label:

```ts
const prefix = peg`
  expr:
  | <>integer => 'INT'
  | '+' <a>expr <b>expr => 'PLUS'

  $integer @raw: \d+
`;

const labelVisitor = {
  INT: node => node.$label,
  PLUS: node => node.$label
};

prefix.value("182", { visit: labelVisitor });         // "INT"
prefix.value("+ 12 + 42 3", { visit: labelVisitor }); // "PLUS"
```

As you might have spotted, the `INT` and `PLUS` callbacks are exactly the same. You can replace them with a simple default case callback by using the `$default` key. This callback will be called when no other visitor key matches the current node label.

```ts
const labelVisitor = {
  $default: node => node.$label
};
```

Let's dive a bit deeper: how would you implement a visitor that calculates the sum's result ? Calculating a sum from an AST means [*folding*](https://en.wikipedia.org/wiki/Fold_(higher-order_function)) the AST into a single value, which implies recursive visits to child nodes. That's exactly what the `$visit` hook is for: called from *inside* a visitor callback and given a node, it applies the current visitor to that node and returns the result. Our sum visitor could be implemented as follows:

```ts
const sumVisitor = {
  INT: node => Number(node.integer),
  PLUS: node => $visit(node.a) + $visit(node.b)
};

prefix.value("182", { visit: sumVisitor });         // 182
prefix.value("+ 12 + 42 3", { visit: sumVisitor }); // 57
```

Next, to illustrate visitor piping, we're going to add a visitor right before `sumVisitor` that preserves the AST but *doubles* the `integer` value of `INT` nodes. This basically implies that each visitor callback will have to be an identity function, returning the node it was passed and only performing side-effects. For `INT` nodes, the side-effect is to double the value. For `PLUS` nodes, it's to visit the child nodes. Giving us:

```ts
const doubleVisitor = {
  INT: node => {
    node.integer *= 2;
    return node;
  },
  PLUS: node => {
    $visit(node.a);
    $visit(node.b);
    return node;
  }
};

prefix.value("182", { visit: [doubleVisitor, sumVisitor] });         // 364
prefix.value("+ 12 + 42 3", { visit: [doubleVisitor, sumVisitor] }); // 114
```

You get the idea. Have fun !

**A visitor callback has access to all the hooks available in semantic actions**, except `$commit`. So it's totally fine to emit warnings and failures from visitors:

```ts
const sumVisitor = {
  INT: node => {
    if (node.integer === "42") $warn("42 is too powerful");
    return Number(node.integer);
  },
  PLUS: node => $visit(node.a) + $visit(node.b)
};

console.log(
  prefix.parse("+ 12 + 42 3", { visit: sumVisitor }).logger.print()
);
```

```
(1:8) Warning: 42 is too powerful

> 1 | + 12 + 42 3
    |        ^
```

The effect of some hooks differ when used in a semantic action vs. a visitor. In semantic actions, `$emit` propagates `children`. In visitors, `$emit` replaces the array at `node.$match.children` where `node` is the current node. In semantic actions, `$fail` and `$expected` don't commit failures, they emit failure *candidates* which are then merged or filtered out using the farthest failure heuristic (see [Basic concepts > Failures and warnings](#failures-and-warnings)). In visitors, these hooks commit failures directly. The heuristic wouldn't make much sense outside of a backtracking syntactic analysis. Please refer to [API > Hooks](#hooks) for an exhaustive doc of all hooks.

---

### Working with `RegExp`

When a `RegExp` instance is inserted into a peg expression via tag argument, it is converted into a regexp parser (an instance of `RegExpParser`, a subclass of `Parser`). At invocation, the parsing is automatically delegated to `RegExp.prototype.exec`. On success, Pegase will then emit its *capturing groups* as `children`:

```js
const time = /(\d+):(\d+)/;

const minutes = peg`
  ${time} ${() => {
    const [hr, min] = $children();
    return 60 * Number(hr) + Number(min);
  }}
`;

console.log(minutes.value("2:43")); // 163
```

The `RegExp`'s [named capturing groups](https://github.com/tc39/proposal-regexp-named-groups) (when supported by your environment) are transformed into regular Pegase captures:

```js
const date = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const yearIs = peg`
  ${date} ${({ year }) => "The year is " + year}
`;

console.log(yearIs.value("2021-08-19")); // "The year is 2021"
```

---

### Cut operator

Pegase implements the concept of [cut points](http://ceur-ws.org/Vol-1269/paper232.pdf) in the form of a cut operator: `^`. There are times when, passing a certain point in an alternative, you know *for sure* that every remaining alternatives would also fail and thus don't need to be tried out. That "point" can be marked explicitly by `^` in your peg expression and has the effect to **commit to the current alternative**: even if it were to fail past that point, the *first parent alternatives* would not be tried out. In other words, the cut operator prevents local backtracking.

An example will explain it better: let's say you want to write a compiler for a C-like language. You define an `instr` rule that can match an `if` statement, a `while` loop or a `do...while` loop. If the terminal `'if'` successfully matched, then *even* if the rest of the expression fails, there is just no way for an alternative `while` loop or a `do...while` loop to match. That means you can insert a *cut point* right after `'if'`. The same reasoning can be applied to the `'while'` terminal, but is useless for `'do'` since it's already the last alternative.

```js
peg`
  instr:
  | 'if' ^ '(' expr ')' instr
  | 'while' ^ '(' expr ')' instr
  | 'do' instr 'while' '(' expr ')'
`;
```

Since `^` is implemented as a no-op `Parser` that always succeeds (nothing is consumed nor emitted), it can **also** be used to implement default cases in alternative expressions, with the same effect but more efficient than the empty string:

```js
peg`
  size:
  | 'small' ${() => new SmallSize()}
  | 'big'   ${() => new BigSize()}
  | ^       ${() => new DefaultSize()}
`;
```

---

### Debugging with tracers

Coming soon.

---

### Using TypeScript

Pegase was coded in TypeScript and ships with its own type declarations. The types of *all* entities, from semantic actions to failure objects, result objects, directives, plugins, etc. can directly be imported from `pegase`. For a list of all available types, please refer to [API > TypeScript types](#typescript-types). Furthermore, the `peg` tag accepts two optional generics: the first one types the *value* of the resulting parser, the second types the context option.

```ts
import peg, { $context, $raw, $fail } from "pegase";

type Context = Map<string, number>;

const g = peg<number, Context>`
  [a-z]+ ${() => {
    const val = $context().get($raw());
    if (!val) $fail(`Undeclared identifier "${$raw()}"`);
    else return val;
  }}
`;

// g is of type Parser<number, Context>
```

---

### Grammar fragments

When you write a grammar (a peg expression with rules), `peg` returns an instance of `GrammarParser`, which is a subclass of `Parser`. The `pegase` package exports a utility function named `merge` to, well, merge multiple `GrammarParser`s into one. Basically, this allows you to split long and complex grammars into fragments, possibly across multiple files, as long as you finally join them. Grammar fragments can reference each other's non-terminals without restriction.

If there are conflicting rule declarations, an exception is thrown.

##### `fragment1.js`

```js
import peg from "pegase";

export default peg`
  a: "a" b
  b: "b" c
`;
```

##### `fragment2.js`

```js
import peg from "pegase";

export default peg`
  c: "c" d
  d: "d" a?
`;
```

##### `grammar.js`

```js
import { merge } from "pegase";
import fragment1 from "./fragment1";
import fragment2 from "./fragment1";

const g = merge(fragment1, fragment2);
console.log(g.test("abcdabcd")); // true
```

---

### Error recovery

*Coming soon...*

---

### Writing a plugin

*Coming soon...*

---

### Writing a `Parser` subclass

We've seen in section [Basic concepts > Building parsers](#building-parsers) that parsers are combined together to form more complex parsers. In this section, we'll go into more detail about how exactly this composition is done internally and how you could write your own `Parser` subclass with its own logic. Under the hood, the `Parser` class is derived into three categories of subclasses:

- Leaf classes, which don't hold a reference to other parsers. There are three of them: `LiteralParser`, `RegExpParser` and `CutParser`.
- Composition classes like `SequenceParser`, `TokenParser`, `PredicateParser`, `ActionParser`, etc. which, on the contrary, reference one or more subparsers.
- `NonTerminalParser` is a special case, because it holds a reference to another parser, but as a string (a rule name) that will be resolved dynamically at parse time.

The `peg` tag's role is to parse a peg expression and to generate the corresponding `Parser` instances. The expression `'a' | 'b'` is converted by the `peg` tag into:

```ts
new AlternativeParser([
  new LiteralParser("a"),
  new LiteralParser("b")
])
```

`&id+` is converted into:

```ts
new PredicateParser(
  new RepetitionParser(
    new NonTerminalParser("id"),
    [1, Infinity]
  ),
  true
)
```

You get the idea.

Every `Parser` subclass, the standard and your custom ones, **must** satisfy two constraints: 1) Inheriting from `Parser`, obviously, and 2) implementing an `exec` method with the following signature:

```ts
exec(options: ParseOptions<Context>): Match | null;
```

The `exec` method will be called when the parser is *invoked*. It must return `null` on failure and a `Match` object on success with the following signature:

```ts
{
  from: Location;
  to: Location;
  children: any[];
  captures: Map<string, any>;
}
```

The state of the parsing process at the time of invocation is expressed by the `options` argument with info like the current position, the input string, the current grammar, the skipping state (on or off), the expected case sensitivity, etc. The exhaustive list is described in [API > TypeScript types](#typescript-types).

Log events (warning and failures) must be emitted as side-effects using the `Logger` instance provided by `options.logger`. The logger is also used to efficiently build `Location` objects based on absolute input indexes. Please refer to [API > `Logger`](#logger) for a list of supported methods.

Great. Once you wrote a custom `Parser` subclass, there are basically three options for using it, depending on your needs:

- You can create an **explicit instance** and inject it into a peg expression as a tag argument:

  ```js
  const p = new MyParser();
  const g = peg`0 | 1 | ${p}`;
  ```

  There is also the builder approach:

  ```ts
  const _ = data => new MyParser(data);
  const g = peg`0 | 1 | ${_("foo")} | ${_("bar")}`;
  ```

- If the class relies on some specific attribute (not a number, a string, a function, a `RegExp` or a `Parser`, these have already special meaning), you can make Pegase generate instances automatically by injecting that attribute directly into the peg expression and **casting** it into a `Parser` using a plugin:

  ```js
  peg.plugins.push({
    castParser(set) {
      if(set instanceof Set)
        return new MyParser(set);
    }
  });
  
  const g = peg`42 | ${new Set(["a", "b"])}`;
  ```

- Lastly, if your class is a composition class, you can define custom directives that generate instances of it:

  ```js
  peg.plugins.push({
    directives: {
      custom(parser) {
        return new MyParser(parser);
      }
    }
  });
  
  const p = peg`\d+ @custom`; // p is a MyParser instance
  ```

---

### L-attributed grammars

*Coming soon...*

## API

### `peg`, `createTag`

##### `peg` (function / template tag)

| Property                | Type                                                         | Description                                                  |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| *Call via template tag* | `<Value, Context>(chunks: TemplateStringsArray, ...args: any[]) => Parser<Value, Context>` | Generates a `Parser` instance based on a peg expression      |
| `trace`                 | `boolean`                                                    | Activates tracing during peg expression parsing (called *meta-parsing*) |
| `plugins`               | `Plugin[]`                                                   | The list of plugins attached to the tag (order matters: in case of conflicts, the first plugin wins). Can be mutated or replaced. |

##### `createTag` (function)

| Property | Type               | Description                                                  |
| -------- | ------------------ | ------------------------------------------------------------ |
| *Call*   | `() => typeof peg` | Generates a new peg-like tag. This is useful is you need different <code>peg</code> tags with different plugins at the same time. |

---

### `Parser`

##### `Parser<Value, Context>` (abstract base class)

| Property         | Type                                                         | Description                                                  |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `defaultOptions` | `Partial<ParseOptions<Context>>`                             | Default parsing options. These are merged to the ones provided when calling one of the following method. |
| `parse`          | `(input: string, options?: Partial<ParseOptions<Context>>) => Result<Value, Context>` | Parses `input` and builds a `Result` object                  |
| `test`           | `(input: string, options?: Partial<ParseOptions<Context>>) => boolean` | Wrapper around `parse`. Returns the `Result` object's `success` field. |
| `value`          | `(input: string, options?: Partial<ParseOptions<Context>>) => Value` | Wrapper around `parse`. Returns the `Result` object's `value` field in case of success. Throws an `Error` on failure. |
| `children`       | `(input: string, options?: Partial<ParseOptions<Context>>) => any[]` | Wrapper around `parse`. Returns the `Result` object's `children` field in case of success. Throws an `Error` on failure. |

All `Parser` **subclasses** share the following properties:

| Property | Type                                                         | Description                                                  |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `exec`   | <code>(options: ParseOptions&lt;Context&gt;) => Match &vert; null</code> | Invokes the parser. Returns a `Match` on success and `null` on failure. |

##### `LiteralParser` (subclass)

| Property      | Type                                                    | Description                                                  |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| *Constructor* | `new(literal: string, emit?: boolean) => LiteralParser` | Builds a new instance                                        |
| `literal`     | `string`                                                | The literal to be matched when the parser is invoked         |
| `emit`        | `boolean`                                               | Whether the parser should emit the matched substring as a single child or not |

##### `RegExpParser` (subclass)

| Property      | Type                                  | Description                                     |
| ------------- | ------------------------------------- | ----------------------------------------------- |
| *Constructor* | `new(regExp: RegExp) => RegExpParser` | Builds a new instance                           |
| `regExp`      | `RegExp`                              | The original `RegExp` passed to the constructor |
| `cased`       | `RegExp`                              | The `RegExp` used for case-sensitive matching   |
| `uncased`     | `RegExp`                              | The `RegExp` used for case-insensitive matching |

---

### `Logger`

| Property      | Type                                             | Description                                                  |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| *Constructor* | `new(input: string) => Logger`                   | Builds a new instance                                        |
| `warnings`    | `Warning[]`                                      | All emitted warnings                                         |
| `failures`    | `Failure[]`                                      | All emitted failures                                         |
| `pending`     | <code>Failure &vert; null</code>                 | The farthest failure candidate. This is updated at parse time according to the farthest failure heuristic. See [Failures and warnings](#failures-and-warnings). |
| `input`       | `string`                                         | The input string                                             |
| `indexes`     | `number[]`                                       | A index array for fast index to row / column conversion. This is automatically generated in the constructor. |
| `at`          | `(index: number) => Location`                    | Creates a `Location` object based on an absolute input index |
| `hasWarnings` | `() => boolean`                                  | Checks whether the logger has any warning                    |
| `hasFailures` | `() => boolean`                                  | Checks whether the logger has any failure                    |
| `warn`        | `(warning: Warning) => void`                     | Pushes the given warning to the logger's `warnings`          |
| `fail`        | `(failure: Failure) => void`                     | Pushes the given failure to the logger's `failures`          |
| `hang`        | `(failure: Failure) => void`                     | Compares the given failure to the logger's `pending` failure and merges / replaces / keeps it according to the farthest failure heuristic. See [Failures and warnings](#failures-and-warnings). |
| `commit`      | `() => void`                                     | Flushes the logger's `pending` failure (if any) to the `failures` array. This is used to implement [error recovery](#error-recovery). |
| `create`      | `() => Logger`                                   | Creates a new empty `Logger` instance on the same input without recalculating the `indexes` array. |
| `fork`        | `() => Logger`                                   | Creates a copy of the current logger                         |
| `sync`        | `(logger: Logger) => void`                       | Copies the given logger's `warnings`, `failures` and `pending` into the current logger |
| `print`       | `(options?: Partial<LogPrintOptions>) => string` | Creates a pretty-printed string of the current log events (`warnings` and `failures`) |

---

### Hooks

| Hook        | Type                                                         | Availability               | Description                                                  |
| ----------- | ------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------ |
| `$from`     | `() => Location`                                             | Semantic actions, visitors | Returns the start location of the current match in the input (included) |
| `$to`       | `() => Location`                                             | Semantic actions, visitors | Returns the end location of the current match in the input (excluded) |
| `$children` | `() => any[]`                                                | Semantic actions, visitors | Returns the `children` produced by the current match         |
| `$captures` | `() => Map<string, any>`                                     | Semantic actions, visitors | Returns the captures produced by the current match           |
| `$value`    | `() => any`                                                  | Semantic actions, visitors | Returns the value (i.e. the single child) produced by the current match. This is `undefined` if there is no child, or multiple children. |
| `$raw`      | `() => string`                                               | Semantic actions, visitors | Returns the substring of the current match                   |
| `$options`  | `() => ParseOptions`                                         | Semantic actions, visitors | Returns the current parse options                            |
| `$context`  | `() => any`                                                  | Semantic actions, visitors | Returns the parse context. Shortcut for `$options().context`. |
| `$warn`     | `(message: string) => void`                                  | Semantic actions, visitors | Emits a warning at the current match's start location        |
| `$fail`     | `(message: string) => void`                                  | Semantic actions, visitors | Emits a semantic failure at the current match's start location. In semantic actions, this failure is only a *candidate* (see [Failures and warnings](#failures-and-warnings)). |
| `$expected` | <code>(expected: string &vert; RegExp &vert; Expectation &vert; (...)[]) => void</code> | Semantic actions, visitors | Emits an expectation failure at the current match's start location. In semantic actions, this failure is only a *candidate* and might be thrown out or merged according to the farthest failure heuristic (see [Failures and warnings](#failures-and-warnings)). |
| `$commit`   | `() => void`                                                 | Semantic actions           | Flushes the current farthest failure to the final failure output (see [Error recovery](#error-recovery)) |
| `$emit`     | `(children: any[]) => void`                                  | Semantic actions, visitors | In semantic actions, emits the given children. In visitors, replaces `node.$match.children` where `node` is the current node. |
| `$node`     | `(label: string, fields: Record<string, any>): Node`         | Semantic actions, visitors | Creates a `Node` with the given label, fields, and the current match |
| `$visit`    | `(node: Node, options?: Partial<ParseOptions>, visitor?: Visitor) => any` | Visitors                   | Applies the current visitor (or `visitor` if the third argument is provided) to `node` and returns the result. New parse options can be merged to the current ones. |

