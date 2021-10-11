First, add Pegase as a dependency:

`npm install pegase` or `yarn add pegase`

Next, import the template literal tag that will become your new best friend and there you go, ready to write your first peg expression.

```js
import peg from "pegase";

const parser = peg`your peg expression`;
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
const bitArray = peg`'[' (0 | 1) % ',' ']'`;
```

The `%` operator can be read as "separated by". Let's test it:

```js
if (bitArray.test(" [ 0,1,    1 ,0 , 1 ]  "))
  console.log("It's a match!");
```

As you might have spotted, whitespaces are handled automatically by default ([it can be changed](/pegase/basic-concepts/Handling-whitespaces)). The way this works is pretty simple: whitespace characters are parsed and discarded **before every terminal parser** (like `'['`, `1`, etc.). This process is called **skipping**. By default, every parser also adds an implicit "end of input" symbol (`$`) at the end of the peg expression, which is a terminal, thus the trailing space is skipped too and the whole string matches.

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
nestedBitArray.test("[[0]");          // false
nestedBitArray.test("[ [1, 0], 1] "); // true
nestedBitArray.test(" [0, [[0] ]]");  // true
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
  console.log(result.logger.toString());
```

This will output:

```
(1:5) Failure: Expected "," or "]"

> 1 | [[0]
    |     ^
```

What we are going to do next is collecting the bits we matched in an array. Every parser and subparser has the ability to *emit* values on success. These values are called `children` and can be processed in parent parsers, which in turn emit `children`, etc. You can think of `children` as Pegase's version of [synthesized attributes](https://en.wikipedia.org/wiki/Attribute_grammar#Synthesized_attributes), values that bubble from bottom to top.

Back to the grammar. By writing `"0"` instead of `0` or `'0'`, it will emit the matched substring as a single child (same for `1`):

```ts
const bit = peg`"0" | "1"`;
bit.parse("1").children; // ["1"]
```

Or directly:

```ts
bit.children("1"); // ["1"]
```

`children` are automatically concatenated in case of sequence and repetition:

```ts
const bitArray = peg`'[' ("0" | "1") % ',' ']'`;
bitArray.children("[0, 1, 1, 0, 1]"); // ["0", "1", "1", "0", "1"]
```

You can wrap any peg expression in functions inserted via tag argument. These functions are called *semantic actions*. Actions can, among many other things, read their subparser's `children`, and process them. Let's wrap our entire expression in an action and `console.log` the `children` from there:

```ts
import peg, { $children } from "pegase";

const bitArray = peg`
  '[' ("0" | "1") % ',' ']' ${() => console.log($children())}
`;

bitArray.parse("[0, 1, 1, 0, 1]"); // console.log: ["0", "1", "1", "0", "1"]
```

If we return a value in our semantic action, it will be emitted as a single child in replacement of the previous `children`. Let's use this to sum our bits:

```ts
const bitArray = peg`
  '[' ("0" | "1") % ',' ']' ${() => $children().reduce((a, b) => a + Number(b), 0)}
`;

bitArray.children("[0, 1, 1, 0, 1]"); // [3]
```

When a parser emits a single child, that child is said to be the `value` of the parser:

```ts
bitArray.value("[0, 1, 1, 0, 1]"); // 3
```

Some behaviors are so commonly used that they are abstracted away in reusable bricks called *directives*. Similarly to semantic actions, un directive wraps a parser and produces another parser. Here is an example of a standard directive, `@reverse`, that... well, reverses the `children`:

```ts
const bitArray = peg`'[' ("0" | "1") % ',' ']' @reverse`;
bitArray.children("[0, 1, 1, 0, 1]"); // ["1", "0", "1", "1", "0"]
```

