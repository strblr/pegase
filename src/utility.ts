import {
  ActionParser,
  Directives,
  FailureType,
  GrammarParser,
  Internals,
  ParseOptions,
  Parser,
  RepetitionParser,
  SequenceParser
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
  internals: Pick<Internals, "failures" | "committedFailures">
) {
  return [
    ...internals.committedFailures,
    ...(internals.failures.length === 0
      ? []
      : [
          internals.failures.reduce((failure, current) => {
            if (current.to > failure.to) return current;
            if (current.to < failure.to) return failure;
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

// buildModulo

export function buildModulo(item: Parser, separator: Parser) {
  return new ActionParser(
    new SequenceParser([
      item,
      new RepetitionParser(new SequenceParser([separator, item]), 0, Infinity)
    ]),
    ({ $match }) => {
      const value = $match.value as Array<any>;
      if (value.length === 1) return (value[0] as Array<any>).flat();
      return [value[0], ...(value[1] as Array<any>).flat()];
    }
  );
}

// merge (grammars)

export function merge<Value, Context>(
  parser: Parser<Value, Context>,
  ...parsers: Array<Parser<any, Context>>
): Parser<Value, Context> {
  return new GrammarParser(
    [parser, ...parsers].reduce<Array<[string, Parser]>>((acc, parser) => {
      if (!(parser instanceof GrammarParser))
        throw new Error("You can only merge grammar parsers");
      return [...acc, ...parser.rules.entries()];
    }, [])
  );
}

// nullObject

export function nullObject(...sources: Array<object>): Record<string, any> {
  const object = Object.create(null);
  return sources.length === 0 ? object : Object.assign(object, ...sources);
}
