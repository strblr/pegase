import {
  ExpectationType,
  extendFlags,
  Failure,
  FailureType,
  Internals,
  Match,
  mergeFailures,
  ParseOptions,
  preskip,
  Result,
  SemanticAction
} from ".";

/** The parser inheritance structure
 *
 * Parser
 * | LiteralParser
 * | RegExpParser
 * | EndEdgeParser
 * | ReferenceParser
 * | OptionsParser
 * | SequenceParser
 * | DelegateParser
 * | | GrammarParser
 * | | TokenParser
 * | | RepetitionParser
 * | | TweakParser
 * | | CaptureParser
 * | | ActionParser
 *
 */

export abstract class Parser<Value, Context> {
  abstract exec(
    options: ParseOptions<Context>,
    internals: Internals
  ): Match<Value> | null;

  parse(
    input: string,
    options?: Partial<ParseOptions<Context>>
  ): Result<Value> {
    const fullOptions = {
      input,
      from: 0,
      skipper: defaultSkipper,
      skip: true,
      ignoreCase: false,
      context: (undefined as unknown) as Context,
      ...options
    };
    const internals = {
      warnings: [],
      failures: [],
      committedFailures: []
    };
    const match = this.exec(fullOptions, internals);
    const common = {
      warnings: internals.warnings,
      failures: [
        ...internals.committedFailures,
        mergeFailures(internals.failures)
      ]
    };
    return {
      ...common,
      ...(!match
        ? { success: false }
        : {
            ...match,
            success: true,
            raw: fullOptions.input.substring(match.from, match.to)
          })
    };
  }
}

// LiteralParser

export class LiteralParser<
  Value extends string | undefined,
  Context
> extends Parser<Value, Context> {
  readonly literal: string;
  readonly emit: boolean;

  constructor(literal: string, emit: boolean) {
    super();
    this.literal = literal;
    this.emit = emit;
  }

  exec(options: ParseOptions<any>, internals: Internals) {
    const from = preskip(options, internals);
    if (from === null) return null;
    const to = from + this.literal.length;
    const raw = options.input.substring(from, to);
    const result = options.ignoreCase
      ? this.literal.toUpperCase() === raw.toUpperCase()
      : this.literal === raw;
    if (result)
      return {
        from,
        to,
        value: (this.emit ? raw : undefined) as Value,
        captures: Object.create(null)
      };
    internals.failures.push({
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.Literal, literal: this.literal }]
    });
    return null;
  }
}

// RegExpParser

export class RegExpParser<Context> extends Parser<string, Context> {
  readonly regExp: RegExp;
  private readonly withCase: RegExp;
  private readonly withoutCase: RegExp;

  constructor(regExp: RegExp) {
    super();
    this.regExp = regExp;
    this.withCase = extendFlags(regExp, "y");
    this.withoutCase = extendFlags(regExp, "iy");
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    const from = preskip(options, internals);
    if (from === null) return null;
    const regExp = options.ignoreCase ? this.withoutCase : this.withCase;
    regExp.lastIndex = from;
    const result = regExp.exec(options.input);
    if (result !== null)
      return {
        from,
        to: from + result[0].length,
        value: result[0],
        captures: result.groups ?? Object.create(null)
      };
    internals.failures.push({
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.RegExp, regExp: this.regExp }]
    });
    return result;
  }
}

// EndEdgeParser

export class EndEdgeParser<Context> extends Parser<undefined, Context> {
  exec(options: ParseOptions<Context>, internals: Internals) {
    const from = preskip(options, internals);
    if (from === null) return null;
    if (from === options.input.length)
      return {
        from,
        to: from,
        value: undefined,
        captures: Object.create(null)
      };
    internals.failures.push({
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.EndEdge }]
    });
    return null;
  }
}

// ReferenceParser

export class ReferenceParser<Value, Context> extends Parser<Value, Context> {
  label: string;

  constructor(label: string) {
    super();
    this.label = label;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    const parser:
      | Parser<Value, Context>
      | undefined = options.grammar?.rules.get(this.label);
    if (!parser)
      throw new Error(
        `Couldn't resolve rule "${this.label}". You need to define it or merge it from another grammar.`
      );
    const match = parser.exec(options, internals);
    if (match === null) return null;
    return {
      ...match,
      captures: Object.assign(Object.create(null), {
        [this.label]: match.value
      })
    };
  }
}

// OptionsParser

export class OptionsParser<Value, Context> extends Parser<Value, Context> {
  readonly parsers: Array<Parser<Value, Context>>;

  constructor(parsers: Array<Parser<Value, Context>>) {
    super();
    this.parsers = parsers;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    for (const parser of this.parsers) {
      const match = parser.exec(options, internals);
      if (match) return match;
    }
    return null;
  }
}

// SequenceParser

export class SequenceParser<Value extends Array<any>, Context> extends Parser<
  Value,
  Context
