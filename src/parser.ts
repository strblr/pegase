import { Cache, FailureTracker, WarningTracker } from "./tracker";
import { Match } from "./match";
import { Report } from "./report";
import {
  Internals,
  NonEmptyArray,
  NonTerminalMode,
  Options,
  SemanticAction
} from "./types";

/**
 * class Parser
 *
 * Base class for all parsers.
 */

export abstract class Parser<TValue, TContext> {
  protected readonly action: SemanticAction<TValue, TContext> | null;

  protected constructor(action?: SemanticAction<TValue, TContext>) {
    this.action = action || null;
  }

  parse(
    input: string,
    partialOptions: Partial<Options<TContext>> = defaultOptions
  ): Report<TValue, TContext> {
    const options = { ...defaultOptions, ...partialOptions };
    const internals = {
      failures: new FailureTracker(),
      warnings: new WarningTracker(),
      cache: new Cache<TContext>()
    };
    return new Report(
      input,
      this._parse(input, options, internals),
      options,
      internals
    );
  }

  value(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): TValue {
    const report = this.parse(input, options);
    if (report.match) return report.match.value;
    throw new Error(report.humanLogs);
  }

  children(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): any[] {
    const report = this.parse(input, options);
    if (report.match) return report.match.children;
    throw new Error(report.humanLogs);
  }

  abstract _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null;

  // Directives

  get omit(): Parser<undefined, TContext> {
    return new NonTerminal(this, "BYPASS", null, () => undefined);
  }

  get raw(): Parser<string, TContext> {
    return new NonTerminal(this, "BYPASS", null, ({ raw }) => raw);
  }

  get token(): Parser<TValue, TContext> {
    return new NonTerminal(this, "TOKEN", null);
  }

  get skip(): Parser<TValue, TContext> {
    return new NonTerminal(this, "SKIP", null);
  }

  get unskip(): Parser<TValue, TContext> {
    return new NonTerminal(this, "UNSKIP", null);
  }

  get matches(): Parser<boolean, TContext> {
    return new Alternative([
      new NonTerminal(this, "BYPASS", null, () => true),
      new LiteralTerminal("", () => false)
    ]);
  }
}

/**
 * class Sequence
 *
 * Syntax: p1 p2 ... pn
 * Description: Parses sequentially from p1 to pn. Fails if one of the child parser fails.
 */

export class Sequence<TValue, TContext> extends Parser<TValue, TContext> {
  private readonly parsers: NonEmptyArray<Parser<any, TContext>>;

  constructor(
    parsers: NonEmptyArray<Parser<any, TContext>>,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parsers = parsers;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null {
    const matches: Match<any, TContext>[] = [];
    let cursor = options.from;
    for (const parser of this.parsers) {
      const match = parser._parse(
        input,
        { ...options, from: cursor },
        internals
      );
      if (!match) return null;
      matches.push(match);
      cursor = match.to;
    }
    return success(
      input,
      matches[0].from,
      cursor,
      matches,
      this.action,
      options,
      internals
    );
  }
}

/**
 * class Alternative
 *
 * Syntax: p1 | p2 | ... | pn
 * Description: Parses sequentially from p1 to pn. Succeeds as soon as one of the child parser succeeds.
 */

/*
 * A: B $
 * B: "a" "b" | "c"
 *
 * */

export class Alternative<TValue, TContext> extends Parser<TValue, TContext> {
  private readonly parsers: NonEmptyArray<Parser<any, TContext>>;

  constructor(
    parsers: NonEmptyArray<Parser<any, TContext>>,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parsers = parsers;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null {
    for (const parser of this.parsers) {
      const match = parser._parse(input, options, internals);
      if (match)
        return success(
          input,
          match.from,
          match.to,
          [match],
          this.action,
          options,
          internals
        );
    }
    return null;
  }
}

/**
 * class NonTerminal
 *
 * Syntax: This is not directly embodied by a specific syntax and is more of a utility parser.
 * Description: Tries to parse its child parser. Succeeds or fails accordingly.
 */

export class NonTerminal<TValue, TContext> extends Parser<TValue, TContext> {
  parser: Parser<any, TContext> | null;
  private readonly mode: NonTerminalMode;
  private readonly identity: string | null;

  constructor(
    parser: Parser<any, TContext> | null,
    mode: NonTerminalMode,
    identity: string | null,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parser = parser;
    this.mode = mode;
    this.identity = identity;
  }

