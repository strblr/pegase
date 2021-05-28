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
  Result
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
      skipper: new RawParser<undefined, Context>(/\s*/, false),
      skip: true,
      ignoreCase: false,
      context: undefined as any,
      ...options
    };
    const internals = {
      failures: [],
      warnings: []
    };
    const match = this.exec(fullOptions, internals);
    if (!match)
      return {
        success: false,
        warnings: internals.warnings,
        failure: mergeFailures(internals.failures)
      };
    return {
      ...match,
      success: true,
      match: fullOptions.input.substring(match.from, match.to),
      captures: {},
      warnings: internals.warnings
    };
  }
}

// GrammarParser

// TODO transform to OptionsParser ?

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

// RawParser

export class RawParser<
  Value extends string | undefined,
  Context
> extends Parser<Value, Context> {
  private readonly withCase: RegExp;
  private readonly withoutCase: RegExp;
  private readonly emit: Value extends string ? true : false;
  private readonly expectedOnFail: () => Expectation;

  constructor(
    pattern: string | RegExp,
    emit: Value extends string ? true : false
  ) {
    super();
    if (pattern instanceof RegExp) {
      const regExp = pattern;
      this.expectedOnFail = () => ({ type: ExpectationType.RegExp, regExp });
    } else {
      const literal = pattern;
      this.expectedOnFail = () => ({ type: ExpectationType.String, literal });
      pattern = new RegExp(escapeRegExp(literal));
    }
    this.withCase = extendFlags(pattern, "y");
    this.withoutCase = extendFlags(pattern, "iy");
    this.emit = emit;
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
