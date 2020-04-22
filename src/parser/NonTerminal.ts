import { Failures, Internals } from "../internals";
import { NonTerminalMode, Options, Parser, preskip } from ".";
import { buildSafeMatch, Match, SemanticAction } from "../match";

export class NonTerminal<TContext> extends Parser<TContext> {
  parser: Parser<TContext> | null;
  private readonly mode: NonTerminalMode;
  private readonly identity: string | null;

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

  private inferTokenIdentity() {
    if (!(this.parser instanceof NonTerminal)) return null;
    let cursor = this.parser;
    while (!cursor.identity && cursor.parser instanceof NonTerminal)
      cursor = cursor.parser;
    return cursor.identity || null;
  }

  /**
   * BYPASS mode
   * Simply tries to parse the child parser
   */

  _parseByPass(
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
        [match],
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

  _parseToken(
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
        [match],
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
        identity: this.identity || this.inferTokenIdentity(),
        failures: failures.read()
      });
    return null;
  }

  /**
   * SKIP or NOSKIP mode
   * Tries to parse the child parser with skipper activated / deactivated
   */

  _parseSkip(
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
        [match],
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

  _parseCase(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    if (!this.parser)
      throw new Error("Cannot parse case setter with undefined child parser");
    const match = this.parser._parse(
      input,
      { ...options, ignoreCase: this.mode === "NOCASE" },
      internals
    );
    return (
      match &&
      buildSafeMatch(
        input,
        match.from,
        match.to,
        [match],
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

  _parseCache(
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
        [match],
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
    if (options.diagnose && this.identity)
      internals = { ...internals, stack: [...internals.stack, this.identity] };
    switch (this.mode) {
      case "BYPASS":
        return this._parseByPass(input, options, internals);
      case "TOKEN":
        return this._parseToken(input, options, internals);
      case "SKIP":
      case "NOSKIP":
        return this._parseSkip(input, options, internals);
      case "CASE":
      case "NOCASE":
        return this._parseCase(input, options, internals);
      case "CACHE":
        return this._parseCache(input, options, internals);
    }
  }
}
