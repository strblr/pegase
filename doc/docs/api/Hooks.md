Hooks are functions that can be called from semantic actions and visitor callbacks. They provide contextual information and actions.

| Hook        | Type                                                         | Availability               | Description                                                  |
| ----------- | ------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------ |
| `$from`     | `() => Location`                                             | Semantic actions, visitors | Returns the start location of the current match in the input (included) |
| `$to`       | `() => Location`                                             | Semantic actions, visitors | Returns the end location of the current match in the input (excluded) |
| `$children` | `() => any[]`                                                | Semantic actions           | Returns the `children` produced by the current match         |
| `$value`    | `() => any`                                                  | Semantic actions           | Returns the value (i.e. the single child) produced by the current match. This is `undefined` if there is no child, or multiple children. |
| `$raw`      | `() => string`                                               | Semantic actions, visitors | Returns the substring of the current match                   |
| `$options`  | `() => Options`                                              | Semantic actions, visitors | Returns the current parse options                            |
| `$context`  | `() => any`                                                  | Semantic actions, visitors | Returns the parse context. Shortcut for `$options().context`. |
| `$warn`     | `(message: string) => void`                                  | Semantic actions, visitors | Emits a warning at the current match's start location        |
| `$fail`     | `(message: string) => void`                                  | Semantic actions, visitors | Emits a semantic failure at the current match's start location. In semantic actions, this failure is only a *candidate* (see [Failures and warnings](/pegase/basic-concepts/Failures-and-warnings)). |
| `$expected` | <code>(expected: (string &vert; RegExp &vert; Expectation)[]) => void</code> | Semantic actions, visitors | Emits an expectation failure at the current match's start location. In semantic actions, this failure is only a *candidate* and might be thrown out or merged according to the farthest failure heuristic (see [Failures and warnings](/pegase/basic-concepts/Failures-and-warnings)). |
| `$commit`   | `() => void`                                                 | Semantic actions           | Flushes the current farthest failure to the final failure output (see [Error recovery](/pegase/advanced-concepts/Error-recovery/)) |
| `$emit`     | `(children: any[]) => void`                                  | Semantic actions           | Emits the given children.                                    |
| `$node`     | `(label: string, fields: Record<string, any>): Node`         | Semantic actions, visitors | Creates a `Node` with the given label and fields             |
| `$visit`    | `(node: Node, visitor?: Visitor, context?: any) => any`      | Visitors                   | Applies the current visitor (or `visitor` if the second argument is provided) to `node` and returns the result. A new context can be passed down. |
| `$parent`   | `() => Node | null`                                          | Visitors                   | Returns the `Node` from which the current visit was called from, or `null` if the current node is root |
