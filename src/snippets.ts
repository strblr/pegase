import { Token, LiteralTerminal, RegexTerminal } from "./parser";
import { SemanticAction } from "./types";

function makeToken<TValue>(
  identity: string,
  pattern: RegExp,
  action?: SemanticAction<TValue, any>
) {
  return new Token<TValue, any>(
    new RegexTerminal<TValue, any>(pattern, action),
    identity
  );
}

export const eps = new Token<undefined, any>(
  new LiteralTerminal<undefined, any>(""),
  "eps"
);

export const eol = makeToken<undefined>("eol", /\n|\r|(\r\n)/);

export const space = makeToken<undefined>("space", /\s/);

export const spaces = makeToken<undefined>("spaces", /\s*/);

export const char = makeToken<undefined>("char", /./);

export const alpha = makeToken<undefined>("alpha", /[a-zA-Z]/);

export const walpha = makeToken<undefined>("walpha", /[a-zA-ZÀ-ÿ]/);

export const alnum = makeToken<undefined>("alnum", /[a-zA-Z0-9]/);

export const digit = makeToken<number>("digit", /\d/, raw => parseInt(raw, 10));

export const xdigit = makeToken<number>("xdigit", /[\da-fA-F]/, raw =>
  parseInt(raw, 16)
);

export const natural = makeToken<number>("natural", /\d+/, raw =>
  parseInt(raw, 10)
);

export const int = makeToken<number>("int", /[-+]?\d+/, raw =>
  parseInt(raw, 10)
);

export const bin = makeToken<number>("bin", /[01]+/, raw => parseInt(raw, 2));

export const oct = makeToken<number>("oct", /[0-7]+/, raw => parseInt(raw, 8));

export const hex = makeToken<number>("hex", /[\da-fA-F]+/, raw =>
  parseInt(raw, 16)
);

export const number = makeToken<number>(
  "number",
  /[-+]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/,
  raw => parseFloat(raw)
);

export const ident = makeToken<string>(
  "ident",
  /[_a-zA-Z][_a-zA-Z0-9]*/,
  raw => raw
);

export const pegaseId = makeToken<string>(
  "pegaseId",
  /([_a-zA-Z][_$a-zA-Z0-9]*)|(\$[_$a-zA-Z0-9]+)/,
  raw => raw
);

export const singleStr = makeToken<string>(
  "singleStr",
  /'([^\\']|\\.)*'/,
  raw => JSON.parse(`"${raw.substring(1, raw.length - 1)}"`)
);

export const doubleStr = makeToken<string>(
  "doubleStr",
  /"([^\\"]|\\.)*"/,
  raw => JSON.parse(raw)
);
