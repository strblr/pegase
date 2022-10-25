import {
  $fail,
  CompileOptions,
  Directive,
  Extension,
  Parser,
  RepetitionParser,
  SequenceParser
} from "../index.js";

/**
 * The skipper used in pegase grammars
 */

export const pegSkipper = /(?:\s|#[^#\r\n]*[#\r\n])*/y;

/**
 * Find a cast resolver by scanning the extension list
 * @param extensions
 * @param value
 */

export function resolveCast(extensions: Extension[], value: any) {
  let parser: Parser | undefined;
  for (const extension of extensions)
    if ((parser = extension.cast?.(value))) break;
  return parser;
}

/**
 * Find a directive definition by name by scanning the extension list
 * @param extensions
 * @param directive
 */

export function resolveDirective(extensions: Extension[], directive: string) {
  return extensions.find(
    extension =>
      extension.directives &&
      Object.prototype.hasOwnProperty.call(extension.directives, directive)
  )?.directives![directive];
}

/**
 * Composes a new parser by piping one through the directive list
 * @param parser
 * @param directives
 */

export function pipeDirectives(
  parser: Parser,
  directives: [Directive, any[]][]
) {
  return directives.reduce(
    (parser, [directive, args]) => directive(parser, ...args),
    parser
  );
}

/**
 * Generates a (meta)parsing error when a directive couldn't be resolved
 * @param directive
 */

export function unresolvedDirectiveFail(directive: string) {
  $fail(
    `Couldn't resolve directive "${directive}", you can add support for it via peg.extend`
  );
}

/**
 * Explicit builder for modulo expressions (a % b)
 * @param item
 * @param separator
 * @param repetitionRange
 */

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

/**
 * Converts a string to space case
 * @param input
 */

export function spaceCase(input: string) {
  return input
    .replace("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

/**
 * Overrides a target value before a given code segment, then restores it
 * @param code
 * @param target
 * @param value
 * @param options
 */

export function wrap(
  code: string,
  target: string,
  value: string,
  options: CompileOptions
) {
  const saved = options.id.generate();
  return `
    var ${saved} = ${target};
    ${target} = ${value};
    ${code}
    ${target} = ${saved};
  `;
}
