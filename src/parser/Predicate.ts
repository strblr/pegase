import { Failures, Internals } from "../internals";
import { Options, Parser } from ".";
import { buildSafeMatch, SemanticAction } from "../match";

export class Predicate<TContext> extends Parser<TContext> {
  private readonly parser: Parser<TContext>;
  private readonly polarity: boolean;

  constructor(
    parser: Parser<TContext>,
    polarity: boolean,
    action?: SemanticAction<TContext>
  ) {
    super(
      action &&
        ((...args) => {
          action(...args);
        })
    );
    this.parser = parser;
    this.polarity = polarity;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const failures = new Failures();
    const match = this.parser._parse(input, options, {
      ...internals,
      failures
    });
    if (this.polarity === !!match)
      return buildSafeMatch(
        input,
        options.from,
        options.from,
        [],
        this.action,
        options,
        internals
      );
    else if (options.diagnose) {
      if (match)
        internals.failures.write({
          from: match.from,
          to: match.to,
          stack: internals.stack,
          type: "PREDICATE_FAILURE",
          polarity: false,
          match
        });
      else
        internals.failures.write({
          from: options.from,
          to: options.from,
          stack: internals.stack,
          type: "PREDICATE_FAILURE",
          polarity: true,
          failures: failures.read()
        });
    }
    return null;
  }
}
