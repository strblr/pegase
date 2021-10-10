import {
  $from,
  $to,
  applyVisitor,
  buildParseOptions,
  castArray,
  castExpectation,
  ExpectationType,
  extendFlags,
  hooks,
  inferValue,
  LiteralExpectation,
  Match,
  ParseOptions,
  ParseResult,
  RegexExpectation,
  SemanticAction,
  skip,
  TokenExpectation,
  TraceEventType,
  Tracer,
  Tweaker,
  WarningType
} from ".";

/** The parser inheritance structure
 *
 * Parser
 * | LiteralParser
 * | RegexParser
 * | CutParser
 * | AlternativeParser
 * | SequenceParser
 * | RepetitionParser
 * | TokenParser
 * | TweakParser
 * | | NonTerminalParser
 * | | PredicateParser
 * | | CaptureParser
 * | | ActionParser
 */

export abstract class Parser<Value = any, Context = any> {
  defaultOptions: Partial<ParseOptions<Context>> = {};

  abstract exec(options: ParseOptions<Context>): Match | null;

  test(input: string, options?: Partial<ParseOptions<Context>>) {
    return this.parse(input, options).success;
  }

  value(input: string, options?: Partial<ParseOptions<Context>>) {
    const result = this.parse(input, options);
    if (!result.success) throw new Error(result.logger.toString());
    return result.value;
  }

  children(input: string, options?: Partial<ParseOptions<Context>>) {
    const result = this.parse(input, options);
    if (!result.success) throw new Error(result.logger.toString());
    return result.children;
  }

