import { Internals } from "../internals";
import { Options, Parser, preskip } from ".";
import { buildSafeMatch, SemanticAction } from "../match";

export class BoundTerminal<TContext> extends Parser<TContext> {
  private readonly bound: "START" | "END";

  constructor(bound: "START" | "END", action?: SemanticAction<TContext>) {
    super(action);
    this.bound = bound;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const diagnose = (cursor: number) =>
      options.diagnose &&
      internals.failures.write({
        from: cursor,
        to: cursor,
        stack: internals.stack,
        type: "TERMINAL_FAILURE",
        terminal: "BOUND",
        bound: this.bound
      });

    switch (this.bound) {
      case "START":
        if (options.from === 0)
          return buildSafeMatch(
            input,
            0,
            0,
            [],
            this.action,
            options,
            internals
          );
        diagnose(options.from);
        return null;

      case "END":
        const cursor = preskip(input, options, internals);
        if (cursor === null) return null;
        if (cursor === input.length)
          return buildSafeMatch(
            input,
            cursor,
            cursor,
            [],
            this.action,
            options,
            internals
          );
        diagnose(cursor);
        return null;
    }
  }
}
