import { isString, uniqWith } from "lodash";

class Match {
  input: string;

  constructor(input: string) {
    this.input = input;
  }
}

export class SuccessMatch extends Match {
  from: number;
  to: number;
  private lazyParsed?: string;

  constructor(input: string, from: number, to: number) {
    super(input);
    this.from = from;
    this.to = to;
  }

  get parsed(): string {
    if (!isString(this.lazyParsed))
      this.lazyParsed = this.input.substring(this.from, this.to);
    return this.lazyParsed;
  }

  get complete(): boolean {
    return this.to === this.input.length - 1;
  }
}

export class MatchFail extends Match {
  expectations: Expectation[];
  private lazyExpectations?: Expectation[];

  constructor(input: string, expectations: Expectation[]) {
    super(input);
    this.expectations = expectations;
  }

  get expected(): Expectation[] {
    if (!this.lazyExpectations)
      this.lazyExpectations = uniqWith(this.expectations, (exp1, exp2) => {
        return (
          exp1.at === exp2.at &&
          ((exp1.what instanceof Token &&
            exp2.what instanceof Token &&
            exp1.what.identity === exp2.what.identity) ||
            (exp1.what instanceof Terminal &&
              exp2.what instanceof Terminal &&
              exp1.what.literal === exp2.what.literal) ||
            (exp1.what instanceof RegexTerminal &&
              exp2.what instanceof RegexTerminal &&
              String(exp1.what.pattern) === String(exp2.what.pattern)))
        );
      });
    return this.lazyExpectations;
  }
}
