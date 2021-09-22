When writing complex grammars and not getting the expected behavior, it's not always clear what's going on. Pegase gives you a tool to debug your grammars: *tracers*.

**A tracer is a function that will be called when entering a non-terminal, successfully matching a non-terminal, or failing to match it.**

Tracing is configured via two parse options:

- `trace`, a boolean to activate or deactivate tracing. This option can be toggled only for specific sections of the grammar by using the `@trace` and `@notrace` standard directives. See [`defaultPlugin`](#defaultplugin).
- `tracer`, a function that takes a trace event (*enter*, *match*, or *fail*) as a single argument. A trace event is a simple object with contextual information. Please refer to [TypeScript types](#typescript-types) to see the precise signature of these objects. If `tracer` is omitted, a default tracer will be provided that will pretty-print the trace events to `console.log` automatically.

Let's illustrate that:

```ts
const g = peg`
  array: '[' (number | boolean) % ',' ']'
  $number: \d+
  $boolean: 'true' | 'false'
`;

g.parse("[12, true]", { trace: true });
```

This will produce the following `console.log` output:

```
Entered "array" at (1:1)
Entered "number" at (1:2)
Matched "number" from (1:2) to (1:4)
Entered "number" at (1:5)
Failed "number" at (1:5)
Entered "boolean" at (1:5)
Matched "boolean" from (1:6) to (1:10)
Matched "array" from (1:1) to (1:11)
```

If the default tracer doesn't suit your needs, pass a custom one to the `tracer` option. Here is an example of a custom tracer that redirects trace events to an `EventEmitter` in a node environment:

```ts
const emitter = new EventEmitter();

g.parse("[12, true]", {
  trace: true,
  tracer: event => emitter.emit("traced", event)
});
```
