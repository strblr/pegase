import { endOfInput } from ".";
import {
  $from,
  $to,
  buildOptions,
  castExpectation,
  CompileOptions,
  ExpectationType,
  extendFlags,
  hooks,
  idGenerator,
  Links,
  log,
  Options,
  Result,
  RuleConfig,
  SemanticAction,
  skip,
  trace,
  Tweaker,
  WarningType
} from "..";

// Parser

export abstract class Parser<Context = any> {
  readonly defaultOptions: Partial<Options<Context>> = {};
  links?: Links;
  exec?: (options: Options, links: Record<string, any>) => any[] | null;

  test(input: string, options?: Partial<Options<Context>>) {
    return this.parse(input, options).success;
  }

  value<Value = any>(
    input: string,
    options?: Partial<Options<Context>>
  ): Value | undefined {
    const result = this.parse(input, options);
    if (!result.success || result.children.length !== 1) return undefined;
    return result.children[0];
  }

  children(input: string, options?: Partial<Options<Context>>) {
    const result = this.parse(input, options);
    if (!result.success) throw new Error(result.log());
    return result.children;
  }

  parse(input: string, options?: Partial<Options<Context>>): Result<Context> {
    const opts = buildOptions(input, {
      ...this.defaultOptions,
      ...options
    });
    let children = this.exec!(opts, this.links!);
    if (children === null) {
      opts._ffCommit();
      return {
        success: false,
        options: opts,
        warnings: opts.warnings,
        failures: opts.failures,
        log(options) {
          return log(input, {
            warnings: opts.warnings,
            failures: opts.failures,
            ...options
          });
        }
      };
    }
    if (opts.complete) {
      const from = opts.from;
      opts.from = opts.to;
      if (endOfInput.exec!(opts, endOfInput.links!) === null) {
        opts._ffCommit();
        return {
          success: false,
          options: opts,
          warnings: opts.warnings,
          failures: opts.failures,
          log(options) {
            return log(input, {
              warnings: opts.warnings,
              failures: opts.failures,
              ...options
            });
          }
        };
      }
      opts.from = from;
    }
    return {
      success: true,
      from: opts.at(opts.from),
      to: opts.at(opts.to),
      children,
      raw: opts.input.substring(opts.from, opts.to),
      complete: opts.to === opts.input.length,
      options: opts,
      warnings: opts.warnings,
      failures: opts.failures,
      log(options) {
        return log(input, {
          warnings: opts.warnings,
          failures: opts.failures,
          ...options
        });
      }
    };
  }

