import { Internals } from "../internals";
import { Options, Parser, preskip } from ".";
import { buildSafeMatch, SemanticAction } from "../match";

export class LiteralTerminal<TContext> extends Parser<TContext> {
  private readonly literal: string;

  constructor(literal: string, action?: SemanticAction<TContext>) {
    super(action);
    this.literal = literal;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const cursor = preskip(input, options, internals);
    if (cursor === null) return null;
    if (input.startsWith(this.literal, cursor))
      return buildSafeMatch(
        input,
        cursor,
        cursor + this.literal.length,
        [],
        this.action,
        options,
        internals
      );
    options.diagnose &&
      internals.failures.write({
        from: cursor,
        to: cursor,
        stack: internals.stack,
        type: "TERMINAL_FAILURE",
        terminal: "LITERAL",
        literal: this.literal
      });
    return null;
  }
}
