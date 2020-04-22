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
    children: any[],
    action: SemanticAction<TContext> | null,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    this.input = input;
    this.from = from;
    this.to = to;
    this.value = undefined;
    this.children = [];

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
