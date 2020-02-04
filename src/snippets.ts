import { Token, LiteralTerminal, RegexTerminal } from "./parser";
import { SemanticAction } from "./types";

function makeToken(identity: string, pattern: RegExp, action?: SemanticAction) {
  return new Token(new RegexTerminal(pattern, action), identity);
}

export const eps = new Token(new LiteralTerminal(""), "eps");

export const eol = makeToken("eol", /\n|\r|(\r\n)/);

export const space = makeToken("space", /\s/);

export const spaces = makeToken("spaces", /\s*/);

export const char = makeToken("char", /./);

export const alpha = makeToken("alpha", /[a-zA-Z]/);

export const walpha = makeToken("walpha", /[a-zA-ZÀ-ÿ]/);

export const alnum = makeToken("alnum", /[a-zA-Z0-9]/);

export const digit = makeToken("digit", /\d/, raw => parseInt(raw, 10));

export const xdigit = makeToken("xdigit", /[\da-fA-F]/, raw =>
  parseInt(raw, 16)
);

export const natural = makeToken("natural", /\d+/, raw => parseInt(raw, 10));

export const int = makeToken("int", /[-+]?\d+/, raw => parseInt(raw, 10));

export const bin = makeToken("bin", /[01]+/, raw => parseInt(raw, 2));

export const oct = makeToken("oct", /[0-7]+/, raw => parseInt(raw, 8));

export const hex = makeToken("hex", /[\da-fA-F]+/, raw => parseInt(raw, 16));

export const number = makeToken(
  "number",
  /[-+]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/,
  raw => parseFloat(raw)
);

export const basicId = makeToken(
  "basicId",
  /[_a-zA-Z][_a-zA-Z0-9]*/,
  raw => raw
);

export const pegaseId = makeToken(
  "pegaseId",
  /([_a-zA-Z][_$a-zA-Z0-9]*)|(\$[_$a-zA-Z0-9]+)/,
  raw => raw
);

export const singleStr = makeToken("singleStr", /'([^\\']|\\.)*'/, raw =>
  JSON.parse(`"${raw.substring(1, raw.length - 1)}"`)
);

export const doubleStr = makeToken("doubleStr", /"([^\\"]|\\.)*"/, raw =>
  JSON.parse(raw)
);
