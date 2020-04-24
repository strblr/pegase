import { NonTerminal, Repetition, Sequence, Text } from "../parser";

export const epsilon = new Text<any>("");

export const anyChar = new Text<any>(/./s);

export const characterClass = new NonTerminal(
  new Text<any>(/\[(?:[^\\\]]|\\.)*]/, ({ raw }) => new RegExp(raw)),
  "TOKEN",
  "characterClass"
);

export const singleQuotedString = new NonTerminal(
  new Text<any>(/'((?:[^\\']|\\.)*)'/, ([inner]) => JSON.parse(`"${inner}"`)),
  "TOKEN",
  "singleQuotedString"
);

export const doubleQuotedString = new NonTerminal(
  new Text<any>(/"(?:[^\\"]|\\.)*"/, ({ raw }) => JSON.parse(raw)),
  "TOKEN",
  "doubleQuotedString"
);

export const identifier = new NonTerminal(
  new Text<any>(/[_a-zA-Z][_a-zA-Z0-9]*/, ({ raw }) => raw),
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
  new Text<any>(/~(\d+)/, ([index]) => parseInt(index, 10)),
  "TOKEN",
  "tagAction"
);

export const directives = new Repetition(
  new Sequence([new Text<any>("@"), identifier]),
  0,
  Infinity,
  ({ children }) => children
);
