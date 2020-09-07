import {
  NonTerminal,
  NonTerminalMode,
  Repetition,
  Sequence,
  Text
} from "../parser";

export const epsilon = new Text<any>("");

export const anyChar = new Text<any>(/./s);

export const characterClass = new NonTerminal(
  new Text<any>(/\[(?:[^\\\]]|\\.)*]/, ({ raw }) => new RegExp(raw)),
  NonTerminalMode.Token,
  "characterClass"
);

export const singleQuotedString = new NonTerminal(
  new Text<any>(/'((?:[^\\']|\\.)*)'/, ([inner]) => JSON.parse(`"${inner}"`)),
  NonTerminalMode.Token,
  "singleQuotedString"
);

export const doubleQuotedString = new NonTerminal(
  new Text<any>(/"(?:[^\\"]|\\.)*"/, ({ raw }) => JSON.parse(raw)),
  NonTerminalMode.Token,
  "doubleQuotedString"
);

export const identifier = new NonTerminal(
  new Text<any>(/[_a-zA-Z][_a-zA-Z0-9]*/, ({ raw }) => raw),
  NonTerminalMode.Token,
  "identifier"
);

export const integer = new NonTerminal(
  new Text<any>(/\d+/, ({ raw }) => parseInt(raw, 10)),
  NonTerminalMode.Token,
  "integer"
);

export const tagEntity = new NonTerminal(
  new Text<any>(/\d+/, ({ raw }) => parseInt(raw, 10)),
  NonTerminalMode.Token,
  "tagEntity"
);

export const tagAction = new NonTerminal(
  new Text<any>(/~(\d+)/, ([index]) => parseInt(index, 10)),
  NonTerminalMode.Token,
  "tagAction"
);

export const directives = new Repetition(
  new Sequence([new Text<any>("@"), identifier]),
  0,
  Infinity,
  ({ children }) => children
);
