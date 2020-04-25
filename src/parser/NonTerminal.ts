import { Failures, Internals } from "../internals";
import { inferIdentity, NonTerminalMode, Options, Parser, preskip } from ".";
import { buildSafeMatch, inferChildren, Match, SemanticAction } from "../match";

export class NonTerminal<TContext> extends Parser<TContext> {
  parser: Parser<TContext> | null;
  readonly mode: NonTerminalMode;
  readonly identity: string | null;

  constructor(
    parser: Parser<TContext> | null,
    mode: NonTerminalMode,
    identity: string | null,
    action?: SemanticAction<TContext>
  ) {
    super(action);
    this.parser = parser;
    this.mode = mode;
    this.identity = identity;
  }

  /**
   * The dispatcher links the NonTerminal modes to their appropriate parse method
   */

  private static dispatcher: Record<
    NonTerminalMode,
    "_parseByPass" | "_parseToken" | "_parseSkip" | "_parseCase" | "_parseCache"
  > = {
    BYPASS: "_parseByPass",
    TOKEN: "_parseToken",
    SKIP: "_parseSkip",
    NOSKIP: "_parseSkip",
    CASE: "_parseCase",
    NOCASE: "_parseCase",
    CACHE: "_parseCache"
  };

  /**
   * BYPASS mode
   * Simply tries to parse the child parser
   */

  private _parseByPass(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    if (!this.parser)
      throw new Error("Cannot parse non-terminal with undefined child parser");
    const match = this.parser._parse(input, options, internals);
    return (
      match &&
      buildSafeMatch(
        input,
        match.from,
        match.to,
        inferChildren([match]),
        this.action,
        options,
        internals
      )
    );
  }

  /**
   * TOKEN mode
   * Does pre-skipping before trying to parse the child parser with skipping deactivated
   */

  private _parseToken(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    if (!this.parser)
      throw new Error("Cannot parse token with undefined child parser");
    const cursor = preskip(input, options, internals);
    if (cursor === null) return null;
    const failures = new Failures();
    const match = this.parser._parse(
      input,
      { ...options, from: cursor, skip: false },
      { ...internals, failures }
    );
    if (match)
      return buildSafeMatch(
        input,
        match.from,
        match.to,
        inferChildren([match]),
        this.action,
        options,
        internals
      );
    else if (options.diagnose)
      internals.failures.write({
        from: cursor,
        to: failures.farthest() ?? cursor,
        stack: internals.stack,
        type: "TERMINAL_FAILURE",
        terminal: "TOKEN",
        identity: this.identity || inferIdentity(this.parser),
        failures: failures.read()
      });
    return null;
  }

  /**
   * SKIP or NOSKIP mode
   * Tries to parse the child parser with skipper activated / deactivated
   */

  private _parseSkip(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    if (!this.parser)
      throw new Error("Cannot parse skip setter with undefined child parser");
    const match = this.parser._parse(
      input,
      { ...options, skip: this.mode === "SKIP" },
      internals
    );
    return (
      match &&
      buildSafeMatch(
        input,
        match.from,
        match.to,
        inferChildren([match]),
        this.action,
        options,
        internals
      )
    );
  }

  /**
   * CASE or NOCASE mode
   * Tries to parse the child parser with case considered / ignored
   */

  private _parseCase(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    if (!this.parser)
      throw new Error("Cannot parse case setter with undefined child parser");
    const match = this.parser._parse(
      input,
      { ...options, case: this.mode === "CASE" },
      internals
    );
    return (
      match &&
      buildSafeMatch(
        input,
        match.from,
        match.to,
        inferChildren([match]),
        this.action,
        options,
        internals
      )
    );
  }

  /**
   * CACHE mode
   * Checks the cache before trying to parse the child parser.
   */

  private _parseCache(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TContext> | null {
    if (!this.parser)
      throw new Error(
        "Cannot parse cached non-terminal with undefined child parser"
      );
    let match = internals.cache.read(options.from, this.parser);
    if (match === undefined) {
      match = this.parser._parse(input, options, internals);
      internals.cache.write(options.from, this.parser, match);
    }
    return (
      match &&
      buildSafeMatch(
        input,
        match.from,
        match.to,
        inferChildren([match]),
        this.action,
        options,
        internals
      )
    );
  }

  // Dispatcher

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    if (this.identity) {
      internals = { ...internals, stack: [...internals.stack, this.identity] };
      options.trace?.({
        type: "ENTERED",
        identity: this.identity,
        input,
        stack: internals.stack,
        options
      });
    }
    const match = this[NonTerminal.dispatcher[this.mode]](
      input,
      options,
      internals
    );
    if (this.identity)
      options.trace?.({
        ...(match
          ? {
              type: "MATCHED",
              match
            }
          : {
              type: "FAILED"
            }),
        identity: this.identity,
        input,
        stack: internals.stack,
        options
      });
    return match;
  }
}
