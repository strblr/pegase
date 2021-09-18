import {
  ActionParser,
  CutParser,
  Directive,
  GrammarParser,
  Hooks,
  LiteralParser,
  Node,
  OptionsParser,
  ParseOptions,
  Parser,
  Plugin,
  RegExpParser,
  RepetitionParser,
  SemanticAction,
  SequenceParser,
  TokenParser,
  Tracer,
  TweakParser,
  Visitor
} from ".";

// Hooks

export const hooks: Hooks = Object.create(null);

export const $options = () => hooks.options();
export const $context = () => hooks.context();
export const $from = () => hooks.from();
export const $to = () => hooks.to();
export const $children = () => hooks.children();
export const $captures = () => hooks.captures();
export const $value = () => hooks.value();
export const $raw = () => hooks.raw();
export const $warn: Hooks["warn"] = message => hooks.warn(message);
export const $fail: Hooks["fail"] = message => hooks.fail(message);
export const $expected: Hooks["expected"] = expected =>
  hooks.expected(expected);
export const $commit: Hooks["commit"] = () => hooks.commit();
export const $emit: Hooks["emit"] = children => hooks.emit(children);
export const $node: Hooks["node"] = (label, fields) =>
  hooks.node(label, fields);

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

export function castArray<T>(value: T | Array<T>) {
  return Array.isArray(value) ? value : [value];
}

// skip

export function skip(options: ParseOptions) {
  if (!options.skip) return options.from;
  const match = options.skipper.exec({ ...options, skip: false });
  return match && match.to;
}

// resolveCast

export function resolveCast(plugins: Array<Plugin>, value: any) {
  let parser: Parser | undefined;
  plugins.some(plugin => (parser = plugin.castParser?.(value)));
  if (!parser)
    $fail(
      "Couldn't cast value to Parser, you can add support for it via peg.extend"
    );
  else return parser;
}

// resolveDirective

export function resolveDirective(plugins: Array<Plugin>, directive: string) {
  const plugin = plugins.find(plugin =>
    plugin.directives?.hasOwnProperty(directive)
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
  directives: Array<[Directive, Array<any>]>
) {
  return directives.reduce(
    (parser, [directive, args]) => directive(parser, ...args),
    parser
  );
}

// inferValue

export function inferValue(children: Array<any>) {
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
  ...grammars: Array<Parser>
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
  visitor: Visitor<Value, Context>,
  options: ParseOptions<Context>
) {
  return node;
}

// action

export function action(
  callback: (captures: Record<string, any>, ...args: Array<any>) => any
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
    if (arg instanceof RegExp) return new RegExpParser(arg);
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
    find: action((_, predicate, defaultValue?) => {
      const result = $children().find(predicate);
      return result === undefined ? defaultValue : result;
    }),
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
    // Other
    action: (parser, action: SemanticAction) =>
      new ActionParser(parser, action),
    echo: (parser, output) =>
      new ActionParser(parser, () => {
        console.log(output);
      }),
    node: action((captures, label, fields = captures) =>
      $node(label, typeof fields === "function" ? fields(captures) : fields)
    ),
    token: (parser, displayName?: string) =>
      new TokenParser(parser, displayName),
    commit: action(() => $commit()),
    test: parser =>
      new OptionsParser([
        new ActionParser(parser, () => true),
        new ActionParser(new CutParser(), () => false)
      ])
  }
};
