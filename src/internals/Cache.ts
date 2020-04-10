import { Parser } from "../parser";
import { Match } from "../match";

export class Cache<TContext> {
  readonly cache: Map<Parser<TContext>, Match<TContext> | null>[] = [];

  read(cursor: number, parser: Parser<TContext>) {
    return this.cache[cursor].get(parser);
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
