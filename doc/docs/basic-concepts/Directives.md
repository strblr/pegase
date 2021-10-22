Directives are functions defined in plugins with the following signature:

```ts
type Directive = (parser: Parser, ...args: any[]) => Parser
```

**They transform a `Parser` into a new `Parser`.**

In peg expressions, they are applied to sub-expressions, either explicitly via the `@` notation or implicitly with syntactic sugar. Such application triggers the `peg` tag to call the function while generating the resulting `Parser`. The first `parser` argument is the parser the directive is wrapped around. The `args` rest arguments are the additional arguments passed to the directive with the optional bracketed argument syntax (these arguments can include tag arguments). The resulting `Parser` is the return value of the function.

To demonstrate that, we're going to add a `@toNumber` directive to the plugin chain. This directive should apply a semantic action to the wrapped parser to cast the parsed substring into a number and emit that number as a single child:

```ts
peg.plugins.push({
  directives: {
    toNumber: parser => peg`${parser} ${() => Number($raw())}`
  }
});
```

Please refer to the [Writing a plugin](/pegase/advanced-concepts/Writing-a-plugin/) section for more info about plugins.

Now, instead of copy/pasting the semantic action every time you need to convert a portion of the input into a number, you can simply apply the directive:

```ts
const p = peg`
  num: $int @toNumber
  $int: \d+
`;

p.children("23"); // [23]
p.value("65");    // 65
```

**Directives can be chained.**

Let's add a `toBase` directive that converts an emitted number into a string, given a custom base:

```ts
peg.plugins.push({
  directives: {
    toNumber: parser => peg`${parser} ${() => Number($raw())}`,
    toBase: (parser, base) => peg`${parser} ${() => $value().toString(base)}`
  }
});
```

```ts
const p = peg`
  num: $int @toNumber @toBase(16)
  $int: \d+
`;

p.value("15");   // "f"
p.value("3153"); // "c51"
```

Directives are used for a wide range of purposes, from wrapping parsers in tokens, making some semantic behavior quickly reusable, toggling whitespace skipping, etc. There are a bunch of standard directives defined by default, like `@omit`, `@raw`, `@number`, `@token`, `@reverse`, etc. See [API > `defaultPlugin`](/pegase/api/defaultPlugin) for more info.

In fact, the syntax of semantic actions `a ${func}` is syntactic sugar for `a @action(${func})`. The standard `@action` directive takes in a `Parser` and a function and returns an instance of `ActionParser`.

In specific cases, you might not care about the wrapped parser. This is for example the case for the `@commit` directive whose sole role is to commit the current farthest failure (see [Advanced concepts > Error recovery](/pegase/advanced-concepts/Error-recovery/)). In such pure side-effect situations, the idea is to wrap the directive around an empty literal (always succeeds):

```ts
a ('' @commit) b
```

But instead of writing it explicitly, there is syntactic sugar too: adding another `@` in front of the directive. The following expression is thus equivalent to the previous one:

```
a @@commit b
```

Please note that this also works for implicit directives like semantic actions:

```ts
const p = peg`
  "a" @${() => "b"} "c"
`;

p.children("ac"); // ["a", "b", "c"]
```

