import { Internals } from "../internals";
import { Options, Parser } from ".";
import { buildSafeMatch, SemanticAction } from "../match";

export class Alternative<TContext> extends Parser<TContext> {
  private readonly parsers: Parser<TContext>[];

  constructor(parsers: Parser<TContext>[], action?: SemanticAction<TContext>) {
    super(action);
    this.parsers = parsers;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    for (const parser of this.parsers) {
      const match = parser._parse(input, options, internals);
      if (match)
        return buildSafeMatch(
          input,
          match.from,
          match.to,
          [match],
          this.action,
          options,
          internals
        );
    }
    return null;
  }
}
