import {
  ExpectationType,
  extendFlags,
  FailureInternals,
  FailureType,
  Internals,
  Match,
  mergeFailures,
  nullObject,
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
      context: undefined as any,
      ...options
    };
    const internals = {
      warnings: [],
      failures: [],
      committedFailures: []
    };
    const match = this.exec(fullOptions, internals);
    return {
      warnings: internals.warnings,
      ...(match
        ? {
            ...match,
            success: true,
            raw: fullOptions.input.substring(match.from, match.to)
          }
        : {
            success: false,
            failures: mergeFailures(internals)
          })
    };
  }
}

// LiteralParser

export class LiteralParser extends Parser {
  readonly literal: string;
  readonly emit: boolean;

  constructor(literal: string, emit: boolean = false) {
    super();
    this.literal = literal;
    this.emit = emit;
  }

  exec(options: ParseOptions, internals: Internals) {
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
        value: this.emit ? raw : undefined,
        captures: nullObject()
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

export class RegExpParser extends Parser {
  readonly regExp: RegExp;
  private readonly withCase: RegExp;
  private readonly withoutCase: RegExp;

  constructor(regExp: RegExp) {
    super();
    this.regExp = regExp;
    this.withCase = extendFlags(regExp, "y");
    this.withoutCase = extendFlags(regExp, "iy");
  }

  exec(options: ParseOptions, internals: Internals) {
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
        captures: nullObject(result.groups ?? {})
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

export class EndEdgeParser extends Parser {
  exec(options: ParseOptions, internals: Internals) {
    const from = preskip(options, internals);
    if (from === null) return null;
    if (from === options.input.length)
      return {
        from,
        to: from,
        value: undefined,
        captures: nullObject()
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

export class ReferenceParser extends Parser {
  readonly label: string;

  constructor(label: string) {
    super();
    this.label = label;
  }

  exec(options: ParseOptions, internals: Internals) {
    const parser: Parser | undefined = (options.grammar as
      | GrammarParser
      | undefined)?.rules.get(this.label);
    if (!parser)
      throw new Error(
        `Couldn't resolve rule "${this.label}". You need to define it or merge it from another grammar.`
      );
    const match = parser.exec(options, internals);
    if (match === null) return null;
    return {
      ...match,
      captures: nullObject({ [this.label]: match.value })
    };
  }
}

// OptionsParser

export class OptionsParser extends Parser {
  readonly parsers: Array<Parser>;

  constructor(parsers: Array<Parser>) {
    super();
    this.parsers = parsers;
  }

  exec(options: ParseOptions, internals: Internals) {
    for (const parser of this.parsers) {
      const match = parser.exec(options, internals);
      if (match) return match;
    }
    return null;
  }
}

// SequenceParser

export class SequenceParser extends Parser {
  readonly parsers: Array<Parser>;

  constructor(parsers: Array<Parser>) {
    super();
    this.parsers = parsers;
  }

  exec(options: ParseOptions, internals: Internals) {
    let from = options.from;
    const matches: Array<Match> = [];
    for (const parser of this.parsers) {
      const match = parser.exec({ ...options, from }, internals);
      if (match === null) return null;
      from = match.to;
      matches.push(match);
    }
    return {
      from: matches[0].from,
      to: from,
      value: matches
        .map(match => match.value)
        .filter(value => value !== undefined),
      captures: nullObject(...matches.map(match => match.captures))
    };
  }
}

// GrammarParser

export class GrammarParser extends Parser {
  readonly parser: Parser;
  readonly rules: Map<string, Parser>;

  constructor(rules: Array<[string, Parser]>) {
    super();
    this.parser = rules[0][1];
    this.rules = new Map(rules);
  }

  exec(options: ParseOptions, internals: Internals): Match | null {
    return this.parser.exec({ ...options, grammar: this }, internals);
  }
}

// TokenParser

export class TokenParser extends Parser {
  readonly parser: Parser;
  readonly alias?: string;

  constructor(parser: Parser, alias?: string) {
    super();
    this.parser = parser;
    this.alias = alias;
  }

  exec(options: ParseOptions, internals: Internals) {
    const from = preskip(options, internals);
    if (from === null) return null;
    const failureInternals: FailureInternals = {
      failures: [],
      committedFailures: []
    };
    const match = this.parser.exec(
      { ...options, from, skip: false },
      { ...internals, ...failureInternals }
    );
    if (match) return match;
    internals.failures.push({
      from,
      to: from,
      type: FailureType.Expectation,
      expected: [
        {
          type: ExpectationType.Token,
          alias: this.alias,
          failures: mergeFailures(failureInternals)
        }
      ]
    });
    return null;
  }
}

// RepetitionParser

export class RepetitionParser extends Parser {
  readonly parser: Parser;
  readonly min: number;
  readonly max: number;

  constructor(parser: Parser, min: number, max: number) {
    super();
    this.parser = parser;
    this.min = min;
    this.max = max;
  }

  exec(options: ParseOptions, internals: Internals) {
    let from = options.from,
      counter = 0;
    const matches: Array<Match> = [];
    const success = () => ({
      ...(matches.length === 0
        ? { from: options.from, to: options.from }
        : { from: matches[0].from, to: matches[matches.length - 1].to }),
      value: matches
        .map(match => match.value)
        .filter(value => value !== undefined),
      captures: nullObject(...matches.map(match => match.captures))
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

// PredicateParser

export class PredicateParser extends Parser {
  readonly parser: Parser;
  readonly polarity: boolean;

  constructor(parser: Parser, polarity: boolean) {
    super();
    this.parser = parser;
    this.polarity = polarity;
  }

  exec(options: ParseOptions, internals: Internals) {
    const failureInternals: FailureInternals = {
      failures: [],
      committedFailures: []
    };
    const match = this.parser.exec(options, {
      ...internals,
      ...failureInternals
    });
    const success = () => ({
      from: options.from,
      to: options.from,
      value: undefined,
      captures: nullObject()
    });
    if (this.polarity) {
      internals.failures.push(...failureInternals.failures);
      internals.committedFailures.push(...failureInternals.committedFailures);
      if (!match) return null;
      return success();
    }
    if (!match) return success();
    internals.failures.push({
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
  readonly parser: Parser;
  readonly options: Partial<ParseOptions>;

  constructor(parser: Parser, options: Partial<ParseOptions>) {
    super();
    this.parser = parser;
    this.options = options;
  }

  exec(options: ParseOptions, internals: Internals) {
    return this.parser.exec({ ...options, ...this.options }, internals);
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

  exec(options: ParseOptions, internals: Internals) {
    const match = this.parser.exec(options, internals);
    if (match === null) return null;
    return {
      ...match,
      value: undefined,
      captures: nullObject(match.captures, { [this.name]: match.value })
    };
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

  exec(options: ParseOptions, internals: Internals) {
    const match = this.parser.exec(options, internals);
    if (match === null) return null;
    try {
      const value = this.action({
        ...match.captures,
        $raw: options.input.substring(match.from, match.to),
        $options: options,
        $match: match,
        $commit() {
          internals.committedFailures = mergeFailures(internals);
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