> {
  readonly parsers: Array<Parser<Value[number] | undefined, Context>>;

  constructor(parsers: Array<Parser<Value[number] | undefined, Context>>) {
    super();
    this.parsers = parsers;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    let from = options.from;
    const matches: Array<Match<Value[number]>> = [];
    for (const parser of this.parsers) {
      const match = parser.exec({ ...options, from }, internals);
      if (match === null) return null;
      from = match.to;
      matches.push(match);
    }
    return {
      from: matches[0].from,
      to: from,
      value: (matches
        .map(match => match.value)
        .filter(value => value !== undefined) as unknown) as Value,
      captures: Object.assign(
        Object.create(null),
        ...matches.map(match => match.captures)
      )
    };
  }
}

// DelegateParser

export abstract class DelegateParser<
  Value,
  PreviousValue,
  Context
> extends Parser<Value, Context> {
  readonly parser: Parser<PreviousValue, Context>;

  protected constructor(parser: Parser<PreviousValue, Context>) {
    super();
    this.parser = parser;
  }
}

// GrammarParser

export class GrammarParser<Value, Context> extends DelegateParser<
  Value,
  Value,
  Context
> {
  readonly rules: Map<string, Parser<any, Context>>;

  constructor(rules: Array<[string, Parser<any, Context>]>) {
    super(rules.values().next().value);
    this.rules = new Map(rules);
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    return this.parser.exec(options, internals);
  }
}

// TokenParser

export class TokenParser<Value, Context> extends DelegateParser<
  Value,
  Value,
  Context
> {
  alias?: string;

  constructor(parser: Parser<Value, Context>, alias?: string) {
    super(parser);
    this.alias = alias;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    const from = preskip(options, internals);
    if (from === null) return null;
    const failures: Array<Failure> = [];
    const match = this.parser.exec(
      { ...options, from, skip: false },
      { ...internals, failures }
    );
    if (match) return match;
    internals.failures.push({
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [{ type: ExpectationType.Token, alias: this.alias }]
    });
    return null;
  }
}

// RepetitionParser

export class RepetitionParser<
  Value extends Array<any>,
  Context
> extends DelegateParser<Value, Value[number], Context> {
  readonly min: number;
  readonly max: number;

  constructor(
    parser: Parser<Value[number], Context>,
    min: number,
    max: number
  ) {
    super(parser);
    this.min = min;
    this.max = max;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    let from = options.from,
      counter = 0;
    const matches: Array<Match<Value[number]>> = [];
    const success = () => ({
      ...(matches.length === 0
        ? { from: options.from, to: options.from }
        : { from: matches[0].from, to: matches[matches.length - 1].to }),
      value: (matches.map(match => match.value) as unknown) as Value,
      captures: Object.assign(
        Object.create(null),
        ...matches.map(match => match.captures)
      )
    });
    while (true) {
      if (counter === this.max) return success();
      const match = this.parser.exec({ ...options, from }, internals);
      if (match) {
        matches.push(match);
        from = match.to;
        counter++;
      } else if (counter < this.min) return null;
      else return success();
    }
  }
}

// TweakParser

export class TweakParser<Value, Context> extends DelegateParser<
  Value,
  Value,
  Context
> {
  options: Partial<ParseOptions<Context>>;

  constructor(
    parser: Parser<Value, Context>,
    options: Partial<ParseOptions<Context>>
  ) {
    super(parser);
    this.options = options;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    return this.parser.exec({ ...options, ...this.options }, internals);
  }
}

// CaptureParser

export class CaptureParser<Value, Context> extends DelegateParser<
  Value,
  Value,
  Context
> {
  name: string;

  constructor(parser: Parser<Value, Context>, name: string) {
    super(parser);
    this.name = name;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    const match = this.parser.exec(options, internals);
    if (match === null) return null;
    return {
      ...match,
      captures: Object.assign(Object.create(null), match.captures, {
        [this.name]: match.value
      })
    };
  }
}

// ActionParser

export class ActionParser<Value, PreviousValue, Context> extends DelegateParser<
  Value,
  PreviousValue,
  Context
> {
  readonly action: SemanticAction<Value, PreviousValue, Context>;

  constructor(
    parser: Parser<PreviousValue, Context>,
    action: SemanticAction<Value, PreviousValue, Context>
  ) {
    super(parser);
    this.action = action;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    const match = this.parser.exec(options, internals);
    if (match === null) return null;
    try {
      const value = this.action({
        ...match.captures,
        $options: options,
        $context: options.context,
        $raw: options.input.substring(match.from, match.to),
        $from: match.from,
        $to: match.to,
        $value: match.value,
        $captures: match.captures,
        $commit() {
          internals.committedFailures.push(mergeFailures(internals.failures));
          internals.failures = [];
        },
        $warn(message: string) {
          internals.warnings.push({ from: match.from, to: match.to, message });
        }
      });
      return { ...match, value };
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      internals.failures.push({
        from: match.from,
        to: match.to,
        type: FailureType.Semantic,
        message: e.message
      });
      return null;
    }
  }
}

export const defaultSkipper = new RegExpParser(/\s*/);
