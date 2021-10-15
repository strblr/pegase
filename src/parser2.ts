import {
  applyVisitor,
  buildOptions2,
  castArray,
  ExpectationType,
  extendFlags,
  inferValue,
  LiteralExpectation,
  Options2,
  RegexExpectation,
  Result2,
  Tweaker2
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
    const createId = createIdGenerator();
    const children = createId();
    this.links = as<CommonLinks>({ nochild: [], skip });
    const code = this.generate({ createId, children, links: this.links });
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
    const literal = options.createId();
    const literalNocase =
      this.literal !== this.literal.toLowerCase() && options.createId();
    const children = this.emit && options.createId();
    const expectation = options.createId();
    const raw = options.createId();
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
    const regex = options.createId();
    const regexNocase = options.createId();
    const expectation = options.createId();
    const usedRegex = options.createId();
    const result = options.createId();
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

// SequenceParser2

export class SequenceParser2 extends Parser2 {
  readonly parsers: Parser2[];

  constructor(parsers: Parser2[]) {
    super();
    this.parsers = parsers;
  }

  generate(options: CompileOptions): string {
    const [first, ...rest] = this.parsers;
    const acc = options.createId();
    const from = options.createId();
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

// AlternativeParser2

export class AlternativeParser2 extends Parser2 {
  readonly parsers: Parser2[];

  constructor(parsers: Parser2[]) {
    super();
    this.parsers = parsers;
  }

  generate(options: CompileOptions): string {
    const from = options.createId();
    return js`
      var ${from} = options.from;
      ${this.parsers.reduceRight(
        (code, parser) => js`
          ${parser.generate(options)}
          if(${options.children} === null) {
            options.from = ${from};
            ${code}
          }
        `,
        ""
      )}
    `;
  }
}

// GrammarParser2

export class GrammarParser2 extends Parser2 {
  readonly rules: Map<string, [[string, Parser2 | null][], Parser2]>;

  constructor(rules: Map<string, [[string, Parser2 | null][], Parser2]>) {
    super();
    this.rules = rules;
  }

  generate(options: CompileOptions): string {
    const children = options.createId();
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
      ${options.children} = r_${this.rules.keys().next().value}();
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
    const children = options.createId();
    return js`
      ${options.children} = r_${this.rule}(${this.parameters
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
      .join(",")});
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
    const tweaker = options.createId();
    const cleanUp = options.createId();
    options.links[tweaker] = this.tweaker;
    return js`
      var ${cleanUp} = ${tweaker}(options);
      ${this.parser.generate(options)}
      ${options.children} = ${cleanUp}(${options.children})
    `;
  }
}

// Helpers

const js = String.raw;

function as<T>(value: T) {
  return value;
}

export const defaultSkipper2 = new RegexParser2(/\s*/);
defaultSkipper2.compile();

function createIdGenerator() {
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

type CompileOptions = {
  createId: ReturnType<typeof createIdGenerator>;
  children: string;
  links: Record<string, any>;
};

type CommonLinks = {
  nochild: [];
  skip(options: Options2): boolean;
};
