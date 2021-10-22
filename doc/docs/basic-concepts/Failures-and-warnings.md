Producing accurate error messages is notoriously difficult when it comes to PEG parsing. That's because when an input error triggers a parse failure, the parser *backtracks* to all the parent alternatives, tries them out, **fails repetitively**, before ultimately exiting with an error. Thus, failures are being emitted way after the one that's relevant. So which one should be displayed ? You also can't just short-exit on the first failure you encounter, since that would prohibit any backtracking and defeat the purpose of PEGs.

**Because of PEG's backtracking nature, a parse failure isn't necessarily an input *error*.**

This is well explained in [this paper](http://scg.unibe.ch/archive/masters/Ruef16a.pdf) for those who want to dive deeper into the subject matter. Other parsing algorithms like `LL` or `LALR` don't suffer from this problem but are also more difficult to implement and more restrictive in the type of parsing expressions they allow. Fortunately for us, there exists a way out of this. As we've just established, the main problem is to be able to "rank" failures and "guess" which ones are more relevant. By the very design of PEGs, this can never be an exact science and one has to use an approximative method, called **heuristic**, to produce good enough results.

**Pegase implements the *farthest failure heuristic*, which considers the farthest failure(s) in terms of input position to be the most relevant.**

The general idea is that a failure emitted at input position *n* will generally be more relevant than a failure emitted at position *n - x*, where *x* is a positive integer, because *x* more characters have been successfully recognized by the parser at that point.

Failures and warnings (called *log events*) are tracked at parse time. `warnings` and `failures` are then attached to the parse result as arrays, whether the match fails or succeeds (a successful match can produce failures, see [Advanced concepts > Error recovery](/pegase/advanced-concepts/Error-recovery/)).

**In Pegase, there are two types of failures**:

- **Expectation failures**

These are automatically emitted when a literal, a regexp or a token mismatched, or if a portion of the input matched where it should not have (cf. *negative predicates* (`!a`)).

```js
const g = peg`'a' ('b' | 'c' | 'd' @token("the awesome letter d") | ![b-e] .)`;
```

**`g.parse('ae').logger.toString()`**

```
(1:2) Failure: Expected "b", "c", the awesome letter d or mismatch of "e"

> 1 | ae
    |  ^
```

You can also manually emit them in semantic actions using the `$expected` hook (please note that this will override any failure emitted from *inside* the peg expression the action is wrapped around):

```js
const g = peg`'a' ('b' | . ${() => {
  if (!["c", "d"].includes($raw())) $expected(["c", "d"]);
}})`;
```

**`g.parse("ae").logger.toString()`**

```
(1:2) Failure: Expected "b", "c" or "d"

> 1 | ae
    |  ^
```

- **Semantic failures**

These are emitted by calling the `$fail` hook from a semantic action. They're useful when dealing with errors that can *not* be expressed as missing terminals, like undeclared identifiers, type errors, `break` statements outside of loops, etc. Such errors will also override any failure emitted from *inside* the peg expression the action is wrapped around. They don't terminate the parser directly either and can thus act as backtracking instructions.

```js
const g = peg`[a-z]+ ${() => {
  const val = $context().get($raw());
  if (!val) $fail(`Undeclared identifier "${$raw()}"`);
  else return val;
}}`;

const context = new Map([["foo", 42], ["bar", 18]]);
```

**`g.value("foo", { context })`**

```js
42
```

**`g.parse("baz", { context }).logger.toString()`**

```
(1:1) Failure: Undeclared identifier "baz"

> 1 | baz
    | ^
```

If there are *several* failures at the farthest position *n*, they are folded into one with the following logic:

- If they're only expectation failures, the expectations are *merged* as illustrated above.
- If there is a semantic failure, it will override all other failures. In case of multiple semantic failures at the same position, the last one will win.

If you want to identify multiple input errors at once, you have to do *error recovery*. This is done using failure commits and synchronization expressions (`...a`). See [Advanced concepts > Error recovery](/pegase/advanced-concepts/Error-recovery/) for more info.

**Warnings can be emitted in semantic actions using the `$warn` hook**. They are collected in a side-effect manner and don't influence the parsing process:

```js
const p = peg`
  declaration:
    'class'
    (identifier ${() => {
      if (!/^[A-Z]/.test($raw()))
        $warn("Class names should be capitalized");
    }})
    '{' '}'
    
  $identifier: [a-zA-Z]+
`;
```

**`p.parse("class test {").logger.toString()`**

```
(1:7) Warning: Class names should be capitalized

> 1 | class test {
    |       ^

(1:13) Failure: Expected "}"

> 1 | class test {
    |             ^
```

- If you want to do more elaborated stuff than to simply pretty-print the logs, like processing them programmatically, you have direct access using the `warnings` and `failures` properties on the result object. These are just arrays of objects describing the log events. Please see [API > `Parser`](/pegase/api/Parser/) for more details.
- Warnings and failures can also be emitted during AST visits. See [Advanced concepts > AST and visitors](/pegase/advanced-concepts/AST-and-visitors/).
