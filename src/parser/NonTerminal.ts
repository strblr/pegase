import { Failures, FailureTerminal, FailureType } from "../internals";
import {
  inferIdentity,
  Internals,
  Options,
  Parser,
  preskip,
  TraceEventType
} from ".";
import { buildSafeMatch, inferChildren, SemanticAction } from "../match";

export enum NonTerminalMode {
  Bypass,
  Token,
  Skip,
  NoSkip,
  Case,
  NoCase,
  Cache
}

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

  private static dispatcher = {
    [NonTerminalMode.Bypass]: "_parseByPass",
    [NonTerminalMode.Token]: "_parseToken",
    [NonTerminalMode.Skip]: "_parseSkip",
    [NonTerminalMode.NoSkip]: "_parseSkip",
    [NonTerminalMode.Case]: "_parseCase",
    [NonTerminalMode.NoCase]: "_parseCase",
    [NonTerminalMode.Cache]: "_parseCache"
  } as const;

  /**
   * Bypass mode
   *
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
   * Token mode
   *
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
    const failures = new Failures<TContext>();
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
        type: FailureType.Terminal,
        terminal: FailureTerminal.Token,
        identity: inferIdentity(this),
        failures: failures.read()
      });
    return null;
  }

  /**
   * Skip or NoSkip mode
   *
   * Tries to parse the child parser with skipper activated / deactivated
   */

  private _parseSkip(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    if (!this.parser)
      throw new Error("Cannot parse skip toggle with undefined child parser");
    const match = this.parser._parse(
      input,
      { ...options, skip: this.mode === NonTerminalMode.Skip },
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
   * Case or NoCase mode
   *
   * Tries to parse the child parser with case considered / ignored
   */

  private _parseCase(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    if (!this.parser)
      throw new Error("Cannot parse case toggle with undefined child parser");
    const match = this.parser._parse(
      input,
      { ...options, case: this.mode === NonTerminalMode.Case },
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
   * Cache mode
   *
   * Checks the cache before trying to parse the child parser.
   */

  private _parseCache(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
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
    const method = this[NonTerminal.dispatcher[this.mode]];
    if (!this.identity) return method(input, options, internals);

    internals = { ...internals, stack: [...internals.stack, this.identity] };
    options.trace?.({
      type: TraceEventType.Entered,
      identity: this.identity,
      input,
      stack: internals.stack,
      options
    });
    const match = method(input, options, internals);
    options.trace?.({
      ...(match
        ? {
            type: TraceEventType.Matched,
            match
          }
        : {
            type: TraceEventType.Failed,
            failures: internals.failures.read()
          }),
      identity: this.identity,
      input,
      stack: internals.stack,
      options
    });
    return match;
  }
}
