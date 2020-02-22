import { Tracker } from "./tracker";
import { Match, SemanticMatchReport } from "./match";
import { Report } from "./report";
import {
  AnyMatch,
  First,
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

  abstract get first(): First[];

  parse(
    input: string,
    partialOptions: Partial<Options<TContext>> = defaultOptions
  ): Report<TValue, TContext> {
    const tracker = new Tracker<TContext>();
    const options = { ...defaultOptions, ...partialOptions };
    const internals = { tracker };
    return new Report(
      input,
      this._parse(input, options, internals),
      options,
      internals
    );
  }

  abstract _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue> | null;

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

  get first(): First[] {
    return this.parsers[0].first;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue> | null {
    const matches: AnyMatch[] = [];
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
  ): Match<TValue> | null {
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

  get first(): First[] {
    if (this.mode === "TOKEN" && this.identity)
      return [
        {
          polarity: true,
          what: "TOKEN",
          identity: this.identity
        }
      ];
    else if (!this.parser)
      throw new Error(
        "Cannot get first-set in non-terminal from undefined child parser"
      );
    else return this.parser.first;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue> | null {
    if (!this.parser)
      throw new Error("Cannot parse non-terminal with undefined child parser");
    let cursor = options.from;
    if (this.mode === "TOKEN") {
      let skipped = preskip(input, options, internals);
      if (skipped === null) return null;
      else cursor = skipped;
    }
    const skipChild = skipChildByMode[this.mode];
    const match = this.parser._parse(
      input,
      {
        ...options,
        from: cursor,
        skip: skipChild === null ? options.skip : skipChild
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

  get first(): First[] {
    return this.parser.first;
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue> | null {
    const matches: AnyMatch[] = [];
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
  ): Match<undefined> | null {
    const match = this.parser._parse(input, options, internals);
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
    else if (match && options.diagnose)
      this.first.forEach(first =>
        internals.tracker.writeFailure({
          from: match.from,
          to: match.to,
          type: "EXPECTATION_FAILURE",
          ...first
        })
      );
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "LITERAL",
        literal: this.literal
      }
    ];
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue> | null {
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
      internals.tracker.writeFailure({
        from: cursor,
        to: cursor,
        type: "EXPECTATION_FAILURE",
        ...this.first[0]
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "REGEX",
        pattern: this.pattern
      }
    ];
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue> | null {
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
      internals.tracker.writeFailure({
        from: cursor,
        to: cursor,
        type: "EXPECTATION_FAILURE",
        ...this.first[0]
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "START"
      }
    ];
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue> | null {
    if (options.from === 0)
      return success(input, 0, 0, [], this.action, options, internals);
    options.diagnose &&
      internals.tracker.writeFailure({
        from: options.from,
        to: options.from,
        type: "EXPECTATION_FAILURE",
        ...this.first[0]
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "END"
      }
    ];
  }

  _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TValue> | null {
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
      internals.tracker.writeFailure({
        from: cursor,
        to: cursor,
        type: "EXPECTATION_FAILURE",
        ...this.first[0]
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

const skipChildByMode: Record<NonTerminalMode, boolean | null> = {
  BYPASS: null,
  SKIP: true,
  UNSKIP: false,
  TOKEN: false
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
  matches: AnyMatch[],
  action: SemanticAction<TValue, TContext> | null,
  options: Options<TContext>,
  internals: Internals<TContext>
): Match<TValue> | null {
  const children = matches.reduce(
    (acc, match) => [
      ...acc,
      ...(match.value === undefined ? match.children : [match.value])
    ],
    [] as any[]
  );

  const arg = new SemanticMatchReport<TContext>(
    input,
    from,
    to,
    children,
    options,
    internals
  );

  let finalValue = undefined;
  let finalChildren = [];

  if (action) {
    try {
      finalValue = action(arg, arg);
    } catch (error) {
      if (error instanceof Error)
        options.diagnose &&
          internals.tracker.writeFailure({
            from,
            to,
            type: "SEMANTIC_FAILURE",
            message: error.message
          });
      else throw error;
      return null;
    }
  } else if (children.length === 1) finalValue = children[0];
  else finalChildren = children;

  return new Match<TValue>(input, from, to, finalChildren, finalValue);
}
