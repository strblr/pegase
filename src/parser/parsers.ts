import {
  buildOptions,
  castExpectation,
  cond,
  EndOfInputExpectation,
  Expectation,
  ExpectationType,
  extendFlags,
  Failure,
  FailureType,
  hooks,
  IdGenerator,
  LiteralExpectation,
  Location,
  Range,
  RegexExpectation,
  TokenExpectation,
  TraceEventType,
  Tracer,
  Warning,
  WarningType
} from "../index.js";

export interface Options<Context = any> {
  input: string;
  from: number;
  to: number;
  complete: boolean;
  skipper: RegExp;
  skip: boolean;
  ignoreCase: boolean;
  tracer: Tracer<Context>;
  trace: boolean;
  log: boolean;
  warnings: Warning[];
  failures: Failure[];
  context: Context;
  at(index: number): Location;
  _ffIndex: number;
  _ffType: FailureType | null;
  _ffSemantic: string | null;
  _ffExpectations: Expectation[];
  _ffExpect(expected: Expectation): void;
  _ffFail(message: string): void;
  _ffCommit(): void;
}

export type Result = SuccessResult | FailResult;

export interface SuccessResult extends Range {
  success: true;
  children: any[];
  warnings: Warning[];
  failures: Failure[];
}

export interface FailResult {
  success: false;
  warnings: Warning[];
  failures: Failure[];
}

export interface CompileOptions {
  id: IdGenerator;
  children: string;
  actions: {
    has: boolean;
  };
  nonTerminals: {
    has: boolean;
  };
  captures: {
    id: string | null;
  };
  cut: {
    possible: boolean;
    id: string | null;
  };
  hooks: {
    children: string;
    emit: string;
    failed: string;
    ffIndex: string;
    ffType: string;
    ffSemantic: string;
    ffExpectations: string;
  };
}

/**
 * Abstract base class for all parsers
 */

export abstract class Parser<Context = any> {
  readonly defaultOptions: Partial<Options<Context>> = {};
  exec?: (options: Options) => Result;

  test(input: string, options?: Partial<Options<Context>>) {
    return this.parse(input, options).success;
  }

  children(input: string, options?: Partial<Options<Context>>) {
    const result = this.parse(input, options);
    return !result.success ? undefined : result.children;
  }

  value(input: string, options?: Partial<Options<Context>>) {
    const result = this.parse(input, options);
    return !result.success || result.children.length !== 1
      ? undefined
      : result.children[0];
  }

  parse(input: string, options?: Partial<Options<Context>>) {
    return this.exec!(buildOptions(input, this.defaultOptions, options));
  }

