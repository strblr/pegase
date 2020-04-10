import { Internals } from "../internals";
import { Options } from "../parser";
import { buildSemanticMatchReport, SemanticAction } from ".";

/**
 * class Match
 *
 * Stores relevant information in case of a successful parsing.
 */

export class Match<TContext> {
  readonly input: string;
  readonly from: number;
  readonly to: number;
  readonly value: any;
  readonly children: any[];

  constructor(
    input: string,
    from: number,
    to: number,
    matches: Match<TContext>[],
    action: SemanticAction<TContext> | null,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    this.input = input;
    this.from = from;
    this.to = to;
    this.value = undefined;
    this.children = [];

    const children = matches.reduce<any[]>(
      (acc, match) => [
        ...acc,
        ...(match.value !== undefined ? [match.value] : match.children)
      ],
      []
    );

    if (action) {
      const arg = buildSemanticMatchReport(
        input,
        from,
        to,
        children,
        options,
        internals
      );
      this.value = action(arg, arg);
    } else if (children.length === 1) this.value = children[0];
    else this.children = children;
  }

  get raw() {
    return this.input.substring(this.from, this.to);
  }

  get complete() {
    return this.to === this.input.length;
  }
}
