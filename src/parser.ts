import {
  createIndexes,
  createLocation,
  emitFailure,
  ExpectationType,
  extendFlags,
  FailureType,
  inferValue,
  log,
  Match,
  ParseOptions,
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
 * | RegExpParser
 * | NonTerminalParser
 * | CutParser
 * | OptionsParser
 * | SequenceParser
 * | GrammarParser
 * | TokenParser
 * | RepetitionParser
 * | PredicateParser
 * | TweakParser
 * | CaptureParser
 * | ActionParser
 *
 */

export abstract class Parser<Value = any, Context = any> {
  abstract exec(options: ParseOptions<Context>): Match | null;

  test(input: string, options?: Partial<ParseOptions<Context>>) {
    return this.parse(input, options).success;
  }

  value(input: string, options?: Partial<ParseOptions<Context>>) {
    const result = this.parse(input, options);
    if (!result.success) throw new Error(result.logs());
    return result.value;
  }

  children(input: string, options?: Partial<ParseOptions<Context>>) {
    const result = this.parse(input, options);
    if (!result.success) throw new Error(result.logs());
    return result.children;
  }

  parse(
    input: string,
    options?: Partial<ParseOptions<Context>>
  ): Result<Value, Context> {
    const indexes = createIndexes(input);
    const opts: ParseOptions<Context> = {
      input,
      from: createLocation(0, indexes),
      complete: true,
      skipper: defaultSkipper,
      skip: true,
      ignoreCase: false,
      tracer: defaultTracer,
      trace: false,
      context: undefined as any,
      internals: {
        indexes,
        cut: { current: false },
        warnings: [],
        failure: { current: null },
        committed: []
      },
      ...options
    };
    const parser = opts.complete
      ? new SequenceParser([this, endOfInput])
      : this;
    const match = parser.exec(opts);
    const common: ResultCommon = {
      options: opts,
      warnings: opts.internals.warnings,
      failures: [
        ...opts.internals.committed,
        ...(match || !opts.internals.failure.current
          ? []
          : [opts.internals.failure.current])
      ],
      logs(options) {
        return log(result, options);
      }
    };
    const result: Result<Value> = !match
      ? { ...common, success: false }
      : {
          ...common,
          ...match,
          success: true,
          value: inferValue(match.children),
          raw: input.substring(match.from.index, match.to.index),
          complete: match.to.index === input.length
        };
    return result;
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

  exec(options: ParseOptions): Match | null {
    const from = skip(options);
    if (from === null) return null;
    const to = from.index + this.literal.length;
    const raw = options.input.substring(from.index, to);
    const result = options.ignoreCase
      ? this.literal.toUpperCase() === raw.toUpperCase()
      : this.literal === raw;
    if (result)
      return {
        from,
        to: createLocation(to, options.internals.indexes),
        children: this.emit ? [raw] : [],
        captures: new Map()
      };
    emitFailure(options, {
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.Literal, literal: this.literal }]
    });
    return null;
  }
}

// RegExpParser

export class RegExpParser extends Parser {
  regExp: RegExp;
  withCase: RegExp;
  withoutCase: RegExp;

  constructor(regExp: RegExp) {
    super();
    this.regExp = regExp;
    this.withCase = extendFlags(regExp, "y");
    this.withoutCase = extendFlags(regExp, "iy");
  }

  exec(options: ParseOptions): Match | null {
    const from = skip(options);
    if (from === null) return null;
    const regExp = options.ignoreCase ? this.withoutCase : this.withCase;
    regExp.lastIndex = from.index;
    const result = regExp.exec(options.input);
    if (result !== null)
      return {
        from,
        to: createLocation(
          from.index + result[0].length,
          options.internals.indexes
        ),
        children: result.slice(1),
        captures: new Map(result.groups ? Object.entries(result.groups) : [])
      };
    emitFailure(options, {
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.RegExp, regExp: this.regExp }]
    });
    return result;
  }
}

// NonTerminalParser

export class NonTerminalParser extends Parser {
  label: string;
  fallback?: Parser;

  constructor(label: string, fallback?: Parser) {
    super();
    this.label = label;
    this.fallback = fallback;
  }

  exec(options: ParseOptions): Match | null {
    let parser = (options.grammar as GrammarParser | undefined)?.rules?.get(
      this.label
    );
    if (!parser)
      if (
        (parser = (this.fallback as GrammarParser | undefined)?.rules?.get(
          this.label
        ))
      )
        options = { ...options, grammar: this.fallback };
      else
        throw new Error(
          `Couldn't resolve rule "${this.label}", you can add it by merging grammars or via peg.extend`
        );
    options.trace &&
      options.tracer({
        type: TraceEventType.Enter,
        label: this.label,
        options
      });
    const match = parser.exec(options);
    if (match === null) {
      options.trace &&
        options.tracer({
          type: TraceEventType.Fail,
          label: this.label,
          options
        });
      return null;
    }
    options.trace &&
      options.tracer({
        type: TraceEventType.Match,
        label: this.label,
        options,
        match
      });
    return {
      ...match,
      captures: new Map([[this.label, inferValue(match.children)]])
    };
  }
}

