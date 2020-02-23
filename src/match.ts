import { Internals, Options, SemanticAction } from "./types";

/**
 * class Match
 *
 * Stores relevant information in case of a successful parsing match.
 */

export class Match<TValue, TContext> {
  readonly input: string;
  readonly from: number;
  readonly to: number;
  readonly children: any[];
  readonly value: TValue;

  constructor(
    input: string,
    from: number,
    to: number,
    matches: Match<any, TContext>[],
    action: SemanticAction<TValue, TContext> | null,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    this.input = input;
    this.from = from;
    this.to = to;
    this.children = [];
    this.value = undefined as any;

    const children = matches.reduce(
      (acc, match) => [
        ...acc,
        ...(match.value !== undefined ? [match.value] : match.children)
      ],
      [] as any[]
    );

    const arg = new SemanticMatchReport<TContext>(
      input,
      from,
      to,
      children,
      options,
      internals
    );

    if (action) this.value = action(arg, arg);
    else if (children.length === 1) this.value = children[0];
    else this.children = children;
  }

  get complete() {
    return this.to === this.input.length;
  }
}

/**
 * class SemanticMatchReport
 *
 * Stores information that needs to be passed down to semantic actions.
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
      options.diagnose &&
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
