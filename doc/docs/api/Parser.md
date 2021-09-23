#### `Parser<Value, Context>`

Class (abstract base)

| Property         | Type                                                         | Description                                                  |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `defaultOptions` | `Partial<Options<Context>>`                             | Default parsing options. These are merged to the ones provided when calling one of the following method. |
| `parse`          | `(input: string, options?: Partial<Options<Context>>) => Result<Value, Context>` | Parses `input` and builds a `Result` object                  |
| `test`           | `(input: string, options?: Partial<Options<Context>>) => boolean` | Wrapper around `parse`. Returns the `Result` object's `success` field. |
| `value`          | `(input: string, options?: Partial<Options<Context>>) => Value` | Wrapper around `parse`. Returns the `Result` object's `value` field in case of success. Throws an `Error` on failure. |
| `children`       | `(input: string, options?: Partial<Options<Context>>) => any[]` | Wrapper around `parse`. Returns the `Result` object's `children` field in case of success. Throws an `Error` on failure. |

All `Parser` **subclasses** share the following properties:

| Property | Type                                                         | Description                                                  |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `exec`   | <code>(options: Options&lt;Context&gt;) => Match &vert; null</code> | Invokes the parser. Returns a `Match` on success and `null` on failure. |

#### `LiteralParser`

Class (inherits from `Parser`)

| Property      | Type                                                    | Description                                                  |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| *Constructor* | `new(literal: string, emit?: boolean) => LiteralParser` | Builds a new instance                                        |
| `literal`     | `string`                                                | The literal to be matched when the parser is invoked         |
| `emit`        | `boolean`                                               | Whether the parser should emit the matched substring as a single child or not |

#### `RegexParser`

Class (inherits from `Parser`)

| Property      | Type                                  | Description                                     |
| ------------- | ------------------------------------- | ----------------------------------------------- |
| *Constructor* | `new(regex: RegExp) => RegexParser`   | Builds a new instance                           |
| `regex`       | `RegExp`                              | The original `RegExp` passed to the constructor |
| `cased`       | `RegExp`                              | The `RegExp` used for case-sensitive matching   |
| `uncased`     | `RegExp`                              | The `RegExp` used for case-insensitive matching |
