import {
  ActionParser,
  CutParser,
  Directive,
  Expectation,
  ExpectationType,
  Failure,
  FailureType,
  GrammarParser,
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

// createIndexes

export function createIndexes(input: string) {
  let acc = 0;
  return input.split(/[\r\n]/).map(chunk => {
    const start = acc;
    acc += chunk.length + 1;
    return start;
  });
}

// createLocation

export function createLocation(
  index: number,
  indexes: Array<number>
): Location {
  let line = 0;
  let n = indexes.length - 1;
  while (line < n) {
    const k = line + ((n - line) >> 1);
    if (index < indexes[k]) n = k - 1;
    else if (index >= indexes[k + 1]) line = k + 1;
    else {
      line = k;
      break;
    }
  }
  return {
    index,
    line: line + 1,
    column: index - indexes[line] + 1
  };
}

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

// skip

export function skip(options: ParseOptions) {
  if (!options.skip) return options.from;
  const match = options.skipper.exec({ ...options, skip: false });
  return match && match.to;
}

// emitFailure

export function emitFailure(options: ParseOptions, failure: Failure) {
  const state = options.internals.failure;
  if (!state.current || failure.from.index > state.current.from.index)
    state.current = failure;
  else if (failure.from.index === state.current.from.index)
    if (failure.type === FailureType.Semantic) state.current = failure;
    else if (state.current.type !== FailureType.Semantic)
      state.current = {
        ...state.current,
        expected: [...state.current.expected, ...failure.expected]
      };
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

// action

export function action(
  callback: (info: SemanticInfo, ...args: Array<any>) => any
): Directive {
  return (parser, ...args) =>
    new ActionParser(parser, info => callback(info, ...args));
}

// log

export function log(result: Result, options?: Partial<LogOptions>) {
  const fullOptions: LogOptions = {
    warnings: true,
    failures: true,
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
        return `Warning: ${entry.message}`;
      case FailureType.Semantic:
        return `Failure: ${entry.message}`;
      case FailureType.Expectation:
        const expectations = entry.expected
          .map(expectation => stringifyExpectation(expectation))
          .reduce(
            (acc, expected, index, { length }) =>
              `${acc}${index === length - 1 ? " or " : ", "}${expected}`
          );
        return `Failure: Expected ${expectations}`;
    }
  };

  const stringifyExpectation = (expectation: Expectation) => {
    switch (expectation.type) {
      case ExpectationType.Literal:
        return `"${expectation.literal}"`;
      case ExpectationType.RegExp:
        return String(expectation.regExp);
      case ExpectationType.Token:
        return expectation.displayName;
      case ExpectationType.Mismatch:
        return `mismatch of "${result.options.input.substring(
          expectation.match.from.index,
          expectation.match.to.index
        )}"`;
      case ExpectationType.Custom:
        return expectation.display;
    }
  };

  function codeFrame(location: Location) {
    const indexes = result.options.internals.indexes;
    const start = Math.max(1, location.line - fullOptions.linesBefore);
    const end = Math.min(
      indexes.length,
      location.line + fullOptions.linesAfter
    );
    const maxLineNum = String(end).length;
    const padding = " ".repeat(maxLineNum);
    let acc = "";
    for (let i = start; i !== end + 1; i++) {
      const lineNum = (padding + i).slice(-maxLineNum);
      const current = result.options.input.substring(
        indexes[i - 1],
        (indexes[i] ?? result.options.input.length + 1) - 1
      );
      const normalized = current.replace(/\t+/, tabs =>
        "  ".repeat(tabs.length)
      );
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

  return entries
    .map(entry => {
      let acc = `(${entry.from.line}:${entry.from.column}) `;
      acc += stringifyEntry(entry);
      if (fullOptions.codeFrames) acc += `\n\n${codeFrame(entry.from)}`;
      return acc;
    })
    .join("\n");
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
    omit: action(() => undefined),
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
    token: (parser, displayName?: string) =>
      new TokenParser(parser, displayName),
    commit: parser => new ActionParser(parser, ({ $commit }) => $commit()),
    test: parser =>
      new OptionsParser([
        new ActionParser(parser, () => true),
        new ActionParser(new CutParser(), () => false)
      ])
  }
};
