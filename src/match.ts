import { isEqual, uniqWith } from "lodash";
import { Failure, NonEmptyArray, Options, SemanticAction } from "./types";

/**
 * This is a static member.
 *
 * Static members should not be inherited.
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
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class SuccessMatch extends Match {
  readonly from: number;
  readonly to: number;
  readonly children: any[];
  readonly value: any;

  constructor(
    input: string,
    from: number,
    to: number,
    matches: SuccessMatch[],
    action: SemanticAction | null,
    options: Options
  ) {
    super(input);
    this.from = from;
    this.to = to;
    const children = matches.reduce(
      (acc, match) => [
        ...acc,
        ...(match.value === undefined ? match.children : [match.value])
      ],
      [] as any[]
    );
    if (action) {
      this.children = [];
      try {
        this.value = action(this.raw, children, options.payload, this);
      } catch (error) {
        if (error instanceof Error)
          return (new MatchFail(input, [
            {
              at: from,
              type: "SEMANTIC_FAIL",
              message: error.message
            }
          ]) as unknown) as SuccessMatch;
        throw error;
      }
    } else if (children.length === 1) {
      this.children = [];
      this.value = children[0];
    } else this.children = children;
  }

  get raw(): string {
    return this.input.substring(this.from, this.to);
  }

  get complete(): boolean {
    return this.to === this.input.length;
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
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