  compile() {
    const id = new IdGenerator();
    const options: CompileOptions = {
      id,
      children: id.generate(),
      actions: { has: false },
      nonTerminals: { has: false },
      captures: { id: null },
      cut: { possible: false, id: null },
      hooks: {
        children: id.generate(),
        emit: id.generate(),
        failed: id.generate(),
        ffIndex: id.generate(),
        ffType: id.generate(),
        ffSemantic: id.generate(),
        ffExpectations: id.generate()
      }
    };

    const endOfInputChildren = id.generate();
    const code = this.generate(options);
    const endOfInput = new EndOfInputParser().generate({
      ...options,
      children: endOfInputChildren
    });

    const traceAt = options.nonTerminals.has && id.generate();
    const traceChildren = options.nonTerminals.has && id.generate();
    const hook = options.actions.has && id.generate(hooks);
    const castExpect = options.actions.has && id.generate(castExpectation);

    const exec = new Function(
      "links",
      "options",
      `
        var { ${id
          .entries()
          .map(([id]) => id)
          .join(",")} } = links;
          
        function u_skip() {
          options.skipper.lastIndex = options.from;
          if (!options.skipper.test(options.input)) return false;
          options.from = options.skipper.lastIndex;
          return true;
        }
        
        ${cond(
          options.nonTerminals.has,
          `
            function u_trace(rule, exec) {
              var ${traceAt} = options.at(options.from);
              options.tracer({
                type: "${TraceEventType.Enter}",
                rule,
                at: ${traceAt},
                options
              });
              var ${traceChildren} = exec();
              if (${traceChildren} === null)
                options.tracer({
                  type: "${TraceEventType.Fail}",
                  rule,
                  at: ${traceAt},
                  options
                });
              else
                options.tracer({
                  type: "${TraceEventType.Match}",
                  rule,
                  at: ${traceAt},
                  options,
                  from: options.at(options.from),
                  to: options.at(options.to),
                  children: ${traceChildren}
                });
              return ${traceChildren};
            }
          `
        )}
        
        ${cond(
          options.actions.has,
          `
            var ${Object.values(options.hooks).join(",")};
            ${hook}.push({
              $from: () => options.at(options.from),
              $to: () => options.at(options.to),
              $children: () => ${options.hooks.children},
              $value: () => ${options.hooks.children}.length !== 1 ? void 0 : ${
            options.hooks.children
          }[0],
              $raw: () => options.input.substring(options.from, options.to),
              $options: () => options,
              $context: () => options.context,
              $warn(message) {
                options.log &&
                  options.warnings.push({
                    from: options.at(options.from),
                    to: options.at(options.to),
                    type: "${WarningType.Message}",
                    message
                  });
              },
              $fail(message) {
                ${options.hooks.failed} = true;
                options._ffIndex = ${options.hooks.ffIndex};
                options._ffType = ${options.hooks.ffType};
                options._ffSemantic = ${options.hooks.ffSemantic};
                options._ffExpectations = ${options.hooks.ffExpectations};
                options.log && options._ffFail(message);
              },
              $expected(expected) {
                ${options.hooks.failed} = true;
                options._ffIndex = ${options.hooks.ffIndex};
                options._ffType = ${options.hooks.ffType};
                options._ffSemantic = ${options.hooks.ffSemantic};
                options._ffExpectations = ${options.hooks.ffExpectations};
                options.log &&
                  expected
                    .map(${castExpect})
                    .forEach(expected => options._ffExpect(expected));
              },
              $commit: () => options._ffCommit(),
              $emit(children) {
                ${options.hooks.emit} = children;
              }
            });
          `
        )}
        
        var ${options.children};
        ${cond(options.captures.id, `var ${options.captures.id} = {};`)}
        
        ${cond(
          options.actions.has,
          `
            try {
              ${code}
            } finally {
              ${hook}.pop();
            }
          `,
          code
        )}
        
        if(${options.children} !== null && options.complete) {
          var ${endOfInputChildren};
          var from = options.from;
          options.from = options.to;
          ${endOfInput}
          if(${endOfInputChildren} !== null) {
            options.from = from;
          } else {
            ${options.children} = null;
          }
        }
        
        if(${options.children} === null) {
          options._ffCommit();
          return {
            success: false,
            warnings: options.warnings,
            failures: options.failures
          }
        }
        return {
          success: true,
          from: options.at(options.from),
          to: options.at(options.to),
          children: ${options.children},
          warnings: options.warnings,
          failures: options.failures
        };
      `
    );

    this.exec = exec.bind(null, Object.fromEntries(id.entries()));
    (this.exec as any).code = exec.toString();
    return this;
  }

  abstract generate(options: CompileOptions): string;
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

  generate(options: CompileOptions, test?: boolean): string {
    const uncased = this.literal.toLowerCase();
    const isCaseSensitive = this.literal.toUpperCase() !== uncased;
    const raw = options.id.generate();
    const children = this.emit && options.id.generate([this.literal]);
    const expectation = options.id.generate<LiteralExpectation>({
      type: ExpectationType.Literal,
      literal: this.literal
    });
    return `
      if(options.skip && !u_skip())
        ${options.children} = null;
      else {
        options.to = options.from + ${this.literal.length};
        var ${raw} = options.input.substring(options.from, options.to);
        if(${cond(
          isCaseSensitive,
          `options.ignoreCase
            ? ${JSON.stringify(uncased)} === ${raw}.toLowerCase() :
          `
        )} ${JSON.stringify(this.literal)} === ${raw})
          ${options.children} = ${children || "[]"};
        else {
          ${options.children} = null;
          options.log && options._ffExpect(${expectation});
        }
      }
    `;
  }
}

// RegexParser

export class RegexParser extends Parser {
  readonly regex: RegExp;
  private readonly hasCaptures: boolean;

