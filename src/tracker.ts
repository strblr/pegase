import { Parser } from "./parser";
import { Match } from "./match";
import { Failure, Warning } from "./types";

/**
 * class Tracker
 *
 * Tracks memoized results, warnings and failures during the parsing process.
 */

export class Tracker<TContext> {
  readonly cache: Map<Parser<any, TContext>, Match<any, TContext>>[];
  readonly warnings: Warning[];
  readonly failures: Failure[];

  constructor() {
    this.cache = [];
    this.warnings = [];
    this.failures = [];
  }

  readCache(
    cursor: number,
    parser: Parser<any, TContext>
  ): Match<any, TContext> | null {
    return (this.cache[cursor] && this.cache[cursor].get(parser)) || null;
  }

  writeCache(
    cursor: number,
    parser: Parser<any, TContext>,
    match: Match<any, TContext>
  ): void {
    if (!this.cache[cursor]) this.cache[cursor] = new Map();
    this.cache[cursor].set(parser, match);
  }

  writeWarning(warning: Warning): void {
    this.warnings.push(warning);
  }

  writeFailure(failure: Failure): void {
    if (this.failures.length === 0 || this.failures[0].to === failure.to)
      this.failures.push(failure);
    else if (this.failures[0].to < failure.to)
      this.failures.splice(0, this.failures.length, failure);
  }
}
