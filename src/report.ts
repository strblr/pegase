import { Tracker } from "./tracker";
import { Match } from "./match";
import { Failure, Options, Warning } from "./types";

/**
 * class Report
 *
 * Stores a recap of a parsing.
 */

export class Report<TValue, TContext> {
  readonly input: string;
  readonly match: Match<TValue, TContext> | null;
  readonly options: Options<TContext>;
  readonly tracker: Tracker<TContext>;
  private _logs?: (Failure | Warning)[];
  private _humanizedLogs?: string;

  constructor(
    input: string,
    match: Match<TValue, TContext> | null,
    options: Options<TContext>,
    tracker: Tracker<TContext>
  ) {
    this.input = input;
    this.match = match;
    this.options = options;
    this.tracker = tracker;
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
        ...this.tracker.warnings,
        ...(this.failed ? this.tracker.failures : [])
      ];
    return this._logs;
  }

  get humanLogs() {
    if (this._humanizedLogs !== undefined) return this._humanizedLogs;
    const lines = this.input.split("\n");

    const breakInput = (from: number, to: number) =>
      this.input.substring(from, to).replace("\n", "\\n");

    const cursorToLine = (pos: number): [number, number] => {
      for (let line = 0, acc = 0; line !== lines.length; ++line) {
        const length = lines[line].length + 1;
        if (acc + length > pos) return [line + 1, pos - acc + 1];
        else acc += length;
      }
      throw new Error("Falls outside");
    };

    const highlight = (info: string, from: number, to: number) => {
      const before = breakInput(from - 10, from);
      const inner = breakInput(from, to);
      const after = breakInput(to, to + 10);
      return `Line ${cursorToLine(from).join(
        ":"
      )}: ${info}\n${before}${inner}${after}\n${" ".repeat(
        before.length
      )}${"^".repeat(inner.length || 1)}`;
    };

    this._humanizedLogs = this.logs
      .map(log => highlight(log.type, log.from, log.to))
      .join("\n");

    return this._humanizedLogs;
  }
}
