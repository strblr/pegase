import {
  applyVisitor,
  castArray,
  castExpectation,
  ExpectationType,
  extendFlags,
  FailureType,
  hooks,
  inferValue,
  Logger,
  Match,
  Options,
  Result,
  ResultCommon,
  SemanticAction,
  skip,
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
      cut: { current: false },
      logger,
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
  literal: string;
  emit: boolean;

  constructor(literal: string, emit: boolean = false) {
    super();
    this.literal = literal;
    this.emit = emit;
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
        children: this.emit ? [raw] : [],
        captures: new Map()
      };
    options.logger.hang({
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.Literal, literal: this.literal }]
    });
    return null;
  }
}

// RegexParser

export class RegexParser extends Parser {
  regExp: RegExp;
  cased: RegExp;
  uncased: RegExp;

  constructor(regExp: RegExp) {
    super();
    this.regExp = regExp;
    this.cased = extendFlags(regExp, "y");
    this.uncased = extendFlags(regExp, "iy");
  }

  exec(options: Options): Match | null {
    const from = skip(options);
    if (from === null) return null;
    const regExp = this[options.ignoreCase ? "uncased" : "cased"];
    regExp.lastIndex = from.index;
    const result = regExp.exec(options.input);
    if (result !== null)
      return {
        from,
        to: options.logger.at(from.index + result[0].length),
        children: result.slice(1),
        captures: new Map(result.groups ? Object.entries(result.groups) : [])
      };
    options.logger.hang({
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.RegExp, regExp: this.regExp }]
    });
    return null;
  }
}

// NonTerminalParser

export class NonTerminalParser extends Parser {
  rule: string;
  fallback?: Parser;

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
    const match = parser.exec(options);
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
    return { ...match, captures: new Map() };
  }
}

// CutParser

export class CutParser extends Parser {
  exec(options: Options): Match | null {
    options.cut.current = true;
    return {
      from: options.from,
      to: options.from,
      children: [],
      captures: new Map()
    };
  }
}

// AlternativeParser

export class AlternativeParser extends Parser {
  parsers: Parser[];

  constructor(parsers: Parser[]) {
    super();
    this.parsers = parsers;
  }

  exec(options: Options) {
    options = { ...options, cut: { current: false } };
    for (const parser of this.parsers) {
      const match = parser.exec(options);
      if (match) return match;
      if (options.cut.current) break;
    }
    return null;
  }
}

// SequenceParser

export class SequenceParser extends Parser {
  parsers: Parser[];

  constructor(parsers: Parser[]) {
    super();
    this.parsers = parsers;
  }

  exec(options: Options): Match | null {
    let from = options.from;
    const matches: Match[] = [];
    for (const parser of this.parsers) {
      const match = parser.exec({ ...options, from });
      if (match === null) return null;
      from = match.to;
      matches.push(match);
    }
    return {
      from: matches[0].from,
      to: from,
      children: matches.flatMap(match => match.children),
      captures: new Map(matches.flatMap(match => [...match.captures]))
    };
  }
}

// GrammarParser

export class GrammarParser extends Parser {
  rules: Map<string, Parser>;
  entry: Parser;

  constructor(rules: [string, Parser][]) {
    super();
    this.rules = new Map(rules);
    this.entry = new NonTerminalParser(rules[0][0]);
  }

  exec(options: Options): Match | null {
    return this.entry.exec({ ...options, grammar: this });
  }
}

// TokenParser

export class TokenParser extends Parser {
  parser: Parser;
  displayName?: string;

  constructor(parser: Parser, displayName?: string) {
    super();
    this.parser = parser;
    this.displayName = displayName;
  }

  exec(options: Options) {
    const from = skip(options);
    if (from === null) return null;
    options = { ...options, from, skip: false };
    if (!this.displayName) return this.parser.exec(options);
    const match = this.parser.exec({
      ...options,
      logger: options.logger.create()
    });
    if (match) return match;
    options.logger.hang({
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.Token, displayName: this.displayName }]
    });
    return null;
  }
}

// RepetitionParser

