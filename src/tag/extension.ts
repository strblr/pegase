import {
  $children,
  $commit,
  $emit,
  $fail,
  $from,
  $raw,
  ActionParser,
  AlternativeParser,
  CutParser,
  LiteralParser,
  Parser,
  RegexParser,
  SemanticAction,
  TokenParser,
  Tracer,
  TweakParser
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
    tweak: (parser, tweaker) => new TweakParser(parser, tweaker),
    skip: (parser, nextSkipper?: RegExp) =>
      new TweakParser(parser, options => {
        const { skip, skipper } = options;
        options.skip = true;
        options.skipper = nextSkipper ?? skipper;
        return match => {
          options.skip = skip;
          options.skipper = skipper;
          return match;
        };
      }),
    noskip: parser =>
      new TweakParser(parser, options => {
        const { skip } = options;
        options.skip = false;
        return match => {
          options.skip = skip;
          return match;
        };
      }),
    case: parser =>
      new TweakParser(parser, options => {
        const { ignoreCase } = options;
        options.ignoreCase = false;
        return match => {
          options.ignoreCase = ignoreCase;
          return match;
        };
      }),
    nocase: parser =>
      new TweakParser(parser, options => {
        const { ignoreCase } = options;
        options.ignoreCase = true;
        return match => {
          options.ignoreCase = ignoreCase;
          return match;
        };
      }),
    trace: (parser, nextTracer?: Tracer) =>
      new TweakParser(parser, options => {
        const { trace, tracer } = options;
        options.trace = true;
        options.tracer = nextTracer ?? tracer;
        return match => {
          options.trace = trace;
          options.tracer = tracer;
          return match;
        };
      }),
    notrace: parser =>
      new TweakParser(parser, options => {
        const { trace } = options;
        options.trace = false;
        return match => {
          options.trace = trace;
          return match;
        };
      }),
    context: (parser, nextContext: any) =>
      new TweakParser(parser, options => {
        const { context } = options;
        options.context = nextContext;
        return match => {
          options.context = context;
          return match;
        };
      }),
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
      ])
  }
};
