**The `peg` tag accepts any valid Pegase expression and always returns a `Parser` instance.**

Pegase parsers follow the *combinator* paradigm: simple parsers are combined to form more complex parsers. You can read more about it in the [`Parser`](/pegase/api/Parser/) section. In the following sections are the different expressions you can use as building blocks. To see the exact grammar of pegs (called metagrammar), please refer to the [Metagrammar](/pegase/api/Metagrammar/) page.

---

### Any character

```text
.
```

Matches any character.

**Children**: `[]`

**Precedence**: 0

---

### End of input

```text
$
```

Matches the end of the input. This expression is syntactic sugar for `!. @token("end of input")`. Indeed, the end of the input has been reached when there's no character left, thus when "not any character" (`!.`) can be evaluated as true.

**Children**: `[]`

**Precedence**: 0

---

### Epsilon

```text
ε
```

Matches the empty string. Strictly equivalent to `''` and always a success.

**Children**: `[]`

**Precedence**: 0

---

### Cut operator

```text
^
```

In an ordered choice expression, the cut operator commits to the current alternative to prevent exploring any further in case it fails. Example : `'x' ^ a | b` will **not** try `b` if `'x'` was found but `a` failed. Although it's called an *operator*, it's really a `Parser` on its own. Used outside an ordered choice expression, it's a no-op. Read more in [Cut operator](https://ostrebler.github.io/pegase/advanced-concepts/Cut-operator/).

**Children**: `[]`

**Precedence**: 0

---

### Sub-parsers

```text
(expr)
('a' 'b' 'c')
${jsParser}
```

Delegates the parsing to a sub-parser. This happens when wrapping a peg expression in parentheses, or by injecting an external `Parser` instance via tag argument.

**Children**: Forwarded from the sub-parser.

**Precedence**: 0

---

### Back references

```text
>id<
```