  _parseToken(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null {
    if (!this.parser)
      throw new Error("Cannot parse token with undefined child parser");
    let cursor = preskip(input, options, internals);
    if (cursor === null) return null;
    const match = this.parser._parse(
      input,
      { ...options, from: cursor, skip: false, diagnose: false },
      internals
    );
    if (match)
      return success(
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
        to: cursor,
        type: "EXPECTATION_FAILURE",
        what: "TOKEN",
        identity: this.identity!
      });
    return null;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null {
    if (this.mode === "TOKEN")
      return this._parseToken(input, options, internals);
    if (!this.parser)
      throw new Error("Cannot parse non-terminal with undefined child parser");
    const match = this.parser._parse(
      input,
      {
        ...options,
        skip: this.mode === "BYPASS" ? options.skip : this.mode === "SKIP"
      },
      internals
    );
    return (
      match &&
      success(
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
}

/**
 * class Sequence
 *
 * Syntax: p? or p+ or p* or p{n} or p{n, m}
 * Description: Tries to parse p as many times as possible given a specific repetition range.
 */

export class Repetition<TValue, TContext> extends Parser<TValue, TContext> {
  private readonly parser: Parser<any, TContext>;
  private readonly min: number;
  private readonly max: number;

  constructor(
    parser: Parser<any, TContext>,
    min: number,
    max: number,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parser = parser;
    this.min = min;
    this.max = max;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null {
    const matches: Match<any, TContext>[] = [];
    let cursor = options.from,
      counter = 0;
    const succeed = () => {
      const [from, to] =
        matches.length === 0
          ? [options.from, options.from]
          : [matches[0].from, matches[matches.length - 1].to];
      return success(input, from, to, matches, this.action, options, internals);
    };
    while (true) {
      if (counter === this.max) return succeed();
      const match = this.parser._parse(
        input,
        { ...options, from: cursor },
        internals
      );
      if (match) {
        matches.push(match);
        cursor = match.to;
        counter++;
      } else if (counter < this.min) return null;
      else return succeed();
    }
  }
}

/**
 * class Predicate
 *
 * Syntax: &p ou !p
 * Description: Tries to match p without consuming any input. Fails or succeeds according to the polarity.
 */

export class Predicate<TContext> extends Parser<undefined, TContext> {
  private readonly parser: Parser<any, TContext>;
  private readonly polarity: boolean;

  constructor(
    parser: Parser<any, TContext>,
    polarity: boolean,
    action?: SemanticAction<any, TContext>
  ) {
    super(
      action &&
        ((...args) => {
          action(...args);
          return undefined;
        })
    );
    this.parser = parser;
    this.polarity = polarity;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<undefined, TContext> | null {
    const failures = new FailureTracker();
    const match = this.parser._parse(input, options, {
      ...internals,
      failures
    });
    if (this.polarity === !!match)
      return success(
        input,
        options.from,
        options.from,
        [],
        this.action,
        options,
        internals
      );
    else if (options.diagnose) {
      if (match)
        internals.failures.write({
          from: match.from,
          to: match.to,
          type: "PREDICATE_FAILURE"
        });
      else
        failures.failures.forEach(failure => internals.failures.write(failure));
    }
    return null;
  }
}

/**
 * class LiteralTerminal
 *
 * Syntax: 'str' or "str"
 * Description: Tries to match the literal as-is.
 */

export class LiteralTerminal<TValue, TContext> extends Parser<
  TValue,
  TContext
> {
  private readonly literal: string;

  constructor(literal: string, action?: SemanticAction<TValue, TContext>) {
    super(action);
    this.literal = literal;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null {
    let cursor = preskip(input, options, internals);
    if (cursor === null) return null;
    if (input.startsWith(this.literal, cursor))
      return success(
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
        type: "EXPECTATION_FAILURE",
        what: "LITERAL",
        literal: this.literal
      });
    return null;
  }
}

/**
 * class RegexTerminal
 *
 * Syntax: Has to be used as a template string parameter (${/my_regexp/}).
 * Description: Tries to match the given RegExp.
 */

export class RegexTerminal<TValue, TContext> extends Parser<TValue, TContext> {
  private readonly pattern: RegExp;

  constructor(pattern: RegExp, action?: SemanticAction<TValue, TContext>) {
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
  ): Match<TValue, TContext> | null {
    let cursor = preskip(input, options, internals);
    if (cursor === null) return null;
    this.pattern.lastIndex = cursor;
    const result = this.pattern.exec(input);
    if (result !== null)
      return success(
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
        type: "EXPECTATION_FAILURE",
        what: "REGEX",
        pattern: this.pattern
      });
    return null;
  }
}

/**
 * class StartTerminal
 *
 * Syntax: ^
 * Description: Succeeds if the input iterator points to the very beginning
 */

export class StartTerminal<TValue, TContext> extends Parser<TValue, TContext> {
  constructor(action?: SemanticAction<TValue, TContext>) {
    super(action);
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null {
    if (options.from === 0)
      return success(input, 0, 0, [], this.action, options, internals);
    options.diagnose &&
      internals.failures.write({
        from: options.from,
        to: options.from,
        type: "EXPECTATION_FAILURE",
        what: "START"
      });
    return null;
  }
}

/**
 * class EndTerminal
 *
 * Syntax: $
 * Description: Succeeds if the input iterator points to the end after optional pre-skipping
 */

export class EndTerminal<TValue, TContext> extends Parser<TValue, TContext> {
  constructor(action?: SemanticAction<TValue, TContext>) {
    super(action);
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue, TContext> | null {
    let cursor = preskip(input, options, internals);
    if (cursor === null) return null;
    if (cursor === input.length)
      return success(
        input,
        cursor,
        cursor,
        [],
        this.action,
        options,
        internals
      );
    options.diagnose &&
      internals.failures.write({
        from: cursor,
        to: cursor,
        type: "EXPECTATION_FAILURE",
        what: "END"
      });
    return null;
  }
}

/**
 * Utility
 */

const defaultOptions: Options<any> = {
  from: 0,
  skipper: new RegexTerminal(/\s*/),
  skip: true,
  diagnose: true,
  cached: false,
  context: undefined
};

function preskip<TContext>(
  input: string,
  options: Options<TContext>,
  internals: Internals<TContext>
) {
  if (!options.skip || !options.skipper) return options.from;
  const match = options.skipper._parse(
    input,
    {
      ...options,
      skip: false
    },
    internals
  );
  return match && match.to;
}

function success<TValue, TContext>(
  input: string,
  from: number,
  to: number,
  matches: Match<any, TContext>[],
  action: SemanticAction<TValue, TContext> | null,
  options: Options<TContext>,
  internals: Internals<TContext>
) {
  try {
    return new Match(input, from, to, matches, action, options, internals);
  } catch (failure) {
    if (!(failure instanceof Error)) throw failure;
    options.diagnose &&
      internals.failures.write({
        from,
        to,
        type: "SEMANTIC_FAILURE",
        message: failure.message
      });
    return null;
  }
}
