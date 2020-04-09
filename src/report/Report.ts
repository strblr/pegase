import lineColumn from "line-column";
import { Failure, Internals, Warning } from "../internals";
import { Options } from "../parser";
import { Match } from "../match";

/**
 * class Report
 *
 * Stores a recap of a parsing.
 */

export class Report<TContext> {
  readonly input: string;
  readonly match: Match<TContext> | null;
  private readonly options: Options<TContext>;
  private readonly internals: Internals<TContext>;
  private _logs?: (Failure | Warning)[];
  private _humanizedLogs?: string;

  constructor(
    input: string,
    match: Match<TContext> | null,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    this.input = input;
    this.match = match;
    this.options = options;
    this.internals = internals;
  }

  get succeeded() {
    return this.match !== null;
  }

  get failed() {
    return this.match === null;
  }

  get logs() {
    if (!this._logs)
      this._logs = [
        ...this.internals.warnings.read(),
        ...(this.failed ? this.internals.failures.read() : [])
      ];
    return this._logs;
  }

  get humanLogs() {
    if (this._humanizedLogs !== undefined) return this._humanizedLogs;

    const reader = lineColumn(this.input);

    const breakInput = (from: number, to: number) =>
      this.input.substring(from, to).replace("\n", "\\n");

    const highlight = (info: string, from: number, to: number) => {
      const before = breakInput(from - 10, from);
      const inner = breakInput(from, to);
      const after = breakInput(to, to + 10);
      const { line, col } = reader.fromIndex(from)!;
      const pointer = `${" ".repeat(before.length)}${"^".repeat(
        inner.length || 1
      )}`;
      return `Line ${line}:${col}: ${info}\n${before}${inner}${after}\n${pointer}`;
    };

    this._humanizedLogs = this.logs
      .map(log => {
        let info = "";
        switch (log.type) {
          case "SEMANTIC_WARNING":
          case "SEMANTIC_FAILURE":
            info = log.message;
            break;
          case "TERMINAL_FAILURE":
            info =
              log.terminal === "LITERAL"
                ? `Expected literal "${log.literal}"`
                : log.terminal === "REGEX"
                ? `Expected match with ${log.pattern.toString()}`
                : log.terminal === "BOUND"
                ? `Expected ${log.bound === "START" ? "start" : "end"} of input`
                : "";
            break;
          case "TOKEN_FAILURE":
            info = `Expected token <${log.identity || "anonymous"}>`;
            break;
          case "PREDICATE_FAILURE":
            info = `Predicate failed (should ${
              log.polarity ? "" : "not "
            }have matched)`;
        }
        return highlight(info, log.from, log.to);
      })
      .join("\n");

    return this._humanizedLogs;
  }
}
