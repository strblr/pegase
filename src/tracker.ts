import { Parser } from "./parser";
import { Match } from "./match";
import { Failure, Warning } from "./types";

/**
 * class FailureTracker
 *
 * Tracks failures during the parsing process.
 */

export class FailureTracker {
  readonly failures: Failure[] = [];

  write(failure: Failure) {
    if (this.failures.length === 0 || this.failures[0].to === failure.to)
      this.failures.push(failure);
    else if (this.failures[0].to < failure.to)
      this.failures.splice(0, this.failures.length, failure);
  }
}

/**
 * class WarningTracker
 *
 * Tracks warnings during the parsing process.
 */

export class WarningTracker {
  readonly warnings: Warning[] = [];

  write(warning: Warning) {
    this.warnings.push(warning);
  }
}

/**
 * class Cache
 *
 * Tracks memoized results during the parsing process.
 */

export class Cache<TContext> {
  readonly cache: Map<Parser<any, TContext>, Match<any, TContext>>[] = [];

  read(cursor: number, parser: Parser<any, TContext>) {
    return (this.cache[cursor] && this.cache[cursor].get(parser)) || null;
  }

  write(
    cursor: number,
    parser: Parser<any, TContext>,
    match: Match<any, TContext>
  ) {
    if (!this.cache[cursor]) this.cache[cursor] = new Map();
    this.cache[cursor].set(parser, match);
  }
}
