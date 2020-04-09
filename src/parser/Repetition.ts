import { Internals } from "../internals";
import { Options, Parser } from ".";
import { buildSafeMatch, Match, SemanticAction } from "../match";

export class Repetition<TContext> extends Parser<TContext> {
  private readonly parser: Parser<TContext>;
  private readonly min: number;
  private readonly max: number;

  constructor(
    parser: Parser<TContext>,
    min: number,
    max: number,
    action?: SemanticAction<TContext>
  ) {
    super(action);
    this.parser = parser;
    this.min = min;
    this.max = max;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const matches: Match<TContext>[] = [];
    let cursor = options.from,
      counter = 0;
    const succeed = () => {
      const [from, to] =
        matches.length === 0
          ? [options.from, options.from]
          : [matches[0].from, matches[matches.length - 1].to];
      return buildSafeMatch(
        input,
        from,
        to,
        matches,
        this.action,
        options,
        internals
      );
    };
    while (true) {
      if (counter === this.max) return succeed();
      const match = this.parser._parse(
        input,
        { ...options, from: cursor },
        internals
      );
      if (match) {
        matches.push(match);
        cursor = match.to;
        counter++;
      } else if (counter < this.min) return null;
      else return succeed();
    }
  }
}
