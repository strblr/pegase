import {
  ActionParser,
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

export function buildModulo(item: Parser, separator: Parser) {
  return new SequenceParser([
    item,
    new RepetitionParser(new SequenceParser([separator, item]), 0, Infinity)
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
    omit: parser => new ActionParser(parser, () => undefined),
    raw: parser => new ActionParser(parser, ({ $raw }) => $raw),
    number: parser => new ActionParser(parser, ({ $raw }) => Number($raw)),
    token: (parser, alias?: string) => new TokenParser(parser, alias),
    skip: (parser, skipper?: Parser) =>
      new TweakParser(parser, () => ({
        skip: true,
        ...(skipper && { skipper })
      })),
    noskip: parser => new TweakParser(parser, () => ({ skip: false })),
    case: parser => new TweakParser(parser, () => ({ ignoreCase: false })),
    nocase: parser => new TweakParser(parser, () => ({ ignoreCase: true })),
    index: parser => new ActionParser(parser, ({ $match }) => $match.from),
    test: parser =>
      new OptionsParser([
        new ActionParser(parser, () => true),
        new ActionParser(new LiteralParser(""), () => false)
      ]),
    children: parser =>
      new ActionParser(parser, ({ $match }) => $match.children),
    captures: parser =>
      new ActionParser(parser, ({ $match }) => $match.captures),
    count: parser =>
      new ActionParser(parser, ({ $match }) => $match.children.length),
    filter: (
      parser,
      predicate: (value: any, index: number, array: Array<any>) => any
    ) =>
      new ActionParser(parser, ({ $match, $propagate }) =>
        $propagate($match.children.filter(predicate))
      ),
    reduce: (
      parser,
      reducer: (
        previous: any,
        current: any,
        index: number,
        array: Array<any>
      ) => any,
      ...initialValue: Array<any>
    ) =>
      new ActionParser(parser, ({ $match }) =>
        ($match.children.reduce as any)(reducer, ...initialValue)
      ),
    reduceInfix: (
      parser,
      reducer: (left: any, separator: any, right: any) => any
    ) =>
      new ActionParser(parser, ({ $match }) =>
        $match.children.reduce((acc, op, index) =>
          index % 2 ? reducer(acc, op, $match.children[index + 1]) : acc
        )
      )
  }
};
