import { Internals, Options } from "./types";

/**
 * class Tracker
 *
 * Tracks memoized results, warnings and failures during the parsing process.
 */

export class SemanticMatchReport<TContext> extends Array<any> {
  readonly input: string;
  readonly from: number;
  readonly to: number;
  readonly children: any[];
  readonly context: TContext;
  readonly warn: (message: string) => void;

  constructor(
    input: string,
    from: number,
    to: number,
    children: any[],
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    super(...children);
    this.input = input;
    this.from = from;
    this.to = to;
    this.children = children;
    this.context = options.context;
    this.warn = (message: string) =>
      internals.tracker.writeWarning({
        from,
        to,
        type: "SEMANTIC_WARNING",
        message
      });
  }

  get raw() {
    return this.input.substring(this.from, this.to);
  }
}

/**
 * class Tracker
 *
 * Tracks memoized results, warnings and failures during the parsing process.
 */

export class Match<TValue> {
  readonly input: string;
  readonly from: number;
  readonly to: number;
  readonly children: any[];
  readonly value: TValue;

  constructor(
    input: string,
    from: number,
    to: number,
    children: any[],
    value: TValue
  ) {
    this.input = input;
    this.from = from;
    this.to = to;
    this.children = children;
    this.value = value;
  }

  get complete() {
    return this.to === this.input.length;
  }
}
