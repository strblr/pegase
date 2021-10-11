Pegase was coded in TypeScript and ships with its own type declarations. The types of *all* entities, from semantic actions to failure objects, result objects, directives, plugins, etc. can directly be imported from `pegase`. For a list of all available types, please refer to [API > Types](/pegase/api/Types). Furthermore, the `peg` tag accepts two optional generics: the first one types the *value* of the resulting parser, the second types the context option.

```ts
import peg, { $context, $raw, $fail } from "pegase";

type Context = Map<string, number>;

const g = peg<number, Context>`
  [a-z]+ ${() => {
    const val = $context().get($raw());
    if (!val) $fail(`Undeclared identifier "${$raw()}"`);
    else return val;
  }}
`;

// g is of type Parser<number, Context>
```
