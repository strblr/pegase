import { Match, SuccessMatch, MatchFail } from "./match";
import { FirstSet, NonEmptyArray, Options, SemanticAction } from "./types";

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export abstract class Parser<TValue, TContext> {
  protected readonly action: SemanticAction<TValue, TContext> | null;

  protected constructor(action?: SemanticAction<TValue, TContext>) {
    this.action = action || null;
  }

  abstract get first(): FirstSet;

  parse(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): Match {
    return this._parse(input, 0, { ...defaultOptions, ...options });
  }

  value(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): TValue {
    const match = this.parse(input, options);
    if (match instanceof SuccessMatch) return match.value;
    throw match;
  }

  children(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): any[] {
    const match = this.parse(input, options);
    if (match instanceof SuccessMatch) return match.children;
    throw match;
  }

  abstract _parse(
    input: string,
    from: number,
    options: Options<TContext>
  ): Match;

  // Directives

  get omit(): Parser<undefined, TContext> {
    return new NonTerminal(this, () => undefined);
  }

  get raw(): Parser<string, TContext> {
    return new NonTerminal(this, raw => raw);
  }

  token(identity: string): Parser<TValue, TContext> {
    return new Token(this, identity);
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
 * This is a static member.
 *
 * Static members should not be inherited.
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

  get first(): FirstSet {
    return this.parsers[0].first;
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    const matches: SuccessMatch<any, TContext>[] = [];
    let cursor = from;
    for (const parser of this.parsers) {
      const match = parser._parse(input, cursor, options);
      if (match instanceof SuccessMatch) {
        matches.push(match);
        cursor = match.to;
      } else return match;
    }
    return new SuccessMatch<TValue, TContext>(
      input,
      matches[0].from,
      cursor,
      matches,
      this.action,
      options
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Alternative<TValue, TContext> extends Parser<TValue, TContext> {
  private readonly parsers: NonEmptyArray<Parser<any, TContext>>;

  constructor(
    parsers: NonEmptyArray<Parser<any, TContext>>,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parsers = parsers;
  }

  get first(): FirstSet {
    return this.parsers.reduce(
      (acc, parser) => [...acc, ...parser.first],
      [] as FirstSet
    );
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    const fails: MatchFail[] = [];
    for (const parser of this.parsers) {
      const match = parser._parse(input, from, options);
      if (match instanceof SuccessMatch)
        return new SuccessMatch<TValue, TContext>(
          input,
          match.from,
          match.to,
          [match],
          this.action,
          options
        );
      fails.push(match as MatchFail);
    }
    return MatchFail.merge(fails as NonEmptyArray<MatchFail>);
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class NonTerminal<TValue, TContext> extends Parser<TValue, TContext> {
  parser: Parser<any, TContext> | null;

  constructor(
    parser: Parser<any, TContext> | null,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parser = parser;
  }

  get first(): FirstSet {
    if (!this.parser)
      throw new Error("Cannot get first from undefined child parser");
    return this.parser.first;
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    if (!this.parser)
      throw new Error("Cannot parse non-terminal with undefined child parser");
    const match = this.parser._parse(input, from, options);
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
 * This is a static member.
 *
 * Static members should not be inherited.
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

  get first(): FirstSet {
    return this.parser.first;
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    const matches: SuccessMatch<any, TContext>[] = [];
    let counter = 0,
      cursor = from;
    const succeed = () => {
      return new SuccessMatch<TValue, TContext>(
        input,
        matches.length === 0 ? from : matches[0].from,
        matches.length === 0 ? from : matches[matches.length - 1].to,
        matches,
        this.action,
        options
      );
    };
    while (true) {
      if (counter === this.max) return succeed();
      const match = this.parser._parse(input, cursor, options);
      if (match instanceof SuccessMatch) {
        matches.push(match);
        cursor = match.to;
        counter++;
      } else if (counter < this.min) return match;
      else return succeed();
    }
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
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

  get first(): FirstSet {
    return this.parser.first.map(first => ({
      ...first,
      polarity: this.polarity === first.polarity
    }));
  }

  _parse(input: string, from: number, options: Options<TContext>): Match {
    const match = this.parser._parse(input, from, options);
    if (match instanceof MatchFail) {
      if (this.polarity) return match;
      return new SuccessMatch<undefined, TContext>(
        input,
        from,
        from,
        [],
        this.action,
        options
      );
    } else {
      if (this.polarity)
        return new SuccessMatch<undefined, TContext>(
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
              at: (match as SuccessMatch<any, TContext>).from,
              type: "EXPECTATION_FAIL",
              ...first
            }))
          : []
      );
    }
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
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

  get first(): FirstSet {
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
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Token<TValue, TContext> extends Parser<TValue, TContext> {
  parser: Parser<any, TContext> | null;
  private readonly identity: string;

  constructor(
    parser: Parser<any, TContext> | null,
    identity: string,
    action?: SemanticAction<TValue, TContext>
  ) {
    super(action);
    this.parser = parser;
    this.identity = identity;
  }

  get first(): FirstSet {
    return [
      {
        polarity: true,
        what: "TOKEN",
        identity: this.identity
      }
    ];
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
 * This is a static member.
 *
 * Static members should not be inherited.
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

  get first(): FirstSet {
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
 * This is a static member.
 *
 * Static members should not be inherited.
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

  get first(): FirstSet {
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
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class StartTerminal<TValue, TContext> extends Parser<TValue, TContext> {
  constructor(action?: SemanticAction<TValue, TContext>) {
    super(action);
  }

  get first(): FirstSet {
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
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class EndTerminal<TValue, TContext> extends Parser<TValue, TContext> {
  constructor(action?: SemanticAction<TValue, TContext>) {
    super(action);
  }

  get first(): FirstSet {
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
 * This is a static member.
 *
 * Static members should not be inherited.
 */

const defaultOptions: Options<any> = {
  skipper: new RegexTerminal(/\s*/),
  skip: true,
  diagnose: false,
  context: undefined
};

export function rule<TValue, TContext>() {
  return new NonTerminal<TValue, TContext>(null);
}

export function token<TValue, TContext>(identity: string) {
  return new Token<TValue, TContext>(null, identity);
}
