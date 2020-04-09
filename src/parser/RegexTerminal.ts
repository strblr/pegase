import { Internals } from "../internals";
import { Options, Parser, preskip } from ".";
import { buildSafeMatch, SemanticAction } from "../match";

export class RegexTerminal<TContext> extends Parser<TContext> {
  private readonly pattern: RegExp;

  constructor(pattern: RegExp, action?: SemanticAction<TContext>) {
    super(action);
    this.pattern = new RegExp(
      pattern,
      pattern.flags.includes("y") ? pattern.flags : `${pattern.flags}y`
    );
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const cursor = preskip(input, options, internals);
    if (cursor === null) return null;
    this.pattern.lastIndex = cursor;
    const result = this.pattern.exec(input);
    if (result !== null)
      return buildSafeMatch(
        input,
        cursor,
        cursor + result[0].length,
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
        terminal: "REGEX",
        pattern: this.pattern
      });
    return null;
  }
}