  parse(
    input: string,
    options?: Partial<ParseOptions<Context>>
  ): ParseResult<Value, Context> {
    const opts = buildParseOptions(input, {
      ...this.defaultOptions,
      ...options
    });
    const parser = opts.complete
      ? new SequenceParser([this, endOfInput])
      : this;
    const match = parser.exec(opts);
    if (!match) {
      opts._ffCommit();
      return { success: false, options: opts, logger: opts.logger };
    }
    match.children = match.children.map(child =>
      castArray(opts.visit).reduce(
        (value, visitor) => applyVisitor(value, visitor, opts),
        child
      )
    );
    return {
      success: true,
      from: opts.logger.at(match.from),
      to: opts.logger.at(match.to),
      value: inferValue(match.children),
      children: match.children,
      raw: input.substring(match.from, match.to),
      complete: match.to === input.length,
      options: opts,
      logger: opts.logger
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

  exec(options: ParseOptions): Match | null {
    const from = skip(options);
    if (from === null) return null;
    const to = from + this.literal.length;
    const raw = options.input.substring(from, to);
    const result = options.ignoreCase
      ? this.literal.toLowerCase() === raw.toLowerCase()
      : this.literal === raw;
    if (result) return { from, to, children: this.emit ? [raw] : [] };
    options.log && options._ffExpect(from, this.expected);
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

  exec(options: ParseOptions): Match | null {
    const from = skip(options);
    if (from === null) return null;
    const regex = this[options.ignoreCase ? "uncased" : "cased"];
    regex.lastIndex = from;
    const result = regex.exec(options.input);
    if (result !== null) {
      if (result.groups) Object.assign(options.captures, result.groups);
      return { from, to: from + result[0].length, children: result.slice(1) };
    }
    options.log && options._ffExpect(from, this.expected);
    return null;
  }
}

// CutParser

export class CutParser extends Parser {
  exec(options: ParseOptions): Match | null {
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

  exec(options: ParseOptions) {
    const { cut } = options;
    options.cut = false;
    let match: Match | null;
    for (let i = 0; i !== this.parsers.length; ++i)
      if ((match = this.parsers[i].exec(options)) || options.cut) break;
    options.cut = cut;
    return match!;
  }
}

// SequenceParser

export class SequenceParser extends Parser {
  readonly parsers: Parser[];

  constructor(parsers: Parser[]) {
    super();
    this.parsers = parsers;
  }

  exec(options: ParseOptions): Match | null {
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

  exec(options: ParseOptions): Match | null {
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

  exec(options: ParseOptions) {
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
    options.log && options._ffExpect(skipped, this.expected!);
    return null;
  }
}

// TweakParser

export class TweakParser extends Parser {
  parser?: Parser;
  readonly tweaker: Tweaker;

  constructor(parser: Parser | undefined, tweaker: Tweaker) {
    super();
    this.parser = parser;
    this.tweaker = tweaker;
  }

  exec(options: ParseOptions): Match | null {
    return this.tweaker(options)(this.parser!.exec(options));
  }
}

// NonTerminalParser

export class NonTerminalParser extends TweakParser {
  readonly rule: string;

  constructor(rule: string, parser?: Parser) {
    super(parser, options => {
      options.trace &&
        options.tracer({
          type: TraceEventType.Enter,
          rule,
          from: options.logger.at(options.from),
          options
        });
      const { captures } = options;
      options.captures = {};
      return match => {
        options.captures = captures;
        if (options.trace)
          if (match === null)
            options.tracer({
              type: TraceEventType.Fail,
              rule,
              from: options.logger.at(options.from),
              options
            });
          else
            options.tracer({
              type: TraceEventType.Match,
              rule,
              from: options.logger.at(match.from),
              to: options.logger.at(match.to),
              children: match.children,
              options
            });
        return match;
      };
    });
    this.rule = rule;
  }
}

// PredicateParser

export class PredicateParser extends TweakParser {
  constructor(parser: Parser, polarity: boolean) {
    super(parser, options => {
      if (polarity)
        return match => {
          if (match === null) return null;
          return {
            from: options.from,
            to: options.from,
            children: []
          };
        };
      const { log } = options;
      options.log = false;
      return match => {
        options.log = log;
        if (match !== null) {
          options.log &&
            options._ffExpect(match.from, {
              type: ExpectationType.Mismatch,
              match: options.input.substring(match.from, match.to)
            });
          return null;
        }
        return {
          from: options.from,
          to: options.from,
          children: []
        };
      };
    });
  }
}

// CaptureParser

export class CaptureParser extends TweakParser {
  constructor(parser: Parser, name: string, all: boolean) {
    super(parser, options => match => {
      if (match === null) return null;
      options.captures[name] = all
        ? match.children
        : inferValue(match.children);
      return match;
    });
  }
}

// ActionParser

export class ActionParser extends TweakParser {
  constructor(parser: Parser, action: SemanticAction) {
    super(parser, options => {
      const ffIndex = options._ffIndex,
        ffType = options._ffType,
        ffSemantic = options._ffSemantic,
        ffExpectations = options._ffExpectations.concat();
      return match => {
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
              options.logger.warnings.push({
                from: $from(),
                to: $to(),
                type: WarningType.Message,
                message
              });
          },
          $fail(message) {
            failed = true;
            options._ffIndex = ffIndex;
            options._ffType = ffType;
            options._ffSemantic = ffSemantic;
            options._ffExpectations = ffExpectations;
            options.log && options._ffFail(match.from, message);
          },
          $expected(expected) {
            failed = true;
            options._ffIndex = ffIndex;
            options._ffType = ffType;
            options._ffSemantic = ffSemantic;
            options._ffExpectations = ffExpectations;
            options.log &&
              castArray(expected)
                .map(castExpectation)
                .forEach(expected => options._ffExpect(match.from, expected));
          },
          $commit: () => options._ffCommit(),
          $emit(children) {
            emit = children;
          },
          $node: (label, fields) => ({
            $label: label,
            $from: $from(),
            $to: $to(),
            ...fields
          })
        });
        try {
          value = action(options.captures);
        } catch (e) {
          hooks.pop();
          throw e;
        }
        hooks.pop();
        if (failed) return null;
        if (emit) match.children = emit;
        else if (value !== undefined) match.children = [value];
        return match;
      };
    });
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
