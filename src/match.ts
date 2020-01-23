import { isEqual, uniqWith } from "lodash";

export type NonEmptyArray<T> = [T, ...T[]];

export type SemanticAction = (
  raw: string,
  children: any[],
  payload: any,
  match: SuccessMatch
) => any;

export type First = {
  polarity: boolean;
} & (
  | {
      what: "TOKEN";
      identity: string;
    }
  | {
      what: "LITERAL";
      literal: string;
    }
  | {
      what: "REGEX";
      pattern: RegExp;
    }
  | {
      what: "START" | "END";
    }
);

export type Failure = {
  at: number;
} & (
  | ({
      type: "EXPECTATION_FAIL";
    } & First)
  | {
      type: "SEMANTIC_FAIL";
      message: string;
    }
);

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
  readonly value: any;
  readonly children: any[];

  constructor(
    input: string,
    from: number,
    to: number,
    matches: SuccessMatch[],
    action: SemanticAction | null,
    payload: any
  ) {
    super(input);
    this.from = from;
    this.to = to;
    this.children = matches.reduce(
      (acc, match) => [
        ...acc,
        ...(match.value === undefined ? match.children : [match.value])
      ],
      [] as any[]
    );
    if (action) this.value = action(this.raw, this.children, payload, this);
    else {
      const activeValueMatches = matches.filter(
        match => match.value !== undefined
      );
      if (activeValueMatches.length === 1)
        this.value = activeValueMatches[0].value;
    }
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
