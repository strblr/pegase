When a `RegExp` instance is inserted into a peg expression via tag argument, it is converted into a regexp parser (an instance of `RegexParser`, a subclass of `Parser`). At invocation, the parsing is automatically delegated to `RegExp.prototype.exec`. On success, Pegase will then emit its *capturing groups* as `children`:

```js
const time = /(\d+):(\d+)/;

const minutes = peg`
  ${time} ${() => {
    const [hr, min] = $children();
    return 60 * Number(hr) + Number(min);
  }}
`;

minutes.value("2:43"); // 163
```

The `RegExp`'s [named capturing groups](https://github.com/tc39/proposal-regexp-named-groups) (when supported by your environment) are transformed into regular Pegase captures:

```js
const date = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const yearIs = peg`
  ${date} ${({ year }) => "The year is " + year}
`;

yearIs.value("2021-08-19"); // "The year is 2021"
```
