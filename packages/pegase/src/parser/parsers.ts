import {
  castExpectation,
  cond,
  consoleTracer,
  defaultSkipper,
  EndOfInputExpectation,
  ExpectationType,
  Failure,
  FailureType,
  hooks,
  IdGenerator,
  LiteralExpectation,
  noop,
  Range,
  RegexExpectation,
  SemanticAction,
  TokenExpectation,
  TraceEventType,
  Tracer,
  uncompiledParse,
  Warning,
  WarningType
} from "../index.js";

export interface Options<Context = any> {
  from: number;
  complete: boolean;
  skipper: RegExp;
  skip: boolean;
  ignoreCase: boolean;
  tracer: Tracer<Context>;
  trace: boolean;
  log: boolean;
  context: Context;
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
  grammarStart: boolean;
  nonTerminals: {
    has: boolean;
  };
  captures: {
    has: false | string;
  };
  cut: {
    possible: boolean;
    has: false | string;
  };
  actions: {
    has:
      | false
      | {
          children: string;
          emit: string;
          failed: string;
          ffIndex: string;
          ffType: string;
          ffSemantic: string;
          ffExpectations: string;
        };
  };
}

/**
 * Abstract base class for all parsers
 */

export abstract class Parser<Context = any> {
  parse: (input: string, options?: Partial<Options>) => Result;

  constructor() {
    this.parse = uncompiledParse;
  }

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

  compile() {
    const id = new IdGenerator();
    const options: CompileOptions = {
      id,
      children: id.generate(),
      grammarStart: true,
      nonTerminals: { has: false },
      captures: { has: false },
      cut: { possible: false, has: false },
      actions: { has: false }
    };

    const defSkipper = id.generate(defaultSkipper);
    const consTracer = id.generate(consoleTracer);
    const endOfInputChildren = id.generate();
    const endOfInputFrom = id.generate();

    const code = this.generate(options);
    const endOfInput = new EndOfInputParser().generate({
      ...options,
      children: endOfInputChildren
    });

    const traceAt = options.nonTerminals.has && id.generate();
    const traceChildren = options.nonTerminals.has && id.generate();
    const hook = options.actions.has && id.generate(hooks);
    const castExpect = options.actions.has && id.generate(castExpectation);

    const parse = new Function(
      "links",
      "input",
      "opts",
      `
        const { ${id
          .entries()
          .map(([id]) => id)
          .join(",")} } = links;
        
        const options = {
          from: 0,
          complete: true,
          skipper: ${defSkipper},
          skip: true,
          ignoreCase: false,
          tracer: ${consTracer},
          trace: false,
          log: true,
          context: undefined,
          to: 0,
          warnings: [],
          failures: [],
          ffIndex: 0,
          ffType: null,
          ffSemantic: null,
          ffExpectations: [],
          ffExpect(expected) {
            if (
              this.ffIndex === this.from &&
              this.ffType !== "${FailureType.Semantic}"
            ) {
              this.ffType = "${FailureType.Expectation}";
              this.ffExpectations.push(expected);
            } else if (this.ffIndex < this.from) {
              this.ffIndex = this.from;
              this.ffType = "${FailureType.Expectation}";
              this.ffExpectations = [expected];
            }
          },
          ffFail(message) {
            if (this.ffIndex <= this.from) {
              this.ffIndex = this.from;
              this.ffType = "${FailureType.Semantic}";
              this.ffSemantic = message;
            }
          },
          ffCommit() {
            if (this.ffType !== null) {
              const pos = $at(this.ffIndex);
              if (this.ffType === "${FailureType.Expectation}")
                this.failures.push({
                  from: pos,
                  to: pos,
                  type: "${FailureType.Expectation}",
                  expected: this.ffExpectations
                });
              else
                this.failures.push({
                  from: pos,
                  to: pos,
                  type: "${FailureType.Semantic}",
                  message: this.ffSemantic
                });
              this.ffType = null;
            }
          },
          ...opts
        };
        
        let acc = 0;
        const indexes = input.split(/[\\r\\n]/).map(chunk => {
          const start = acc;
          acc += chunk.length + 1;
          return start;
        });
        
        function $at(index) {
          let line = 0;
          let n = indexes.length - 1;
          while (line < n) {
            const k = line + ((n - line) >> 1);
            if (index < indexes[k]) n = k - 1;
            else if (index >= indexes[k + 1]) line = k + 1;
            else {
              line = k;
              break;
            }
          }
          return {
            input,
            index,
            line: line + 1,
            column: index - indexes[line] + 1
          };
        }
          
        function $skip() {
          options.skipper.lastIndex = options.from;
          if (!options.skipper.test(input)) return false;
          options.from = options.skipper.lastIndex;
          return true;
        }
        
        ${cond(
          options.nonTerminals.has,
          `
            function $trace(rule, exec) {
              var ${traceAt} = $at(options.from);
              options.tracer({
                type: "${TraceEventType.Enter}",
                rule,
                at: ${traceAt}
              });
              var ${traceChildren} = exec();
              if (${traceChildren} === null)
                options.tracer({
                  type: "${TraceEventType.Fail}",
                  rule,
                  at: ${traceAt}
                });
              else
                options.tracer({
                  type: "${TraceEventType.Match}",
                  rule,
                  at: ${traceAt},
                  from: $at(options.from),
                  to: $at(options.to),
                  children: ${traceChildren}
                });
              return ${traceChildren};
            }
          `
        )}
        
        ${
          !options.actions.has
            ? ""
            : `
              var ${Object.values(options.actions.has).join(",")};
              ${hook}.push({
                $from: () => $at(options.from),
                $to: () => $at(options.to),
                $children: () => ${options.actions.has.children},
                $value: () => ${
                  options.actions.has.children
                }.length !== 1 ? void 0 : ${options.actions.has.children}[0],
                $raw: () => input.substring(options.from, options.to),
                $context: () => options.context,
                $options: () => options,
                $warn(message) {
                  options.log &&
                    options.warnings.push({
                      from: $at(options.from),
                      to: $at(options.to),
                      type: "${WarningType.Message}",
                      message
                    });
                },
                $fail(message) {
                  ${options.actions.has.failed} = true;
                  options.ffIndex = ${options.actions.has.ffIndex};
                  options.ffType = ${options.actions.has.ffType};
                  options.ffSemantic = ${options.actions.has.ffSemantic};
                  options.ffExpectations = ${
                    options.actions.has.ffExpectations
                  };
                  options.log && options.ffFail(message);
                },
                $expected(expected) {
                  ${options.actions.has.failed} = true;
                  options.ffIndex = ${options.actions.has.ffIndex};
                  options.ffType = ${options.actions.has.ffType};
                  options.ffSemantic = ${options.actions.has.ffSemantic};
                  options.ffExpectations = ${
                    options.actions.has.ffExpectations
                  };
                  options.log &&
                    expected
                      .map(${castExpect})
                      .forEach(expected => options.ffExpect(expected));
                },
                $commit: () => options.ffCommit(),
                $emit(children) {
                  ${options.actions.has.emit} = children;
                }
              });
            `
        }
        
        var ${options.children};
        ${cond(options.captures.has, `var ${options.captures.has} = {};`)}
        
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
          var ${endOfInputFrom} = options.from;
          options.from = options.to;
          ${endOfInput}
          if(${endOfInputChildren} !== null) {
            options.from = ${endOfInputFrom};
          } else {
            ${options.children} = null;
          }
        }
        
        if(${options.children} === null) {
          options.ffCommit();
          return {
            success: false,
            warnings: options.warnings,
            failures: options.failures
          }
        }
        return {
          success: true,
          from: $at(options.from),
          to: $at(options.to),
          children: ${options.children},
          warnings: options.warnings,
          failures: options.failures
        };
      `
    );

    this.parse = parse.bind(null, Object.fromEntries(id.entries()));
    (this.parse as any).code = parse.toString();
    return this;
  }