  constructor(regex: RegExp) {
    super();
    this.regex = regex;
    this.hasCaptures = /\(\?</.test(this.regex.source);
  }

  generate(options: CompileOptions): string {
    const regex = options.id.generate(extendFlags(this.regex, "y"));
    const regexNocase = options.id.generate(extendFlags(this.regex, "iy"));
    const expectation = options.id.generate<RegexExpectation>({
      type: ExpectationType.RegExp,
      regex: this.regex
    });
    const usedRegex = options.id.generate();
    const result = options.id.generate();
    const captures =
      this.hasCaptures &&
      (options.captures.id ?? (options.captures.id = options.id.generate()));
    return `
      if(options.skip && !u_skip())
        ${options.children} = null;
      else {
        var ${usedRegex} = options.ignoreCase ? ${regexNocase} : ${regex};
        ${usedRegex}.lastIndex = options.from;
        var ${result} = ${usedRegex}.exec(options.input);
        if(${result} !== null) {
          ${cond(captures, `Object.assign(${captures}, ${result}.groups);`)}
          options.to = ${usedRegex}.lastIndex;
          ${options.children} = ${result}.slice(1);
        } else {
          ${options.children} = null;
          options.log && options._ffExpect(${expectation});
        }
      }
    `;
  }
}

// EndOfInputParser

export class EndOfInputParser extends Parser {
  generate(options: CompileOptions) {
    const expectation = options.id.generate<EndOfInputExpectation>({
      type: ExpectationType.EndOfInput
    });
    return `
      if(options.skip && !u_skip())
        ${options.children} = null;
      else {
        if(options.from === options.input.length) {
          options.to = options.from;
          ${options.children} = [];
        } else {
          ${options.children} = null;
          options.log && options._ffExpect(${expectation});
        }
      }
    `;
  }
}

// TokenParser

export class TokenParser extends Parser {
  readonly parser: Parser;
  readonly displayName?: string;

  constructor(parser: Parser, displayName?: string) {
    super();
    this.parser = parser;
    this.displayName = displayName;
  }

  generate(options: CompileOptions): string {
    const skip = options.id.generate();
    const log = this.displayName && options.id.generate();
    const expectation =
      this.displayName &&
      options.id.generate<TokenExpectation>({
        type: ExpectationType.Token,
        displayName: this.displayName
      });
    const code = this.parser.generate(options);
    return `
      if(options.skip && !u_skip())
        ${options.children} = null;
      else {
        var ${skip} = options.skip;
        options.skip = false;
        ${cond(
          !this.displayName,
          code,
          `
            var ${log} = options.log;
            options.log = false;
            ${code}
            options.log = ${log};
            if(${options.children} === null && ${log})
              options._ffExpect(${expectation});
          `
        )}
        options.skip = ${skip};
      }
    `;
  }
}

// BackReferenceParser

export class BackReferenceParser extends Parser {
  readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  generate(options: CompileOptions): string {
    const reference = options.id.generate();
    const raw = options.id.generate();
    const captures =
      options.captures.id ?? (options.captures.id = options.id.generate());
    return `
      if(options.skip && !u_skip())
        ${options.children} = null;
      else {
        var ${reference} = ${captures}["${this.name}"];
        options.to = options.from + ${reference}.length;
        var ${raw} = options.input.substring(options.from, options.to);
        if(options.ignoreCase
          ? ${reference}.toLowerCase() === ${raw}.toLowerCase()
          : ${reference} === ${raw})
          ${options.children} = [];
        else {
          ${options.children} = null;
          options.log && options._ffExpect({
            type: "${ExpectationType.Literal}",
            literal: ${reference}
          });
        }
      }
    `;
  }
}

// CutParser

export class CutParser extends Parser {
  generate(options: CompileOptions): string {
    const id = options.cut.possible
      ? options.cut.id ?? (options.cut.id = options.id.generate())
      : null;
    return `
      ${cond(id, `${id} = true;`)}
      options.to = options.from;
      ${options.children} = [];
    `;
  }
}

// AlternativeParser

export class AlternativeParser extends Parser {
  readonly parsers: Parser[];

  constructor(parsers: Parser[]) {
    super();
    this.parsers = parsers;
  }

  generate(options: CompileOptions): string {
    const from = options.id.generate();
    return `
      var ${from} = options.from;
      ${this.parsers.reduceRight((acc, parser, index) => {
        const cut: CompileOptions["cut"] = {
          possible: index !== this.parsers.length - 1,
          id: null
        };
        const code = parser.generate({ ...options, cut });
        return `
          ${cond(cut.id, `var ${cut.id} = false;`)}
          ${code}
          if(${options.children} === null ${cond(cut.id, `&& !${cut.id}`)}) {
            options.from = ${from};
            ${acc}
          }
        `;
      }, "")}
    `;
  }
}

// SequenceParser

export class SequenceParser extends Parser {
  readonly parsers: Parser[];

