import { Internals, Options } from "../parser";
import { buildSemanticMatchReport } from ".";

export type SemanticMatchReport<TContext> = Array<any> &
  Readonly<{
    input: string;
    from: number;
    to: number;
    raw: string;
    stack: Array<string>;
    children: Array<any>;
    context: TContext;
    warn(message: string): void;
    fail(message: string): never;
    archive(): void;
    propagate(): void;
  }>;

export type SemanticAction<TContext> = (
  semanticReport: SemanticMatchReport<TContext>,
  ...children: Array<any>
) => any;

/**
 * class Match
 *
 * Stores relevant information in case of a successful parsing.
 */

export class Match<TContext> {
  readonly input: string;
  readonly from: number;
  readonly to: number;
  readonly children: Array<any>;
  readonly synthesized: boolean;
  readonly value: any;

  constructor(
    input: string,
    from: number,
    to: number,
    children: Array<any>,
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
      this.value = action(
        buildSemanticMatchReport(
          input,
          from,
          to,
          this,
          children,
          options,
          internals
        ),
        ...children
      );
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