  abstract generate(options: CompileOptions): string;
}

// LiteralParser

export class LiteralParser extends Parser {
  readonly literal: string;
  readonly emit: boolean;
  private readonly caseSensitive: boolean;

  constructor(literal: string, emit: boolean = false) {
    super();
    this.literal = literal;
    this.emit = emit;
    this.caseSensitive = literal.toLowerCase() !== literal.toUpperCase();
  }

  generate(options: CompileOptions, test?: boolean): string {
    const substr = options.id.generate();
    const uncased = this.literal.toLowerCase();
    const children = this.emit && options.id.generate([this.literal]);
    const expectation = options.id.generate<LiteralExpectation>({
      type: ExpectationType.Literal,
      literal: this.literal
    });
    return `
      if(options.skip && !$skip())
        ${options.children} = null;
      else {
        ${cond(
          this.literal.length === 0,
          noop(options),
          `
            var ${substr} = ${cond(
            this.literal.length === 1,
            "input[options.from]",
            `input.substring(options.from, options.from + ${this.literal.length})`
          )};
            if(${cond(
              this.caseSensitive,
              `options.ignoreCase
                ? ${JSON.stringify(uncased)} === ${substr}.toLowerCase() :
              `
            )} ${JSON.stringify(this.literal)} === ${substr}) {
              options.to = options.from + ${this.literal.length};
              ${options.children} = ${children || "[]"};
            } else {
              ${options.children} = null;
              options.log && options.ffExpect(${expectation});
            }
          `
        )}
      }
    `;
  }
}

// RegexParser

export class RegexParser extends Parser {
  readonly regex: RegExp;
  private readonly hasGroups: boolean;
  private readonly hasNamedGroups: boolean;

