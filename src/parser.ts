import {
  ExpectationType,
  extendFlags,
  FailureType,
  inferValue,
  Internals,
  Match,
  mergeFailures,
  ParseOptions,
  Result,
  SemanticAction,
  skip,
  TraceEventType
} from ".";

/** The parser inheritance structure
 *
 * Parser
 * | LiteralParser
 * | RegExpParser
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
  ): Match | null;

  value(input: string, options?: Partial<ParseOptions<Context>>) {
    return this.parse(input, options).value;
  }

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
      cut: { active: false },
      warnings: [],
      failures: [],
      committed: []
    };
    const match = this.exec(fullOptions, internals);
    if (match)
      return {
        success: true,
        value: inferValue(match.children),
        raw: fullOptions.input.substring(match.from, match.to),
        warnings: internals.warnings,
        ...match
      };
    return {
      success: false,
      value: undefined,
      warnings: internals.warnings,
      failures: mergeFailures(internals),
      children: [],
      captures: new Map()
    };
  }
}

// LiteralParser

export class LiteralParser extends Parser {
  readonly type = "LITERAL_PARSER";
  readonly literal: string;
  readonly emit: boolean;

  constructor(literal: string, emit: boolean = false) {
    super();
    this.literal = literal;
    this.emit = emit;
  }

  exec(options: ParseOptions, internals: Internals) {
    const from = skip(options, internals);
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
        children: this.emit ? [raw] : [],
        captures: new Map()
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
  readonly type = "REGEXP_PARSER";
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
    const from = skip(options, internals);
    if (from === null) return null;
    const regExp = options.ignoreCase ? this.withoutCase : this.withCase;
    regExp.lastIndex = from;
    const result = regExp.exec(options.input);
    if (result !== null)
      return {
        from,
        to: from + result[0].length,
        children: [result[0]],
        captures: new Map(result.groups ? Object.entries(result.groups) : [])
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

// ReferenceParser

export class ReferenceParser extends Parser {
  readonly type = "REFERENCE_PARSER";
  readonly label: string;
  readonly external: Array<Parser>;

  constructor(label: string, external: Array<Parser> = []) {
    super();
    this.label = label;
    this.external = external;
  }

  exec(options: ParseOptions, internals: Internals) {
    const grammar = [options.grammar, ...this.external].find(grammar =>
      (grammar as GrammarParser | undefined)?.rules.get(this.label)
    );
    if (grammar) options = { ...options, grammar };
    else
      throw new Error(
        `Couldn't resolve rule "${this.label}", you can add it by merging grammars or via peg.addPlugin`
      );
    options.tracer?.({
      type: TraceEventType.Enter,
      label: this.label,
      options
    });
    const parser = (grammar as GrammarParser).rules.get(this.label)!;
    const match = parser.exec(options, internals);
    if (match === null) {
      options.tracer?.({
        type: TraceEventType.Fail,
        label: this.label,
        options
      });
      return null;
    }
    options.tracer?.({
      type: TraceEventType.Match,
      label: this.label,
      options,
      match
    });
    return {
      ...match,
      captures: new Map().set(this.label, inferValue(match.children))
    };
  }
}

// CutParser

export class CutParser extends Parser {
  readonly type = "CUT_PARSER";
  exec(options: ParseOptions, internals: Internals) {
    internals.cut.active = true;
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
  readonly type = "OPTIONS_PARSER";
  readonly parsers: Array<Parser>;

  constructor(parsers: Array<Parser>) {
    super();
    this.parsers = parsers;
  }

  exec(options: ParseOptions, internals: Internals) {
    const cut = { active: false };
    for (const parser of this.parsers) {
      const match = parser.exec(options, { ...internals, cut });
      if (match) return match;
      if (cut.active) break;
    }
    return null;
  }
}

// SequenceParser

export class SequenceParser extends Parser {
  readonly type = "SEQUENCE_PARSER";
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
      children: matches.map(match => match.children).flat(),
      captures: new Map(matches.map(match => [...match.captures]).flat())
    };
  }
}

// GrammarParser

export class GrammarParser extends Parser {
  readonly type = "GRAMMAR_PARSER";
  readonly rules: Map<string, Parser>;
  private readonly entry: Parser;

  constructor(rules: Array<[string, Parser]>) {
    super();
    this.rules = new Map(rules);
    this.entry = rules[0][1];
  }

  exec(options: ParseOptions, internals: Internals): Match | null {
    return this.entry.exec({ ...options, grammar: this }, internals);
  }
}

// TokenParser

export class TokenParser extends Parser {
  readonly type = "TOKEN_PARSER";
  readonly parser: Parser;
  readonly alias?: string;

  constructor(parser: Parser, alias?: string) {
    super();
    this.parser = parser;
    this.alias = alias;
  }

  exec(options: ParseOptions, internals: Internals) {
    const from = skip(options, internals);
    if (from === null) return null;
    const subInternals = { failures: [], committed: [] };
    const match = this.parser.exec(
      { ...options, from, skip: false },
      { ...internals, ...subInternals }
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
          failures: mergeFailures(subInternals)
        }
      ]
    });
    return null;
  }
}

// RepetitionParser

export class RepetitionParser extends Parser {
  readonly type = "REPETITION_PARSER";
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
      children: matches.map(match => match.children).flat(),
      captures: new Map(matches.map(match => [...match.captures]).flat())
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
  readonly type = "PREDICATE_PARSER";
  readonly parser: Parser;
  readonly polarity: boolean;

  constructor(parser: Parser, polarity: boolean) {
    super();
    this.parser = parser;
    this.polarity = polarity;
  }

  exec(options: ParseOptions, internals: Internals) {
    const subInternals = { failures: [], committed: [] };
    const match = this.parser.exec(options, {
      ...internals,
      ...subInternals
    });
    const success = () => ({
      from: options.from,
      to: options.from,
      children: [],
      captures: new Map()
    });
    if (this.polarity) {
      internals.failures.push(...subInternals.failures);
      internals.committed.push(...subInternals.committed);
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
  readonly type = "TWEAK_PARSER";
  readonly parser: Parser;
  readonly options: (options: ParseOptions) => Partial<ParseOptions>;

  constructor(
    parser: Parser,
    options: (options: ParseOptions) => Partial<ParseOptions>
  ) {
    super();
    this.parser = parser;
    this.options = options;
  }

  exec(options: ParseOptions, internals: Internals) {
    return this.parser.exec(
      { ...options, ...this.options(options) },
      internals
    );
  }
}

// CaptureParser

export class CaptureParser extends Parser {
  readonly type = "CAPTURE_PARSER";
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
      captures: new Map(match.captures).set(
        this.name,
        inferValue(match.children)
      )
    };
  }
}

// ActionParser

export class ActionParser extends Parser {
  readonly type = "ACTION_PARSER";
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
      let failed = false,
        propagate = undefined;
      const value = this.action({
        ...Object.fromEntries(match.captures),
        $value: inferValue(match.children),
        $raw: options.input.substring(match.from, match.to),
        $options: options,
        $match: match,
        $commit() {
          // BUG, won't be accessible from TokenParser for example
          internals.committed = mergeFailures(internals);
          internals.failures = [];
        },
        $warn(message: string) {
          internals.warnings.push({ from: match.from, to: match.to, message });
        },
        $expected(expected) {
          failed = true;
          if (!Array.isArray(expected)) expected = [expected];
          internals.failures.push({
            from: match.from,
            to: match.to,
            type: FailureType.Expectation,
            expected
          });
        },
        $propagate(children: Array<any> = match.children) {
          propagate = children.filter(child => child !== undefined);
        }
      });
      if (failed) return null;
      return {
        ...match,
        children: propagate ?? (value === undefined ? [] : [value])
      };
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

// Skippers

export const defaultSkipper = new RegExpParser(/\s*/);

export const pegSkipper = new RegExpParser(
  /(?:\s|#[^#\r\n]*(?:#|\r\n|\r|\n))*/
);
