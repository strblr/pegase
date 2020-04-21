import { LiteralTerminal, NonTerminal, RegexTerminal } from "../parser";

export const epsilon = new LiteralTerminal<any>("");

export const anyChar = new RegexTerminal<any>(/./);

export const characterClass = new NonTerminal(
  new RegexTerminal<any>(/\[([^\\\]]|\\.)*]/, ({ raw }) => new RegExp(raw)),
  "TOKEN",
  "characterClass"
);

export const singleQuotedString = new NonTerminal(
  new RegexTerminal<any>(/'([^\\']|\\.)*'/, ({ raw }) =>
    JSON.parse(`"${raw.substring(1, raw.length - 1)}"`)
  ),
  "TOKEN",
  "singleQuotedString"
);

export const doubleQuotedString = new NonTerminal(
  new RegexTerminal<any>(/"([^\\"]|\\.)*"/, ({ raw }) => JSON.parse(raw)),
  "TOKEN",
  "doubleQuotedString"
);

export const identifier = new NonTerminal(
  new RegexTerminal<any>(
    /([_a-zA-Z][_$a-zA-Z0-9]*)|(\$[_$a-zA-Z0-9]+)/,
    ({ raw }) => raw
  ),
  "TOKEN",
  "identifier"
);

export const integer = new NonTerminal(
  new RegexTerminal<any>(/\d+/, ({ raw }) => parseInt(raw, 10)),
  "TOKEN",
  "integer"
);

export const tagEntity = new NonTerminal(
  new RegexTerminal<any>(/\d+/, ({ raw }) => parseInt(raw, 10)),
  "TOKEN",
  "tagEntity"
);

export const tagAction = new NonTerminal(
  new RegexTerminal<any>(/@\d+/, ({ raw }) => parseInt(raw.substring(1), 10)),
  "TOKEN",
  "tagAction"
);
