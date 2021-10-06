import {
  ActionParser,
  AlternativeParser,
  CutParser,
  defaultSkipper,
  defaultTracer,
  Directive,
  Expectation,
  ExpectationType,
  Failure,
  FailureType,
  Hooks,
  LiteralParser,
  Location,
  LogOptions,
  Node,
  Options,
  Parser,
  Plugin,
  RegexParser,
  RepetitionParser,
  SemanticAction,
  SequenceParser,
  TokenParser,
  Tracer,
  TweakParser,
  Visitor,
  Warning,
  WarningType
} from "."; // Hooks

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
export const $value = hook("$value");
export const $raw = hook("$raw");
export const $options = hook("$options");
export const $context = hook("$context");
export const $warn = hook("$warn");
export const $fail = hook("$fail");
export const $expected = hook("$expected");
export const $commit = hook("$commit");
export const $emit = hook("$emit");
export const $node = hook("$node");
export const $visit = hook("$visit");

// buildOptions

export function buildOptions<Context>(
  input: string,
  partial: Partial<Options<Context>>
): Options<Context> {
  let acc = 0;
  const indexes = input.split(/[\r\n]/).map(chunk => {
    const start = acc;
    acc += chunk.length + 1;
    return start;
  });
  return {
    input,
    from: 0,
    complete: true,
    skipper: defaultSkipper,
    skip: true,
    ignoreCase: false,
    tracer: defaultTracer,
    trace: false,
    context: undefined as any,
    visit: [],
    cut: false,
    captures: {},
    indexes,
    log: true,
    warnings: [],
    failures: [],
    ffIndex: 0,
    ffType: null,
    ffSemantic: null,
    ffExpectations: [],
    at(index) {
      let line = 0;
      let n = this.indexes.length - 1;
      while (line < n) {
        const k = line + ((n - line) >> 1);
        if (index < this.indexes[k]) n = k - 1;
        else if (index >= this.indexes[k + 1]) line = k + 1;
        else {
          line = k;
          break;
        }
      }
      return {
        index,
        line: line + 1,
        column: index - this.indexes[line] + 1
      };
    },
    ffExpect(from, expected) {
      if (this.ffIndex === from && this.ffType !== FailureType.Semantic) {
        this.ffType = FailureType.Expectation;
        this.ffExpectations.push(expected);
      } else if (this.ffIndex < from) {
        this.ffIndex = from;
        this.ffType = FailureType.Expectation;
        this.ffExpectations = [expected];
      }
    },
    ffFail(from: number, message: string) {
      if (this.ffIndex <= from) {
        this.ffIndex = from;
        this.ffType = FailureType.Semantic;
        this.ffSemantic = message;
      }
    },
    commit() {
      if (this.ffType !== null) {
        const pos = this.at(this.ffIndex);
        if (this.ffType === FailureType.Expectation)
          this.failures.push({
            from: pos,
            to: pos,
            type: FailureType.Expectation,
            expected: this.ffExpectations
          });
        else
          this.failures.push({
            from: pos,
            to: pos,
            type: FailureType.Semantic,
            message: this.ffSemantic!
          });
        this.ffType = null;
      }
    },
    ...partial
  };
}

// has