  constructor(parsers: Parser[]) {
    super();
    this.parsers = parsers;
  }

  generate(options: CompileOptions): string {
    const [first, ...rest] = this.parsers;
    const acc = options.id.generate();
    const from = options.id.generate();
    return `
      ${first.generate(options)}
      if(${options.children} !== null) {
        var ${from} = options.from;
        var ${acc} = ${options.children}.concat();
        ${rest.reduceRight(
          (code, parser) => `
            options.from = options.to;
            ${parser.generate(options)}
            if(${options.children} !== null) {
              ${acc}.push.apply(${acc}, ${options.children});
              ${code}
            }
          `,
          `
            options.from = ${from};
            ${options.children} = ${acc};
          `
        )}
      }
    `;
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

  generate(options: CompileOptions): string {
    const from = options.id.generate();
    const to = options.id.generate();
    const acc = options.id.generate();
    const code = this.parser.generate(options);
    if (this.max === 1) {
      if (this.min === 1) return code;
      return `
        var ${from} = options.from;
        ${code}
        if(${options.children} === null) {
          options.from = options.to = ${from};
          ${options.children} = [];
        }
      `;
    }
    const temp = options.id.generate();
    const iterate = (times: number, finish: string = "") =>
      Array.from(Array(times)).reduceRight(
        code => `
          options.from = ${to};
          ${temp}();
          if(${options.children} !== null) {
            ${acc}.push.apply(${acc}, ${options.children});
            ${to} = options.to;
            ${code}
          }
        `,
        finish
      );
    return `
      var ${from}${cond(this.min === 0, " = options.from")};
      function ${temp}() { ${code} }
      ${temp}();
      if(${options.children} !== null) {
        ${from} = options.from;
        var ${to} = options.to;
        var ${acc} = ${options.children}.concat();
        ${iterate(
          this.min === 0 ? 0 : this.min - 1,
          `
            ${
              this.max !== Infinity
                ? iterate(this.max - (this.min === 0 ? 1 : this.min))
                : `
                  while(true) {
                    options.from = ${to};
                    ${temp}();
                    if(${options.children} === null)
                      break;
                    ${acc}.push.apply(${acc}, ${options.children});
                    ${to} = options.to;
                  }
                `
            }
            options.from = ${from};
            options.to = ${to};
            ${options.children} = ${acc};
          `
        )}
      }
      ${cond(
        this.min === 0,
        `
          else {
            options.from = options.to = ${from};
            ${options.children} = [];
          }
        `
      )}
    `;
  }
}

// GrammarParser

export type RuleConfig = [
  rule: string,
  parameters: [parameter: string, defaultValue: Parser | null][],
  definition: Parser
];

export class GrammarParser extends Parser {
  readonly rules: RuleConfig[];
  private readonly start: NonTerminalParser;

  constructor(rules: RuleConfig[]) {
    super();
    this.rules = rules;
    this.start = new NonTerminalParser(rules[0][0]);
  }

  generate(options: CompileOptions): string {
    const children = options.id.generate();
    return `
      ${this.rules
        .map(([rule, parameters, parser]) => {
          const captures: CompileOptions["captures"] = { id: null };
          const code = parser.generate({ ...options, children, captures });
          const assignCode = parameters
            .filter(([_, defaultParser]) => defaultParser)
            .map(
              ([name, defaultParser]) => `
                r_${name} = r_${name} !== void 0 ? r_${name} : function() {
                  var ${children};
                  ${defaultParser!.generate({
                    ...options,
                    children,
                    captures
                  })}
                  return ${children};
                }
              `
            )
            .join("\n");
          return `
            function r_${rule}(${parameters
            .map(([name]) => `r_${name}`)
            .join(",")}) {
              var ${children};
              ${cond(captures.id, `var ${captures.id} = {};`)}
              ${assignCode}
              ${code}
              return ${children};
            }
          `;
        })
        .join("\n")}
      ${this.start.generate(options)}
    `;
  }
}

// NonTerminalParser

export class NonTerminalParser extends Parser {
  readonly rule: string;
  readonly parameters: (Parser | null)[];

  constructor(rule: string, parameters: (Parser | null)[] = []) {
    super();
    this.rule = rule;
    this.parameters = parameters;
  }

