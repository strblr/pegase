# Pegase

![NPM](https://img.shields.io/npm/l/pegase)  
![npm](https://img.shields.io/npm/v/pegase)  
![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?label=gzip)

<p align="center">  
  <img alt="pegase" src="https://raw.githubusercontent.com/ostrebler/pegase/master/img/pegase.png">  
</p>


Pegase is a PEG parser generator for JavaScript and TypeScript. It's:

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
  - [Handling whitespaces](#handling-whitespaces)
  - [Tokens](#tokens)

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
- `@number` is another directive. It converts the matched substring into a number and emits that number as a single child.
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

First, add Pegase as a dependency:

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
  console.log("It's a match!");
```

What about an array of bits like `[0, 1, 1, 0, 1]` ?

```js
const bitArray = peg`'[' ('0' | '1') % ',' ']'`
```

The `%` operator can be read as "separated by". Let's test it:

```js
if (bitArray.test(" [ 0,1 ,0  ,  1, 1]  "))
  console.log("It's a match!");
```

As you might have spotted, whitespaces are handled automatically by default ([it can be changed](#handling-whitespaces)). The way this works is pretty simple: whitespace characters and comments are parsed and discarded **before every terminal parser** (like `'['`, `'1'`, etc.). This process is called **skipping**. By default, every parser also adds an implicit "end of input" symbol (`$`) at the end of the parsing expression and treats it as a terminal, thus the trailing space is also skipped and the whole string matches.

Good, but so far, a `RegExp` could have done the job. Things get interesting when we add in **non-terminals**. A non-terminal is an identifier that refers to a more complex parsing expression which will be invoked every time the identifier is used. You can think of non-terminals as variables whose value is a parser, initialized in what we call `rules`. This allows for recursive patterns. Let's say we want to match possibly infinitely-nested bit arrays:

```js
const nestedBitArray = peg`  
  bitArray: '[' (bit | bitArray) % ',' ']'
  bit: '0' | '1'
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

Here are the different expressions you can use as building blocks of more complex parsing expressions (in the following examples, `a` and `b` represents any parsing expression of higher precedence). Please note that *every expression* in this table and *every arbitrary composition* of them are `Parser`s in and of themselves.

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
      <td>Skips input character by character until <code>a</code> is matched. This can be used to implement error recovery and is equivalent to <code>(!a .)* a</code>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center">4</td>
    </tr>
    <tr>
      <td><pre>a % b<br/>a %? b<br/>a %{3} b<br/>a %{3,} b</pre>etc.</td>
      <td>Matches a sequence of <code>a</code>s separated by <code>b</code>. The <code>%</code> operator can be parametrized using the quantifiers described above.</td>
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

### Dataflow

Differentiating between faulty and correct inputs is generally only part of the job we expect from a parser. Another big part is to **run routines** and **generate data** as a side-effect. In this section, we'll talk *dataflow*, *semantic actions*, *parse children* and *captures*.

PEG parsers are top-down parsers, meaning the parsing expressions are recursively traversed (or *"called"*) in a depth-first manner, guided by a left-to-right input read. This traversal process can be represented as a tree, called syntax tree. In fact, a top-down parsing process can be thought of as an attempt to build such tree. Let's illustrate that with the following grammar:

```js
const prefix = peg`
  expr: op expr expr | \d
  op: '+' | '-' | '*' | '/'
`;
```

The input `"+ 5 * 2 6"` would generate the following syntax tree:

![Parse tree](https://raw.githubusercontent.com/ostrebler/pegase/master/img/dataflow-1.png)

**To handle semantic values, Pegase implements a mechanism by which every individual parser can emit an array of values called `children`**.

For example, in the `op` rule, `'+'` is a parser in and of itself who will succeed if a *plus* character can be read from the input. It's called a *literal* parser. You can make every literal parser emit the substring they matched as a single child by using double quotes instead of single quotes. More generally, we can make **any** parser emit the substring they matched as a single child by using the `@raw` directive. So `\d @raw` will emit the exact character it just matched.

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

**A semantic action is a `Parser` wrapped around another `Parser`, and whose role is to call a callback on success. This callback will be provided with a bunch of infos like the `children`, captures, matched substring, etc. If it returns a *non-undefined* value, this value will be emitted as a single child. If it returns `undefined`, no child will be emitted.**

Let's take our `prefix` grammar and say we want to make it generate the input expression but written in postfix notation (operators *after* operands). All we need to do is wrap a semantic action around `op expr expr`, reorder its `children` to postfix order, join them into a string and emit that string as a single child.

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
console.log(prefix.parse("+ 5 * 2 6").children); // ["5 2 6 * +"]
```

**When a `Parser` emits only a single child, it's called the *value* of that `Parser`.**

```js
console.log(prefix.parse("+ 5 * 2 6").value); // "5 2 6 * +"
console.log(prefix.value("+ 5 * 2 6"));       // "5 2 6 * +"
```

`value` is `undefined` if there is no child, or multiple children.

What if you want to call a semantic action for some side-effects but let the initial `children` propagate through or emit more than one child ? Well, this has to be done explicitly by calling the `$propagate` callback passed as an argument:

```js
peg`expr ${({ $propagate }) => $propagate()}`; // pass-through
peg`expr ${({ $propagate }) => $propagate([1, true, "test"])}`; // propagate custom children
```

Great, but `children` are just unlabeled propagated values. Sometimes that's what you want (for example when parsing a phone number list), but more often in semantic actions, you want to be able to grab a specific parser's value by name. This is where *captures* will come in handy.

**A capture expression `<id>a` associates the *value* of a parser `a` to an identifier `id`, which can then be used in semantic actions.**

There are two things to keep in mind:

- Non-terminals are self-captured, meaning that `id` is equivalent to `<id>id`.
- Captures are propagated and accumulated upwards just like `children`, but are stopped at non-terminals. I.e. `'[' expr ']'` will just capture `expr`, but not forward the sub-captures done in `expr`.

Taking this into consideration, our prefix-to-postfix converter could be rewritten is a clearer way:

```js
const prefix = peg`
  expr:
  | op <a>expr <b>expr ${({ op, a, b }) => [a, b, op].join(' ')}
  | \d @raw

  op: "+" | "-" | "*" | "/"
`;
```

As an exercise, try to rewrite the `prefix` grammar so that its value is the actual result of the calculation.

**When a `RegExp` instance is inserted into a parsing expression, it is converted into a regexp parser. The `children` are the `RegExp`'s *capturing groups*, and its [named capturing groups](https://github.com/tc39/proposal-regexp-named-groups) (when supported by your environment) are transformed into regular Pegase captures.**

```js
const rgx = /@(\d+)/;
const g = peg`${rgx} ${({ $value }) => 2*Number($value)}`;

console.log(g.value("@13")); // 26
```

---

### Handling whitespaces

When it comes to parsing, whitespaces are usually an annoying part to handle. Well, not with Pegase which provides you with a set of default behaviors and options to make everything straightforward. For most use cases, you won't even have to think about it.

**By default, whitespaces and comments are skipped before every *terminal* parser.**

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

- `skipper`, a `Parser` instance that should match the substring you want to skip before every terminal. When you don't provide that option, a default `Parser` is used which skips any sequence of `\s` and comments.
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

---

### Tokens

*Coming soon.*

