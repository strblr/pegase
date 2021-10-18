import {
  $from,
  $to,
  applyVisitor,
  buildOptions2,
  castArray,
  castExpectation,
  ExpectationType,
  extendFlags,
  hooks,
  inferValue,
  LiteralExpectation,
  Options2,
  RegexExpectation,
  Result2,
  SemanticAction,
  TokenExpectation,
  TraceEventType,
  Tracer2,
  Tweaker2,
  WarningType
} from ".";
import prettier from "prettier";

// Parser2

// TODO try to replace options.from and options.to with local from & to (like peg.js)

export abstract class Parser2<Value = any, Context = any> {
  readonly defaultOptions: Partial<Options2<Context>> = {};
  links?: Record<string, any>;
  exec?: (options: Options2, links: Record<string, any>) => any[] | null;

  parse(
    input: string,
    options?: Partial<Options2<Context>>
  ): Result2<Value, Context> {
    const opts = buildOptions2(input, {
      ...this.defaultOptions,
      ...options
    });
    let children = this.exec!(opts, this.links!);
    if (children === null) {
      opts._ffCommit();
      return {
        success: false,
        options: opts,
        logger: opts.logger
      };
    }
    const visitors = castArray(opts.visit);
    children = children.map(child =>
      visitors.reduce(
        (value, visitor) => applyVisitor(value, visitor, opts as any),
        child
      )
    );
    return {
      success: true,
      from: opts.logger.at(opts.from),
      to: opts.logger.at(opts.to),
      value: inferValue(children),
      children,
      raw: opts.input.substring(opts.from, opts.to),
      complete: opts.to === opts.input.length,
      options: opts,
      logger: opts.logger
    };
  }

  compile() {
    const id = idGenerator();
    const children = id();
    this.links = as<CommonLinks>({ nochild: [], hooks, skip, trace });
    const code = this.generate({ id, children, links: this.links });
    this.exec = new Function(
      "options",
      "links",
      prettier.format(js`
        ${Object.keys(this.links)
          .map(key => js`var ${key} = links.${key};`)
          .join("\n")}
        var ${children};
        ${code}
        return ${children};
      `)
    ) as any;
  }

  abstract generate(options: CompileOptions): string;
}

// LiteralParser2

export class LiteralParser2 extends Parser2 {
  readonly literal: string;
  readonly emit: boolean;

  constructor(literal: string, emit: boolean = false) {
    super();
    this.literal = literal;
    this.emit = emit;
  }

  generate(options: CompileOptions): string {
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
    options.links[expectation] = as<LiteralExpectation>({
      type: ExpectationType.Literal,
      literal: this.literal
    });
    return js`
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
          options.log && options._ffExpect(options.from, ${expectation});
          ${options.children} = null;
        }
      }
    `;
  }
}

// RegexParser2

export class RegexParser2 extends Parser2 {
  readonly regex: RegExp;

  constructor(regex: RegExp) {
    super();
    this.regex = regex;
  }

  generate(options: CompileOptions): string {
    const regex = options.id();
    const regexNocase = options.id();
    const usedRegex = options.id();
    const expectation = options.id();
    const result = options.id();
    options.links[regex] = extendFlags(this.regex, "y");
    options.links[regexNocase] = extendFlags(this.regex, "iy");
    options.links[expectation] = as<RegexExpectation>({
      type: ExpectationType.RegExp,
      regex: this.regex
    });
    return js`
      if(!skip(options))
        ${options.children} = null;
      else {
        var ${usedRegex} = options.ignoreCase ? ${regexNocase} : ${regex};
        ${usedRegex}.lastIndex = options.from;
        var ${result} = ${usedRegex}.exec(options.input);
        if(${result} !== null) {
          if (${result}.groups) Object.assign(options.captures, ${result}.groups);
          options.to = options.from + ${result}[0].length;
          ${options.children} = ${result}.slice(1);
        } else {
          options.log && options._ffExpect(options.from, ${expectation});
          ${options.children} = null;
        }
      }
    `;
  }
}

// TokenParser2

export class TokenParser2 extends Parser2 {
  readonly parser: Parser2;
  readonly displayName?: string;

  constructor(parser: Parser2, displayName?: string) {
    super();
    this.parser = parser;
    this.displayName = displayName;
  }

