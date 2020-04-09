import { LiteralTerminal, RegexTerminal } from "../parser";

export const epsilon = new LiteralTerminal<any>("");

export const anyChar = new RegexTerminal<any>(/./);

export const charClass = new RegexTerminal<any>(
  /\[([^\\\]]|\\.)*]/,
  ({ raw }) => new RegExp(raw)
);

export const singleString = new RegexTerminal<any>(
  /'([^\\']|\\.)*'/,
  ({ raw }) => JSON.parse(`"${raw.substring(1, raw.length - 1)}"`)
);

export const doubleString = new RegexTerminal<any>(
  /"([^\\"]|\\.)*"/,
  ({ raw }) => JSON.parse(raw)
);

export const identifier = new RegexTerminal<any>(
  /([_a-zA-Z][_$a-zA-Z0-9]*)|(\$[_$a-zA-Z0-9]+)/,
  ({ raw }) => raw
);

export const natural = new RegexTerminal<any>(/\d+/, ({ raw }) =>
  parseInt(raw, 10)
);
