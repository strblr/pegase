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

Directives are used for a wide range of purposes, from wrapping parsers in tokens, making some semantic behavior quickly reusable, toggling whitespace skipping, etc. There are a bunch of standard directives defined by default, like `@omit`, `@raw`, `@number`, `@token`, `@reverse`, etc. See [API > `defaultPlugin`](/pegase/api/defaultPlugin) for more info. As a quick example, the standard `@test` directive wraps around a `Parser` `a`, and creates a new `Parser` that will always succeed, emitting `true` if `a` succeeds and `false` otherwise. In other words, a definition for `@test` could be:

```js
function test(a) {
  return peg`${a} ${() => true} | ^${() => false}`;
}
```

(The cut operator `^` can be used to implement default cases in alternatives).

In the [Writing a plugin](/pegase/advanced-concepts/Writing-a-plugin/) section, you will learn how such functions are added to plugins, and how plugins are added to the `peg` tag. This will allow you to add support for your **own custom directives**.
