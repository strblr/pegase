import escapeRegExp from "lodash/escapeRegExp";
import {
  EdgeType,
  Expectation,
  ExpectationType,
  extendFlags,
  FailureType,
  Internals,
  Match,
  mergeFailures,
  ParseOptions,
  preskip,
  Result,
  SemanticAction
} from ".";

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
      skipper: spaces,
      skip: true,
      ignoreCase: false,
      context: (undefined as unknown) as Context,
      ...options
    };
    const internals = {
      captures: Object.create(null),
      warnings: [],
      failures: [],
      committedFailures: []
    };
    const match = this.exec(fullOptions, internals);
    const common = {
      captures: internals.captures,
      warnings: internals.warnings,
      failures: [
        ...internals.committedFailures,
        mergeFailures(internals.failures)
      ]
    };
    if (!match) return { success: false, ...common };
    return {
      ...common,
      ...match,
      success: true,
      raw: fullOptions.input.substring(match.from, match.to)
    };
  }
}

// RawParser

export class RawParser<
  Value extends string | undefined,
  Context
> extends Parser<Value, Context> {
  readonly raw: string | RegExp;
  readonly emit: Value extends string ? true : false;
  private readonly withCase: RegExp;
  private readonly withoutCase: RegExp;
  private readonly expectedOnFail: () => Expectation;

  constructor(raw: string | RegExp, emit: Value extends string ? true : false) {
    super();
    this.raw = raw;
    this.emit = emit;
    if (raw instanceof RegExp) {
      const regExp = raw;
      this.expectedOnFail = () => ({ type: ExpectationType.RegExp, regExp });
    } else {
      const literal = raw;
      this.expectedOnFail = () => ({ type: ExpectationType.String, literal });
      raw = new RegExp(escapeRegExp(literal));
    }
    this.withCase = extendFlags(raw, "y");
    this.withoutCase = extendFlags(raw, "iy");
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    const cursor = preskip(options, internals);
    if (cursor === null) return null;
    const regExp = options.ignoreCase ? this.withoutCase : this.withCase;
    regExp.lastIndex = cursor;
    const result = regExp.exec(options.input);
    if (result !== null)
      return {
        from: cursor,
        to: cursor + result[0].length,
        value: (this.emit ? result[0] : undefined) as Value
      };
    internals.failures.push({
      from: cursor,
      to: cursor,
      type: FailureType.Expectation,
      expected: [this.expectedOnFail()]
    });
    return result;
  }
}

// EdgeParser

export class EdgeParser<Context> extends Parser<undefined, Context> {
  edge: EdgeType;

  constructor(edge: EdgeType) {
    super();
    this.edge = edge;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    switch (this.edge) {
      case EdgeType.Start:
        if (options.from === 0)
          return {
            from: 0,
            to: 0,
            value: undefined
          };
        internals.failures.push({
          from: options.from,
          to: options.from,
          type: FailureType.Expectation,
          expected: [{ type: ExpectationType.Edge, edge: EdgeType.Start }]
        });
        return null;

      case EdgeType.End:
        const cursor = preskip(options, internals);
        if (cursor === null) return null;
        if (cursor === options.input.length)
          return {
            from: cursor,
            to: cursor,
            value: undefined
          };
        internals.failures.push({
          from: cursor,
          to: cursor,
          type: FailureType.Expectation,
          expected: [{ type: ExpectationType.Edge, edge: EdgeType.End }]
        });
        return null;
    }
  }
}

// GrammarParser

export class GrammarParser<Value, Context> extends Parser<Value, Context> {
  readonly rules: Map<string, Parser<any, Context>>;

  constructor() {
    super();
    this.rules = new Map();
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    return this.rules
      .values()
      .next()
      .value.exec({ ...options, grammar: this }, internals);
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
        `Pegase couldn't resolve rule "${this.label}". You need to define it or merge it from another grammar.`
      );
    return parser.exec(options, internals);
  }
}

// ActionParser

export class ActionParser<Value, Context> extends Parser<Value, Context> {
  parser: Parser<any, Context>;
  action: SemanticAction<Value, Context>;

  constructor(
    parser: Parser<any, Context>,
    action: SemanticAction<Value, Context>
  ) {
    super();
    this.parser = parser;
    this.action = action;
  }

  exec(options: ParseOptions<Context>, internals: Internals) {
    const match = this.parser.exec(options, internals);
    if (match === null) return null;
    const $fail = (message: string) => {
      internals.failures.push({
        from: match.from,
        to: match.to,
        type: FailureType.Semantic,
        message
      });
    };
    let value;
    try {
      value = this.action({
        ...internals.captures,
        $options: options,
        $from: match.from,
        $to: match.to,
        $value: match.value,
        $raw: options.input.substring(match.from, match.to),
        $captures: internals.captures,
        $commit() {
          internals.committedFailures.push(mergeFailures(internals.failures));
          internals.failures = [];
        },
        $warn(message: string) {
          internals.warnings.push({ from: match.from, to: match.to, message });
        },
        $fail
      });
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      $fail(e.message);
      value = (undefined as unknown) as Value;
    }
    return { ...match, value };
  }
}

// OptionParser

class OptionParser<Value, Context> extends Parser<Value, Context> {
  readonly parsers: Array<Parser<any, Context>>;

  constructor(parsers: Array<Parser<any, Context>>) {
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

// Global parsers

export const spaces = new RawParser<undefined, any>(/\s*/, false);
export const any = new RawParser<undefined, any>(/./, false);
