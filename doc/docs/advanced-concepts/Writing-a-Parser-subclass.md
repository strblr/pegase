We've seen in section [Basic concepts > Building parsers](/pegase/basic-concepts/Building-parsers/) that parsers are combined together to form more complex parsers. In this section, we'll go into more detail about how exactly this composition is done internally and how you could write your own `Parser` subclass with its own logic. Under the hood, the `Parser` class is derived into two categories of subclasses:

- Leaf classes, which don't hold a reference to other parsers. There are three of them: `LiteralParser`, `RegexParser` and `CutParser`.
- Composition classes like `SequenceParser`, `TokenParser`, `PredicateParser`, `ActionParser`, `NonTerminalParser` etc. which, on the contrary, reference one or more subparsers.

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
exec(options: Options<Context>): Match | null;
```

The `exec` method will be called when the parser is *invoked*. It must return `null` on failure and a `Match` object on success with the following signature:

```ts
type Match = {
  from: number;
  to: number;
  children: any[];
}
```

The state of the parsing process at the time of invocation is expressed by the `options` argument with info like the current position, the input string, the skipping state (on or off), the expected case sensitivity, etc. The exhaustive list is described in [API > Types](/pegase/api/Types/). **Important**: For performance reasons, this object is never recreated and always directly mutated.

Warning and failures must be emitted as side-effects by pushing items to `options.warnings` and `options.failures`. Please refer to [API > `Parser`](/pegase/api/Parser/).

Great. Once you wrote a custom `Parser` subclass, there are basically four options for using it, depending on your needs:

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

- If the class relies on one specific attribute that's not a number, a string, a function, a `RegExp` or a `Parser`, you can make Pegase generate instances automatically by injecting that attribute directly into the peg expression and **casting** it into a `Parser` using a plugin:

```js
peg.plugins.push({
  castParser(set) {
    if(set instanceof Set)
      return new MyParser(set);
  }
});

const g = peg`42 | ${new Set(["a", "b"])}`;
```

- You can define custom directives that generate instances of it:

```js
peg.plugins.push({
  directives: {
    myLeafParser(_, x, y) {
      return new MyLeafParser(x, y);
    },
    myCompParser(parser) {
      return new MyCompParser(parser);
    }
  }
});
  
const p = peg`
  a: b @myCompParser
  b: '(' @@myLeafParser(4, 5) ')'
`;
```

- If your class is a singleton, you can bind its instance to an external non-terminal:

```ts
peg.plugins.push({
  resolve: {
    myparser: new MyParser()
  }
});

const g = peg`42 | myparser`;
```

