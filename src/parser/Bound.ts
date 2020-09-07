import { FailureTerminal, FailureType } from "../internals";
import { Internals, Options, Parser, preskip } from ".";
import { buildSafeMatch, SemanticAction } from "../match";

export enum BoundType {
  Start,
  End
}

export class Bound<TContext> extends Parser<TContext> {
  private readonly bound: BoundType;

  constructor(bound: BoundType, action?: SemanticAction<TContext>) {
    super(action);
    this.bound = bound;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const diagnose = (cursor: number) => {
      if (options.diagnose)
        internals.failures.write({
          from: cursor,
          to: cursor,
          stack: internals.stack,
          type: FailureType.Terminal,
          terminal: FailureTerminal.Bound,
          bound: this.bound
        });
    };
    switch (this.bound) {
      case BoundType.Start:
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

      case BoundType.End:
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
