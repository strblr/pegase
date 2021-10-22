Pegase has a plugin system that allows you to extend the base functionalities. A plugin is a simple object with four optional properties:

1. `name`: the name of your plugin.
2. `castParser`: A function to convert custom tag argument types into `Parser` instances.
3. `directives`: Custom directive definitions.
4. `resolve`: A string to `Parser` map that will be used as a fallback resolver for undefined non-terminals in your peg expressions. Think of it as *global rules*.

For the exact type signature of these properties, please refer to [API > Types](/pegase/api/Types/). Plugins then have to be added to the `peg` tag's `plugins` array. Order matters: in case of conflict (a conflicting `resolve` rule, `directive` definition or `castParser` behavior), the first will win. Let's add two directives `@min` and `@max`, that transform the `children` of the wrapped parser to only keep respectively the minimum and the maximum value and emit it as a single child:

```ts
peg.plugins.push({
  name: "my-plugin",
  directives: {
    min: parser => peg`${parser} ${() => Math.min(...$children())}`,
    max: parser => peg`${parser} ${() => Math.max(...$children())}`
  }
});
```

Testing it:

```ts
const max = peg`
  list: $int+ @max
  $int: \d+ @number
`;

max.value("36 12 42 3"); // 42
```

To remove a plugin, you can manipulate the `plugins` array just like any other array: `splice` it, or replace it entirely:

```ts
peg.plugins = peg.plugins.filter(({ name }) => name !== "my-plugin");
```
