import { isEqual, uniqWith } from "lodash";
import { Failure, NonEmptyArray, Options, SemanticAction } from "./types";

/**
 * class Match
 *
 * Base class embodying a parsing result.
 */

export abstract class Match {
  readonly input: string;

  protected constructor(input: string) {
    this.input = input;
  }

  get succeeded(): boolean {
    return this instanceof SuccessMatch;
  }

  get failed(): boolean {
    return this instanceof MatchFail;
  }
}

/**
 * class SuccessMatch
 *
 * Stores relevant information in case of a successful parsing.
 */

export class SuccessMatch<TValue, TContext> extends Match {
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
    super(input);
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

    if (action)
      try {
        this.value = action(this.raw, children, options.context, this);
      } catch (error) {
        if (error instanceof Error)
          return new MatchFail(input, [
            {
              at: from,
              type: "SEMANTIC_FAIL",
              message: error.message
            }
          ]) as any;
        throw error;
      }
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

/**
 * class MatchFail
 *
 * Stores relevant information in case of a unsuccessful parsing.
 */

export class MatchFail extends Match {
  static merge(fails: NonEmptyArray<MatchFail>): MatchFail {
    return new MatchFail(
      fails[0].input,
      fails.reduce((acc, fail) => [...acc, ...fail._failures], [] as Failure[])
    );
  }

  constructor(input: string, failures: Failure[]) {
    super(input);
    this._failures = failures;
  }

  private readonly _failures: Failure[];
  private _uniqueFailures?: Failure[];

  get failures(): Failure[] {
    if (!this._uniqueFailures)
      this._uniqueFailures = uniqWith(this._failures, isEqual);
    return this._uniqueFailures;
  }
}
