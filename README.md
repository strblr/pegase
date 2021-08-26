# Pegase

![NPM](https://img.shields.io/npm/l/pegase)  
![npm](https://img.shields.io/npm/v/pegase)  
![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

<p align="center">  
  <img alt="pegase" src="https://raw.githubusercontent.com/ostrebler/pegase/master/img/pegase.png">  
</p>


Pegase is the last PEG parser generator for JavaScript and TypeScript you will ever need to learn. It's:

- **_Inline_**, meaning parsing expressions and grammars are directly expressed in-code as [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates). No generation step, no CLI. Pegase works in complete symbiosis with JS. As an example, [`RegExp`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) can directly be part of grammars via tag arguments.
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights less than 7kB gzipped.
- **_Intuitive_**, in that it lets you express complex grammars and semantic actions in simple ways and with excellent error reporting, warnings, error recovery, [cut operator](http://ceur-ws.org/Vol-1269/paper232.pdf), grammar fragments, and a lot more.
- **_Highly extensible_**: You can define your own `Parser` subclasses, add plugins, write custom directives, etc.

## Table of Contents

- [Overview](#overview)
  - [Motivation](#motivation)
  - [Quick start](#quick-start)
- [Basic concepts](#basic-concepts)
  - [Building parsers](#building-parsers)
  - [Dataflow](#dataflow)

## Overview

### Motivation

The first and main goal of this library is to get you quickly and painlessly into parsing. Let's take a look at an example: parsing math expressions. With very few lines of code, some directives and semantic actions, you already have a parser that also acts as a _calculator_:

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

A few early notes here :

- `a % b` is a shortcut for `a (b a)*`, meaning _"any sequence of `a` separated by `b`"_.
- You can think of parsers as black boxes *emitting* (if they succeed) zero or more values, called `children`. These black boxes can be composed together to form more complex parsers.
- `@infix` is a directive. It transforms a parser's `children` by treating them as items of an infix expression and reducing them to a single child using the provided callback.
- `@number` is another directive. It takes the raw match, converts it into a number and emits that number as a single child.
- By default, whitespace skipping is automatically handled without you having to tweak a single thing. It's entirely configurable of course.
- Notice how some literals are single-quoted like `')'` or double-quoted like `"+"`. Double-quote literals emit their string match as a single child, while single-quotes are silent. Writing the operators with double quotes allows them to be accumulated and processed in `@infix`.

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

Don't worry if things aren't so clear yet. The rest of the documentation below is here to go step by step in all the underlying concepts, so that you understand the core philosophy and principles at hand.

---

### Quick start

First, add pegase as a dependency:

`npm install pegase` or `yarn add pegase`

Next, import the template literal tag that will become your new best friend and there you go, ready to write your first parsing expression.

```js
import peg from "pegase";

const parser = peg`your pegase expression`;
```

What about a parser that recognizes a binary digit ? That's a simple alternative:

```js
const bit = peg`'0' | '1'`;
```

Ok, `bit` is now a `Parser` instance, which has 4 methods : `parse`, `test`, `value` and `children`. Let's take a look at `test`. It takes a string input and returns `true` or `false` (whether the string conforms to the pattern or not).

```js
if (bit.test("1"))
  console.log("It matches!");
```

What about an array of bits like `[0, 1, 1, 0, 1]` ?

```js
const bitArray = peg`'[' ('0' | '1') % ',' ']'`
```

The `%` operator can be read as "separated by". Let's test it:

```js
if (bitArray.test(" [ 0,1 ,0  ,  1, 1]  "))
  console.log("It matches!");
```

As you might have spotted, whitespaces are handled automatically by default (it can be changed). The way this works is pretty simple: whitespace characters and comments are parsed and discarded **before every terminal expression** (like `'['`, `'1'`, etc.). This process is called **skipping**. By default, every parser also adds an implicit "end of input" symbol (`$`) at the end of the parsing expression and treats it as a terminal, thus the trailing space is also skipped and the whole string matches.

Good, but so far, a `RegExp` could have done the job. Things get interesting when we add in **non-terminals**. A non-terminal is an identifier that refers to a more complex parsing expression which will be invoked every time the identifier is used. You can think of non-terminals as variables whose value is a parser, initialized in what we call `rules`. This allows for recursive patterns. Let's say we want to match possibly infinitely-nested bit arrays:

```js
const nestedBitArray = peg`  
  bitArray: '[' (bit | bitArray) % ',' ']'
  bit: '0' | '1'
`;
```

We have two rules: `bitArray` and `bit`. A collection of rules is called a **grammar**. `nestedBitArray` always points to the topmost rule, `bitArray`.

Testing it:

```js
nestedBitArray.test("[[0]"); // false
nestedBitArray.test("[ [1, 0], 1] "); // true
nestedBitArray.test(" [0, [[0] ]]"); // true
```

Fun fact: if we already defined `bit` as a JS variable, we're not obligated to redefine it as a rule. We can simply inject it as a tag argument:

```js
const nestedBitArray = peg`  
  bitArray: '[' (${bit} | bitArray) % ',' ']'
`;
```

## Basic concepts

### Building parsers

Here are the different expressions you can use as building blocks of arbitrarily complex parsing expressions (in the following examples, `e` represents any parsing expression of higher precedence):

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
      <td>Matches the end of the input (equivalent to <code>!.</code>)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>ε</pre></td>
      <td>Matches the empty string. Equivalent to <code>''</code> and always a success. It can be used to implement a default parsing case in an alternative expression.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>^</pre></td>
      <td>The cut operator. Always a success, commits to an alternative to prevent exploring any further in the first parent alternative. Example : <code>'a' ^ e1 &#124; e2</code> will <b>not</b> try <code>e2</code> if <code>'a'</code> was found but <code>e1</code> failed.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>(e)</pre></td>
      <td>Matches <code>e</code></td>
      <td>Forwarded from <code>e</code></td>
    </tr>
    <tr>
      <td><pre>id</pre></td>
      <td>Matches the non-terminal <code>id</code></td>
      <td><code>[]</code></td>
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
      <td>Matches the number literally</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>${arg}</pre></td>
      <td>Template tag argument (<code>arg</code> is a js expression). It can be a number (matches the number literally), a string (matches the string), a <code>RegExp</code> (matches the regular expression), or a <code>Parser</code> instance. Plugins can add support for additionnal types.</td>
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
      <td><pre>e?</pre></td>
      <td>Matches zero or one <code>e</code></td>
      <td>Forwarded from <code>e</code></td>
      <td align="center" rowspan="6">1</td>
    </tr>
    <tr>
      <td><pre>e+</pre></td>
      <td>Matches one or more <code>e</code>s</td>
      <td>Forwarded from <code>e</code></td>
    </tr>
    <tr>
      <td><pre>e*</pre></td>
      <td>Matches zero or more <code>e</code>s</td>
      <td>Forwarded from <code>e</code></td>
    </tr>
    <tr>
      <td><pre>e{4}</pre></td>
      <td>Matches <code>e</code> exactly 4 times</td>
      <td>Forwarded from <code>e</code></td>
    </tr>
    <tr>
      <td><pre>e{4, 15}</pre></td>
      <td>Matches <code>e</code> between 4 and 15 times</td>
      <td>Forwarded from <code>e</code></td>
    </tr>
    <tr>
      <td><pre>e{4,}</pre></td>
      <td>Matches <code>e</code> at least 4 times</td>
      <td>Forwarded from <code>e</code></td>
    </tr>
    <tr>
      <td><pre>&amp;e</pre></td>
      <td>Matches <code>e</code> without consuming any input</td>
      <td><code>[]</code></td>
      <td align="center" rowspan="2">2</td>
    </tr>
    <tr>
      <td><pre>!e</pre></td>
      <td>Succeeds if <code>e</code> fails and vice-versa, without consuming any input</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>&lt;id&gt;e</pre></td>
      <td>If <code>e</code> emits a single child (called "<b>value</b> of <code>e</code>"), it's captured and assigned to <i>"id"</i>, which can then be used in semantic actions and other places. Otherwise, <i>"id"</i> will be set to <code>undefined</code>.</td>
      <td>Forwarded from <code>e</code></td>
      <td align="center">3</td>
    </tr>
    <tr>
      <td><pre>...e</pre></td>
      <td>Skips input character by character until <code>e</code> is matched. This can be used to implement error recovery and is equivalent to <code>(!e .)* e</code>.</td>
      <td>Forwarded from <code>e</code></td>
      <td align="center">4</td>
    </tr>
    <tr>
      <td><pre>e1 % e2<br/>e1 %? e2<br/>e1 %{3} e2</pre>etc.</td>
      <td>Matches a sequence of <code>e1</code>s separated by <code>e2</code>. The <code>%</code> operator can be parametrized using the quantifiers described above.</td>
      <td>Forwarded and concatenated from the matched sequence of <code>e1</code>s and <code>e2</code>s</td>
      <td align="center">5</td>
    </tr>
    <tr>
      <td><pre>e1 - e2</pre></td>
      <td>Matches <code>e1</code> but not <code>e2</code> (fails if <code>e2</code> succeeds). Equivalent to <code>!e2 e1</code>.</td>
      <td>Forwarded from <code>e1</code></td>
      <td align="center">6</td>
    </tr>
    <tr>
      <td><pre>e1 e2</pre></td>
      <td>Matches <code>e1</code> followed by <code>e2</code></td>
      <td>Forwarded and concatenated from <code>e1</code> and <code>e2</code></td>
      <td align="center">7</td>
    </tr>
    <tr>
      <td><pre>e @dir<br/>e @dir(a, b)<br/>e @dir(${arg})<br/>e @dir1 @dir2</pre>etc.</td>
      <td>Applies the directive <code>dir</code> to the parser <code>e</code>. Directives are functions that take a parser and return a new parser. They can take additional arguments and can be chained.</td>
      <td><code>[]</code></td>
      <td align="center" rowspan="2">8</td>
    </tr>
    <tr>
      <td><pre>e ${func}</pre></td>
      <td>Semantic action. <code>func</code> can be any js function passed as tag argument. It will be called with a match payload as argument if <code>e</code> succeeds. This is in fact a shortcut for the <code>@action</code> directive and can thus be chained with other directives as described above.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>e1 | e2</pre></td>
      <td>Succeeds if <code>e1</code> or <code>e2</code> succeeds (order matters)</td>
      <td>Forwarded from <code>e1</code> or <code>e2</code></td>
      <td align="center">9</td>
    </tr>
    <tr>
      <td><pre>id: e<br/>id @dir: e</pre>etc.</td>
      <td>Rule. This creates a non-terminal <code>id</code> as an alias to parser <code>e</code>. Rules can be stacked to form grammars. If directives are specified right after the rule name, they are applied to the whole right-side expression.</td>
      <td>Forwarded from the topmost rule</td>
      <td align="center">10</td>
    </tr>
  </tbody>
</table>

---

### Dataflow

PEG parsers are top-down parsers, meaning the parsing expressions are recursively traversed (or *"called"*) in a depth-first manner, guided by a left-to-right input read. This traversal process can be represented as a tree, called concrete syntax tree. In fact, a top-down parsing process can be thought of as an attempt to build such tree. Let's illustrate that with the following grammar:

```js
const prefix = peg`
  expr: op expr expr | \d
  op: '+' | '-' | '*' | '/'
`;
```

The input `"+ 5 2"` would generate the following concrete syntax tree:

![Parse tree](https://raw.githubusercontent.com/ostrebler/pegase/master/img/dataflow1.png)

