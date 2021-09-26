import {
  applyVisitor,
  castArray,
  castExpectation,
  ExpectationType,
  extendFlags,
  FailureType,
  hooks,
  inferValue,
  LiteralExpectation,
  Logger,
  Match,
  Options,
  RegexExpectation,
  Result,
  ResultCommon,
  SemanticAction,
  skip,
  TokenExpectation,
  TraceEventType,
  Tracer,
  WarningType
} from ".";

/** The parser inheritance structure
 *
 * Parser
 * | LiteralParser
 * | RegexParser
 * | NonTerminalParser
 * | CutParser
 * | AlternativeParser
 * | SequenceParser
 * | GrammarParser
 * | TokenParser
 * | RepetitionParser
 * | PredicateParser
 * | TweakParser
 * | CaptureParser
 * | ActionParser
 */

export abstract class Parser<Value = any, Context = any> {
  defaultOptions: Partial<Options<Context>> = {};

  abstract exec(options: Options<Context>): Match | null;

  test(input: string, options?: Partial<Options<Context>>) {
    return this.parse(input, options).success;
  }

  value(input: string, options?: Partial<Options<Context>>) {
    const result = this.parse(input, options);
    if (!result.success) throw new Error(result.logger.print());
    return result.value;
  }

  children(input: string, options?: Partial<Options<Context>>) {
    const result = this.parse(input, options);
    if (!result.success) throw new Error(result.logger.print());
    return result.children;
  }

  parse(
    input: string,
    options?: Partial<Options<Context>>
  ): Result<Value, Context> {
    const logger = new Logger(input);
    const opts: Options<Context> = {
      input,
      from: logger.at(0),
      complete: true,
      skipper: defaultSkipper,
      skip: true,
      ignoreCase: false,
      tracer: defaultTracer,
      trace: false,
      context: undefined as any,
      visit: [],
      cut: false,
      captures: {},
      logger,
      log: true,
      ...this.defaultOptions,
      ...options
    };
    const parser = opts.complete
      ? new SequenceParser([this, endOfInput])
      : this;
    const match = parser.exec(opts);
    const common: ResultCommon = { options: opts, logger };
    if (!match) {
      logger.commit();
      return { ...common, success: false };
    }
    match.children = match.children.map(child =>
      castArray(opts.visit).reduce(
        (value, visitor) => applyVisitor(value, visitor, opts),
        child
      )
    );
    return {
      ...common,
      ...match,
      success: true,
      value: inferValue(match.children),
      raw: input.substring(match.from.index, match.to.index),
      complete: match.to.index === input.length
    };
  }
}

// LiteralParser

export class LiteralParser extends Parser {
  readonly literal: string;
  readonly emit: boolean;
  private readonly expected: LiteralExpectation;

  constructor(literal: string, emit: boolean = false) {
    super();
    this.literal = literal;
    this.emit = emit;
    this.expected = { type: ExpectationType.Literal, literal };
  }

  exec(options: Options): Match | null {
    const from = skip(options);
    if (from === null) return null;
    const to = from.index + this.literal.length;
    const raw = options.input.substring(from.index, to);
    const result = options.ignoreCase
      ? this.literal.toLowerCase() === raw.toLowerCase()
      : this.literal === raw;
    if (result)
      return {
        from,
        to: options.logger.at(to),
        children: this.emit ? [raw] : []
      };
    options.log &&
      options.logger.ffExpectation({
        from,
        to: from,
        type: FailureType.Expectation,
        expected: [this.expected]
      });
    return null;
  }
}

// RegexParser

export class RegexParser extends Parser {
  readonly regex: RegExp;
  private readonly cased: RegExp;
  private readonly uncased: RegExp;
  private readonly expected: RegexExpectation;

  constructor(regex: RegExp) {
    super();
    this.regex = regex;
    this.cased = extendFlags(regex, "y");
    this.uncased = extendFlags(regex, "iy");
    this.expected = { type: ExpectationType.RegExp, regex };
  }

  exec(options: Options): Match | null {
    const from = skip(options);
    if (from === null) return null;
    const regex = this[options.ignoreCase ? "uncased" : "cased"];
    regex.lastIndex = from.index;
    const result = regex.exec(options.input);
    if (result !== null) {
      if (result.groups) Object.assign(options.captures, result.groups);
      return {
        from,
        to: options.logger.at(from.index + result[0].length),
        children: result.slice(1)
      };
    }
    options.log &&
      options.logger.ffExpectation({
        from,
        to: from,
        type: FailureType.Expectation,
        expected: [this.expected]
      });
    return null;
  }
}

// NonTerminalParser

export class NonTerminalParser extends Parser {
  readonly rule: string;
  readonly fallback?: Parser;

  constructor(rule: string, fallback?: Parser) {
    super();
    this.rule = rule;
    this.fallback = fallback;
  }