export class RepetitionParser extends Parser {
  parser: Parser;
  min: number;
  max: number;

  constructor(parser: Parser, [min, max]: [number, number]) {
    super();
    this.parser = parser;
    this.min = min;
    this.max = max;
  }

  exec(options: Options): Match | null {
    let from = options.from,
      counter = 0;
    const matches: Match[] = [];
    const success = () => ({
      ...(matches.length === 0
        ? { from: options.from, to: options.from }
        : { from: matches[0].from, to: matches[matches.length - 1].to }),
      children: matches.flatMap(match => match.children),
      captures: new Map(matches.flatMap(match => [...match.captures]))
    });
    while (true) {
      if (counter === this.max) return success();
      const match = this.parser.exec({ ...options, from });
      if (match) {
        matches.push(match);
        from = match.to;
        counter++;
      } else if (counter < this.min) return null;
      else return success();
    }
  }
}

// PredicateParser

export class PredicateParser extends Parser {
  parser: Parser;
  polarity: boolean;

  constructor(parser: Parser, polarity: boolean) {
    super();
    this.parser = parser;
    this.polarity = polarity;
  }

  exec(options: Options): Match | null {
    const match = this.parser.exec({
      ...options,
      ...(!this.polarity && { logger: options.logger.create() })
    });
    const success = () => ({
      from: options.from,
      to: options.from,
      children: [],
      captures: match ? match.captures : new Map()
    });
    if (this.polarity === Boolean(match)) return success();
    if (match)
      options.logger.hang({
        from: match.from,
        to: match.to,
        type: FailureType.Expectation,
        expected: [{ type: ExpectationType.Mismatch, match }]
      });
    return null;
  }
}

// TweakParser

export class TweakParser extends Parser {
  parser: Parser;
  options: (options: Options) => Partial<Options>;

  constructor(
    parser: Parser,
    options: Partial<Options> | ((options: Options) => Partial<Options>)
  ) {
    super();
    this.parser = parser;
    this.options = typeof options === "function" ? options : () => options;
  }

  exec(options: Options) {
    return this.parser.exec({ ...options, ...this.options(options) });
  }
}

// CaptureParser

export class CaptureParser extends Parser {
  parser: Parser;
  name: string;

  constructor(parser: Parser, name: string) {
    super();
    this.parser = parser;
    this.name = name;
  }

  exec(options: Options): Match | null {
    const match = this.parser.exec(options);
    if (match === null) return null;
    return {
      ...match,
      captures: new Map(match.captures).set(
        this.name,
        inferValue(match.children)
      )
    };
  }
}

// ActionParser

export class ActionParser extends Parser {
  parser: Parser;
  action: SemanticAction;

  constructor(parser: Parser, action: SemanticAction) {
    super();
    this.parser = parser;
    this.action = action;
  }

  exec(options: Options): Match | null {
    const save = options.logger.fork();
    const match = this.parser.exec(options);
    if (match === null) return null;
    let value, emit, failed;
    hooks.push({
      $from: () => match.from,
      $to: () => match.to,
      $children: () => match.children,
      $captures: () => match.captures,
      $value: () => inferValue(match.children),
      $raw: () => options.input.substring(match.from.index, match.to.index),
      $options: () => options,
      $context: () => options.context,
      $warn: message =>
        options.logger.warn({
          from: match.from,
          to: match.to,
          type: WarningType.Message,
          message
        }),
      $fail(message) {
        failed = true;
        options.logger.sync(save);
        options.logger.hang({
          from: match.from,
          to: match.to,
          type: FailureType.Semantic,
          message
        });
      },
      $expected(expected) {
        failed = true;
        options.logger.sync(save);
        options.logger.hang({
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
        $match: match,
        ...fields
      }),
      $visit() {
        throw new Error("The $visit hook is not available in semantic actions");
      }
    });
    try {
      value = this.action(Object.fromEntries(match.captures));
    } catch (e) {
      hooks.pop();
      throw e;
    }
    hooks.pop();
    return failed
      ? null
      : {
          ...match,
          children: emit ?? (value === undefined ? match.children : [value])
        };
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
