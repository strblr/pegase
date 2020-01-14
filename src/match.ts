import { isString, uniqWith } from "lodash";
import instantiate = WebAssembly.instantiate;

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
  private _parsed?: string;

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
    if (action) {
      try {
        const value = action(this.raw, this.children, payload, this);
        if (value !== undefined) this.value = value;
      } catch (error) {
        throw !(error instanceof Error)
          ? error
          : new MatchFail(input, [
              {
                at: from,
                type: "SEMANTIC_ERROR",
                message: error.message
              }
            ]);
      }
    } else {
      const activeValueMatches = matches.filter(
        match => match.value !== undefined
      );
      if (activeValueMatches.length === 1)
        this.value = activeValueMatches[0].value;
    }
  }

  get raw(): string {
    if (!isString(this._parsed))
      this._parsed = this.input.substring(this.from, this.to);
    return this._parsed;
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
  private readonly _expectations: PegaseError[];
  private _uniqueExpectations?: PegaseError[];

  static merge(fails: NonEmptyArray<MatchFail>): MatchFail {
    return new MatchFail(
      fails[0].input,
      fails.reduce(
        (acc, fail) => acc.concat(fail._expectations),
        [] as PegaseError[]
      )
    );
  }

  constructor(input: string, expectations: PegaseError[]) {
    super(input);
    this._expectations = expectations;
  }

  get expected(): PegaseError[] {
    if (!this._uniqueExpectations)
      this._uniqueExpectations = uniqWith(this._expectations, (exp1, exp2) => {
        return (
          exp1.at === exp2.at &&
          exp1.type === exp2.type &&
          ((exp1.type === "SEMANTIC_ERROR" &&
            exp2.type === "SEMANTIC_ERROR" &&
            exp1.message === exp2.message) ||
            (exp1.type === "EXPECTATION_ERROR" &&
              exp2.type === "EXPECTATION_ERROR" &&
              exp1.polarity === exp2.polarity &&
              ((exp1.what === "TOKEN" &&
                exp2.what === "TOKEN" &&
                exp1.identity === exp2.identity) ||
                (exp1.what === "LITERAL" &&
                  exp2.what === "LITERAL" &&
                  exp1.literal === exp2.literal) ||
                (exp1.what === "REGEX" &&
                  exp2.what === "REGEX" &&
                  String(exp1.pattern) === String(exp2.pattern)))))
        );
      });
    return this._uniqueExpectations;
  }
}
