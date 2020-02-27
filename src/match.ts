import {
  Internals,
  Options,
  SemanticAction,
  SemanticMatchReport
} from "./types";

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

    const arg = buildSemanticMatchReport(
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
 * function buildSemanticMatchReport
 *
 * Builds an object storing information that needs to be passed down to semantic actions.
 * This uses Object.defineProperties since Array-inheritance is forbidden in ES5.
 */

function buildSemanticMatchReport<TContext>(
  input: string,
  from: number,
  to: number,
  children: any[],
  options: Options<TContext>,
  internals: Internals<TContext>
): SemanticMatchReport<TContext> {
  return Object.defineProperties([...children], {
    input: {
      value: input
    },
    from: {
      value: from
    },
    to: {
      value: to
    },
    raw: {
      get: () => input.substring(from, to)
    },
    children: {
      value: children
    },
    context: {
      value: options.context
    },
    warn: {
      value: (message: string) =>
        options.diagnose &&
        internals.warnings.write({
          from,
          to,
          type: "SEMANTIC_WARNING",
          message
        })
    }
  });
}
