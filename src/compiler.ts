import { parseFunction, Parser, Visitor } from ".";

export function compile(parser: Parser): parseFunction {
  const code = parser.accept(compileVisitor);
  return new Function(code) as parseFunction;
}

export const compileVisitor: Visitor<string> = {};
