import { isString, uniqWith, head, isEmpty } from "lodash";
import { throwError } from "./error";

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
    action?: SemanticAction
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
    if (action) this.value = action(this.raw, this.children, this);
    else if (matches.length === 1)
      this.value = (head(matches) as SuccessMatch).value;
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
  private readonly _expectations: Expectation[];
  private _uniqueExpectations?: Expectation[];

  static merge(fails: MatchFail[]): MatchFail {
    if (isEmpty(fails))
      return throwError("Cannot merge empty match fail array");
    return new MatchFail(
      (head(fails) as MatchFail).input,
      fails.reduce(
        (acc, fail) => acc.concat(fail._expectations),
        [] as Expectation[]
      )
    );
  }

  constructor(input: string, expectations: Expectation[]) {
    super(input);
    this._expectations = expectations;
  }

  get expected(): Expectation[] {
    if (!this._uniqueExpectations)
      this._uniqueExpectations = uniqWith(this._expectations, (exp1, exp2) => {
        return (
          exp1.at === exp2.at &&
          exp1.polarity === exp2.polarity &&
          ((exp1.what === "TOKEN" &&
            exp2.what === "TOKEN" &&
            exp1.identity === exp2.identity) ||
            (exp1.what === "LITERAL" &&
              exp2.what === "LITERAL" &&
              exp1.literal === exp2.literal) ||
            (exp1.what === "REGEX" &&
              exp2.what === "REGEX" &&
              String(exp1.pattern) === String(exp2.pattern)))
        );
      });
    return this._uniqueExpectations;
  }
}
