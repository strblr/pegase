# Pegase

![NPM](https://img.shields.io/npm/l/pegase) ![npm](https://img.shields.io/npm/v/pegase) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

<p align="center">  
  <img alt="pegase" src="https://raw.githubusercontent.com/ostrebler/pegase/master/img/pegase.png">  
</p>

> **⚠️ This doc is under active construction. Some passages may change, and more will be added.**

Pegase is a PEG parser generator for JavaScript and TypeScript. It's:

- **_Inline_**, meaning parsing expressions and grammars are directly expressed in-code as [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates). No generation step, no CLI. Pegase works in complete symbiosis with JS. As an example, [`RegExp`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) can directly be part of grammars via tag arguments.
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights less than 7kB gzipped.
- **_Intuitive_**, in that it lets you express complex grammars and semantic actions in simple ways and with excellent error reporting, warnings, error recovery, [cut operator](#cut-operator), grammar fragments, and a lot more.
- **_Highly extensible_**: You can define your own `Parser` subclasses, add plugins, write custom directives, etc.

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
  - [Working with `RegExp`](#working-with-regexp)
  - [Cut operator](#cut-operator)
  - [Using TypeScript](#using-typescript)
  - [Grammar fragments](#grammar-fragments)
  - [Failure recovery](#failure-recovery)
  - [Writing a plugin](#writing-a-plugin)
  - [Writing a `Parser` subclass](#writing-a-parser-subclass)
  - [L-attributed grammars](#l-attributed-grammars)
- [API](#api)
  - [`peg`, `createTag`](#peg-createtag)
  - [`Parser`](#parser)
  - [`defaultPlugin`](#defaultplugin)
  - [Utility functions](#utility-functions)
  - [Other types](#other-types)
  - [Metagrammar](#metagrammar)
- [Bug report and discussion](#bug-report-and-discussion)

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

#### `g.parse("2* (4 + )/32").logs()`

```
(1:9) Failure: Expected integer or "("

> 1 | 2* (4 + )/32
    |         ^
```

A few early notes here :

- `a % b` is a shortcut for `a (b a)*`, meaning _"any sequence of `a` separated by `b`"_.
- You can think of parsers as black boxes *emitting* (if they succeed) zero or more values, called `children`. These black boxes can be composed together to form more complex parsers.
- `@infix` is a directive. It transforms a parser's `children` by treating them as items of an infix expression and reducing them to a single child using the provided callback.
- `@number` is another directive. It converts the matched substring into a number and emits that number as a single child.
- By default, whitespace *skipping* is automatically handled without you having to tweak a single thing. It's entirely configurable of course.
- Rules starting with `$` are *tokens*. Tokens are parsers with special behavior regarding failure reporting and whitespace skipping.
- Notice how some literals are single-quoted like `')'` or double-quoted like `"+"`. Double-quote literals emit their string match as a single child, while single-quotes are silent. Writing the operators with double quotes allows them to be accumulated and processed in `@infix`.

Don't worry if things aren't so clear yet. The rest of the documentation below is here to go step by step in all the underlying concepts, so that you understand the core philosophy and principles at hand.

---

### Quick start

First, add Pegase as a dependency:

`npm install pegase` or `yarn add pegase`

Next, import the template literal tag that will become your new best friend and there you go, ready to write your first parsing expression.

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

As you might have spotted, whitespaces are handled automatically by default ([it can be changed](#handling-whitespaces)). The way this works is pretty simple: whitespace characters are parsed and discarded **before every terminal parser** (like `'['`, `1`, etc.). This process is called **skipping**. By default, every parser also adds an implicit "end of input" symbol (`$`) at the end of the parsing expression and treats it as a terminal, thus the trailing space is also skipped and the whole string matches.

Good, but so far, a `RegExp` could have done the job. Things get interesting when we add in **non-terminals**. A non-terminal is an identifier that refers to a more complex parsing expression which will be invoked every time the identifier is used. You can think of non-terminals as variables whose value is a parser, initialized in what we call `rules`. This allows for recursive patterns. Let's say we want to match possibly infinitely-nested bit arrays:

```js
const nestedBitArray = peg`  
  bitArray: '[' (bit | bitArray) % ',' ']'
  bit: 0 | 1
`;
```

We have two rules: `bitArray` and `bit`. A collection of rules is called a **grammar**. The generated parser, `nestedBitArray`, always points to the topmost rule, `bitArray`.

Testing it:

```js
nestedBitArray.test("[[0]"); // false
nestedBitArray.test("[ [1, 0], 1] "); // true
nestedBitArray.test(" [0, [[0] ]]"); // true
```

Fun fact: if we already defined `bit` as a JS variable, we're not obligated to redefine it as a rule. We can simply inject it as a tag argument:

```js
const bit = peg`0 | 1`;

const nestedBitArray = peg`  
  bitArray: '[' (${bit} | bitArray) % ',' ']'
`;
```

Okay, the `test` method is fun but what if you want to do something more elaborated like collecting semantic values, reading warnings or parse failures ? The `parse` method is what you're asking for. It returns a result object containing all the infos you might be interested in after a parsing. In fact, all other `Parser` methods (`test`, `value` and `children`) are wrappers around `parse`.

```js
const result = nestedBitArray.parse("[[0]");
if(!result.success)
  console.log(result.logs());
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

Pegase parsers follow the *combinator* paradigm: simple parsers are combined to form more complex parsers. You can read more about it in the [API > `Parser`](#parser) section. In the following table are the different expressions you can use as building blocks (in the following examples, `a` and `b` represent any parsing expression of higher precedence). Please note that *every expression* in this table and *every arbitrary composition* of them are `Parser` instances in and of themselves.

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
      <td>The cut operator. Always a success, commits to an alternative to prevent exploring any further in the first parent alternative. Example : <code>'x' ^ a &#124; b</code> will <b>not</b> try <code>b</code> if <code>'x'</code> was found but <code>a</code> failed.</td>
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
      <td>Matches the number literally. Equivalent to <code>'42'</code>.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>${arg}</pre></td>
      <td>Template tag argument (<code>arg</code> is a js expression). It can be a number (matches the number literally), a string (matches the string), a <code>RegExp</code> (matches the regular expression), or a <code>Parser</code> instance. Plugins can add support for additionnal kind of values.</td>
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
      <td>Matches one or more <code>a</code>s</td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a*</pre></td>
      <td>Matches zero or more <code>a</code>s</td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a{4}</pre></td>
      <td>Matches <code>a</code> exactly 4 times. Please note that quantifiers can be parametrized by tag argument: <code>a{${val}}</code>.</td>
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
      <td>Succeeds if <code>a</code> fails and vice-versa, without consuming any input</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>&lt;id&gt;a</pre></td>
      <td>If <code>a</code> emits a single child (called "<b>value</b> of <code>a</code>"), it's captured and assigned to <i>"id"</i>, which can then be used in semantic actions. Otherwise, <i>"id"</i> will be set to <code>undefined</code>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center">3</td>
    </tr>
    <tr>
      <td><pre>...a</pre></td>
      <td>Skips input character by character until <code>a</code> is matched. This can be used to implement <i>synchronization tokens</i> and is equivalent to <code>(!a .)* a</code>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center">4</td>
    </tr>
    <tr>
      <td><pre>a % b<br/>a %? b<br/>a %{3} b<br/>a %{3,} b</pre>etc.</td>
      <td>Matches a sequence of <code>a</code>s separated by <code>b</code>. The <code>%</code> operator can be parametrized using the quantifiers described above. <code>a % b</code> is equivalent to <code>a (b a)*</code>, <code>a %? b</code> to <code>a (b a)?</code>, etc.</td>
      <td>Forwarded and concatenated from the matched sequence of <code>a</code>s and <code>b</code>s</td>
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
      <td><pre>a @dir<br/>a @dir(x, y)<br/>a @dir(x, ${arg})<br/>a @dir @other</pre>etc.</td>
      <td>Applies the directive(s) to the parser <code>a</code>. Directives are functions that take a parser and return a new parser. They can take additional arguments and can be chained.</td>
      <td>Directives generate new parsers. So <code>children</code> depends on whatever parser is generated.</td>
      <td align="center" rowspan="2">8</td>
    </tr>
    <tr>
      <td><pre>a ${func}</pre></td>
      <td>Semantic action. <code>func</code> is a js function passed as tag argument. It will be called if <code>a</code> succeeds. This is in fact a shortcut for the <code>@action</code> directive and can thus be chained with other directives as described above.</td>
      <td><code>[&lt;return value of func&gt;]</code> if that value is different than <code>undefined</code>, <code>[]</code> otherwise</td>
    </tr>
    <tr>
      <td><pre>a | b<br/>a / b</pre></td>
      <td>Succeeds if <code>a</code> or <code>b</code> succeeds (order matters). Please note that you can add a leading bar for aesthetic purposes.</td>
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

PEG parsers are top-down parsers, meaning the parsing expressions are recursively traversed (or *"called"*) in a depth-first manner, guided by a left-to-right input read. This traversal process can be represented as a tree, called syntax tree. Let's illustrate that with the following grammar:

```js
const prefix = peg`
  expr: op expr expr | \d
  op: '+' | '-' | '*' | '/'
`;
```

The input `"+ 5 * 2 6"` would generate the following syntax tree:

![Parse tree](https://raw.githubusercontent.com/ostrebler/pegase/master/img/dataflow-1.png)

**To handle semantic values, Pegase implements a mechanism by which every individual parser can emit an array of values called `children`**.

For example, in the `op` rule, `'+'` is a parser in and of itself who will succeed if a *plus* character can be read from the input. It's called a *literal* parser. You can make every literal parser emit the substring they matched as a single child by using double quotes instead of single quotes. More generally, you can make **any** parser emit the substring they matched as a single child by using the `@raw` directive. So `\d @raw` will emit the exact character it just matched.

**`children` can be collected and processed in parent parsers through composition**.

Some composition patterns process `children` automatically. This is for example the case with the sequence expression `op expr expr`: The `children` of that sequence is the concatenation of the individual `children` of `op`, `expr` and `expr`. Please refer to the table in [Building parsers](#building-parsers), column *Children*, for more information. We can also customize that processing behavior with the help of semantic actions as we'll discuss in a second. For now, let's rewrite the grammar to make it emit the operators and the digits it matched:

```js
const prefix = peg`
  expr: op expr expr | \d @raw
  op: "+" | "-" | "*" | "/"
`;
```

Now strings are emitted and propagated during the parsing process:



![Parse tree](https://raw.githubusercontent.com/ostrebler/pegase/master/img/dataflow-2.png)

Indeed:

```js
console.log(prefix.parse("+ 5 * 2 6").children); // ["+", "5", "*", "2", "6"]
console.log(prefix.children("+ 5 * 2 6"));       // ["+", "5", "*", "2", "6"]
```

That can already be pretty useful, but what you usually want to do is to process these `children` in certain ways at strategic steps during parse time in order to incrementally build your desired output. This is where *semantic actions* come into play.

**A semantic action wraps around a `Parser` and calls a callback on success. This callback will be given `children`, captures, matched substring and more. If it returns `undefined`, no child will be emitted. Any other return value will be emitted as a single child.**

Let's take our `prefix` grammar and say we want to make it generate the input expression in postfix notation (operators *after* operands). All we need to do is wrap a semantic action around `op expr expr`, reorder its `children` to postfix order, join them into a string and emit that string as a single child.

```js
const prefix = peg`
  expr:
  | op expr expr ${({ $children: [op, ...r] }) => [...r, op].join(' ')}
  | \d @raw

  op: "+" | "-" | "*" | "/"
`;
```

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

`value` is `undefined` if there is no child, or multiple children. You can quickly convince yourself that the `prefix` grammar can only ever return one child. Thus, except in case of a parse failure, there is always a `value` to be read from `prefix`. A well designed parsing expression should always have easily predictable `children` for itself and all its nested parser parts. A quick glimpse at a grammar for example should always give you a good general picture of the dataflow. In most cases, a good design choice is to ensure that non-terminals always emit only up to one child but that's ultimately up to you.

Great, but at the end of the day `children` are just unlabeled propagated values. Sometimes that's what you want (typically when you're parsing "list data": a list of phone numbers, a list of operators and operands, a list of arguments to a function, etc.), but very often in semantic actions, you want to be able to grab a specific parser's value by name. This is where *captures* will come in handy.

**A capture expression `<id>a` associates the *value* (the single child) of parser `a` to the identifier `id`, which can then be used in semantic actions.**

There are two things to keep in mind:

- Non-terminals are self-captured, meaning that `id` is equivalent to `<id>id`.
- Captures are propagated and accumulated upwards just like `children`, but are stopped at non-terminals. I.e. `'[' expr ']'` will just capture `expr`, but not forward the sub-captures done inside `expr`.

Taking this into consideration, our prefix-to-postfix converter can be rewritten in a slightly nicer and more idiomatic way:

```js
const prefix = peg`
  expr:
  | op <a>expr <b>expr ${({ op, a, b }) => [a, b, op].join(' ')}
  | \d @raw

  op: "+" | "-" | "*" | "/"
`;
```

As an exercise, try to rewrite the `prefix` grammar so that its value is the actual result of the calculation.

Okay. What if you want to call a semantic action for some side-effects but let the initial `children` propagate through, or emit more than one child ? This has to be done explicitly by calling the `$emit` callback passed as an argument:

```js
peg`a ${() => undefined}`; // a's children are blocked (emits [])
peg`a ${({ $emit }) => $emit()}`; // a's children are forwarded (pass-through)
peg`a ${({ $emit }) => $emit([1, true, "test"])}`; // emit custom children
```

If you don't care about emitted `children` and *only* wanna perform side-effects, then forget about `$emit` and just don't return any value.

---

### Handling whitespaces

When it comes to parsing, whitespaces are usually an annoying part to handle. Well, not with Pegase which provides you with a set of default behaviors and options to make everything straightforward. For most use cases, you won't even have to think about it.

**By default, whitespaces are skipped before every *terminal* parser.**

Terminal parsers include:

- *Literal* parsers (like `"lit"`, `'lit'`, `42` or `ε`)
- *Regexp* parsers (like `[a-z]`, `\w`, `.` or `${/my_js_regexp/}`)
- *Token* parsers, including the end-of-input token `$` and every parser wrapped with the `@token` directive (we will go to that in the [next section](#tokens)).

In the following example, whitespaces are skipped before each `'a'` and before `$`. Thus, the parse is a success.

```js
const g = peg`'a'+ $`;
console.log(g.test("  aa  a  a a   a  ")); // true
```

`Parser`'s methods (`parse`, `test`, etc.) actually accept an optional second argument, an `options` object. Two options are of interest with the matter at hand here:

- `skipper`, a `Parser` instance that should match the substring you want to skip before every terminal. When you don't provide that option, a default `Parser` is used which skips any sequence of `\s`.
- `skip`, a boolean value that enables or disables skipping.

```js
const g = peg`'a'+ $`;
console.log(g.test("  aa  a  a a   a  ", { skip: false })); // false
console.log(g.test("aaaaaa", { skip: false }));             // true
```

You can toggle skipping for specific parts of your parsing expression by using the `@skip` and/or `@noskip` directives:

```js
const g = peg`('a'+ @noskip) $`;
console.log(g.test("  aa  a  a a   a  ")); // false
console.log(g.test("aaaaaaa   "));         // true
```

**If none of these options suits your particular needs, you can use explicit whitespaces:**

```js
const g = peg`
  array: '[' _ '1' % ',' _ ']'
  _: \s+
`;

console.log(g.test("[1,1,1]", { skip: false }));      // false
console.log(g.test("[  1,1,1  ]", { skip: false }));  // true
console.log(g.test("[  1, 1,1  ]", { skip: false })); // false
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
console.log(intList.parse("1 , 1").logs());
```

```
(1:4) Failure: Expected /\d/

> 1 | 1 , 1
    |    ^
```

If you think about it, what we need is to skip whitespaces **before** `integer` but not **inside** it. Something like `\d (\d* @noskip)` but without the repetitiveness. And that's exactly what a token parser does:

**A token parser wraps around a `Parser` and performs pre-skipping before calling it. Skipping is then disabled inside.**

Essentially, the token parser avoids the need for explicit whitespaces in the grammar *and* for an external tokenizer by treating any arbitrary parsing expression *as if* it were a terminal. Let's try it out and see that it works as expected:

```js
const intList = peg`
  list: integer % ','
  integer @raw @token: \d+
`;

console.log(intList.parse("23 4, 45").logs());
```

```
(1:4) Failure: Expected "," or end of input

> 1 | 23 4, 45
    |    ^
```

**A token can be given a *display name* to improve failure logging.**

Tokens often have a lexeme semantic, meaning we want to label them with names and don't much care about their internal syntactical details. This can be done by passing a string as an argument to the `@token` directive:

```js
const intList = peg`
  list: integer % ','
  integer @raw @token("fancy integer"): \d+
`;

console.log(intList.parse("12, ").logs());
```

```
(1:5) Failure: Expected fancy integer

> 1 | 12, 
    |     ^
```

**The `$id` shortcut**: The pattern that will appear the most is probably `fancyToken @token("fancy token")`. That's why Pegase has a shortcut for it: by starting your rule name with a dollar sign, it is automated. The display name is inferred by transforming PascalCase, camelCase and snake_case rule names to space case.

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

Directives are higher-order functions defined in plugins with the following signature:

```ts
(parser: Parser, ...args: Array<any>) => Parser
```

**They transform a `Parser` into a new `Parser`.** The first `parser` argument is the parser the directive is applied to. The `args` array are the additional arguments passed to the directive with the bracketed parameter syntax. These arguments can include tag arguments.

```js
peg`a @dir`
// is equivalent to
definitionOfDir(peg`a`);

peg`a @dir("str", ${42})`;
// is equivalent to
definitionOfDir(peg`a`, "str", 42);
```

Directives are used for a wide range of purposes, from wrapping parsers in tokens, making some semantic behavior quickly reusable, toggling whitespace skipping, etc. There are a bunch of standard directives defined in the `defaultPlugin`, like `@omit`, `@raw`, `@number`, `@token`, `@reverse`, etc. See [API > `defaultPlugin`](#defaultplugin) for more infos. As a quick example, the standard `@test` directive wraps around a `Parser` `a`, and creates a new `Parser` that will always succeed, emitting `true` if `a` succeeds and `false` otherwise. In other words, a definition for `@test` could be:

```js
function test(a) {
  return peg`${a} ${() => true} | ^${() => false}`;
}
```

(Yes, the cut operator `^` can be used to implement default cases in alternatives). In [creating a plugin](#creating-a-plugin) section, you will learn how such functions are added to plugins, and how plugins are added to the `peg` tag. This will allow you to add support for your **own custom directives**.

---

### Failures and warnings

Producing accurate error messages is notoriously difficult when it comes to PEG parsing. That's because when a faulty input triggers a parse failure at the place of error, the parser *backtracks* to all the parent alternatives, tries them out, **fails repetitively**, before ultimately exiting with an error. Thus, failures are being emitted way after the one that's relevant. So which one should be displayed ? You also can't just short-exit on the first failure you encounter, since that would prohibit any backtracking and defeat the purpose of PEGs.

**Because of PEG's backtracking nature, a parse failure isn't necessarily an input *error*.**

This is well explained in [this paper](http://scg.unibe.ch/archive/masters/Ruef16a.pdf) for those who want to dive deeper into the subject matter. Other parsing algorithms like `LL` or `LALR` don't suffer from this problem but are also more difficult to implement and more restrictive in the type of parsing expressions they allow. Fortunately for us, there exists a way out of this. As we've just established, the main problem is to be able to "rank" failures and "guess" which ones are more relevant. By the very design of PEGs, this can never be an exact science and one has to use an approximative method, called **heuristic**, to produce good enough results.

**Pegase implements the *farthest failure heuristic*, which considers the farthest failure(s) in terms of input position to be the most relevant.**

The general idea is that a failure emitted at input position *n* will generally be more relevant than a failure emitted at position *n - x*, where *x* is a positive integer, because *x* more characters have been successfully recognized by the parser at that point.

**In Pegase, there are two types of failures**:

- **Expectation failures**. These are automatically emitted when a literal, a regexp or a token mismatched, or if a portion of the input matched where it should not have (cf. *negative predicates* (`!a`)).

  ```js
  const g = peg`'a' ('b' | 'c' | 'd' @token("the awesome letter d") | ![b-e] .)`;
  console.log(g.parse('ae').logs());
  ```

  ```
  (1:2) Failure: Expected "b", "c", the awesome letter d or mismatch of "e"
  
  > 1 | ae
      |  ^
  ```

  You can also manually emit them in semantic actions using the `$expected` callback (please note that this will override any failure emitted from *inside* the parsing expression the action is wrapped around):

  ```js
  const g = peg`'a' ('b' | . ${({ $raw, $expected }) => {
    if ($raw !== "c" && $raw !== "d") $expected("c", "d");
  }})`;
  
  console.log(g.parse("ae").logs());
  ```

  ```
  (1:2) Failure: Expected "b", "c" or "d"
  
  > 1 | ae
      |  ^
  ```

- **Semantic failures**. These are emitted by *throwing* an `Error` from a semantic action. They're useful when dealing with errors that can *not* be expressed as missing terminals, like undeclared identifiers, type errors, `break` statements outside of loops, etc. Such errors will also override any failure emitted from *inside* the parsing expression the action is wrapped around.

  ```js
  const g = peg`[a-z]+ ${({ $raw, $context }) => {
    if (!$context.has($raw))
      throw new Error(`Undeclared identifier "${$raw}"`);
    return $context.get($raw);
  }}`;
  
  const context = new Map([["foo", 42], ["bar", 18]]);
  ```
  
  ##### `console.log(g.value("foo", { context }))`
  
  ```js
  42
  ```
  
  ##### `console.log(g.parse("baz", { context }).logs())`
  
  ```
  (1:1) Failure: Undeclared identifier "baz"
  
  > 1 | baz
      | ^
  ```

If there are *several* failures at the farthest position *n*, they are reduced with the following logic:

- If they're only expectation failures, the expectations are *merged* as illustrated above.
- If there is a semantic failure, it will override everything else. In case of multiple semantic failures at the same position, the last one will win.

If you want to identify multiple input errors at once, you have to do *error recovery*. This is done using failure commits and forward expressions (`...a`). See [Advanced concepts > Failure recovery](#failure-recovery) for more infos.

**Warnings can be emitted in semantic actions using the `$warn` callback**. They are collected in a side-effect manner and don't influence the parsing process:

```js
const p = peg`
  declaration:
    'class'
    (identifier ${({ $raw, $warn }) => {
      if (!/^[A-Z]/.test($raw))
        $warn("Class names should be capitalized");
    }})
    '{' '}'
    
  $identifier @raw: [a-zA-Z]+
`;

console.log(p.parse("class test {").logs());
```

```
(1:7) Warning: Class names should be capitalized

> 1 | class test {
    |       ^

(1:13) Failure: Expected "}"

> 1 | class test {
    |             ^
```

## Advanced concepts

### Working with `RegExp`

When a `RegExp` instance is inserted into a parsing expression via tag argument, it is converted into a regexp parser (an instance of `RegExpParser`, a subclass of `Parser`). Pegase will then emit its *capturing groups* as `children`:

```js
const time = /(\d+):(\d+)/;
const minutes = peg`
  ${time} ${({ $children: [hr, min] }) => 60 * Number(hr) + Number(min)}
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

Pegase implements the concept of [cut points](http://ceur-ws.org/Vol-1269/paper232.pdf) in the form of a cut operator: `^`. There are times when, passing a certain point in an alternative, you know *for sure* that every remaining alternatives would also fail and thus don't need to be tried out. That "point" can be marked explicitly by `^` in your parsing expression and has the effect to **commit to the current alternative**: even if it were to fail past that point, the *first parent alternatives* would not be tried out. In other words, the cut operator prevents local backtracking.

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

### Using TypeScript

Pegase was coded in TypeScript and ships with its own type declarations. The types of *all* entities, from semantic actions to failure objects, result objects, directives, plugins, etc. can directly be imported from `pegase`. For a list of all available types, please refer to the [`types.ts` file](#https://github.com/ostrebler/pegase/blob/master/src/types.ts). Furthermore, the `peg` tag accepts two optional generics: the first one types the *value* of the resulting parser, the second types the context option.

```ts
import peg, { SemanticInfo } from "pegase";

type Context = Map<string, number>

const g = peg<number, Context>`
  [a-z]+ ${({ $raw, $context }: SemanticInfo<Context>) => {
    if (!$context.has($raw))
      throw new Error(`Undeclared identifier "${$raw}"`);
    return $context.get($raw);
  }}
`;

// g is of type Parser<number, Context>
```

---

### Grammar fragments

When you write a grammar (a parsing expression with rules), `peg` returns an instance of `GrammarParser`, which is a subclass of `Parser`. The `pegase` package exports a utility function named `merge` to, well, merge multiple `GrammarParser`s into one. Basically, this allows you to split long and complex grammars into fragments, possibly across multiple files, as long as you finally join them. Grammar fragments can reference each other's non-terminals without restriction.

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

##### grammar.js

```js
import { merge } from "pegase";
import fragment1 from "./fragment1";
import fragment2 from "./fragment1";

const g = merge(fragment1, fragment2);
console.log(g.test("abcdabcd")); // true
```

---

### Failure recovery

*Coming soon...*

---

### Writing a plugin

*Coming soon...*

---

### Writing a `Parser` subclass

We've seen in section [Basic concepts > Building parsers](#building-parsers) that parsers are combined together to form more complex parsers. In this section, we'll go into more detail about how exactly this composition is done and how you could write your own `Parser` subclass with its own parsing logic. Under the hood, the `Parser` class is derived into two categories of subclasses:

- Leaf classes like `LiteralParser` and `RegExpParser`, which don't hold a reference to other parsers.
- Composition classes like `SequenceParser`, `TokenParser`, `PredicateParser`, etc. which, on the contrary, reference one or more sub-parsers.

For example, the Pegase expression `'a' | 'b'` is converted by the `peg` tag into `new Options([new LiteralParser("a"), new LiteralParser("b")])`, `!id` is converted into `new PredicateParser(new NonTerminalParser("id"), false)`, etc. You got the idea.

In order to fit in this scheme, your custom class must satisfy two constraints: deriving from the `Parser` class, obviously, and implementing an `exec` method with the following signature:

```ts
exec(options: ParseOptions<Context>): Match | null;
```

And that's it. This method will be called when your parser is invoked. It must return a `Match` object on success and `null` on failure (actual failure objects are emitted as side-effects using the `emitFailure` utility). The state of the parsing process at the time of invocation is resumed in the `options` argument with infos like the current position, the input string, the current grammar, the skipping state (on or off), the expected case sensitivity, etc. The exhaustive list is described in [API > Other types > `ParseOptions`](#parseoptions).

Great, but how could you make use of your custom subclass ? There are basically three options depending on your needs:

- You can create an **explicit instance** and inject it into a parsing expression as a tag argument:

  ```js
  const p = new MyParser();
  const g = peg`0 | 1 | ${p}`;
  ```

- If the class depends on some argument, you can make Pegase generate instances automatically by injecting that argument directly into the parsing expression and **casting** it into a `Parser` using a plugin:

  ```js
  peg.extend({
    castParser(arg) {
      if(arg instanceof Set)
        return new MyParser(arg);
    }
  });
  
  const g = peg`42 | ${new Set(["a", "b"])}`;
  ```

- Finally, in case of composition classes, you can define custom directives that generate instances of your subclass:

  ```js
  peg.extend({
    directives: {
      while(parser, predicate) {
        return new MyWhileParser(parser, predicate);
      }
    }
  });
  
  const predicate = payload => { /*...*/ };
  const g = peg`\d @while(${predicate})`;
  ```

---

### L-attributed grammars

*Coming soon...*

## API

### `Parser`



