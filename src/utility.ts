import {
  ActionParser,
  AlternativeParser,
  CutParser,
  defaultSkipper,
  defaultTracer,
  Directive,
  Expectation,
  ExpectationInput,
  ExpectationType,
  Extension,
  Failure,
  FailureType,
  GrammarParser,
  Hooks,
  LiteralParser,
  Location,
  LogOptions,
  Options,
  Parser,
  RegexParser,
  RepetitionParser,
  SemanticAction,
  SequenceParser,
  TokenParser,
  Tracer,
  TweakParser,
  Warning,
  WarningType
} from ".";

// unique

export function unique<T>(items: Iterable<T>) {
  return [...new Set(items)];
}

// extendFlags

export function extendFlags(regex: RegExp, flags: string) {
  return new RegExp(regex, unique([...regex.flags, ...flags]).join(""));
}

// spaceCase

export function spaceCase(input: string) {
  return input
    .replace("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

// castExpectation

export function castExpectation(expected: ExpectationInput): Expectation {
  return typeof expected === "string"
    ? { type: ExpectationType.Literal, literal: expected }
    : expected instanceof RegExp
    ? { type: ExpectationType.RegExp, regex: expected }
    : expected;
}

// idGenerator

export function idGenerator() {
  let i = 0;
  return () => `_${(i++).toString(36)}`;
}

// merge

export function merge<Context = any>(...grammars: Parser[]): Parser<Context> {
  return new GrammarParser(
    grammars.flatMap(grammar => {
      if (!(grammar instanceof GrammarParser))
        throw new Error("Only GrammarParser can be merged");
      return grammar.rules;
    })
  ).compile();
}

// resolveCast

export function resolveCast(extensions: Extension[], value: any) {
  let parser: Parser | undefined;
  for (const extension of extensions)
    if ((parser = extension.cast?.(value))) break;
  return parser;
}

// resolveDirective

export function resolveDirective(extensions: Extension[], directive: string) {
  return extensions.find(
    extension =>
      extension.directives &&
      Object.prototype.hasOwnProperty.call(extension.directives, directive)
  )?.directives![directive];
}

// pipeDirectives

export function pipeDirectives(
  parser: Parser,
  directives: [Directive, any[]][]
) {
  return directives.reduce(
    (parser, [directive, args]) => directive(parser, ...args),
    parser
  );
}

// modulo

export function modulo(
  item: Parser,
  separator: Parser,
  repetitionRange: [number, number] = [0, Infinity]
) {
  return new SequenceParser([
    item,
    new RepetitionParser(new SequenceParser([separator, item]), repetitionRange)
  ]);
}

// entryToString

export function entryToString(entry: Warning | Failure) {
  switch (entry.type) {
    case WarningType.Message:
      return `Warning: ${entry.message}`;
    case FailureType.Semantic:
      return `Failure: ${entry.message}`;
    case FailureType.Expectation:
      const expectations = unique(
        entry.expected.map(expectationToString)
      ).reduce(
        (acc, expected, index, { length }) =>
          `${acc}${index === length - 1 ? " or " : ", "}${expected}`
      );
      return `Failure: Expected ${expectations}`;
  }
}

// expectationToString

export function expectationToString(expectation: Expectation) {
  switch (expectation.type) {
    case ExpectationType.Literal:
      return `"${expectation.literal}"`;
    case ExpectationType.RegExp:
      return String(expectation.regex);
    case ExpectationType.EndOfInput:
      return "end of input";
    case ExpectationType.Token:
      return expectation.displayName;
    case ExpectationType.Mismatch:
      return `mismatch of "${expectation.match}"`;
    case ExpectationType.Custom:
      return expectation.display;
  }
}

// Hooks

function hook<K extends keyof Hooks>(key: K): Hooks[K] {
  return function () {
    return (hooks[hooks.length - 1][key] as Function).apply(null, arguments);
  };
}

export const hooks: Hooks[] = [];
export const $from = hook("$from");
export const $to = hook("$to");
export const $children = hook("$children");
export const $raw = hook("$raw");
export const $options = hook("$options");
export const $context = hook("$context");
export const $warn = hook("$warn");
export const $fail = hook("$fail");
export const $expected = hook("$expected");
export const $commit = hook("$commit");
export const $emit = hook("$emit");

// buildOptions

export function buildOptions<Context>(
  input: string,
  defaultOptions?: Partial<Options<Context>>,
  partialOptions?: Partial<Options<Context>>
): Options<Context> {
  input = partialOptions?.input ?? input;
  const startOptions: Options<Context> = {
    input,
    from: 0,
    to: 0,
    complete: true,
    skipper: defaultSkipper,
    skip: true,
    ignoreCase: false,
    tracer: defaultTracer,
    trace: false,
    log: true,
    warnings: [],
    failures: [],
    context: undefined as any,
    at: locationGenerator(input),
    _ffIndex: 0,
    _ffType: null,
    _ffSemantic: null,
    _ffExpectations: [],
    _ffExpect(expected) {
      if (
        this._ffIndex === this.from &&
        this._ffType !== FailureType.Semantic
      ) {
        this._ffType = FailureType.Expectation;
        this._ffExpectations.push(expected);
      } else if (this._ffIndex < this.from) {
        this._ffIndex = this.from;
        this._ffType = FailureType.Expectation;
        this._ffExpectations = [expected];
      }
    },
    _ffFail(message: string) {
      if (this._ffIndex <= this.from) {
        this._ffIndex = this.from;
        this._ffType = FailureType.Semantic;
        this._ffSemantic = message;
      }
    },
    _ffCommit() {
      if (this._ffType !== null) {
        const pos = this.at(this._ffIndex);
        if (this._ffType === FailureType.Expectation)
          this.failures.push({
            from: pos,
            to: pos,
            type: FailureType.Expectation,
            expected: this._ffExpectations
          });
        else
          this.failures.push({
            from: pos,
            to: pos,
            type: FailureType.Semantic,
            message: this._ffSemantic!
          });
        this._ffType = null;
      }
    }
  };
  return Object.assign(startOptions, defaultOptions, partialOptions);
}

// locationGenerator

function locationGenerator(input: string) {
  let acc = 0;
  const indexes = input.split(/[\r\n]/).map(chunk => {
    const start = acc;
    acc += chunk.length + 1;
    return start;
  });
  return (index: number): Location => {
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
      index,
      line: line + 1,
      column: index - indexes[line] + 1
    };
  };
}

// log

export function log(input: string, options: Partial<LogOptions>) {
  const opts: LogOptions = {
    warnings: [],
    failures: [],
    showWarnings: true,
    showFailures: true,
    showCodeFrames: true,
    linesBefore: 2,
    linesAfter: 2,
    ...options
  };

  const entries = [
    ...((opts.showWarnings && opts.warnings) || []),
    ...((opts.showFailures && opts.failures) || [])
  ];

  if (entries.length === 0) return "";
  const lines = input.split(/[\r\n]/);

  const codeFrame = (options: LogOptions, location: Location) => {
    const start = Math.max(1, location.line - options.linesBefore);
    const end = Math.min(lines.length, location.line + options.linesAfter);
    const maxLineNum = String(end).length;
    const padding = " ".repeat(maxLineNum);
    let acc = "";
    for (let i = start; i !== end + 1; i++) {
      const lineNum = (padding + i).slice(-maxLineNum);
      const current = lines[i - 1];
      const normalized = current.replace(/\t+/, tabs =>
        "  ".repeat(tabs.length)
      );
      if (i !== location.line) acc += `  ${lineNum} | ${normalized}\n`;
      else {
        const count = Math.max(
          0,
          normalized.length - current.length + location.column - 1
        );
        acc += `> ${lineNum} | ${normalized}\n`;
        acc += `  ${padding} | ${" ".repeat(count)}^\n`;
      }
    }
    return acc;
  };

  return entries
    .sort((a, b) => a.from.index - b.from.index)
    .map(
      entry =>
        `(${entry.from.line}:${entry.from.column}) ${entryToString(entry)}${
          opts.showCodeFrames ? `\n\n${codeFrame(opts, entry.from)}` : ""
        }`
    )
    .join("\n");
}

// defaultExtension

export const defaultExtension: Extension = {
  cast(arg) {
    if (typeof arg === "number") return new LiteralParser(String(arg));
    if (typeof arg === "string") return new LiteralParser(arg);
    if (arg instanceof RegExp) return new RegexParser(arg);
    if (arg instanceof Parser) return arg;
  },
  directives: {
    // Option tweaks
    tweak: (parser, tweaker) => new TweakParser(parser, tweaker),
    skip: (parser, nextSkipper?: RegExp) =>
      new TweakParser(parser, options => {
        const { skip, skipper } = options;
        options.skip = true;
        options.skipper = nextSkipper ?? skipper;
        return match => {
          options.skip = skip;
          options.skipper = skipper;
          return match;
        };
      }),
    noskip: parser =>
      new TweakParser(parser, options => {
        const { skip } = options;
        options.skip = false;
        return match => {
          options.skip = skip;
          return match;
        };
      }),
    case: parser =>
      new TweakParser(parser, options => {
        const { ignoreCase } = options;
        options.ignoreCase = false;
        return match => {
          options.ignoreCase = ignoreCase;
          return match;
        };
      }),
    nocase: parser =>
      new TweakParser(parser, options => {
        const { ignoreCase } = options;
        options.ignoreCase = true;
        return match => {
          options.ignoreCase = ignoreCase;
          return match;
        };
      }),
    trace: (parser, nextTracer?: Tracer) =>
      new TweakParser(parser, options => {
        const { trace, tracer } = options;
        options.trace = true;
        options.tracer = nextTracer ?? tracer;
        return match => {
          options.trace = trace;
          options.tracer = tracer;
          return match;
        };
      }),
    notrace: parser =>
      new TweakParser(parser, options => {
        const { trace } = options;
        options.trace = false;
        return match => {
          options.trace = trace;
          return match;
        };
      }),
    context: (parser, nextContext: any) =>
      new TweakParser(parser, options => {
        const { context } = options;
        options.context = nextContext;
        return match => {
          options.context = context;
          return match;
        };
      }),
    // Children transforms
    omit: parser => new ActionParser(parser, () => $emit([])),
    raw: parser => new ActionParser(parser, () => $raw()),
    length: parser => new ActionParser(parser, () => $raw().length),
    number: parser => new ActionParser(parser, () => Number($raw())),
    index: parser => new ActionParser(parser, () => $from().index),
    children: parser => new ActionParser(parser, () => $children()),
    count: parser => new ActionParser(parser, () => $children().length),
    every: (parser, predicate) =>
      new ActionParser(parser, () => $children().every(predicate)),
    filter: (parser, predicate) =>
      new ActionParser(parser, () => $emit($children().filter(predicate))),
    find: (parser, predicate, defaultValue?) =>
      new ActionParser(parser, () =>
        $emit([$children().find(predicate) ?? defaultValue])
      ),
    flat: (parser, depth) =>
      new ActionParser(parser, () => $emit($children().flat(depth))),
    forEach: (parser, callback) =>
      new ActionParser(parser, () => $children().forEach(callback)),
    join: (parser, separator = ",") =>
      new ActionParser(parser, () => $children().join(separator)),
    map: (parser, mapper) =>
      new ActionParser(parser, () => $emit($children().map(mapper))),
    reduce: (parser, ...args) =>
      new ActionParser(parser, () => ($children().reduce as Function)(...args)),
    infix: (parser, reducer, ltr = true) =>
      new ActionParser(
        parser,
        ltr
          ? () =>
              $children().reduce((acc, op, index) =>
                index % 2 ? reducer(acc, op, $children()[index + 1]) : acc
              )
          : () =>
              $children().reduceRight((acc, op, index) =>
                index % 2 ? reducer($children()[index - 1], op, acc) : acc
              )
      ),
    reverse: parser =>
      new ActionParser(parser, () => $emit([...$children()].reverse())),
    some: (parser, predicate) =>
      new ActionParser(parser, () => $children().some(predicate)),
    reorder: (parser, ...indexes) =>
      new ActionParser(parser, () =>
        $emit(indexes.map(index => $children()[index]))
      ),
    // Other
    action: (parser, action: SemanticAction) =>
      new ActionParser(parser, action),
    fail: (parser, message) => new ActionParser(parser, () => $fail(message)),
    echo: (parser, message) =>
      new ActionParser(parser, () => console.log(message)),
    token: (parser, displayName?: string) =>
      new TokenParser(parser, displayName),
    commit: parser => new ActionParser(parser, () => $commit()),
    test: parser =>
      new AlternativeParser([
        new ActionParser(parser, () => true),
        new ActionParser(new CutParser(), () => false)
      ])
  }
};
