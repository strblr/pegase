import {
  $from,
  $to,
  applyVisitor,
  castArray,
  castExpectation,
  ExpectationType,
  extendFlags,
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
 * | TokenParser
 * | SequenceParser
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
      from: 0,
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
      success: true,
      from: logger.at(match.from),
      to: logger.at(match.to),
      value: inferValue(match.children),
      children: match.children,
      raw: input.substring(match.from, match.to),
      complete: match.to === input.length
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
    const to = from + this.literal.length;
    const raw = options.input.substring(from, to);
    const result = options.ignoreCase
      ? this.literal.toLowerCase() === raw.toLowerCase()
      : this.literal === raw;
    if (result) return { from, to, children: this.emit ? [raw] : [] };
    options.log && options.logger.ffExpectation(from, this.expected);
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
    regex.lastIndex = from;
    const result = regex.exec(options.input);
    if (result !== null) {
      if (result.groups) Object.assign(options.captures, result.groups);
      return { from, to: from + result[0].length, children: result.slice(1) };
    }
    options.log && options.logger.ffExpectation(from, this.expected);
    return null;
  }
}

// NonTerminalParser

export class NonTerminalParser extends Parser {
  readonly rule: string;
  parser?: Parser;

  constructor(rule: string, parser?: Parser) {
    super();
    this.rule = rule;
    this.parser = parser;
  }

  exec(options: Options): Match | null {
    options.trace &&
      options.tracer({
        type: TraceEventType.Enter,
        rule: this.rule,
        from: options.logger.at(options.from),
        options
      });
    const { captures } = options;
    options.captures = {};
    const match = this.parser!.exec(options);
    options.captures = captures;
    if (match === null) {
      options.trace &&
        options.tracer({
          type: TraceEventType.Fail,
          rule: this.rule,
          from: options.logger.at(options.from),
          options
        });
      return null;
    }
    options.trace &&
      options.tracer({
        type: TraceEventType.Match,
        rule: this.rule,
        from: options.logger.at(match.from),
        to: options.logger.at(match.to),
        options
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
    options.log && options.logger.ffExpectation(skipped, this.expected!);
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
          options.logger.ffExpectation(match.from, {
            type: ExpectationType.Mismatch,
            match: options.input.substring(match.from, match.to)
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
  readonly tweaker: (options: Options) => (match: Match | null) => Match | null;

  constructor(parser: Parser, tweaker: typeof TweakParser.prototype.tweaker) {
    super();
    this.parser = parser;
    this.tweaker = tweaker;
  }

  exec(options: Options): Match | null {
    return this.tweaker(options)(this.parser.exec(options));
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
      $from: () => options.logger.at(match.from),
      $to: () => options.logger.at(match.to),
      $children: () => match.children,
      $value: () => inferValue(match.children),
      $raw: () => options.input.substring(match.from, match.to),
      $options: () => options,
      $context: () => options.context,
      $warn(message) {
        options.log &&
          options.logger.warn({
            from: $from(),
            to: $to(),
            type: WarningType.Message,
            message
          });
      },
      $fail(message) {
        failed = true;
        options.logger.sync(save);
        options.log && options.logger.ffSemantic(match.from, message);
      },
      $expected(expected) {
        failed = true;
        options.logger.sync(save);
        options.log &&
          castArray(expected)
            .map(castExpectation)
            .forEach(expected =>
              options.logger.ffExpectation(match.from, expected)
            );
      },
      $commit: () => options.logger.commit(),
      $emit(children) {
        emit = children;
      },
      $node: (label, fields) => ({
        $label: label,
        $from: $from(),
        $to: $to(),
        ...fields
      }),
      $visit() {
        throw new Error("The $visit hook is not available in semantic actions");
      },
      $parent() {
        throw new Error(
          "The $parent hook is not available in semantic actions"
        );
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
  const { from } = event;
  let adjective = "";
  let complement = "";
  switch (event.type) {
    case TraceEventType.Enter:
      adjective = "Entered";
      complement = `at (${from.line}:${from.column})`;
      break;
    case TraceEventType.Match:
      const { to } = event;
      adjective = "Matched";
      complement = `from (${from.line}:${from.column}) to (${to.line}:${to.column})`;
      break;
    case TraceEventType.Fail:
      adjective = "Failed";
      complement = `at (${from.line}:${from.column})`;
      break;
  }
  console.log(adjective, `"${event.rule}"`, complement);
};
