# Pegase

![NPM](https://img.shields.io/npm/l/pegase?color=black&style=flat-square) ![npm](https://img.shields.io/npm/v/pegase?color=black&style=flat-square) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/pegase?color=black&label=gzip&logoColor=black&style=flat-square) ![npm](https://img.shields.io/npm/dw/pegase?color=black&style=flat-square)

<p align="center">  
  <img alt="pegase" src="https://strblr.github.io/pegase/assets/images/pegase.png">  
</p>

> ⚠️ This library is still under development. This is a pre-release but some functionalities might still change.

[Pegase](https://strblr.github.io/pegase/) is a PEG parser generator for JavaScript and TypeScript. It's:

- **_Inline_**, meaning grammars are directly expressed as [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates). No generation step, no CLI. Pegase works in symbiosis with JS.
- **_Fast_**. Pegase is heavily optimized to be extremely fast while providing an extensive range of features.
- **_Complete_**. Pegase has *everything* you will ever need: an elegant grammar syntax with lots of flexibility, semantic actions, parametrized rules, support for native regexps, error recovery, warnings, integrated AST generation and visitors, cut operator, back references, grammar merging, and [a lot more](/pegase/basic-concepts/Building-parsers/).
- **_Lightweight_**. Pegase is a _zero-dependency_ package, and weights around 9kB gzipped.
- **_Intuitive_**, in that it lets you express complex processes in very simple ways. You will never feel lost.
- **_Extensible_**: You can define your own `Parser` subclasses, add plugins, write custom directives, etc.

# [🔗 Go to the official website](https://strblr.github.io/pegase/)



## What Pegase has to offer:

### Concise, readable yet powerful parsers in symbiosis with JS

The following parses math expressions and calculates the result *on the fly*:

```js
import peg from "pegase";

function calc(left, op, right) {
  switch (op) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return left / right;
  }
}

const expr = peg`  
  expr: term % ("+" | "-") @infix(${calc})  
  term: fact % ("*" | "/") @infix(${calc})  
  fact: $integer | '(' expr ')'
  $integer @number: '-'? [0-9]+
`;
```

**`expr.value("2 + (17-2*30) *(-5)+2")`**

```json
219
```

**`expr.test("2* (4 + )/32")`**

```json
false
```

**`expr.parse("2* (4 + )/32").log()`**

```text
(1:9) Failure: Expected integer or "("

> 1 | 2* (4 + )/32
    |         ^
```

Read more in [Building parsers](https://strblr.github.io/pegase/basic-concepts/Building-parsers/) and [Semantic action and dataflow](https://strblr.github.io/pegase/basic-concepts/Semantic-action-and-dataflow/).

### Automatic whitespace skipping

```ts
const bitArray = peg`'[' (0 | 1) % ',' ']'`;

bitArray.test(" [ 0,1 ,0  ,  1, 1]  "); // true
```

With, obviously, the possibility to opt-out and do it yourself:

```ts
const g = peg`
  array: '[' _ '1' % ',' _ ']'
  _: \s+
`;

g.test("[1,1,1]", { skip: false }); // Opt-out as a one-off

// Or for all executions by default:

g.defaultOptions.skip = false;

g.test("[1,1,1]");      // false
g.test("[  1,1,1  ]");  // true
g.test("[  1, 1,1  ]"); // false
```

Read more in [Handling whitespaces](https://strblr.github.io/pegase/basic-concepts/Handling-whitespaces/).

### Great warning and failure reports

```ts
import peg, { $raw, $warn } from "pegase";

function isCap(str) {
  return /^[A-Z]/.test(str)
}

const g = peg`
  classDef:
    'class'
    ($identifier ${() => {
      if (!isCap($raw())) $warn("Class names should be capitalized");
    }})
    '{' '}'

  $identifier: [a-zA-Z]+
`;
```

**`g.parse("class test {").log()`**

```text
(1:7) Warning: Class names should be capitalized

> 1 | class test {
    |       ^

(1:13) Failure: Expected "}"

> 1 | class test {
    |             ^
```

Read more in [Failures and warnings](https://strblr.github.io/pegase/basic-concepts/Failures-and-warnings/).

### Parametrized rules

With the possibility of omitted parameters and default parameter values.

```ts 
const g = peg`
  root: array | array('a') | array('b' | 'c')
  array(item = \d): '[' commaList(item) ']'
  commaList(item): item % ','
`;

g.test("[ a, a, a, a]");   // true
g.test("[ a, 5, a, a]");   // false
g.test("[b, c]");          // true
g.test("[b, a]");          // false
g.test("[4, 5, 3, 9, 0]"); // true
```

### Report multiple failures with recovery

```ts
const g = peg`
  bitArray: '[' (bit | sync) % ',' ']'
  bit: 0 | 1
  sync: @@commit ...&(',' | ']')
`;
```

**`g.parse("[0, 4, 1, 2, 0, 1]").log()`**

```text
(1:5) Failure: Expected "0" or "1"

> 1 | [0, 4, 1, 2, 0, 1]
    |     ^

(1:11) Failure: Expected "0" or "1"

> 1 | [0, 4, 1, 2, 0, 1]
    |           ^
```

Read more in [Error recovery](https://strblr.github.io/pegase/advanced-concepts/Error-recovery/).

### Support for native `RegExp`

```ts
const time = /(\d+):(\d+)/;

const minutes = peg`
  ${time} ${() => {
    const [hr, min] = $children();
    return 60 * Number(hr) + Number(min);
  }}
`;

minutes.value("2:43"); // 163
```

Pegase also supports regex literals:

```ts
const minutes = peg`
  /(\d+):(\d+)/ ${() => {
    const [hr, min] = $children();
    return 60 * Number(hr) + Number(min);
  }}
`;
```

Named capturing groups are converted to Pegase captures:

```ts
const date = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const yearIs = peg`
  ${date} ${({ year }) => "The year is " + year}
`;

yearIs.value("2021-08-19"); // "The year is 2021"
```

Read more in [Working with RegExp](https://strblr.github.io/pegase/advanced-concepts/Working-with-RegExp/).

### Painless AST and visitors

```ts
const prefix = peg`
  expr:
  | <>$integer => 'INT'
  | '+' <a>expr <b>expr => 'PLUS'

  $integer @raw: \d+
`;

const sumVisitor = {
  INT: node => Number(node.$integer),
  PLUS: node => $visit(node.a) + $visit(node.b)
};

prefix.value("182", { visit: sumVisitor });         // 182
prefix.value("+ 12 + 42 3", { visit: sumVisitor }); // 57
```

Read more in [AST and visitors](https://strblr.github.io/pegase/advanced-concepts/AST-and-visitors/).

### Extensible functionalities

Here we define a directive `@max`

```ts
import peg, { $children } from "pegase";

peg.plugins.push({
  directives: {
    max: parser => peg`${parser} ${() => Math.max(...$children())}`
  }
});

const max = peg`
  list: $int+ @max
  $int: \d+ @number
`;

max.value("36 12 42 3"); // 42
```

Read more in [Writing a plugin](https://strblr.github.io/pegase/advanced-concepts/Writing-a-plugin/).

## And a lot more

There is so much more to see. To learn more about Pegase, [please go to the official website](https://strblr.github.io/pegase/).

