import {
  $children,
  $commit,
  $emit,
  $fail,
  $from,
  $raw,
  ActionParser,
  AlternativeParser,
  CompileOptions,
  CustomParser,
  CutParser,
  GrammarParser,
  LiteralParser,
  Parser,
  RegexParser,
  SemanticAction,
  TokenParser,
  Tracer,
  wrap
} from "../index.js";

export interface Extension {
  cast?(arg: any): Parser | undefined;
  directives?: Record<string, Directive>;
}

export type Directive = (parser: Parser, ...args: any[]) => Parser;

export const defaultExtension: Extension = {
  cast(arg) {
    if (typeof arg === "number") return new LiteralParser(String(arg));
    if (typeof arg === "string") return new LiteralParser(arg);
    if (arg instanceof RegExp) return new RegexParser(arg);
    if (arg instanceof Parser) return arg;
  },
  directives: {
    // Option tweaks
    skip: (parser, nextSkipper?: RegExp) =>
      new CustomParser(options => {
        let code = wrap(
          parser.generate(options),
          "options.skip",
          "true",
          options
        );
        if (nextSkipper)
          code = wrap(
            code,
            "options.skipper",
            options.id.generate(nextSkipper),
            options
          );
        return code;
      }),
    noskip: parser =>
      new CustomParser(options =>
        wrap(parser.generate(options), "options.skip", "false", options)
      ),
    case: parser =>
      new CustomParser(options =>
        wrap(parser.generate(options), "options.ignoreCase", "false", options)
      ),
    nocase: parser =>
      new CustomParser(options =>
        wrap(parser.generate(options), "options.ignoreCase", "true", options)
      ),
    trace: (parser, nextTracer?: Tracer) =>
      new CustomParser(options => {
        let code = wrap(
          parser.generate(options),
          "options.trace",
          "true",
          options
        );
        if (nextTracer)
          code = wrap(
            code,
            "options.tracer",
            options.id.generate(nextTracer),
            options
          );
        return code;
      }),
    notrace: parser =>
      new CustomParser(options =>
        wrap(parser.generate(options), "options.trace", "false", options)
      ),
    context: (parser, nextContext: any) =>
      new CustomParser(options =>
        wrap(
          parser.generate(options),
          "options.context",
          nextContext === undefined
            ? "void 0"
            : options.id.generate(nextContext),
          options
        )
      ),
    // Children transforms
    omit: parser => new ActionParser(parser, () => $emit([])),
    raw: parser => new ActionParser(parser, () => $raw()),
    length: parser => new ActionParser(parser, () => $raw().length),
    number: parser => new ActionParser(parser, () => Number($raw())),
    index: parser => new ActionParser(parser, () => $from().index),
    clump: parser => new ActionParser(parser, () => $children()),
    count: parser => new ActionParser(parser, () => $children().length),
    every: (parser, predicate) =>
      new ActionParser(parser, () => $children().every(predicate)),
    filter: (parser, predicate) =>
      new ActionParser(parser, () => $emit($children().filter(predicate))),
    find: (parser, predicate, defaultValue?) =>
      new ActionParser(parser, () =>
        $emit([$children().find(predicate) ?? defaultValue])
      ),
    flat: (parser, depth) =>
      new ActionParser(parser, () => $emit($children().flat(depth))),
    forEach: (parser, callback) =>
      new ActionParser(parser, () => $children().forEach(callback)),
    join: (parser, separator = ",") =>
      new ActionParser(parser, () => $children().join(separator)),
    map: (parser, mapper) =>
      new ActionParser(parser, () => $emit($children().map(mapper))),
    reduce: (parser, ...args) =>
      new ActionParser(parser, () => ($children().reduce as Function)(...args)),
    infix: (parser, reducer, ltr = true) =>
      new ActionParser(
        parser,
        ltr
          ? () =>
              $children().reduce((acc, op, index) =>
                index % 2 ? reducer(acc, op, $children()[index + 1]) : acc
              )
          : () =>
              $children().reduceRight((acc, op, index) =>
                index % 2 ? reducer($children()[index - 1], op, acc) : acc
              )
      ),
    reverse: parser =>
      new ActionParser(parser, () => $emit([...$children()].reverse())),
    some: (parser, predicate) =>
      new ActionParser(parser, () => $children().some(predicate)),
    reorder: (parser, ...indexes) =>
      new ActionParser(parser, () =>
        $emit(indexes.map(index => $children()[index]))
      ),
    // Other
    action: (parser, action: SemanticAction) =>
      new ActionParser(parser, action),
    fail: (parser, message) => new ActionParser(parser, () => $fail(message)),
    echo: (parser, message) =>
      new ActionParser(parser, () => console.log(message)),
    token: (parser, displayName?: string) =>
      new TokenParser(parser, displayName),
    commit: parser => new ActionParser(parser, () => $commit()),
    test: parser =>
      new AlternativeParser([
        new ActionParser(parser, () => true),
        new ActionParser(new CutParser(), () => false)
      ]),
    import: (parser, ...grammars: Parser[]) => {
      if (grammars.some(g => !(g instanceof GrammarParser)))
        throw new Error("Arguments to @use directive can only be grammars");
      return new CustomParser(options => {
        const grammarOptions: CompileOptions = {
          ...options,
          grammarStart: false
        };
        return `
          ${grammars.map(g => g.generate(grammarOptions)).join("\n")}
          ${parser.generate(options)}
        `;
      });
    }
  }
};
