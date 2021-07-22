import {
  ActionParser,
  Directives,
  eps,
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
  definitions: Directives,
  parser: Parser,
  directives: Array<string>,
  rule?: string
) {
  return directives.reduce((parser, directive) => {
    if (!(directive in definitions))
      throw new Error(
        `Couldn't resolve directive "${directive}". You need to merge it to the default directives using peg.extendDirectives.`
      );
    return definitions[directive](parser, rule);
  }, parser);
}

// inferValue

export function inferValue(children: Array<any>) {
  return children.length === 1 ? children[0] : undefined;
}

// buildModulo

export function buildModulo(item: Parser, separator: Parser) {
  return new SequenceParser([
    item,
    new RepetitionParser(new SequenceParser([separator, item]), 0, Infinity)
  ]);
}

// reduceModulo

export function reduceModulo(
  reducer: (left: any, separator: any, right: any) => any
) {
  return ({ $match }: SemanticInfo) =>
    $match.children.reduce((acc, op, index) =>
      index % 2 ? reducer(acc, op, $match.children[index + 1]) : acc
    );
}

// merge (grammars)

export function merge<Parsers extends ReadonlyArray<Parser>>(
  ...parsers: Parsers
): Parsers[0] {
  return new GrammarParser(
    parsers.reduce<Array<[string, Parser]>>((acc, parser) => {
      if (!(parser instanceof GrammarParser))
        throw new Error("You can only merge grammar parsers");
      return [...acc, ...parser.rules.entries()];
    }, [])
  );
}

// nullObject

export function nullObject(
  ...sources: Array<Record<string, any>>
): Record<string, any> {
  const object = Object.create(null);
  return sources.length === 0 ? object : Object.assign(object, ...sources);
}

// defaultPlugin

export const defaultPlugin: Plugin = {
  name: "default",
  castArgument(arg) {
    if (typeof arg === "number") return new LiteralParser(String(arg));
    if (typeof arg === "string") return new LiteralParser(arg);
    if (arg instanceof RegExp) return new RegExpParser(arg);
    if (arg instanceof Parser) return arg;
  },
  directives: {
    omit: parser => new ActionParser(parser, () => undefined),
    raw: parser => new ActionParser(parser, ({ $raw }) => $raw),
    number: parser => new ActionParser(parser, ({ $raw }) => Number($raw)),
    token: (parser, alias: string) => new TokenParser(parser, alias),
    skip: (parser, skipper?: Parser) =>
      new TweakParser(parser, { skip: true, ...(skipper && { skipper }) }),
    noskip: parser => new TweakParser(parser, { skip: false }),
    case: parser => new TweakParser(parser, { ignoreCase: false }),
    nocase: parser => new TweakParser(parser, { ignoreCase: true }),
    index: parser => new ActionParser(parser, ({ $match }) => $match.from),
    children: parser =>
      new ActionParser(parser, ({ $match }) => $match.children),
    captures: parser =>
      new ActionParser(parser, ({ $match }) => $match.captures),
    count: parser =>
      new ActionParser(parser, ({ $match }) => $match.children.length),
    filter: (
      parser,
      predicate: (value: any, index: number, array: Array<any>) => unknown
    ) =>
      new ActionParser(parser, ({ $match, $propagate }) =>
        $propagate($match.children.filter(predicate))
      ),
    test: parser =>
      new OptionsParser([
        new ActionParser(parser, () => true),
        new ActionParser(eps, () => false)
      ])
  }
};
