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
  readonly children: any[];
  readonly synthesized: boolean;
  readonly value: any;

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
    this.children = children;

    if (action) {
      this.synthesized = true;
      const arg = buildSemanticMatchReport(
        input,
        from,
        to,
        children,
        options,
        internals
      );
      this.value = action(arg, arg);
    } else if (children.length === 1) {
      this.synthesized = true;
      this.value = children[0];
    } else {
      this.synthesized = false;
      this.value = undefined;
    }
  }

  get raw() {
    return this.input.substring(this.from, this.to);
  }

  get complete() {
    return this.to === this.input.length;
  }
}
