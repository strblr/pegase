import { isString, uniqWith, head } from "lodash";
import { throwError } from "./error";

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

export class SuccessMatch extends Match {
  readonly from: number;
  readonly to: number;
  value: any;
  readonly children: any[];
  private _parsed?: string;

  constructor(
    input: string,
    from: number,
    to: number,
    children: any[],
    action: SemanticAction
  ) {
    super(input);
    this.from = from;
    this.to = to;
    this.children = children;
    const value = action(this);
    if (value !== undefined) this.value = value;
  }

  get parsed(): string {
    if (!isString(this._parsed))
      this._parsed = this.input.substring(this.from, this.to);
    return this._parsed;
  }

  get complete(): boolean {
    return this.to === this.input.length;
  }
}

export class MatchFail extends Match {
  private readonly expectations: Expectation[];
  private _expectations?: Expectation[];

  static merge(fails: MatchFail[]): MatchFail {
    if (fails.length === 0)
      return throwError("Cannot merge empty match fail array");
    return new MatchFail(
      (head(fails) as MatchFail).input,
      fails.reduce(
        (acc, fail) => acc.concat(fail.expectations),
        [] as Expectation[]
      )
    );
  }

  constructor(input: string, expectations: Expectation[]) {
    super(input);
    this.expectations = expectations;
  }

  get expected(): Expectation[] {
    if (!this._expectations)
      this._expectations = uniqWith(this.expectations, (exp1, exp2) => {
        return (
          exp1.at === exp2.at &&
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
    return this._expectations;
  }
}
