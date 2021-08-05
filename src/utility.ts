import {
  ActionParser,
  Directive,
  Expectation,
  ExpectationType,
  Failure,
  FailureType,
  GrammarParser,
  Internals,
  LiteralParser,
  Location,
  LogOptions,
  OptionsParser,
  ParseOptions,
  Parser,
  Plugin,
  RegExpParser,
  RepetitionParser,
  Result,
  SemanticAction,
  SemanticInfo,
  SequenceParser,
  TokenParser,
  Tracer,
  TweakParser,
  Warning,
  WarningType
} from ".";

// lines

export function lines(input: string) {
  let acc = 0;
  return input.split(/[\r\n]/).map(chunk => {
    const result: [number, string] = [acc, chunk];
    acc += chunk.length + 1;
    return result;
  });
}

// createLocation

export function createLocation(
  index: number,
  lines: Array<[number, string]>
): Location {
  // TODO Should this be lazy ? (probably better on big inputs, worse on small inputs)
  let line = 0;
  let n = lines.length - 2;
  while (line < n) {
    const k = line + ((n - line) >> 1);
    if (index < lines[k][0]) n = k - 1;
    else if (index >= lines[k + 1][0]) line = k + 1;
    else {
      line = k;
      break;
    }
  }
  return {
    index,
    line: line + 1,
    column: index - lines[line][0] + 1
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
      if (current.from.index > failure.from.index) return current;
      if (current.from.index < failure.from.index) return failure;
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

// log

export function log(
  result: Result,
  lines: Array<[number, string]>,
  options?: Partial<LogOptions>
) {
  const fullOptions: LogOptions = {
    warnings: true,
    failures: true,
    tokenDetail: false,
    codeFrames: true,
    linesBefore: 2,
    linesAfter: 2,
    ...options
  };
  const entries = [
    ...(fullOptions.warnings ? result.warnings : []),
    ...(fullOptions.failures ? result.failures : [])
  ].sort((a, b) => a.from.index - b.from.index);

  const stringifyEntry = (entry: Warning | Failure) => {
    switch (entry.type) {
      case WarningType.Message:
        return ["Warning", entry.message];
      case FailureType.Semantic:
        return ["Failure", entry.message];
      case FailureType.Expectation:
        const expectations = entry.expected
          .map(expectation => stringifyExpectation(expectation))
          .reduce(
            (acc, expected, index, { length }) =>
              `${acc}${index === length - 1 ? " or " : ", "}${expected}`
          );
        return ["Failure", `Expected ${expectations}`];
    }
  };

  const stringifyExpectation = (expectation: Expectation) => {
    switch (expectation.type) {
      case ExpectationType.Literal:
        return `"${expectation.literal}"`;
      case ExpectationType.RegExp:
        return String(expectation.regExp);
      case ExpectationType.Token:
        let detail = "";
        if (fullOptions.tokenDetail)
          detail += ` (${expectation.failures
            .map(failure => stringifyEntry(failure)[1])
            .join(" | ")})`;
        return `${expectation.alias}${detail}`;
      case ExpectationType.Mismatch:
        return `mismatch of "${result.options.input.substring(
          expectation.match.from.index,
          expectation.match.to.index
        )}"`;
    }
  };

  return entries
    .map(entry => {
      let acc = `(${entry.from.line}:${entry.from.column}) `;
      const [type, detail] = stringifyEntry(entry);
      acc += `${type}: ${detail}`;
      if (fullOptions.codeFrames)
        acc += `\n\n${codeFrame(entry.from, lines, fullOptions)}`;
      return acc;
    })
    .join("\n\n");
}

// codeFrame

export function codeFrame(
  location: Location,
  lines: Array<[number, string]>,
  options: LogOptions
) {
  const start = Math.max(1, location.line - options.linesBefore);
  const end = Math.min(lines.length, location.line + options.linesAfter);
  const maxLineNum = String(end).length;
  const padding = " ".repeat(maxLineNum);
  let acc = "";
  for (let i = start; i !== end + 1; i++) {
    const lineNum = (padding + i).slice(-maxLineNum);
    const current = lines[i - 1][1];
    const normalized = current.replace(/\t+/, tabs => "  ".repeat(tabs.length));
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
    index: action(({ $match }) => $match.from.index),
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
    infix: action(({ $match }, reducer, ltr = true) =>
      ltr
        ? $match.children.reduce((acc, op, index) =>
            index % 2 ? reducer(acc, op, $match.children[index + 1]) : acc
          )
        : $match.children.reduceRight((acc, op, index) =>
            index % 2 ? reducer($match.children[index - 1], op, acc) : acc
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
