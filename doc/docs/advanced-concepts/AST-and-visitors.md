---
hide:
  - toc
---

We saw in [Basic concepts > Semantic actions and dataflow](#semantic-actions-and-dataflow) that a parsing process can be represented as an invocation tree, called *concrete syntax tree*. This tree doesn't actually exist except temporarily in the JS call stack, thus semantic processes you want to fire at some "nodes" have to be executed at parse time. This is what semantic actions are for. You can do a lot with that, but it might not always be sufficient nor practical. For example, most real-life compilers do several traversals of the syntax tree, some dependent on the previous ones, with a clear separation of concerns. For the tree to be traversed multiple times, it has to be **generated** and **kept** in memory. You generally don't want to generate the whole concrete syntax tree which might have lots of parts only relevant to the syntax analysis but irrelevant in later stages. The actual tree you care about has custom nodes and is called *abstract syntax tree*.

**Pegase provides a clean and elegant way to generate ASTs: the `$node` hook.**

This hook can be called from semantic actions and has the following signature:

```ts
(label: string, fields: Record<string, any>) => Node
```

Given a label to distinguish between node types and some custom fields, it builds and returns a `Node` object with the following signature:

```ts
type Node = {
  $label: string;
  $from: Location;
  $to: Location;
  [field: string]: any;
}
```

The `$label` field and the custom fields simply correspond to `$node`'s arguments. The `$from` and `$to` keys are *automatically* set and indicate the boundaries of the match that produced the node.

**Nodes can then be emitted, propagated and captured during the parsing process just like any `children`.**

The specifics of how this happens is totally up to you (see [Basic concepts > Semantic actions and dataflow](#semantic-actions-and-dataflow)). Here is an example of a grammar generating an AST for sums written in prefix notation:

```ts
const prefix = peg`
  expr:
  | <>integer ${({ integer }) => $node("INT", { integer })}
  | '+' <a>expr <b>expr ${({ a, b }) => $node("PLUS", { a, b })}

  $integer @raw: \d+
`;

const ast = prefix.value("+ 12 + 42 3");
```

The resulting `ast` will look like this:

![AST](/pegase/assets/images/ast-1.png)

You may have noticed that the custom node fields are the captures. This is actually a very common practice and Pegase offers a shortcut for it: the standard `@node` directive. This directive takes the node label as an argument, and automatically emits a `Node` whose custom fields *are* the captures. In other words, the following is *strictly equivalent* to the previous example:

```ts
const prefix = peg`
  expr:
  | <>integer @node('INT')
  | '+' <a>expr <b>expr @node('PLUS')

  $integer @raw: \d+
`;
```

But it gets even better. Just like `$` rules are syntactic sugar for `@token` rules, the `=>` operator is syntactic sugar for `@node`:

```ts
const prefix = peg`
  expr:
  | <>integer => 'INT'
  | '+' <a>expr <b>expr => 'PLUS'

  $integer @raw: \d+
`;
```

What if you still want to tweak some fields before setting up the `Node` ? Well, the `@node` directive can take as a second argument a function that maps the captures to custom fields. These fields will be merged to the existing captures and the result will be set as the `Node`'s custom fields. It gives you the flexibility of an explicit call to the `$node` hook, with the brevity and expressivity of the directive.

To illustrate that, let's parse complex numbers written in the form *"a + bi"*. The imaginary part is optional, so the `i` capture may be `undefined`. If that's indeed the case, we want our `i` node field to default to zero:

```ts
const complex = peg`
  complex:
    <r>num <i>('+' num 'i')?
      @node('COMPLEX', ${({ i }) => ({ i: i || 0 })})

  $num @number: \d+
`;

complex.value("13+6i"); // { $label: "COMPLEX", $match: (...), r: 13, i: 6 }
complex.value("42");    // { $label: "COMPLEX", $match: (...), r: 42, i: 0 }
```

Once an AST is generated, the next step is obviously to implement traversal procedures. The possibilities are nearly infinite: performing semantic checks (like type checks), fine-tuning a syntactic analysis, mutating the tree (like [Babel plugins](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md)), folding the tree to some output value, etc. To implement traversals of ASTs, Pegase ships with its own [visitor pattern](#https://en.wikipedia.org/wiki/Visitor_pattern#Use_case_example).

**A Pegase visitor is an object whose keys are node labels and whose values are callbacks taking a `Node` as single argument:**

```ts
type Visitor = {
  [label: string]: (node: Node) => any
}
```

The *result* of a visitor for a given node `n` is the return value of the callback associated with the label of `n`. Visitors are directly passed via the `visit` option to a parser's `parse`, `test`, `value` or `children` method, either as a single visitor or as an array of visitors forming a visitor pipe.

**After the parsing is done, the final `children` array will be mapped through the visitor pipe.**

Every `children` item will individually be sent down the visitor pipe. Each visitor feeds its result to next one. The result of the final visitor will replace the initial child. This mechanism implies two things:

- `children` never changes size as a result of visits, it's just a one-to-one mapping. Thus parsers who produce a `value` (ie. a single child) keep producing a `value` no matter how many visitors you stack. The final `value` will be the result of the visitor pipe applied to the initial `value`.
- Only the last visitor can return a non-`Node` result, since each visitor has to be fed with a `Node` value.

![AST](/pegase/assets/images/ast-2.png)

Let's build a simple visitor that transforms the output `Node` of our previous `prefix` grammar into its label:

```ts
const prefix = peg`
  expr:
  | <>integer => 'INT'
  | '+' <a>expr <b>expr => 'PLUS'

  $integer @raw: \d+
`;

const labelVisitor = {
  INT: node => node.$label,
  PLUS: node => node.$label
};

prefix.value("182", { visit: labelVisitor });         // "INT"
prefix.value("+ 12 + 42 3", { visit: labelVisitor }); // "PLUS"
```

As you might have spotted, the `INT` and `PLUS` callbacks are exactly the same. You can replace them with a simple default case callback by using the `$default` key. This callback will be called when no other visitor key matches the current node label.

```ts
const labelVisitor = {
  $default: node => node.$label
};
```

Let's dive a bit deeper: how would you implement a visitor that calculates the sum's result ? Calculating a sum from an AST means [*folding*](https://en.wikipedia.org/wiki/Fold_(higher-order_function)) the AST into a single value, which implies recursive visits to child nodes. That's exactly what the `$visit` hook is for: called from *inside* a visitor callback and given a node, it applies the current visitor to that node and returns the result. Our sum visitor could be implemented as follows:

```ts
const sumVisitor = {
  INT: node => Number(node.integer),
  PLUS: node => $visit(node.a) + $visit(node.b)
};

prefix.value("182", { visit: sumVisitor });         // 182
prefix.value("+ 12 + 42 3", { visit: sumVisitor }); // 57
```

Next, to illustrate visitor piping, we're going to add a visitor right before `sumVisitor` that preserves the AST but *doubles* the `integer` value of `INT` nodes. This basically implies that each visitor callback will have to be an identity function, returning the node it was passed and only performing side-effects. For `INT` nodes, the side-effect is to double the value. For `PLUS` nodes, it's to visit the child nodes. Giving us:

```ts
const doubleVisitor = {
  INT: node => {
    node.integer *= 2;
    return node;
  },
  PLUS: node => {
    $visit(node.a);
    $visit(node.b);
    return node;
  }
};

prefix.value("182", { visit: [doubleVisitor, sumVisitor] });         // 364
prefix.value("+ 12 + 42 3", { visit: [doubleVisitor, sumVisitor] }); // 114
```

You get the idea. Have fun !

**A visitor callback has access to all the hooks available in semantic actions**, except `$children`, `$value`, `$commit` and `$emit`. So it's totally fine to emit warnings and failures from visitors:

```ts
const sumVisitor = {
  INT: node => {
    if (node.integer === "42") $warn("42 is too powerful");
    return Number(node.integer);
  },
  PLUS: node => $visit(node.a) + $visit(node.b)
};
```

#### > `prefix.parse("+ 12 + 42 3", { visit: sumVisitor }).logger.toString()`

```
(1:8) Warning: 42 is too powerful

> 1 | + 12 + 42 3
    |        ^
```

The effect of some hooks differs when used in a semantic action vs. a visitor. In semantic actions, `$fail` and `$expected` don't commit failures, they emit failure *candidates* which are then merged or filtered out using the farthest failure heuristic (see [Basic concepts > Failures and warnings](#failures-and-warnings)). In visitors, these hooks commit failures directly. The heuristic wouldn't make much sense outside of a backtracking syntactic analysis. Please refer to [API > Hooks](#hooks) for an exhaustive doc of all hooks.
