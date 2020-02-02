import {
  Parser,
  Token,
  LiteralTerminal,
  RegexTerminal,
  NonTerminal
} from "./parser";

export function silent(parser: Parser) {
  return new NonTerminal(parser, () => undefined);
}

function makeToken(identity: string, pattern: RegExp) {
  return new Token(new RegexTerminal(pattern), identity);
}

export const eps = new Token(new LiteralTerminal(""), "eps");
export const space = makeToken("space", /\s/);
export const spaces = makeToken("spaces", /\s*/);
export const alpha = makeToken("alpha", /[a-zA-Z]/);
export const walpha = makeToken("walpha", /[a-zA-ZÀ-ÿ]/);
export const alnum = makeToken("alnum", /[a-zA-Z0-9]/);
export const eol = makeToken("eol", /\n|\r|(\r\n)/);
export const char = makeToken("char", /./);
export const basicId = makeToken("basicId", /[_a-zA-Z][_a-zA-Z0-9]*/);
export const pegaseId = makeToken(
  "pegaseId",
  /([_a-zA-Z][_$a-zA-Z0-9]*)|(\$[_$a-zA-Z0-9]+)/
);
export const singleStr = makeToken("singleStr", /'([^\\']|\\.)*'/);
export const doubleStr = makeToken("doubleStr", /"([^\\"]|\\.)*"/);
export const digit = makeToken("digit", /\d/);
export const xdigit = makeToken("xdigit", /[\da-fA-F]/);
export const natural = makeToken("natural", /\d+/);
export const negInt = makeToken("negInt", /-\d+/);
export const int = makeToken("int", /[-+]?\d+/);
export const bin = makeToken("bin", /[01]+/);
export const oct = makeToken("oct", /[0-7]+/);
export const hex = makeToken("hex", /[\da-fA-F]+/);
export const number = makeToken(
  "number",
  /[-+]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/
);
