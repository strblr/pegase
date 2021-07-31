import {
  ActionParser,
  Directive,
  Failure,
  FailureType,
  GrammarParser,
  Internals,
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
  TweakParser
} from ".";

// createInternals

export function createInternals(): Internals {
  return {
    cut: { active: false },
    warnings: [],
    failures: [],
    committed: []
  };
}

// extendFlags

export function extendFlags(regExp: RegExp, flags: string) {
  return new RegExp(regExp, [...new Set([...regExp.flags, ...flags])].join(""));
}

// skip

export function skip(options: ParseOptions, internals: Internals) {
  if (!options.skip) return options.from;
  const match = options.skipper.exec({ ...options, skip: false }, internals);
  return match && match.to;
}

// mergeFailures

export function mergeFailures(failures: Array<Failure>) {
  if (failures.length === 0) return [];
  return [
    failures.reduce((failure, current) => {
      if (current.from > failure.from) return current;
      if (current.from < failure.from) return failure;
      if (current.type === FailureType.Semantic) return current;
      if (failure.type === FailureType.Semantic) return failure;
      failure.expected.push(...current.expected);
      return failure;
    })
  ];
}

// pipeDirectives

export function pipeDirectives(
  plugins: Array<Plugin>,
  parser: Parser,
  directives: Array<[string, Array<any>]>
) {
  return directives.reduce((parser, [directive, args]) => {
    const definition = plugins.find(plugin =>
      plugin.directives?.hasOwnProperty(directive)
    );
    if (!definition)
      throw new Error(
        `Couldn't resolve directive "${directive}", you can add support for it via peg.addPlugin`
      );
    return definition.directives![directive](parser, ...args);
  }, parser);
}

// inferValue

export function inferValue(children: Array<any>) {
  return children.length === 1 ? children[0] : undefined;
}

// buildModulo

export function buildModulo(
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
  return new GrammarParser(
    [grammar, ...grammars].reduce<Array<[string, Parser]>>((acc, parser) => {
      if (!(parser instanceof GrammarParser))
        throw new Error("You can only merge grammar parsers");
      return [...acc, ...parser.rules.entries()];
    }, [])
  );
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
      new TweakParser(parser, () => ({
        skip: true,
        ...(skipper && { skipper })
      })),
    noskip: parser => new TweakParser(parser, () => ({ skip: false })),
    case: parser => new TweakParser(parser, () => ({ ignoreCase: false })),
    nocase: parser => new TweakParser(parser, () => ({ ignoreCase: true })),
    trace: (parser, tracer?: Tracer) =>
      new TweakParser(parser, () => ({
        trace: true,
        ...(tracer && { tracer })
      })),
    notrace: parser => new TweakParser(parser, () => ({ trace: false })),
    context: (parser, context: any) =>
      new TweakParser(parser, () => ({ context })),
    // Children transforms
    omit: action(() => undefined),
    raw: action(({ $raw }) => $raw),
    length: action(({ $raw }) => $raw.length),
    number: action(({ $raw }) => Number($raw)),
    index: action(({ $match }) => $match.from),
    children: action(({ $match }) => $match.children),
    count: action(({ $match }) => $match.children.length),
    every: action(({ $match }, predicate) => $match.children.every(predicate)),
    filter: action(({ $match, $propagate }, predicate) =>
      $propagate($match.children.filter(predicate))
    ),
    find: action(({ $match }, predicate, defaultValue?) => {
      const result = $match.children.find(predicate);
      return result === undefined ? defaultValue : result;
    }),
    flat: action(({ $match, $propagate }, depth = 1) =>
      $propagate($match.children.flat(depth))
    ),
    forEach: action(({ $match }, callback) =>
      $match.children.forEach(callback)
    ),
    join: action(({ $match }, separator = ",") =>
      $match.children.join(separator)
    ),
    map: action(({ $match, $propagate }, mapper) =>
      $propagate($match.children.map(mapper))
    ),
    reduce: action(({ $match }, ...args) =>
      ($match.children.reduce as Function)(...args)
    ),
    infix: action(({ $match }, reducer) =>
      $match.children.reduce((acc, op, index) =>
        index % 2 ? reducer(acc, op, $match.children[index + 1]) : acc
      )
    ),
    reverse: action(({ $match, $propagate }) =>
      $propagate([...$match.children].reverse())
    ),
    some: action(({ $match }, predicate) => $match.children.some(predicate)),
    // Other
    action: (parser, action: SemanticAction) =>
      new ActionParser(parser, action),
    token: (parser, alias?: string) => new TokenParser(parser, alias),
    test: parser =>
      new OptionsParser([
        new ActionParser(parser, () => true),
        new ActionParser(new LiteralParser(""), () => false)
      ])
  }
};
