---
title: peg, createTag
---

#### `peg`

Function (template tag)

| Property                | Type                                                         | Description                                                  |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| *Call via template tag* | `<Value, Context>(chunks: TemplateStringsArray, ...args: any[]) => Parser<Value, Context>` | Generates a `Parser` instance based on a peg expression      |
| `trace`                 | `boolean`                                                    | Activates tracing during peg expression parsing (called *meta-parsing*) |
| `plugins`               | `Plugin[]`                                                   | The list of plugins attached to the tag (order matters: in case of conflicts, the first plugin wins). Can be mutated or replaced. |

#### `createTag`

Function

| Property | Type               | Description                                                  |
| -------- | ------------------ | ------------------------------------------------------------ |
| *Call*   | `() => typeof peg` | Generates a new peg-like tag. This is useful is you need different <code>peg</code> tags with different plugins at the same time. |
