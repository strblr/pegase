import { Options, SemanticAction } from "./types";

/**
 * class SuccessMatch
 *
 * Stores relevant information in case of a successful parsing.
 */

export class SuccessMatch<TValue, TContext> {
  readonly input: string;
  readonly from: number;
  readonly to: number;
  readonly children: any[];
  readonly value: TValue;

  constructor(
    input: string,
    from: number,
    to: number,
    matches: SuccessMatch<any, TContext>[],
    action: SemanticAction<TValue, TContext> | null,
    options: Options<TContext>
  ) {
    this.input = input;
    this.from = from;
    this.to = to;
    this.children = [];
    this.value = undefined as any;

    const children = matches.reduce(
      (acc, match) => [
        ...acc,
        ...(match.value === undefined ? match.children : [match.value])
      ],
      [] as any[]
    );

    if (action) this.value = action(this.raw, children, options.context, this);
    else if (children.length === 1) this.value = children[0];
    else this.children = children;
  }

  get raw(): string {
    return this.input.substring(this.from, this.to);
  }

  get complete(): boolean {
    return this.to === this.input.length;
  }
}
