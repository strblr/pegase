import {
  ActionParser,
  CutParser,
  Directive,
  GrammarParser,
  LiteralParser,
  OptionsParser,
  ParseOptions,
  Parser,
  Plugin,
  RegExpParser,
  RepetitionParser,
  SemanticAction,
  SemanticInfo,
  SequenceParser,
  TokenParser,
  Tracer,
  TweakParser,
  Visitor
} from ".";

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
    throw new Error(
      "Couldn't cast value to Parser, you can add support for it via peg.extend"
    );
  return parser;
}

// resolveDirective

export function resolveDirective(plugins: Array<Plugin>, directive: string) {
  const plugin = plugins.find(plugin =>
    plugin.directives?.hasOwnProperty(directive)
  );
  if (!plugin)
    throw new Error(
      `Couldn't resolve directive "${directive}", you can add support for it via peg.extend`
    );
  return plugin.directives![directive];
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
  callback: (info: SemanticInfo, ...args: Array<any>) => any
): Directive {
  return (parser, ...args) =>
    new ActionParser(parser, info => callback(info, ...args));
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
    omit: action(({ $emit }) => $emit([])),
    raw: action(({ $raw }) => $raw),
    length: action(({ $raw }) => $raw.length),
    number: action(({ $raw }) => Number($raw)),
    index: action(({ $from }) => $from.index),
    children: action(({ $children }) => $children),
    count: action(({ $children }) => $children.length),
    every: action(({ $children }, predicate) => $children.every(predicate)),
    filter: action(({ $children, $emit }, predicate) =>
      $emit($children.filter(predicate))
    ),
    find: action(({ $children }, predicate, defaultValue?) => {
      const result = $children.find(predicate);
      return result === undefined ? defaultValue : result;
    }),
    flat: action(({ $children, $emit }, depth = 1) =>
      $emit($children.flat(depth))
    ),
    forEach: action(({ $children }, callback) => $children.forEach(callback)),
    join: action(({ $children }, separator = ",") => $children.join(separator)),
    map: action(({ $children, $emit }, mapper) => $emit($children.map(mapper))),
    reduce: action(({ $children }, ...args) =>
      ($children.reduce as Function)(...args)
    ),
    infix: action(({ $children }, reducer, ltr = true) =>
      ltr
        ? $children.reduce((acc, op, index) =>
            index % 2 ? reducer(acc, op, $children[index + 1]) : acc
          )
        : $children.reduceRight((acc, op, index) =>
            index % 2 ? reducer($children[index - 1], op, acc) : acc
          )
    ),
    reverse: action(({ $children, $emit }) => $emit([...$children].reverse())),
    some: action(({ $children }, predicate) => $children.some(predicate)),
    // Other
    action: (parser, action: SemanticAction) =>
      new ActionParser(parser, action),
    echo: (parser, output) =>
      new ActionParser(parser, () => {
        console.log(output);
      }),
    node: action((info, label, fields = Object.fromEntries(info.$captures)) =>
      info.$node(label, typeof fields === "function" ? fields(info) : fields)
    ),
    token: (parser, displayName?: string) =>
      new TokenParser(parser, displayName),
    commit: parser =>
      new ActionParser(parser, ({ $commit }) => {
        $commit();
      }),
    test: parser =>
      new OptionsParser([
        new ActionParser(parser, () => true),
        new ActionParser(new CutParser(), () => false)
      ])
  }
};