  exec(options: Options): Match | null {
    let parser = (options.grammar as GrammarParser | undefined)?.rules.get(
      this.rule
    );
    if (!parser)
      if (
        (parser = (this.fallback as GrammarParser | undefined)?.rules.get(
          this.rule
        ))
      )
        options = { ...options, grammar: this.fallback };
      else
        throw new Error(
          `Couldn't resolve rule "${this.rule}", you can add it by merging grammars or via peg.extend`
        );
    options.trace &&
      options.tracer({
        type: TraceEventType.Enter,
        rule: this.rule,
        options
      });
    const { captures } = options;
    options.captures = {};
    const match = parser.exec(options);
    options.captures = captures;
    if (match === null) {
      options.trace &&
        options.tracer({
          type: TraceEventType.Fail,
          rule: this.rule,
          options
        });
      return null;
    }
    options.trace &&
      options.tracer({
        type: TraceEventType.Match,
        rule: this.rule,
        options,
        match
      });
    return match;
  }
}

// CutParser

export class CutParser extends Parser {
  exec(options: Options): Match | null {
    options.cut = true;
    return {
      from: options.from,
      to: options.from,
      children: []
    };
  }
}

// AlternativeParser

export class AlternativeParser extends Parser {
  readonly parsers: Parser[];

  constructor(parsers: Parser[]) {
    super();
    this.parsers = parsers;
  }

  exec(options: Options) {
    const { cut } = options;
    options.cut = false;
    for (let i = 0; i !== this.parsers.length; ++i) {
      const match = this.parsers[i].exec(options);
      if (match) {
        options.cut = cut;
        return match;
      }
      if (options.cut) break;
    }
    options.cut = cut;
    return null;
  }
}

// GrammarParser

export class GrammarParser extends Parser {
  readonly rules: Map<string, Parser>;
  private readonly entry: Parser;

  constructor(rules: [string, Parser][]) {
    super();
    this.rules = new Map(rules);
    this.entry = new NonTerminalParser(rules[0][0]);
  }

  exec(options: Options): Match | null {
    const { grammar } = options;
    options.grammar = this;
    const match = this.entry.exec(options);
    options.grammar = grammar;
    return match;
  }
}

// TokenParser

export class TokenParser extends Parser {
  readonly parser: Parser;
  readonly displayName?: string;
  private readonly expected?: TokenExpectation;

  constructor(parser: Parser, displayName?: string) {
    super();
    this.parser = parser;
    this.displayName = displayName;
    if (displayName)
      this.expected = { type: ExpectationType.Token, displayName };
  }

  exec(options: Options) {
    const skipped = skip(options);
    if (skipped === null) return null;
    let match;
    const { from, skip: sskip } = options;
    options.from = skipped;
    options.skip = false;
    if (!this.displayName) {
      match = this.parser.exec(options);
      options.from = from;
      options.skip = sskip;
      return match;
    }
    const { log } = options;
    options.log = false;
    match = this.parser.exec(options);
    options.from = from;
    options.skip = sskip;
    options.log = log;
    if (match) return match;
    options.log &&
      options.logger.ffExpectation({
        from: skipped,
        to: skipped,
        type: FailureType.Expectation,
        expected: [this.expected!]
      });
    return null;
  }
}

// SequenceParser

export class SequenceParser extends Parser {
  readonly parsers: Parser[];

  constructor(parsers: Parser[]) {
    super();
    this.parsers = parsers;
  }

  exec(options: Options): Match | null {
    const { from } = options;
    const matches: Match[] = [];
    for (let i = 0; i !== this.parsers.length; ++i) {
      const match = this.parsers[i].exec(options);
      if (match === null) {
        options.from = from;
        return null;
      }
      options.from = match.to;
      matches.push(match);
    }
    const result = {
      from: matches[0].from,
      to: options.from,
      children: matches.flatMap(match => match.children)
    };
    options.from = from;
    return result;
  }
}

// RepetitionParser

export class RepetitionParser extends Parser {
  readonly parser: Parser;
  readonly min: number;
  readonly max: number;

  constructor(parser: Parser, [min, max]: [number, number]) {
    super();
    this.parser = parser;
    this.min = min;
    this.max = max;
  }

  exec(options: Options): Match | null {
    const { from } = options;
    const matches: Match[] = [];
    let counter = 0;
    while (true) {
      const match = this.parser.exec(options);
      if (match) {
        options.from = match.to;
        matches.push(match);
        counter++;
      } else if (counter < this.min) {
        options.from = from;
        return null;
      } else break;
      if (counter === this.max) break;
    }
    const result = {
      ...(matches.length === 0
        ? { from, to: from }
        : { from: matches[0].from, to: options.from }),
      children: matches.flatMap(match => match.children)
    };
    options.from = from;
    return result;
  }
}

// PredicateParser

export class PredicateParser extends Parser {
  readonly parser: Parser;
  readonly polarity: boolean;

