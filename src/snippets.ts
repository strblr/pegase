import { NonTerminal, LiteralTerminal, RegexTerminal } from "./parser";
import { SemanticAction } from "./types";

function makeToken<TValue>(
  identity: string,
  pattern: RegExp,
  action?: SemanticAction<TValue, any>
) {
  return new NonTerminal<TValue, any>(
    new RegexTerminal<TValue, any>(pattern, action),
    "TOKEN",
    identity
  );
}

export const eps = new NonTerminal<undefined, any>(
  new LiteralTerminal<undefined, any>(""),
  "TOKEN",
  "epsilon"
);

export const eol = makeToken<undefined>("endOfLine", /\n|\r|(\r\n)/);

export const space = makeToken<undefined>("space", /\s/);

export const spaces = makeToken<undefined>("spaces", /\s*/);

export const char = makeToken<undefined>("anyCharacter", /./);

export const letter = makeToken<undefined>("letter", /[a-zA-Z]/);

export const wletter = makeToken<undefined>("wideLetter", /[a-zA-ZÀ-ÿ]/);

export const bin = makeToken<number>("binaryDigit", /[01]+/, ({ raw }) =>
  parseInt(raw, 2)
);

export const oct = makeToken<number>("octalDigit", /[0-7]+/, ({ raw }) =>
  parseInt(raw, 8)
);

export const digit = makeToken<number>("digit", /\d/, ({ raw }) =>
  parseInt(raw, 10)
);

export const xdigit = makeToken<number>(
  "hexadecimalDigit",
  /[\da-fA-F]/,
  ({ raw }) => parseInt(raw, 16)
);

export const natural = makeToken<number>("naturalNumber", /\d+/, ({ raw }) =>
  parseInt(raw, 10)
);

export const int = makeToken<number>("integer", /[-+]?\d+/, ({ raw }) =>
  parseInt(raw, 10)
);

export const number = makeToken<number>(
  "number",
  /[-+]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/,
  ({ raw }) => parseFloat(raw)
);

export const hex = makeToken<number>(
  "hexadecimalNumber",
  /[\da-fA-F]+/,
  ({ raw }) => parseInt(raw, 16)
);

export const ident = makeToken<string>(
  "identifier",
  /[_a-zA-Z][_a-zA-Z0-9]*/,
  ({ raw }) => raw
);

export const pegaseId = makeToken<string>(
  "pegaseIdentifier",
  /([_a-zA-Z][_$a-zA-Z0-9]*)|(\$[_$a-zA-Z0-9]+)/,
  ({ raw }) => raw
);

export const singleStr = makeToken<string>(
  "singleQuotedString",
  /'([^\\']|\\.)*'/,
  ({ raw }) => JSON.parse(`"${raw.substring(1, raw.length - 1)}"`)
);

export const doubleStr = makeToken<string>(
  "doubleQuotedString",
  /"([^\\"]|\\.)*"/,
  ({ raw }) => JSON.parse(raw)
);

export const charClass = makeToken<RegExp>(
  "characterClass",
  /\[([^\\\]]|\\.)*]/,
  ({ raw }) => new RegExp(raw)
);