  generate(options: CompileOptions): string {
    options.nonTerminals.has = true;
    const children = options.id.generate();
    const parameters = this.parameters.map(parameter =>
      parameter ? ([options.id.generate(), parameter] as const) : null
    );
    const call = `
      r_${this.rule}(${parameters
      .map(parameter => parameter?.[0] ?? "void 0")
      .join(",")})
    `;
    return `
      ${parameters
        .filter(parameter => Boolean(parameter))
        .map(
          parameter => `
            function ${parameter![0]}() {
              var ${children};
              ${parameter![1].generate({ ...options, children })}
              return ${children};
            };
          `
        )
        .join("\n")}
      if(options.trace) {
        ${options.children} = u_trace("${this.rule}", function() {
          return (${call});
        })
      } else {
        ${options.children} = ${call};
      }
    `;
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

  generate(options: CompileOptions): string {
    const from = options.id.generate();
    const code = this.parser.generate(options);
    if (this.polarity)
      return `
        var ${from} = options.from;
        ${code}
        if(${options.children} !== null) {
          options.from = options.to = ${from};
          ${options.children} = [];
        }
      `;
    const log = options.id.generate();
    return `
      var ${from} = options.from;
      var ${log} = options.log;
      options.log = false;
      ${code}
      options.log = ${log};
      if(${options.children} === null) {
        options.from = options.to = ${from};
        ${options.children} = [];
      } else {
        ${options.children} = null;
        options.log &&
          options._ffExpect({
            type: "${ExpectationType.Mismatch}",
            match: options.input.substring(options.from, options.to)
          });
      }
    `;
  }
}

// CaptureParser

export class CaptureParser extends Parser {
  readonly parser: Parser;
  readonly captures: [spread: boolean, name: string][];

  constructor(parser: Parser, captures: [spread: boolean, name: string][]) {
    super();
    this.parser = parser;
    this.captures = captures;
  }

  generate(options: CompileOptions): string {
    const captures =
      options.captures.id ?? (options.captures.id = options.id.generate());
    return `
      ${this.parser.generate(options)}
      if(${options.children} !== null)
        [${this.captures
          .map(([spread, name]) => `${cond(spread, "...")}${captures}.${name}`)
          .join(",")}] = ${options.children};
    `;
  }
}

// TweakParser

export type Tweaker = (
  options: Options
) => (children: any[] | null) => any[] | null;

export class TweakParser extends Parser {
  readonly parser: Parser;
  readonly tweaker: Tweaker;

  constructor(parser: Parser, tweaker: Tweaker) {
    super();
    this.parser = parser;
    this.tweaker = tweaker;
  }

  generate(options: CompileOptions): string {
    const tweaker = options.id.generate(this.tweaker);
    const cleanUp = options.id.generate();
    return `
      var ${cleanUp} = ${tweaker}(options);
      ${this.parser.generate(options)}
      ${options.children} = ${cleanUp}(${options.children})
    `;
  }
}

// ActionParser

export type SemanticAction = (captures: Record<string, any>) => any;

export class ActionParser extends Parser {
  readonly parser: Parser;
  readonly action: SemanticAction;

  constructor(parser: Parser, action: SemanticAction) {
    super();
    this.parser = parser;
    this.action = action;
  }

  generate(options: CompileOptions): string {
    options.actions.has = true;
    const value = options.id.generate();
    const action = options.id.generate(this.action);
    const captures =
      options.captures.id ?? (options.captures.id = options.id.generate());
    const ffIndex = options.id.generate();
    const ffType = options.id.generate();
    const ffSemantic = options.id.generate();
    const ffExpectations = options.id.generate();
    return `
      var ${ffIndex} = options._ffIndex,
        ${ffType} = options._ffType,
        ${ffSemantic} = options._ffSemantic,
        ${ffExpectations} = options._ffExpectations.concat();
      
      ${this.parser.generate(options)}
      
      if(${options.children} !== null) {
        ${options.hooks.children} = ${options.children};
        ${options.hooks.ffIndex} = ${ffIndex};
        ${options.hooks.ffType} = ${ffType};
        ${options.hooks.ffSemantic} = ${ffSemantic};
        ${options.hooks.ffExpectations} = ${ffExpectations};
        ${options.hooks.emit} = void 0;
        ${options.hooks.failed} = false;
        
        var ${value} = ${action}(${captures});
        
        if (${options.hooks.failed}) {
          ${options.children} = null;
        } else if (${options.hooks.emit} !== void 0) {
          ${options.children} = ${options.hooks.emit};
        } else if (${value} !== void 0) {
          ${options.children} = [${value}]
        }
      }
    `;
  }
}
