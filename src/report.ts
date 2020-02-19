import { flatten, last } from "lodash";
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
        ...flatten(this.tracker.warnings),
        ...(this.failed ? last(this.tracker.failures)! : [])
      ];
    return this._logs;
  }
}