  constructor(regex: RegExp) {
    super();
    this.regex = regex;
    this.hasGroups = /(?<!\\)\((?!\?:)/.test(this.regex.source);
    this.hasNamedGroups =
      this.hasGroups && /(?<!\\)\(\?<(?![=!])/.test(this.regex.source);
  }

  generate(options: CompileOptions): string {
    const regex = options.id.generate(new RegExp(this.regex, "y"));
    const regexNocase = options.id.generate(new RegExp(this.regex, "iy"));
    const expectation = options.id.generate<RegexExpectation>({
      type: ExpectationType.RegExp,
      regex: this.regex
    });
    const usedRegex = options.id.generate();
    const result = options.id.generate();
    const captures =
      this.hasNamedGroups &&
      (options.captures.has || (options.captures.has = options.id.generate()));
    return `
      if(options.skip && !$skip())
        ${options.children} = null;
      else {
        var ${usedRegex} = options.ignoreCase ? ${regexNocase} : ${regex};
        ${usedRegex}.lastIndex = options.from;
        ${cond(
          !this.hasGroups,
          `
            if(${usedRegex}.test(input)) {
              options.to = ${usedRegex}.lastIndex;
              ${options.children} = [];
            }
          `,
          `
            var ${result} = ${usedRegex}.exec(input);
            if(${result} !== null) {
              ${cond(captures, `Object.assign(${captures}, ${result}.groups);`)}
              options.to = ${usedRegex}.lastIndex;
              ${options.children} = ${result}.slice(1);
            }
          `
        )}
        else {
          ${options.children} = null;
          options.log && options.ffExpect(${expectation});
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
      if(options.skip && !$skip())
        ${options.children} = null;
      else {
        if(options.from === input.length) {
          ${noop(options)}
        } else {
          ${options.children} = null;
          options.log && options.ffExpect(${expectation});
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
      if(options.skip && !$skip())
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
              options.ffExpect(${expectation});
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
      options.captures.has || (options.captures.has = options.id.generate());
    return `
      if(options.skip && !$skip())
        ${options.children} = null;
      else {
        var ${reference} = ${captures}["${this.name}"];
        options.to = options.from + ${reference}.length;
        var ${raw} = input.substring(options.from, options.to);
        if(options.ignoreCase
          ? ${reference}.toLowerCase() === ${raw}.toLowerCase()
          : ${reference} === ${raw})
          ${options.children} = [];
        else {
          ${options.children} = null;
          options.log && options.ffExpect({
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
      ? options.cut.has || (options.cut.has = options.id.generate())
      : null;
    return `
      ${cond(id, `${id} = true;`)}
      ${noop(options)}
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
          has: false
        };
        const code = parser.generate({ ...options, cut });
        return `
          ${cond(cut.has, `var ${cut.has} = false;`)}
          ${code}
          if(${options.children} === null ${cond(cut.has, `&& !${cut.has}`)}) {
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
    const from = options.id.generate();
    const acc = options.id.generate();
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
          const captures: CompileOptions["captures"] = { has: false };
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
              ${cond(captures.has, `var ${captures.has} = {};`)}
              ${assignCode}
              ${code}
              return ${children};
            }
          `;
        })
        .join("\n")}
      ${options.grammarStart ? this.start.generate(options) : ""}
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
        ${options.children} = $trace("${this.rule}", function() {
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
          options.ffExpect({
            type: "${ExpectationType.Mismatch}",
            match: input.substring(options.from, options.to)
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
      options.captures.has || (options.captures.has = options.id.generate());
    return `
      ${this.parser.generate(options)}
      if(${options.children} !== null)
        [${this.captures
          .map(([spread, name]) => `${cond(spread, "...")}${captures}.${name}`)
          .join(",")}] = ${options.children};
    `;
  }
}

// CustomParser

export class CustomParser extends Parser {
  readonly generate: (options: CompileOptions) => string;

  constructor(generate: (options: CompileOptions) => string) {
    super();
    this.generate = generate;
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

  generate(options: CompileOptions): string {
    options.actions.has = options.actions.has || {
      children: options.id.generate(),
      emit: options.id.generate(),
      failed: options.id.generate(),
      ffIndex: options.id.generate(),
      ffType: options.id.generate(),
      ffSemantic: options.id.generate(),
      ffExpectations: options.id.generate()
    };
    const value = options.id.generate();
    const action = options.id.generate(this.action);
    const captures =
      options.captures.has || (options.captures.has = options.id.generate());
    const ffIndex = options.id.generate();
    const ffType = options.id.generate();
    const ffSemantic = options.id.generate();
    const ffExpectations = options.id.generate();
    return `
      var ${ffIndex} = options.ffIndex,
        ${ffType} = options.ffType,
        ${ffSemantic} = options.ffSemantic,
        ${ffExpectations} = options.ffExpectations.concat();
      
      ${this.parser.generate(options)}
      
      if(${options.children} !== null) {
        ${options.actions.has.children} = ${options.children};
        ${options.actions.has.ffIndex} = ${ffIndex};
        ${options.actions.has.ffType} = ${ffType};
        ${options.actions.has.ffSemantic} = ${ffSemantic};
        ${options.actions.has.ffExpectations} = ${ffExpectations};
        ${options.actions.has.emit} = void 0;
        ${options.actions.has.failed} = false;
        
        var ${value} = ${action}(${captures});
        
        if (${options.actions.has.failed}) {
          ${options.children} = null;
        } else if (${options.actions.has.emit} !== void 0) {
          ${options.children} = ${options.actions.has.emit};
        } else if (${value} !== void 0) {
          ${options.children} = [${value}]
        }
      }
    `;
  }
}
