When it comes to parsing, whitespaces are usually an annoying part to handle. Well, not with Pegase which provides you with a set of default behaviors and options to make everything straightforward. For most use cases, you won't even have to think about it.

**By default, whitespaces are skipped before every *terminal* parser.**

Terminal parsers include:

- *Literal* parsers (like `"lit"`, `'lit'`, `42` or `ε`)
- *Regexp* parsers (like `[a-z]`, `\w`, `.` or `${/my_js_regexp/}`)
- *Token* parsers, including the end-of-input token `$` and every parser wrapped with the `@token` directive (we will go to that in the [next section](/pegase/basic-concepts/Tokens/)).

This behavior can be changed. All `Parser`'s methods (`parse`, `test`, `value` and `children`) actually accept an optional second argument, an `options` object. These are the parse options, two of which are of interest with the matter at hand here:

- `skipper`, a `Parser` instance that should match the substring you want to skip before every terminal. When you don't provide that option, a default `Parser` is used which skips any sequence of `\s`.
- `skip`, a boolean value that enables or disables skipping (`true` by default).

In the following example, default options are used. Whitespaces are skipped before each `'a'` and before the implicit token `$` (set option `complete` to `false` to avoid having an implicit `$` at the end of your peg expression):

```js
const g = peg`'a'+`;
g.test("  aa  a  a a   a  "); // true
```

Next, let's disable skipping entirely:

```js
const g = peg`'a'+`;
g.test("  aa  a  a a   a  ", { skip: false }); // false
g.test("aaaaaa", { skip: false });             // true
```

You can toggle skipping for specific parts of your peg expression by using the `@skip` and/or `@noskip` directives:

```js
const g = peg`('a'+ @noskip) 'b'`;
g.test("  aa  a  a a   a  b"); // false
g.test("aaaaaaa   b");         // true
```

**If none of these options suits your needs, you can use explicit whitespaces and disable auto-skipping once and for all:**

```js
const g = peg`
  array: '[' _ '1' % ',' _ ']'
  _: \s+
`;

g.defaultOptions.skip = false;

g.test("[1,1,1]");      // false
g.test("[  1,1,1  ]");  // true
g.test("[  1, 1,1  ]"); // false
```