Back reference to an earlier string capture. This will matches the string literal captured as `id`. Read more in [Semantic action and dataflow](https://ostrebler.github.io/pegase/basic-concepts/Semantic-action-and-dataflow/).

**Children**: `[]`

**Precedence**: 0

---

### Nullary directives

```text
@@dir
@@dir(x, y)
@${jsFunction}
@ => 'label'
```

This is syntactic sugar for directives applied to the empty literal parser: `'' @dir`, `'' ${jsFunction}`, etc. Handy if the directive you want to invoke doesn't care about a wrapped parser. Read more in [Directives](https://ostrebler.github.io/pegase/basic-concepts/Directives/).

**Children**: Directives generate new parsers. So `children` depends on whatever parser is generated.

**Precedence**: 0

---

### Non-terminals

```text
identifier
identifier('a', 'c' | 'd')
identifier('a',, 'd')
```

Matches the non-terminal. A non-terminal can refer to a *grammar rule* or to a *rule parameter*. Since rules can be parametrized, non-terminals can have parameters. Parameters can be omitted at any place if the corresponding rule defines a default value for them.

**Children**: Forwarded from the non-terminal (`identifier` in the example)

**Precedence**: 0

---

### String literals

```text
"lit"
'test'
''
${jsString}
42
${jsNumber}
```

Matches the string literal. When a JS string value is inserted as a tag argument into the a peg expression, it's cast into a non-emissive string literal parser. String literals that represent numbers can directly be written as numbers, without quotes. Inserting a JS number via tag argument also creates a string literal parser.

**Children**: When double-quotes are used, the parsed substring is emitted as a single child. `[]` otherwise.

**Precedence**: 0

---

### Character classes

```text
[abc]
[0-9]
[a-zA-Z]
[^u]
[^a-zA-Z]
```

There are two types of character classes: non-negated and negated (`^`). Non-negated classes match one character in the given character class. Negated classes match one character **not** in the given class. Internally, characters classes are instantiated as `RegExp` instances and thus end up as regex parsers.

**Children**: `[]`

**Precedence**: 0

---

### Metacharacters

```text
\n
\s
\w
\xAF
\uA6F1
```

Matches the escaped metacharacter. The same metacharacters available in `RegExp` expressions are available in Pegase, meaning `\s` matches any whitespace, `\S` any non-whitespace, `\uA6F1` matches the unicode character `A6F1`, etc. ([See `RegExp` documentation](https://www.w3schools.com/jsref/jsref_obj_regexp.asp) for a complete list of supported metacharacters).

**Children**: `[]`

**Precedence**: 0

---

### Regex literals

```text
/ab/
/\w+/
/(\d+):(\d+)/
${jsRegExp}
```

Matches the regex. It can either be a regex literal (same syntax as JS' `RegExp`), or an actual `RegExp` instance injected as tag argument.

**Children**: The regex's capturing groups

**Precedence**: 0

---

### Repetitions

```text
a?
a+
a*
a{4}
a{4, 15}
a{4,}
a{${jsNumber}, 15}
```

Invokes a sub-parser (`a`) **greedily** as many times as specified. Different kind of quantifiers are available:

| Expression form | Meaning                                                      |
| --------------- | ------------------------------------------------------------ |
| `a?`            | Optional `a` (zero or one)                                   |
| `a+`            | Matches one or more `a`                                      |
| `a*`            | Matches any sequence of `a` (zero or more)                   |
| `a{n}`          | Matches `a` exactly `n` times. `n` can be a number literal or a JS number injected via tag argument. |
| `a{n, m}`       | Matches `a` between `n` and `m` times. Number literals and tag arguments are allowed for `n` and `m`. |
| `a{n,}`         | Matches `a` at least `n` times. As above, `n` is a number literal or a tag argument. |

**Children**: Forwarded and concatenated from the wrapped expression

**Precedence**: 1

---

### Predicates

```text
&a
!a
```

In case of a positive predicate (`$`), `a` is matched without consuming any input. For negative predicates (`!`), the expression fails if `a` succeeds and vice-versa.

**Children**: `[]`

**Precedence**: 2

---

### Captures

```text
<id>a
<>id
<...id>a
<...>id
```

Captures associate a parser's `value` or `children` to an identifier (`id` in the example). To captures the `children` array, use `...`. When the wrapped expression is a non-terminal of the same name than the capture, the capture's name can be omitted.

Captures are accumulated in *scopes*, can be overwritten and be read in semantic actions and custom parsers. Rule definitions and ordered choice alternatives create new capture scopes. Read more in [Semantic action and dataflow](https://ostrebler.github.io/pegase/basic-concepts/Semantic-action-and-dataflow/).

**Children**: Forwarded from the wrapped expression

**Precedence**: 3

---

### Synchronizations

```text
...a
```

Skips input character by character until `a` is matched. This can be used to implement *synchronization* to recover from errors and is equivalent to `(!a .)* a`. Write `...&a` if you want to sync to `a` without consuming `a`. See [Failure recovery](https://ostrebler.github.io/pegase/basic-concepts/Building-parsers/#failure-recovery).

**Children**: Forwarded from the wrapped expression

**Precedence**: 4

---

### Repetitions with separators

```text
a % b
a %? b
a %{3} b
a %{3,} b
a %{3, ${jsNumber}} b
```

Matches a sequence of `a` separated by `b`. The `%` operator can be quantified explicitly using the quantifiers described in [Repetitions](#repetitions). `a % b` is equivalent to `a (b a)*`, `a %? b` to `a (b a)?`, etc.

**Children**: Forwarded and concatenated from the subexpressions

**Precedence**: 5

---

### Subtractions

```text
a - b
```

Matches `a` but not `b` (fails if `b` succeeds). Strictly equivalent to `!b a`.

**Children**: Forwarded from expression `a`

**Precedence**: 6

---

### Sequences

```text
a b
a b c
```

Matches `a` followed by `b`.

**Children**: Forwarded and concatenated from expression `a` and `b`

**Precedence**: 7

---

### Directives (includes semantic actions)

```text
a @dir
a @dir(x, y)
a @dir(x, ${y})
a @dir @other

a ${jsFunction}
a => 'label'
```

Applies the directive(s) to the parser `a`. Directives are functions that take a parser and return a new parser. They can take additional arguments and can be chained. These arguments can include number, string, regex literals, characters classes, metacharacters, non-terminals and tag arguments.

Injecting a JS function right after a peg expression is syntactic sugar for the `@action` directive, which builds an action parser (a parser that calls a custom function on success). So `a ${jsFunction}` and `a @action(${jsFunction})` are strictly equivalent.

The `a => 'label'` syntax is syntactic sugar for the `@node` directive and is equivalent to `a @node('label')`. The label can be specified via a string tag argument if necessary.

Directives are a powerful and central tool within Pegase. Read more about it in [Directives](/pegase/basic-concepts/Directives/).

**Children**: Directives generate new parsers. So `children` depends on whatever parser is generated. When using the `@action` shorthand (`a ${jsFunction}`), one can emit a single child by returning a non-`undefined` value from the function, or emit multiple children by calling [the `$emit` hook](/pegase/api/Hooks/) inside the function. Not returning anything and not calling `$emit` will forward the wrapped expression's `children`. When using the `@node` shorthand (`a => 'label'`), the generated `Node` is emitted as a single child (see [AST and visitors](/pegase/advanced-concepts/AST-and-visitors/)).

**Precedence**: 8

---

### Ordered choices

```text
a | b
| a | b | c
```

Ordered choices (or *alternatives*) try their subexpression one by one in order and succeed if a subexpression succeeds. Fails otherwise. Please note that you can add a leading bar for aesthetic purposes.

**Children**: Forwarded from the successful subexpression (`a` or `b` in the example)

**Precedence**: 9

---

### Rules and grammars

```text
id: a
$id: a
id @directive: a
id(p1, p2): a
id(p1, p2) @directive: a
id(p = \d): a
id(p1, p2 = 'a', p3): a
```

These expressions create rules. Think of rules as alias to peg expressions. Once defined, they can be invoked via non-terminals (see [Non-terminals](#non-terminals)). Rules can be stacked to form **grammars**. They can also be parametrized and the parameters can take default values. Since non-terminal invocations can skip any parameter, default parameters values don't need to appear at the last parameter positions.

If directives are specified just before `:`, they are applied to the whole right-side expression.

Adding `$` at the beginning of a rule name acts as syntactic sugar. It applies an implicit `@token` directive whose display name in failure reports will be the rule name transformed to space case. Example: `$myToken: a` is equivalent to `$myToken @token("my token"): a`.

Grammars can be nested by using [parentheses](#sub-parsers):

```text
r1: 'a' (
  nested1: 'u' nested2
  nested2: 'v'
) r2
r2: 'b'
```

Nesting grammars can be used to parametrize entire grammars, or as a separation of concern method.

**Children**: Forwarded from the topmost rule

**Precedence**: 10