  generate(options: CompileOptions): string {
    const skip = options.id();
    const log = options.id();
    const expectation = this.displayName && options.id();
    expectation &&
      (options.links[expectation] = as<TokenExpectation>({
        type: ExpectationType.Token,
        displayName: this.displayName!
      }));
    const code = this.parser.generate(options);
    return js`
      if(!skip(options))
        ${options.children} = null;
      else {
        var ${skip} = options.skip;
        options.skip = false;
        ${
          !this.displayName
            ? code
            : js`
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

// CutParser2

export class CutParser2 extends Parser2 {
  generate(options: CompileOptions): string {
    return js`
      options.cut = true;
    `;
  }
}

// AlternativeParser2

export class AlternativeParser2 extends Parser2 {
  readonly parsers: Parser2[];

  constructor(parsers: Parser2[]) {
    super();
    this.parsers = parsers;
  }

  generate(options: CompileOptions): string {
    const from = options.id();
    const cut = options.id();
    return js`
      var ${from} = options.from;
      var ${cut} = options.cut;
      options.cut = false;
      ${this.parsers.reduceRight(
        (code, parser) => js`
          ${parser.generate(options)}
          if(${options.children} === null && !options.cut) {
            options.from = ${from};
            ${code}
          }
        `,
        ""
      )}
      options.cut = ${cut};
    `;
  }
}

// SequenceParser2

export class SequenceParser2 extends Parser2 {
  readonly parsers: Parser2[];

  constructor(parsers: Parser2[]) {
    super();
    this.parsers = parsers;
  }

  generate(options: CompileOptions): string {
    const [first, ...rest] = this.parsers;
    const acc = options.id();
    const from = options.id();
    return js`
      ${first.generate(options)}
      if(${options.children} !== null) {
        var ${from} = options.from;
        var ${acc} = ${options.children}.concat();
        ${rest.reduceRight(
          (code, parser) => js`
            options.from = options.to;
            ${parser.generate(options)}
            if(${options.children} !== null) {
              ${acc}.push.apply(${acc}, ${options.children});
              ${code}
            }
          `,
          js`
            options.from = ${from};
            ${options.children} = ${acc};
          `
        )}
      }
    `;
  }
}

// RepetitionParser2

export class RepetitionParser2 extends Parser2 {
  readonly parser: Parser2;
  readonly min: number;
  readonly max: number;

  constructor(parser: Parser2, min: number, max = min) {
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
      return js`
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
        code => js`
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
    return js`
      var ${from}${strIf(this.min === 0, " = options.from")};
      function ${temp}() { ${code} }
      ${temp}();
      if(${options.children} !== null) {
        ${from} = options.from;
        var ${to} = options.to;
        var ${acc} = ${options.children}.concat();
        ${iterate(
          this.min === 0 ? 0 : this.min - 1,
          js`
            ${
              this.max !== Infinity
                ? iterate(this.max - (this.min === 0 ? 1 : this.min))
                : js`
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
      ${strIf(
        this.min === 0,
        js`
          else {
            options.from = options.to = ${from};
            ${options.children} = nochild;
          }
        `
      )}
    `;
  }
}

// GrammarParser2

export class GrammarParser2 extends Parser2 {
  readonly rules: Map<string, [[string, Parser2 | null][], Parser2]>;
  private readonly start: NonTerminalParser2;

  constructor(rules: Map<string, [[string, Parser2 | null][], Parser2]>) {
    super();
    this.rules = rules;
    this.start = new NonTerminalParser2(rules.keys().next().value);
  }

  generate(options: CompileOptions): string {
    const children = options.id();
    return js`
      ${Array.from(this.rules)
        .map(
          ([rule, [parameters, parser]]) => js`
            function r_${rule}(${parameters
            .map(([name]) => `r_${name}`)
            .join(",")}) {
              ${parameters
                .filter(([_, defaultParser]) => defaultParser)
                .map(
                  ([name, defaultParser]) => js`
                    r_${name} = r_${name} !== void 0 ? r_${name} : function() {
                      var ${children};
                      ${defaultParser!.generate({ ...options, children })}
                      return ${children};
                    }
                  `
                )}
              var ${children};
              ${parser.generate({ ...options, children })}
              return ${children};
            }
          `
        )
        .join("\n")}
      ${this.start.generate(options)}
    `;
  }
}

// NonTerminalParser2

export class NonTerminalParser2 extends Parser2 {
  readonly rule: string;
  readonly parameters: (Parser2 | null)[];

  constructor(rule: string, parameters: Parser2[] = []) {
    super();
    this.rule = rule;
    this.parameters = parameters;
  }

  generate(options: CompileOptions): string {
    const children = options.id();
    const call = js`
      r_${this.rule}(${this.parameters
      .map(parameter =>
        parameter
          ? js`
            (function() {
              var ${children};
              ${parameter.generate({ ...options, children })}
              return ${children};
            })
          `
          : js`void 0`
      )
      .join(",")})
    `;
    return js`
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

// PredicateParser2

export class PredicateParser2 extends Parser2 {
  readonly parser: Parser2;
  readonly polarity: boolean;

  constructor(parser: Parser2, polarity: boolean) {
    super();
    this.parser = parser;
    this.polarity = polarity;
  }

  generate(options: CompileOptions): string {
    const from = options.id();
    const log = options.id();
    const code = this.parser.generate(options);
    if (this.polarity)
      return js`
        var ${from} = options.from;
        ${code}
        if(${options.children} !== null) {
          options.from = options.to = ${from};
          ${options.children} = nochild;
        }
      `;
    return js`
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

// CaptureParser2

export class CaptureParser2 extends Parser2 {
  readonly parser: Parser2;
  readonly name: string;
  readonly all: boolean;

  constructor(parser: Parser2, name: string, all = false) {
    super();
    this.parser = parser;
    this.name = name;
    this.all = all;
  }

  generate(options: CompileOptions): string {
    return js`
      ${this.parser.generate(options)}
      if(${options.children} !== null)
        options.captures["${this.name}"] = ${
      this.all
        ? options.children
        : js`
            ${options.children}.length === 1 ? ${options.children}[0] : undefined;
          `
    };
    `;
  }
}

// TweakParser2

export class TweakParser2 extends Parser2 {
  readonly parser: Parser2;
  readonly tweaker: Tweaker2;

  constructor(parser: Parser2, tweaker: Tweaker2) {
    super();
    this.parser = parser;
    this.tweaker = tweaker;
  }

  generate(options: CompileOptions): string {
    const tweaker = options.id();
    const cleanUp = options.id();
    options.links[tweaker] = this.tweaker;
    return js`
      var ${cleanUp} = ${tweaker}(options);
      ${this.parser.generate(options)}
      ${options.children} = ${cleanUp}(${options.children})
    `;
  }
}

// ActionParser2

export class ActionParser2 extends TweakParser2 {
  readonly action: SemanticAction;

  constructor(parser: Parser2, action: SemanticAction) {
    super(parser, options => {
      const ffIndex = options._ffIndex,
        ffType = options._ffType,
        ffSemantic = options._ffSemantic,
        ffExpectations = options._ffExpectations.concat();
      return children => {
        if (children === null) return null;
        let value, emit, failed;
        hooks.push({
          $from: () => options.logger.at(options.from),
          $to: () => options.logger.at(options.to),
          $children: () => children,
          $value: () => (children.length === 1 ? children[0] : undefined),
          $raw: () => options.input.substring(options.from, options.to),
          $options: () => options as any, // TODO remove that "any"
          $context: () => options.context,
          $warn(message) {
            options.log &&
              options.logger.warnings.push({
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
              castArray(expected)
                .map(castExpectation)
                .forEach(expected => options._ffExpect(options.from, expected));
          },
          $commit: () => options._ffCommit(),
          $emit(children) {
            emit = children;
          },
          $node: (label, fields) => ({
            $label: label,
            $from: $from(),
            $to: $to(),
            ...fields
          })
        });
        try {
          value = action(options.captures);
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

// Helpers

const js = String.raw;

function as<T>(value: T) {
  return value;
}

function strIf(test: boolean, code: string) {
  return test ? code : "";
}

export const defaultSkipper2 = new RegexParser2(/\s*/);
defaultSkipper2.compile();

function idGenerator() {
  let i = 0;
  return function () {
    return `_${(i++).toString(36)}`;
  };
}

function skip(options: Options2) {
  if (!options.skip) return true;
  const { skip } = options;
  options.skip = false;
  const children = options.skipper.exec!(options, options.skipper.links!);
  options.skip = skip;
  if (children === null) return false;
  options.from = options.to;
  return true;
}

function trace(rule: string, options: Options2, exec: () => any[] | null) {
  const at = options.logger.at(options.from);
  options.tracer({
    type: TraceEventType.Enter,
    rule,
    at,
    options
  });
  const children = exec();
  if (children === null)
    options.tracer({
      type: TraceEventType.Fail,
      rule,
      at,
      options
    });
  else
    options.tracer({
      type: TraceEventType.Match,
      rule,
      at,
      options,
      from: options.logger.at(options.from),
      to: options.logger.at(options.to),
      children
    });
  return children;
}

type CompileOptions = {
  id: ReturnType<typeof idGenerator>;
  children: string;
  links: Record<string, any>;
};

type CommonLinks = {
  nochild: [];
  hooks: typeof hooks;
  skip: typeof skip;
  trace: typeof trace;
};

export const defaultTracer2: Tracer2 = event => {
  const { at } = event;
  let adjective = "";
  let complement = "";
  switch (event.type) {
    case TraceEventType.Enter:
      adjective = "Entered";
      complement = `at (${at.line}:${at.column})`;
      break;
    case TraceEventType.Match:
      const { from, to } = event;
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
