Class

| Property      | Type                                             | Description                                                  |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| *Constructor* | `new(input: string) => Logger`                   | Builds a new instance                                        |
| `warnings`    | `Warning[]`                                      | All emitted warnings                                         |
| `failures`    | `Failure[]`                                      | All emitted failures                                         |
| `pending`     | <code>Failure &vert; null</code>                 | The farthest failure candidate. This is updated at parse time according to the farthest failure heuristic. See [Failures and warnings](#failures-and-warnings). |
| `input`       | `string`                                         | The input string                                             |
| `indexes`     | `number[]`                                       | A index array for fast index to row / column conversion. This is automatically generated in the constructor. |
| `at`          | `(index: number) => Location`                    | Creates a `Location` object based on an absolute input index |
| `hasWarnings` | `() => boolean`                                  | Checks whether the logger has any warning                    |
| `hasFailures` | `() => boolean`                                  | Checks whether the logger has any failure                    |
| `warn`        | `(warning: Warning) => void`                     | Pushes the given warning to the logger's `warnings`          |
| `fail`        | `(failure: Failure) => void`                     | Pushes the given failure to the logger's `failures`          |
| `hang`        | `(failure: Failure) => void`                     | Compares the given failure to the logger's `pending` failure and merges / replaces / keeps it according to the farthest failure heuristic. See [Failures and warnings](#failures-and-warnings). |
| `commit`      | `() => void`                                     | Flushes the logger's `pending` failure (if any) to the `failures` array. This is used to implement [error recovery](#error-recovery). |
| `create`      | `() => Logger`                                   | Creates a new empty `Logger` instance on the same input without recalculating the `indexes` array. |
| `fork`        | `() => Logger`                                   | Creates a copy of the current logger                         |
| `sync`        | `(logger: Logger) => void`                       | Copies the given logger's `warnings`, `failures` and `pending` into the current logger |
| `print`       | `(options?: Partial<LogPrintOptions>) => string` | Creates a pretty-printed string of the current log events (`warnings` and `failures`) |
