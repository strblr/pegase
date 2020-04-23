import { Parser } from "../parser";
import { Match } from "../match";

export class Cache<TContext> {
  private readonly cache: Record<
    number,
    Map<Parser<TContext>, Match<TContext> | null>
  > = Object.create(null);

  read(cursor: number, parser: Parser<TContext>) {
    return this.cache[cursor]?.get(parser);
  }

  write(
    cursor: number,
    parser: Parser<TContext>,
    match: Match<TContext> | null
  ) {
    if (!(cursor in this.cache)) this.cache[cursor] = new Map();
    this.cache[cursor].set(parser, match);
  }
}