  compile() {
    const id = idGenerator();
    const children = id();
    const captures = id();
    this.links = { nochild: [], skip, trace };
    const code = this.generate({
      id,
      links: this.links,
      children,
      captures,
      cut: {
        possible: false,
        id: null
      }
    });
    this.exec = new Function(
      "options",
      "links",
      `
        ${Object.keys(this.links)
          .map(key => `var ${key} = links.${key};`)
          .join("\n")}
        var ${children};
        var ${captures} = {};
        ${code}
        return ${children};
      `
    ) as any;
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
    const literal = options.id();
    const literalNocase =
      this.literal !== this.literal.toLowerCase() && options.id();
    const children = this.emit && options.id();
    const expectation = options.id();
    const raw = options.id();
    options.links[literal] = this.literal;
    literalNocase &&
      (options.links[literalNocase] = this.literal.toLowerCase());
    children && (options.links[children] = [this.literal]);
    options.links[expectation] = {
      type: ExpectationType.Literal,
      literal: this.literal
    };
    return `
      if(!skip(options))
        ${options.children} = null;
      else {
        options.to = options.from + ${literal}.length;
        var ${raw} = options.input.substring(options.from, options.to);
        if(options.ignoreCase
          ? ${literalNocase || literal} === ${raw}.toLowerCase()
          : ${literal} === ${raw})
          ${options.children} = ${children || "nochild"};
        else {
          ${options.children} = null;
          options.log && options._ffExpect(options.from, ${expectation});
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
    this.hasCaptures = /\(\?<[\w]+>/.test(this.regex.toString());
  }

  generate(options: CompileOptions): string {
    const regex = options.id();
    const regexNocase = options.id();
    const usedRegex = options.id();
    const expectation = options.id();
    const result = options.id();
    options.links[regex] = extendFlags(this.regex, "y");
    options.links[regexNocase] = extendFlags(this.regex, "iy");
    options.links[expectation] = {
      type: ExpectationType.RegExp,
      regex: this.regex
    };
    return `
      if(!skip(options))
        ${options.children} = null;
      else {
        var ${usedRegex} = options.ignoreCase ? ${regexNocase} : ${regex};
        ${usedRegex}.lastIndex = options.from;
        var ${result} = ${usedRegex}.exec(options.input);
        if(${result} !== null) {
          ${
            this.hasCaptures
              ? `if (${result}.groups) Object.assign(${options.captures}, ${result}.groups);`
              : ""
          }
          options.to = options.from + ${result}[0].length;
          ${options.children} = ${result}.slice(1);
        } else {
          ${options.children} = null;
          options.log && options._ffExpect(options.from, ${expectation});
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
    const skip = options.id();
    const log = options.id();
    const expectation = this.displayName && options.id();
    expectation &&
      (options.links[expectation] = {
        type: ExpectationType.Token,
        displayName: this.displayName!
      });
    if (!this.parser.generate) {
      console.log({ this: this });
      return "";
    }
    const code = this.parser.generate(options);
    return `
      if(!skip(options))
        ${options.children} = null;
      else {
        var ${skip} = options.skip;
        options.skip = false;
        ${
          !this.displayName
            ? code
            : `
              var ${log} = options.log;
              options.log = false;
              ${code}
              options.log = ${log};
              if(${options.children} === null && ${log})
                options._ffExpect(options.from, ${expectation});
            `
        }
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
    const reference = options.id();
    const raw = options.id();
    return `
      if(!skip(options))
        ${options.children} = null;
      else {
        var ${reference} = ${options.captures}["${this.name}"];
        options.to = options.from + ${reference}.length;
        var ${raw} = options.input.substring(options.from, options.to);
        if(options.ignoreCase
          ? ${reference}.toLowerCase() === ${raw}.toLowerCase()
          : ${reference} === ${raw})
          ${options.children} = nochild;
        else {
          ${options.children} = null;
          options.log && options._ffExpect(options.from, {
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
      ? options.cut.id ?? (options.cut.id = options.id())
      : null;
    return `
      ${id ? `${id} = true;` : ""}
      options.to = options.from;
      ${options.children} = nochild;
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
    const from = options.id();
    const captures = options.id();
    return `
      var ${from} = options.from;
      var ${captures} = {};
      ${this.parsers.reduceRight((acc, parser, index) => {
        const cut: CompileOptions["cut"] = {
          possible: index !== this.parsers.length - 1,
          id: null
        };
        const code = parser.generate({ ...options, captures, cut });
        return `
          ${index !== 0 ? `${captures} = {};` : ""}
          ${cut.id ? `var ${cut.id} = false;` : ""}
          ${code}
          if(${options.children} === null ${cut.id ? `&& !${cut.id}` : ""}) {
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
    const acc = options.id();
    const from = options.id();
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
    const from = options.id();
    const to = options.id();
    const acc = options.id();
    const code = this.parser.generate(options);
    if (this.max === 1) {
      if (this.min === 1) return code;
      return `
        var ${from} = options.from;
        ${code}
        if(${options.children} === null) {
          options.from = options.to = ${from};
          ${options.children} = nochild;
        }
      `;
    }
    const temp = options.id();
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
      var ${from}${this.min === 0 ? " = options.from" : ""};
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
      ${
        this.min === 0
          ? `
            else {
              options.from = options.to = ${from};
              ${options.children} = nochild;
            }
          `
          : ""
      }
    `;
  }
}

// GrammarParser

export class GrammarParser extends Parser {
  readonly rules: Map<string, RuleConfig>;
  private readonly start: NonTerminalParser;

  constructor(rules: [string, RuleConfig][]) {
    super();
    this.rules = new Map(rules);
    this.start = new NonTerminalParser(rules[0][0]);
  }

  generate(options: CompileOptions): string {
    const children = options.id();
    const captures = options.id();
    return `
      ${Array.from(this.rules)
        .map(
          ([rule, [parameters, parser]]) => `
            function r_${rule}(${parameters
            .map(([name]) => `r_${name}`)
            .join(",")}) {
              var ${children};
              var ${captures} = {};
              ${parameters
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
                .join("\n")}
              ${parser.generate({ ...options, children, captures })}
              return ${children};
            }
          `
        )
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
    const children = options.id();
    const parameters = this.parameters.map(parameter =>
      parameter ? ([options.id(), parameter] as const) : null
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
        ${options.children} = trace("${this.rule}", options, function() {
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
    const from = options.id();
    const log = options.id();
    const code = this.parser.generate(options);
    if (this.polarity)
      return `
        var ${from} = options.from;
        ${code}
        if(${options.children} !== null) {
          options.from = options.to = ${from};
          ${options.children} = nochild;
        }
      `;
    return `
      var ${from} = options.from;
      var ${log} = options.log;
      options.log = false;
      ${code}
      options.log = ${log};
      if(${options.children} === null) {
        options.from = options.to = ${from};
        ${options.children} = nochild;
      } else {
        ${options.children} = null;
        options.log &&
          options._ffExpect(options.from, {
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
  readonly name: string;
  readonly all: boolean;

  constructor(parser: Parser, name: string, all = false) {
    super();
    this.parser = parser;
    this.name = name;
    this.all = all;
  }

  generate(options: CompileOptions): string {
    return `
      ${this.parser.generate(options)}
      if(${options.children} !== null)
        ${options.captures}["${this.name}"] = ${
      this.all
        ? options.children
        : `${options.children}.length === 1 ? ${options.children}[0] : undefined;`
    };
    `;
  }
}

// TweakParser

export class TweakParser extends Parser {
  readonly parser: Parser;
  readonly tweaker: Tweaker;

  constructor(parser: Parser, tweaker: Tweaker) {
    super();
    this.parser = parser;
    this.tweaker = tweaker;
  }

  generate(options: CompileOptions): string {
    const tweaker = options.id();
    const cleanUp = options.id();
    options.links[tweaker] = this.tweaker;
    return `
      var ${cleanUp} = ${tweaker}(options, ${options.captures});
      ${this.parser.generate(options)}
      ${options.children} = ${cleanUp}(${options.children})
    `;
  }
}

// ActionParser

export class ActionParser extends TweakParser {
  readonly action: SemanticAction;

  constructor(parser: Parser, action: SemanticAction) {
    super(parser, (options, captures) => {
      const ffIndex = options._ffIndex,
        ffType = options._ffType,
        ffSemantic = options._ffSemantic,
        ffExpectations = options._ffExpectations.concat();
      return children => {
        if (children === null) return null;
        let value, emit, failed;
        hooks.push({
          $from: () => options.at(options.from),
          $to: () => options.at(options.to),
          $children: () => children,
          $raw: () => options.input.substring(options.from, options.to),
          $options: () => options,
          $context: () => options.context,
          $warn(message) {
            options.log &&
              options.warnings.push({
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
            options.log && options._ffFail(options.from, message);
          },
          $expected(expected) {
            failed = true;
            options._ffIndex = ffIndex;
            options._ffType = ffType;
            options._ffSemantic = ffSemantic;
            options._ffExpectations = ffExpectations;
            options.log &&
              expected
                .map(castExpectation)
                .forEach(expected => options._ffExpect(options.from, expected));
          },
          $commit: () => options._ffCommit(),
          $emit(children) {
            emit = children;
          }
        });
        try {
          value = action(captures);
        } catch (e) {
          hooks.pop();
          throw e;
        }
        hooks.pop();
        if (failed) return null;
        if (emit !== undefined) return emit;
        else if (value !== undefined) return [value];
        return children;
      };
    });
    this.action = action;
  }
}
