import {
  ActionParser,
  AlternativeParser,
  CutParser,
  Directive,
  Expectation,
  ExpectationType,
  FailureType,
  GrammarParser,
  Hooks,
  LiteralParser,
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
export const $captures = hook("$captures");
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

// extendFlags

export function extendFlags(regExp: RegExp, flags: string) {
  return new RegExp(regExp, [...new Set([...regExp.flags, ...flags])].join(""));
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
  expected: (string | RegExp | Expectation)[]
): Expectation[] {
  return expected.map(expected =>
    typeof expected === "string"
      ? { type: ExpectationType.Literal, literal: expected }
      : expected instanceof RegExp
      ? { type: ExpectationType.RegExp, regExp: expected }
      : expected
  );
}

// skip

export function skip(options: Options) {
  if (!options.skip) return options.from;
  const match = options.skipper.exec({ ...options, skip: false });
  return match && match.to;
}

// resolveFallback

export function resolveFallback(plugins: Plugin[], rule: string) {
  return plugins.find(plugin =>
    (plugin.grammar as GrammarParser | undefined)?.rules?.get(rule)
  )?.grammar;
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
    plugin =>
      plugin.directives &&
      Object.prototype.hasOwnProperty.call(plugin.directives, directive)
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

// merge

export function merge<Value = any, Context = any>(
  grammar: Parser<Value, Context>,
  ...grammars: Parser[]
): Parser<Value, Context> {
  return new GrammarParser([
    ...[grammar, ...grammars]
      .reduce((acc, parser) => {
        if (!(parser instanceof GrammarParser))
          throw new Error("You can only merge grammar parsers");
        for (const rule of parser.rules.keys())
          if (acc.has(rule))
            throw new Error(
              `Conflicting declaration of rule "${rule}" in grammar merging`
            );
        return new Map([...acc, ...parser.rules]);
      }, new Map<string, Parser>())
      .entries()
  ]);
}

// applyVisitor

export function applyVisitor<Value, Context>(
  node: Node,
  visitor: Visitor<Value>,
  options: Options<Context>
) {
  let value,
    { from, to } = node.$match;
  hooks.push({
    $from: () => from,
    $to: () => to,
    $children: () => node.$match.children,
    $captures: () => node.$match.captures,
    $value: () => inferValue(node.$match.children),
    $raw: () => options.input.substring(from.index, to.index),
    $options: () => options,
    $context: () => options.context,
    $warn: message =>
      options.logger.warn({ from, to, type: WarningType.Message, message }),
    $fail: message =>
      options.logger.fail({ from, to, type: FailureType.Semantic, message }),
    $expected: expected =>
      options.logger.fail({
        from,
        to,
        type: FailureType.Expectation,
        expected: castExpectation(castArray(expected))
      }),
    $commit() {
      throw new Error("The $commit hook is not available in visitors");
    },
    $emit(children) {
      node.$match.children = children;
    },
    $node: (label, fields) => ({
      $label: label,
      $match: node.$match,
      ...fields
    }),
    $visit: (node, opts, nextVisitor = visitor) =>
      applyVisitor(node, nextVisitor, { ...options, ...opts })
  });
  try {
    if (Object.prototype.hasOwnProperty.call(visitor, node.$label))
      value = visitor[node.$label](node);
    else if (Object.prototype.hasOwnProperty.call(visitor, "$default"))
      value = visitor.$default(node);
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
    skip: (parser, skipper?: Parser) =>
      new TweakParser(parser, { skip: true, ...(skipper && { skipper }) }),
    noskip: parser => new TweakParser(parser, { skip: false }),
    case: parser => new TweakParser(parser, { ignoreCase: false }),
    nocase: parser => new TweakParser(parser, { ignoreCase: true }),
    trace: (parser, tracer?: Tracer) =>
      new TweakParser(parser, { trace: true, ...(tracer && { tracer }) }),
    notrace: parser => new TweakParser(parser, { trace: false }),
    context: (parser, context: any) => new TweakParser(parser, { context }),
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
