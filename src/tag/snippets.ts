import { NonTerminal, Text } from "../parser";

export const epsilon = new Text<any>("");

export const anyChar = new Text<any>(/./);

export const characterClass = new NonTerminal(
  new Text<any>(/\[([^\\\]]|\\.)*]/, ({ raw }) => new RegExp(raw)),
  "TOKEN",
  "characterClass"
);

export const singleQuotedString = new NonTerminal(
  new Text<any>(/'([^\\']|\\.)*'/, ({ raw }) =>
    JSON.parse(`"${raw.substring(1, raw.length - 1)}"`)
  ),
  "TOKEN",
  "singleQuotedString"
);

export const doubleQuotedString = new NonTerminal(
  new Text<any>(/"([^\\"]|\\.)*"/, ({ raw }) => JSON.parse(raw)),
  "TOKEN",
  "doubleQuotedString"
);

export const identifier = new NonTerminal(
  new Text<any>(
    /([_a-zA-Z][_$a-zA-Z0-9]*)|(\$[_$a-zA-Z0-9]+)/,
    ({ raw }) => raw
  ),
  "TOKEN",
  "identifier"
);

export const integer = new NonTerminal(
  new Text<any>(/\d+/, ({ raw }) => parseInt(raw, 10)),
  "TOKEN",
  "integer"
);

export const tagEntity = new NonTerminal(
  new Text<any>(/\d+/, ({ raw }) => parseInt(raw, 10)),
  "TOKEN",
  "tagEntity"
);

export const tagAction = new NonTerminal(
  new Text<any>(/@\d+/, ({ raw }) => parseInt(raw.substring(1), 10)),
  "TOKEN",
  "tagAction"
);
