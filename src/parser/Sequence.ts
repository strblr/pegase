import { Internals, Options, Parser } from ".";
import { buildSafeMatch, inferChildren, Match, SemanticAction } from "../match";

export class Sequence<TContext> extends Parser<TContext> {
  private readonly parsers: Array<Parser<TContext>>;

  constructor(
    parsers: Array<Parser<TContext>>,
    action?: SemanticAction<TContext>
  ) {
    super(action);
    this.parsers = parsers;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const matches: Array<Match<TContext>> = [];
    let cursor = options.from;
    for (const parser of this.parsers) {
      const match = parser._parse(
        input,
        { ...options, from: cursor },
        internals
      );
      if (!match) return null;
      matches.push(match);
      cursor = match.to;
    }
    return buildSafeMatch(
      input,
      matches[0].from,
      cursor,
      inferChildren(matches),
      this.action,
      options,
      internals
    );
  }
}
