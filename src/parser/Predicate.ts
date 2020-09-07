import { Failures, FailureType } from "../internals";
import { Internals, Options, Parser } from ".";
import { buildSafeMatch, SemanticAction } from "../match";

export enum PredicatePolarity {
  MustMatch,
  MustFail
}

export class Predicate<TContext> extends Parser<TContext> {
  private readonly parser: Parser<TContext>;
  private readonly polarity: PredicatePolarity;

  constructor(
    parser: Parser<TContext>,
    polarity: PredicatePolarity,
    action?: SemanticAction<TContext>
  ) {
    super(action && ((...args) => (action(...args), undefined)));
    this.parser = parser;
    this.polarity = polarity;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const failures = new Failures<TContext>();
    const match = this.parser._parse(input, options, {
      ...internals,
      failures
    });
    if ((this.polarity === PredicatePolarity.MustMatch) === !!match)
      return buildSafeMatch(
        input,
        options.from,
        options.from,
        [],
        this.action,
        options,
        internals
      );
    else if (options.diagnose)
      internals.failures.write(
        match
          ? {
              from: match.from,
              to: match.to,
              stack: internals.stack,
              type: FailureType.Predicate,
              polarity: PredicatePolarity.MustFail,
              match
            }
          : {
              from: options.from,
              to: options.from,
              stack: internals.stack,
              type: FailureType.Predicate,
              polarity: PredicatePolarity.MustMatch,
              failures: failures.read()
            }
      );
    return null;
  }
}
