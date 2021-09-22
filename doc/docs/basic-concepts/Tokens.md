To understand the need for a token concept, let's take a look at a quick example. Let's try and write a grammar to match and extract a coma-separated integer list:

```js
const intList = peg`
  list: integer % ','
  integer @raw: \d+
`;
```

But this doesn't work. Indeed, as whitespace skipping happens before every `\d`, `\d+` can match any space-separated digit list. Thus, `"23 4, 45"` would be a valid input because `23 4` would be considered *one* integer:

```js
console.log(intList.children("23 4, 45")); // ["23 4", "45"]
```

You might intuitively want to disable skipping for the integer rule:

```js
const intList = peg`
  list: integer % ','
  integer @raw @noskip: \d+
`;
```

But this doesn't work either, because now you don't allow for whitespaces *before* integers. So a simple `"1 , 1"` would fail when it should not:

```js
console.log(intList.parse("1 , 1").logger.print());
```

```
(1:4) Failure: Expected /\d/

> 1 | 1 , 1
    |    ^
```

If you think about it, what we need is to skip whitespaces right **before** `integer` but not **inside** it. Something like `\d (\d* @noskip)` but without the repetitiveness. And that's exactly what a token parser does:

**A token parser wraps around a `Parser` and performs pre-skipping before invoking it. Skipping is then disabled inside.**

Essentially, the token parser avoids the need for explicit whitespaces in the grammar *and* for an external tokenizer by allowing you to treat any arbitrary peg expression *as if* it were a terminal. Let's try it out and see that it works as expected:

```js
const intList = peg`
  list: integer % ','
  integer @raw @token: \d+
`;

console.log(intList.parse("23 4, 45").logger.print());
```

```
(1:4) Failure: Expected "," or end of input

> 1 | 23 4, 45
    |    ^
```

**A token can be given a *display name* to improve failure logging.**

Tokens often have a lexeme semantic, meaning we want to label them with names and don't much care about their internal syntactical details. This is indeed what happens with external tokenizers. It can be done with Pegase by passing a string as an argument to the `@token` directive:

```js
const intList = peg`
  list: integer % ','
  integer @raw @token("fancy integer"): \d+
`;

console.log(intList.parse("12, ").logger.print());
```

```
(1:5) Failure: Expected fancy integer

> 1 | 12, 
    |     ^
```

**The `$id` shortcut**: The pattern that will appear the most is probably `fancyToken @token("fancy token")`, there will likely be some repetition between the rule name and the display name. That's why Pegase has a shortcut for it: by starting your rule name with a dollar sign, an implicit `@token` directive is added whose display name is inferred by transforming PascalCase, camelCase and snake_case rule names to space case:

```js
peg`$lowerCaseWord: [a-z]+`;
// is equivalent to
peg`lowerCaseWord @token("lower case word"): [a-z]+`;

peg`$two_digit_integer: \d{2}`;
// is equivalent to
peg`two_digit_integer @token("two digit integer"): \d{2}`;
```
