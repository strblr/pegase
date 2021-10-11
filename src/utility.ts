import {
  ActionParser,
  AlternativeParser,
  CutParser,
  defaultSkipper,
  defaultTracer,
  Directive,
  Expectation,
  ExpectationType,
  FailureType,
  Hooks,
  LiteralParser,
  Logger,
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
  WarningType
} from ".";

// Hooks

function hook<K extends keyof Hooks>(key: K): Hooks[K] {
  return function () {
    return (hooks[hooks.length - 1][key] as Function).apply(null, arguments);
  };
}

export const hooks: Partial<Hooks>[] = [];
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
export const $parent = hook("$parent");

// buildOptions

export function buildOptions<Context>(
  input: string,
  partial: Partial<Options<Context>>
): Options<Context> {
  input = partial.input ?? input;
  return {
    input,
    from: 0,
    complete: true,
    skipper: defaultSkipper,
    skip: true,
    ignoreCase: false,
    tracer: defaultTracer,
    trace: false,
    logger: new Logger(input),
    log: true,
    context: undefined as any,
    visit: [],
    cut: false,
    captures: {},
    _ffIndex: 0,
    _ffType: null,
    _ffSemantic: null,
    _ffExpectations: [],
    _ffExpect(from, expected) {
      if (this._ffIndex === from && this._ffType !== FailureType.Semantic) {
        this._ffType = FailureType.Expectation;
        this._ffExpectations.push(expected);
      } else if (this._ffIndex < from) {
        this._ffIndex = from;
        this._ffType = FailureType.Expectation;
        this._ffExpectations = [expected];
      }
    },
    _ffFail(from: number, message: string) {
      if (this._ffIndex <= from) {
        this._ffIndex = from;
        this._ffType = FailureType.Semantic;
        this._ffSemantic = message;
      }
    },
    _ffCommit() {
      if (this._ffType !== null) {
        const pos = this.logger.at(this._ffIndex);
        if (this._ffType === FailureType.Expectation)
          this.logger.failures.push({
            from: pos,
            to: pos,
            type: FailureType.Expectation,
            expected: this._ffExpectations
          });
        else
          this.logger.failures.push({
            from: pos,
            to: pos,
            type: FailureType.Semantic,
            message: this._ffSemantic!
          });
        this._ffType = null;
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
  parent: Node | null = null,
  visitor: Visitor<Value>,
  options: Options<Context>
) {
  let value,
    from = node.$from,
    to = node.$to;
  hooks.push({
    $from: () => from,
    $to: () => to,
    $raw: () => options.input.substring(from.index, to.index),
    $options: () => options,
    $context: () => options.context,
    $warn(message) {
      options.log &&
        options.logger.warnings.push({
          from,
          to,
          type: WarningType.Message,
          message
        });
    },
    $fail(message) {
      options.log &&
        options.logger.failures.push({
          from,
          to,
          type: FailureType.Semantic,
          message
        });
    },
    $expected(expected) {
      options.log &&
        options.logger.failures.push({
          from,
          to,
          type: FailureType.Expectation,
          expected: castArray(expected).map(castExpectation)
        });
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
      const result = applyVisitor(nextNode, node, nextVisitor, options);
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
    tweak: (parser, tweaker) => new TweakParser(parser, tweaker),
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
    visit: action((_, visitor) => $visit($value(), visitor)),
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
