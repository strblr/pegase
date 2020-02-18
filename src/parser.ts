import { SuccessMatch } from "./match";
import {
  Failure,
  First,
  Internals,
  NonEmptyArray,
  Options,
  ParseReport,
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

  abstract get first(): First[];

  parse(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): ParseReport<TValue, TContext> {
    const internals: Internals<TContext> = {
      cache: [],
      warnings: [],
      failures: []
    };
    return {
      match: this._parse(input, { ...defaultOptions, ...options }, internals),
      warnings: internals.warnings,
      failures: internals.failures
    };
  }

  abstract _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): SuccessMatch<TValue, TContext> | null;

  value(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): TValue {
    const { match, failures } = this.parse(input, options);
    if (match) return match.value;
    throw failures;
  }

  children(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): any[] {
    const { match, failures } = this.parse(input, options);
    if (match) return match.children;
    throw failures;
  }

  // Directives

  get omit(): Parser<undefined, TContext> {
    return new NonTerminal(this, () => undefined);
  }

  get raw(): Parser<string, TContext> {
    return new NonTerminal(this, raw => raw);
  }

  get token(): Parser<TValue, TContext> {
    return new Token(this);
  }

  get skip(): Parser<TValue, TContext> {
    return new SkipTrigger(this, true);
  }

  get unskip(): Parser<TValue, TContext> {
    return new SkipTrigger(this, false);
  }

  get matches(): Parser<boolean, TContext> {
    return new Alternative([
      new NonTerminal(this, () => true),
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

  get first(): First[] {
    return this.parsers[0].first;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): SuccessMatch<TValue, TContext> | null {
    const matches: SuccessMatch<any, TContext>[] = [];
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

  get first(): First[] {
    return this.parsers.reduce(
      (acc, parser) => [...acc, ...parser.first],
      [] as First[]
    );
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): SuccessMatch<TValue, TContext> | null {
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

  constructor(
    parser?: Parser<any, TContext>,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parser = parser || null;
  }

  get first(): First[] {
    if (!this.parser)
      throw new Error(
        "Cannot get first-set in non-terminal from undefined child parser"
      );
    return this.parser.first;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): SuccessMatch<TValue, TContext> | null {
    if (!this.parser)
      throw new Error("Cannot parse non-terminal with undefined child parser");
    const match = this.parser._parse(input, options, internals);
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

  get first(): First[] {
    return this.parser.first;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): SuccessMatch<TValue, TContext> | null {
    const matches: SuccessMatch<any, TContext>[] = [];
    let counter = 0,
      cursor = options.from;
    const succeed = () => {
      return success(
        input,
        matches.length === 0 ? options.from : matches[0].from,
        matches.length === 0 ? options.from : matches[matches.length - 1].to,
        matches,
        this.action,
        options,
        internals
      );
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

  get first(): First[] {
    return this.parser.first.map(first => ({
      ...first,
      polarity: this.polarity === first.polarity
    }));
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): SuccessMatch<undefined, TContext> | null {
    const match = this.parser._parse(input, options, internals);
    if (!match) {
      if (this.polarity) return null;
      return success(
        input,
        options.from,
        options.from,
        [],
        this.action,
        options,
        internals
      );
    } else {
      if (this.polarity)
        return success(
          input,
          options.from,
          options.from,
          [],
          this.action,
          options,
          internals
        );
      options.diagnose &&
        internals.failures.push(
          ...(this.first.map(first => ({
            at: match.from,
            type: "EXPECTATION_FAILURE",
            ...first
          })) as Failure[])
        );
      return null;
    }
  }
}

/**
 * class SkipTrigger
 *
 * Syntax: skip[p] or unskip[p]
 * Description: Tries to match p while reactivating or deactivating skipping.
 */

export class SkipTrigger<TValue, TContext> extends Parser<TValue, TContext> {
  private readonly parser: Parser<any, TContext>;
  private readonly trigger: boolean;

  constructor(
    parser: Parser<any, TContext>,
    trigger: boolean,
    action?: SemanticAction<any, TContext>
  ) {
    super(action);
    this.parser = parser;
    this.trigger = trigger;
  }

  get first(): First[] {
    return this.parser.first;
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    const match = this.parser._parse(input, from, {
      ...options,
      skip: this.trigger
    });
    if (match instanceof SuccessMatch)
      return new SuccessMatch<TValue, TContext>(
        input,
        match.from,
        match.to,
        [match],
        this.action,
        options
      );
    return match;
  }
}

/**
 * class Token
 *
 * Syntax: $ruleName: <derivation>
 * Description: Matches its child parser while deactivating skipping, but can do pre-skipping.
 */

export class Token<TValue, TContext> extends Parser<TValue, TContext> {
  parser: Parser<any, TContext> | null;
  private readonly identity: string | null;

  constructor(
    parser?: Parser<any, TContext>,
    identity?: string,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parser = parser || null;
    this.identity = identity || null;
  }

  get first(): First[] {
    if (this.identity)
      return [
        {
          polarity: true,
          what: "TOKEN",
          identity: this.identity
        }
      ];
    else if (this.parser) return this.parser.first;
    throw new Error("Cannot get first from undefined child parser");
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    if (!this.parser)
      throw new Error(
        `Cannot parse token ${this.identity} with undefined child parser`
      );
    const optionsNoSkip = { ...options, skip: false };
    if (options.skip && options.skipper) {
      const match = options.skipper._parse(input, from, optionsNoSkip);
      if (match instanceof SuccessMatch) from = match.to;
      else return match;
    }
    const match = this.parser._parse(input, from, optionsNoSkip);
    if (match instanceof SuccessMatch)
      return new SuccessMatch<TValue, TContext>(
        input,
        match.from,
        match.to,
        [match],
        this.action,
        options
      );
    return new MatchFail(
      input,
      options.diagnose
        ? this.first.map(first => ({
            at: from,
            type: "EXPECTATION_FAIL",
            ...first
          }))
        : []
    );
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "LITERAL",
        literal: this.literal
      }
    ];
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    if (options.skip && options.skipper) {
      const match = options.skipper._parse(input, from, {
        ...options,
        skip: false
      });
      if (match instanceof SuccessMatch) from = match.to;
      else return match;
    }
    if (!input.startsWith(this.literal, from))
      return new MatchFail(
        input,
        options.diagnose
          ? this.first.map(first => ({
              at: from,
              type: "EXPECTATION_FAIL",
              ...first
            }))
          : []
      );
    return new SuccessMatch<TValue, TContext>(
      input,
      from,
      from + this.literal.length,
      [],
      this.action,
      options
    );
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "REGEX",
        pattern: this.pattern
      }
    ];
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    if (options.skip && options.skipper) {
      const match = options.skipper._parse(input, from, {
        ...options,
        skip: false
      });
      if (match instanceof SuccessMatch) from = match.to;
      else return match;
    }
    this.pattern.lastIndex = from;
    const result = this.pattern.exec(input);
    if (result === null)
      return new MatchFail(
        input,
        options.diagnose
          ? this.first.map(first => ({
              at: from,
              type: "EXPECTATION_FAIL",
              ...first
            }))
          : []
      );
    return new SuccessMatch<TValue, TContext>(
      input,
      from,
      from + result[0].length,
      [],
      this.action,
      options
    );
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "START"
      }
    ];
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    if (from === 0)
      return new SuccessMatch<TValue, TContext>(
        input,
        0,
        0,
        [],
        this.action,
        options
      );
    return new MatchFail(
      input,
      options.diagnose
        ? this.first.map(first => ({
            at: from,
            type: "EXPECTATION_FAIL",
            ...first
          }))
        : []
    );
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "END"
      }
    ];
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    if (options.skip && options.skipper) {
      const match = options.skipper._parse(input, from, {
        ...options,
        skip: false
      });
      if (match instanceof SuccessMatch) from = match.to;
      else return match;
    }
    if (from === input.length)
      return new SuccessMatch<TValue, TContext>(
        input,
        from,
        from,
        [],
        this.action,
        options
      );
    return new MatchFail(
      input,
      options.diagnose
        ? this.first.map(first => ({
            at: from,
            type: "EXPECTATION_FAIL",
            ...first
          }))
        : []
    );
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
  if (!options.skip || !options.skipper) return true;
  const match = options.skipper._parse(input, {
    ...options,
    skip: false
  });
  if (!match) return false;
  options.from = match.to;
  return true;
}

function success<TValue, TContext>(
  input: string,
  from: number,
  to: number,
  matches: SuccessMatch<any, TContext>[],
  action: SemanticAction<TValue, TContext> | null,
  options: Options<TContext>,
  internals: Internals<TContext>
) {
  try {
    return new SuccessMatch(input, from, to, matches, action, options);
  } catch (error) {
    if (error instanceof Error)
      internals.failures.push({
        at: from,
        type: "SEMANTIC_FAILURE",
        message: error.message
      });
    else throw error;
    return null;
  }
}