// CutParser

export class CutParser extends Parser {
  exec(options: ParseOptions): Match | null {
    options.internals.cut.current = true;
    return {
      from: options.from,
      to: options.from,
      children: [],
      captures: new Map()
    };
  }
}

// OptionsParser

export class OptionsParser extends Parser {
  parsers: Array<Parser>;

  constructor(parsers: Array<Parser>) {
    super();
    this.parsers = parsers;
  }

  exec(options: ParseOptions) {
    options = {
      ...options,
      internals: { ...options.internals, cut: { current: false } }
    };
    for (const parser of this.parsers) {
      const match = parser.exec(options);
      if (match) return match;
      if (options.internals.cut.current) break;
    }
    return null;
  }
}

// SequenceParser

export class SequenceParser extends Parser {
  parsers: Array<Parser>;

  constructor(parsers: Array<Parser>) {
    super();
    this.parsers = parsers;
  }

  exec(options: ParseOptions): Match | null {
    let from = options.from;
    const matches: Array<Match> = [];
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

  constructor(rules: Array<[string, Parser]>) {
    super();
    this.rules = new Map(rules);
    this.entry = new NonTerminalParser(rules[0][0]);
  }

  exec(options: ParseOptions): Match | null {
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

  exec(options: ParseOptions) {
    const from = skip(options);
    if (from === null) return null;
    options = { ...options, from, skip: false };
    if (!this.displayName) return this.parser.exec(options);
    const match = this.parser.exec({
      ...options,
      internals: {
        ...options.internals,
        failure: { current: null },
        committed: []
      }
    });
    if (match) return match;
    emitFailure(options, {
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

  exec(options: ParseOptions): Match | null {
    let from = options.from,
      counter = 0;
    const matches: Array<Match> = [];
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

  exec(options: ParseOptions): Match | null {
    const match = this.parser.exec({
      ...options,
      ...(!this.polarity && {
        internals: {
          ...options.internals,
          warnings: [],
          failure: { current: null },
          committed: []
        }
      })
    });
    const success = () => ({
      from: options.from,
      to: options.from,
      children: [],
      captures: match ? match.captures : new Map()
    });
    if (this.polarity === Boolean(match)) return success();
    if (match)
      emitFailure(options, {
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
  options: (options: ParseOptions) => Partial<ParseOptions>;

  constructor(
    parser: Parser,
    options:
      | Partial<ParseOptions>
      | ((options: ParseOptions) => Partial<ParseOptions>)
  ) {
    super();
    this.parser = parser;
    this.options = typeof options === "function" ? options : () => options;
  }

  exec(options: ParseOptions) {
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

  exec(options: ParseOptions): Match | null {
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

  exec(options: ParseOptions): Match | null {
    const savedFailure = options.internals.failure.current;
    const savedCommitted = [...options.internals.committed];
    const match = this.parser.exec(options);
    if (match === null) return null;
    let value, emit, failed;
    const rewind = () => {
      failed = true;
      options.internals.failure.current = savedFailure;
      options.internals.committed.splice(
        0,
        options.internals.committed.length,
        ...savedCommitted
      );
    };
    try {
      value = this.action({
        ...Object.fromEntries(match.captures),
        $value: inferValue(match.children),
        $raw: options.input.substring(match.from.index, match.to.index),
        $from: match.from,
        $to: match.to,
        $children: match.children,
        $captures: match.captures,
        $options: options,
        $context: options.context,
        $commit() {
          if (options.internals.failure.current) {
            options.internals.committed.push(options.internals.failure.current);
            options.internals.failure.current = null;
          }
        },
        $warn(message: string) {
          options.internals.warnings.push({
            from: match.from,
            to: match.to,
            type: WarningType.Message,
            message
          });
        },
        $expected(...expected) {
          rewind();
          emitFailure(options, {
            from: match.from,
            to: match.to,
            type: FailureType.Expectation,
            expected: expected.map(expected =>
              typeof expected === "string"
                ? { type: ExpectationType.Literal, literal: expected }
                : expected instanceof RegExp
                ? { type: ExpectationType.RegExp, regExp: expected }
                : expected
            )
          });
        },
        $emit(children: Array<any> = match.children) {
          emit = children.filter(child => child !== undefined);
        }
      });
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      rewind();
      emitFailure(options, {
        from: match.from,
        to: match.to,
        type: FailureType.Semantic,
        message: e.message
      });
    }
    return failed
      ? null
      : { ...match, children: emit ?? (value === undefined ? [] : [value]) };
  }
}

// Presets

export const defaultSkipper = new RegExpParser(/\s*/);

export const pegSkipper = new RegExpParser(/(?:\s|#[^#\r\n]*[#\r\n])*/);

export const endOfInput = new TokenParser(
  new PredicateParser(new RegExpParser(/./), false),
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
  console.log(adjective, `"${event.label}"`, complement);
};
