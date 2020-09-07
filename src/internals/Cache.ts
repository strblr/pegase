import { Parser } from "../parser";
import { Match } from "../match";

export class Cache<TContext> {
  private readonly content: Record<
    number,
    Map<Parser<TContext>, Match<TContext> | null>
  > = Object.create(null);

  read(cursor: number, parser: Parser<TContext>) {
    return this.content[cursor]?.get(parser);
  }

  write(
    cursor: number,
    parser: Parser<TContext>,
    match: Match<TContext> | null
  ) {
    if (!(cursor in this.content)) this.content[cursor] = new Map();
    this.content[cursor].set(parser, match);
  }
}
