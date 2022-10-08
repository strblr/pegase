import {
  Directive,
  Extension,
  Parser,
  RepetitionParser,
  SequenceParser
} from "../index.js";

// resolveCast

export function resolveCast(extensions: Extension[], value: any) {
  let parser: Parser | undefined;
  for (const extension of extensions)
    if ((parser = extension.cast?.(value))) break;
  return parser;
}

// resolveDirective

export function resolveDirective(extensions: Extension[], directive: string) {
  return extensions.find(
    extension =>
      extension.directives &&
      Object.prototype.hasOwnProperty.call(extension.directives, directive)
  )?.directives![directive];
}

// pipeDirectives

export function pipeDirectives(
  parser: Parser,
  directives: [Directive, any[]][]
) {
  return directives.reduce(
    (parser, [directive, args]) => directive(parser, ...args),
    parser
  );
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
