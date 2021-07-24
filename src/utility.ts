import {
  ActionParser,
  Directive,
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
  SemanticInfo,
  SequenceParser,
  TokenParser,
  Tracer,
  TweakParser
} from ".";

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

export function mergeFailures(
  internals: Pick<Internals, "failures" | "committed">
) {
  return [
    ...internals.committed,
    ...(internals.failures.length === 0
      ? []
      : [
          internals.failures.reduce((failure, current) => {
            if (current.from > failure.from) return current;
            if (current.from < failure.from) return failure;
            if (current.type === FailureType.Semantic) return current;
            if (failure.type === FailureType.Semantic) return failure;
            failure.expected.push(...current.expected);
            return failure;
          })
        ])
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

// forwardArgs

export function forwardArgs(
  to: (info: SemanticInfo) => Function,
  finalize: (result: any, info: SemanticInfo) => any = result => result
): Directive {
  return (parser, ...args) =>
    new ActionParser(parser, info => finalize(to(info)(...args), info));
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
      new TweakParser(parser, () => ({ tracer })),
    notrace: parser => new TweakParser(parser, () => ({ tracer: undefined })),
    // Value tweaks
    omit: parser => new ActionParser(parser, () => undefined),
    raw: parser => new ActionParser(parser, ({ $raw }) => $raw),
    length: parser => new ActionParser(parser, ({ $raw }) => $raw.length),
    number: parser => new ActionParser(parser, ({ $raw }) => Number($raw)),
    index: parser => new ActionParser(parser, ({ $match }) => $match.from),
    is: parser =>
      new ActionParser(parser, ({ $value }) => $value !== undefined),
    test: parser =>
      new OptionsParser([
        new ActionParser(parser, () => true),
        new ActionParser(new LiteralParser(""), () => false)
      ]),
    // Children-related
    children: parser =>
      new ActionParser(parser, ({ $match }) => $match.children),
    count: parser =>
      new ActionParser(parser, ({ $match }) => $match.children.length),
    every: forwardArgs(({ $match }) => $match.children.every),
    filter: forwardArgs(
      ({ $match }) => $match.children.filter,
      (result, { $propagate }) => $propagate(result)
    ),
    find: forwardArgs(({ $match }) => $match.children.find),
    flat: forwardArgs(
      ({ $match }) => $match.children.flat,
      (result, { $propagate }) => $propagate(result)
    ),
    forEach: forwardArgs(({ $match }) => $match.children.forEach),
    join: forwardArgs(({ $match }) => $match.children.join),
    map: forwardArgs(
      ({ $match }) => $match.children.map,
      (result, { $propagate }) => $propagate(result)
    ),
    reduce: forwardArgs(({ $match }) => $match.children.reduce),
    reduceInfix: (
      parser,
      reducer: (left: any, separator: any, right: any) => any
    ) =>
      new ActionParser(parser, ({ $match }) =>
        $match.children.reduce((acc, op, index) =>
          index % 2 ? reducer(acc, op, $match.children[index + 1]) : acc
        )
      ),
    reverse: parser =>
      new ActionParser(parser, ({ $match, $propagate }) =>
        $propagate([...$match.children].reverse())
      ),
    some: forwardArgs(({ $match }) => $match.children.some),
    // Other
    token: (parser, alias?: string) => new TokenParser(parser, alias),
    context: (parser, context: any) =>
      new TweakParser(parser, () => ({ context }))
  }
};
