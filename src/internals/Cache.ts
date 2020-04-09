import { Parser } from "../parser";
import { Match } from "../match";

export class Cache<TContext> {
  readonly cache: Map<Parser<TContext>, Match<TContext> | null>[] = [];

  has(cursor: number, parser: Parser<TContext>) {
    return !!this.cache[cursor] && this.cache[cursor].has(parser);
  }

  read(cursor: number, parser: Parser<TContext>) {
    return this.cache[cursor].get(parser) || null;
  }

  write(
    cursor: number,
    parser: Parser<TContext>,
    match: Match<TContext> | null
  ) {
    if (!this.cache[cursor]) this.cache[cursor] = new Map();
    this.cache[cursor].set(parser, match);
  }
}
