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
type Match = {
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