export function has(object: object, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

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

// castArray

export function castArray<T>(value: T | T[]) {
  return Array.isArray(value) ? value : [value];
}

// castExpectation

export function castExpectation(
  expected: string | RegExp | Expectation
): Expectation {
  return typeof expected === "string"
    ? { type: ExpectationType.Literal, literal: expected }
    : expected instanceof RegExp
    ? { type: ExpectationType.RegExp, regex: expected }
    : expected;
}

// skip

export function skip(options: Options) {
  if (!options.skip) return options.from;
  const { skip } = options;
  options.skip = false;
  const match = options.skipper.exec(options);
  options.skip = skip;
  return match && match.to;
}

// log

export function log(options: Options, logOptions?: Partial<LogOptions>) {
  const opts: LogOptions = {
    warnings: true,
    failures: true,
    codeFrames: true,
    linesBefore: 2,
    linesAfter: 2,
    ...logOptions
  };

  const entries = [
    ...(opts.warnings ? options.warnings : []),
    ...(opts.failures ? options.failures : [])
  ].sort((a, b) => a.from.index - b.from.index);

  const stringifyEntry = (entry: Warning | Failure) => {
    switch (entry.type) {
      case WarningType.Message:
        return `Warning: ${entry.message}`;
      case FailureType.Semantic:
        return `Failure: ${entry.message}`;
      case FailureType.Expectation:
        const expectations = unique(
          entry.expected.map(stringifyExpectation)
        ).reduce(
          (acc, expected, index, { length }) =>
            `${acc}${index === length - 1 ? " or " : ", "}${expected}`
        );
        return `Failure: Expected ${expectations}`;
    }
  };

  const stringifyExpectation = (expectation: Expectation) => {
    switch (expectation.type) {
      case ExpectationType.Literal:
        return `"${expectation.literal}"`;
      case ExpectationType.RegExp:
        return String(expectation.regex);
      case ExpectationType.Token:
        return expectation.displayName;
      case ExpectationType.Mismatch:
        return `mismatch of "${expectation.match}"`;
      case ExpectationType.Custom:
        return expectation.display;
    }
  };

  const codeFrame = (location: Location) => {
    const start = Math.max(1, location.line - opts.linesBefore);
    const end = Math.min(
      options.indexes.length,
      location.line + opts.linesAfter
    );
    const maxLineNum = String(end).length;
    const padding = " ".repeat(maxLineNum);
    let acc = "";
    for (let i = start; i !== end + 1; i++) {
      const lineNum = (padding + i).slice(-maxLineNum);
      const current = options.input.substring(
        options.indexes[i - 1],
        (options.indexes[i] ?? options.input.length + 1) - 1
      );
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
    .map(entry => {
      let acc = `(${entry.from.line}:${entry.from.column}) ${stringifyEntry(
        entry
      )}`;
      if (opts.codeFrames) acc += `\n\n${codeFrame(entry.from)}`;
      return acc;
    })
    .join("\n");
}

// resolveRule

export function resolveRule(plugins: Plugin[], rule: string) {
  const plugin = plugins.find(
    plugin => plugin.resolve && has(plugin.resolve, rule)
  );
  return plugin?.resolve?.[rule];
}

// resolveCast

export function resolveCast(plugins: Plugin[], value: any) {
  let parser: Parser | undefined;
  plugins.some(plugin => (parser = plugin.castParser?.(value)));
  if (!parser)
    $fail(
      "Couldn't cast value to Parser, you can add support for it via peg.extend"
    );
  else return parser;
}

// resolveDirective

export function resolveDirective(plugins: Plugin[], directive: string) {
  const plugin = plugins.find(
    plugin => plugin.directives && has(plugin.directives, directive)
  );
  if (!plugin)
    $fail(
      `Couldn't resolve directive "${directive}", you can add support for it via peg.extend`
    );
  else return plugin.directives![directive];
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

// inferValue

export function inferValue(children: any[]) {
  return children.length === 1 ? children[0] : undefined;
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

// applyVisitor

export function applyVisitor<Value, Context>(
  node: Node,
  visitor: Visitor<Value>,
  options: Options<Context>,
  parent: Node | null = null
) {
  let value,
    from = node.$from,
    to = node.$to;
  hooks.push({
    $from: () => from,
    $to: () => to,
    $children() {
      throw new Error("The $children hook is not available in visitors");
    },
    $value() {
      throw new Error("The $value hook is not available in visitors");
    },
    $raw: () => options.input.substring(from.index, to.index),
    $options: () => options,
    $context: () => options.context,
    $warn(message) {
      options.log &&
        options.warnings.push({ from, to, type: WarningType.Message, message });
    },
    $fail(message) {
      options.log &&
        options.failures.push({
          from,
          to,
          type: FailureType.Semantic,
          message
        });
    },
    $expected(expected) {
      options.log &&
        options.failures.push({
          from,
          to,
          type: FailureType.Expectation,
          expected: castArray(expected).map(castExpectation)
        });
    },
    $commit() {
      throw new Error("The $commit hook is not available in visitors");
    },
    $emit() {
      throw new Error("The $emit hook is not available in visitors");
    },
    $node: (label, fields) => ({
      $label: label,
      $from: from,
      $to: to,
      ...fields
    }),
    $visit(nextNode, nextVisitor = visitor, nextContext = options.context) {
      const { context } = options;
      options.context = nextContext;
      const result = applyVisitor(nextNode, nextVisitor, options, node);
      options.context = context;
      return result;
    },
    $parent: () => parent
  });
  try {
    if (has(visitor, node.$label)) value = visitor[node.$label](node);
    else if (has(visitor, "$default")) value = visitor.$default(node);
    else
      throw new Error(
        `Missing visitor callback for "${node.$label}" labeled nodes`
      );
  } catch (e) {
    hooks.pop();
    throw e;
  }
  hooks.pop();
  return value;
}

// action

export function action(
  callback: (captures: Record<string, any>, ...args: any[]) => any
): Directive {
  return (parser, ...args) =>
    new ActionParser(parser, captures => callback(captures, ...args));
}

// defaultPlugin

export const defaultPlugin: Plugin = {
  name: "default",
  castParser(arg) {
    if (typeof arg === "number") return new LiteralParser(String(arg));
    if (typeof arg === "string") return new LiteralParser(arg);
    if (arg instanceof RegExp) return new RegexParser(arg);
    if (arg instanceof Parser) return arg;
  },
  directives: {
    // Option tweaks
    skip: (parser, nextSkipper?: Parser) =>
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
    omit: action(() => $emit([])),
    raw: action(() => $raw()),
    length: action(() => $raw().length),
    number: action(() => Number($raw())),
    index: action(() => $from().index),
    children: action(() => $children()),
    count: action(() => $children().length),
    every: action((_, predicate) => $children().every(predicate)),
    filter: action((_, predicate) => $emit($children().filter(predicate))),
    find: action((_, predicate, defaultValue?) =>
      $emit([$children().find(predicate) ?? defaultValue])
    ),
    flat: action((_, depth = 1) => $emit($children().flat(depth))),
    forEach: action((_, callback) => $children().forEach(callback)),
    join: action((_, separator = ",") => $children().join(separator)),
    map: action((_, mapper) => $emit($children().map(mapper))),
    reduce: action((_, ...args) => ($children().reduce as Function)(...args)),
    infix: action((_, reducer, ltr = true) =>
      ltr
        ? $children().reduce((acc, op, index) =>
            index % 2 ? reducer(acc, op, $children()[index + 1]) : acc
          )
        : $children().reduceRight((acc, op, index) =>
            index % 2 ? reducer($children()[index - 1], op, acc) : acc
          )
    ),
    reverse: action(() => $emit([...$children()].reverse())),
    some: action((_, predicate) => $children().some(predicate)),
    reorder: action((_, ...indexes) =>
      $emit(indexes.map(index => $children()[index]))
    ),
    // Other
    action: (parser, action: SemanticAction) =>
      new ActionParser(parser, action),
    echo: action((_, message) => console.log(message)),
    node: action((captures, label, fields = () => ({})) =>
      $node(label, { ...captures, ...fields(captures) })
    ),
    token: (parser, displayName?: string) =>
      new TokenParser(parser, displayName),
    commit: action(() => $commit()),
    test: parser =>
      new AlternativeParser([
        new ActionParser(parser, () => true),
        new ActionParser(new CutParser(), () => false)
      ])
  }
};
