import { escapeRegExp, isString } from "lodash";
import { Internals } from "../internals";
import { extendFlags, Options, Parser, preskip } from ".";
import { buildSafeMatch, SemanticAction } from "../match";

export class Text<TContext> extends Parser<TContext> {
  private readonly text: RegExp | string;
  private readonly withCase: RegExp;
  private readonly withoutCase: RegExp;

  constructor(text: RegExp | string, action?: SemanticAction<TContext>) {
    super(action);
    this.text = text;
    if (isString(text)) text = new RegExp(escapeRegExp(text));
    this.withCase = extendFlags(text, "y");
    this.withoutCase = extendFlags(text, "i", "y");
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    const cursor = preskip(input, options, internals);
    if (cursor === null) return null;
    const pattern = options.ignoreCase ? this.withoutCase : this.withCase;
    pattern.lastIndex = cursor;
    const result = pattern.exec(input);
    if (result !== null)
      return buildSafeMatch(
        input,
        cursor,
        cursor + result[0].length,
        result.slice(1),
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
        terminal: "TEXT",
        text: this.text
      });
    return null;
  }
}