  constructor(parser: Parser, polarity: boolean) {
    super();
    this.parser = parser;
    this.polarity = polarity;
  }

  exec(options: Options): Match | null {
    if (this.polarity) {
      const match = this.parser.exec(options);
      if (match === null) return null;
    } else {
      const { log } = options;
      options.log = false;
      const match = this.parser.exec(options);
      options.log = log;
      if (match !== null) {
        options.log &&
          options.logger.ffExpectation({
            from: match.from,
            to: match.to,
            type: FailureType.Expectation,
            expected: [
              { type: ExpectationType.Mismatch, from: match.from, to: match.to }
            ]
          });
        return null;
      }
    }
    return {
      from: options.from,
      to: options.from,
      children: []
    };
  }
}

// TweakParser

export class TweakParser extends Parser {
  readonly parser: Parser;
  readonly options: (options: Options) => Partial<Options>;

  constructor(
    parser: Parser,
    options: Partial<Options> | ((options: Options) => Partial<Options>)
  ) {
    super();
    this.parser = parser;
    this.options = typeof options === "function" ? options : () => options;
  }

  exec(options: Options) {
    const next = this.options(options);
    const save: Record<string, any> = {};
    const keys = Object.keys(next);
    for (let i = 0; i !== keys.length; ++i) {
      const key = keys[i];
      save[key] = (options as any)[key];
      (options as any)[key] = (next as any)[key];
    }
    const match = this.parser.exec(options);
    for (let i = 0; i !== keys.length; ++i) {
      const key = keys[i];
      (options as any)[key] = save[key];
    }
    return match;
  }
}

// CaptureParser

export class CaptureParser extends Parser {
  readonly parser: Parser;
  readonly name: string;

  constructor(parser: Parser, name: string) {
    super();
    this.parser = parser;
    this.name = name;
  }

  exec(options: Options): Match | null {
    const match = this.parser.exec(options);
    if (match === null) return null;
    options.captures[this.name] = inferValue(match.children);
    return match;
  }
}

// ActionParser

export class ActionParser extends Parser {
  readonly parser: Parser;
  readonly action: SemanticAction;

  constructor(parser: Parser, action: SemanticAction) {
    super();
    this.parser = parser;
    this.action = action;
  }

  exec(options: Options): Match | null {
    const save = options.logger.save();
    const match = this.parser.exec(options);
    if (match === null) return null;
    let value, emit, failed;
    hooks.push({
      $from: () => match.from,
      $to: () => match.to,
      $children: () => match.children,
      $value: () => inferValue(match.children),
      $raw: () => options.input.substring(match.from.index, match.to.index),
      $options: () => options,
      $context: () => options.context,
      $warn: message =>
        options.log &&
        options.logger.warn({
          from: match.from,
          to: match.to,
          type: WarningType.Message,
          message
        }),
      $fail(message) {
        failed = true;
        options.logger.sync(save);
        options.log &&
          options.logger.ffSemantic({
            from: match.from,
            to: match.to,
            type: FailureType.Semantic,
            message
          });
      },
      $expected(expected) {
        failed = true;
        options.logger.sync(save);
        options.log &&
          options.logger.ffExpectation({
            from: match.from,
            to: match.to,
            type: FailureType.Expectation,
            expected: castExpectation(castArray(expected))
          });
      },
      $commit: () => options.logger.commit(),
      $emit(children) {
        emit = children;
      },
      $node: (label, fields) => ({
        $label: label,
        $from: match.from,
        $to: match.to,
        ...fields
      }),
      $visit() {
        throw new Error("The $visit hook is not available in semantic actions");
      }
    });
    try {
      value = this.action(options.captures);
    } catch (e) {
      hooks.pop();
      throw e;
    }
    hooks.pop();
    if (failed) return null;
    match.children = emit ?? (value === undefined ? match.children : [value]);
    return match;
  }
}

// Presets

export const defaultSkipper = new RegexParser(/\s*/);

export const pegSkipper = new RegexParser(/(?:\s|#[^#\r\n]*[#\r\n])*/);

export const endOfInput = new TokenParser(
  new PredicateParser(new RegexParser(/./), false),
  "end of input"
);

export const defaultTracer: Tracer = event => {
  const at = event.options.from;
  let adjective = "";
  let complement = "";
  switch (event.type) {
    case TraceEventType.Enter:
      adjective = "Entered";
      complement = `at (${at.line}:${at.column})`;
      break;
    case TraceEventType.Match:
      const { from, to } = event.match;
      adjective = "Matched";
      complement = `from (${from.line}:${from.column}) to (${to.line}:${to.column})`;
      break;
    case TraceEventType.Fail:
      adjective = "Failed";
      complement = `at (${at.line}:${at.column})`;
      break;
  }
  console.log(adjective, `"${event.rule}"`, complement);
};
