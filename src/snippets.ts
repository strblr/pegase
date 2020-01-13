import { Parser, Token, LiteralTerminal, RegexTerminal } from "./parser";

/*

export const alpha: Parser = token(/[A-z]/, "alpha");

export const walpha: Parser = token(/[A-zÀ-ÿ]/, "walpha");

export const word: Parser = token(/[A-zÀ-ÿ]+/, "word");*/

export const epsilon: Parser = new Token(new LiteralTerminal(""), "epsilon");

export const space: Parser = new Token(new RegexTerminal(/\s/), "space");

export const spaces: Parser = new Token(new RegexTerminal(/\s*/), "spaces");

export const endOfLine: Parser = new Token(
  new RegexTerminal(/\n|\r|(\r\n)/),
  "end of line"
);

export const anyCharacter: Parser = new Token(
  new RegexTerminal(/./),
  "any character"
);

export const identifier: Parser = new Token(
  new RegexTerminal(/[_a-zA-Z][_a-zA-Z0-9]*/),
  "identifier"
);

export const extendedIdentifier: Parser = new Token(
  new RegexTerminal(/[_$a-zA-Z][_$a-zA-Z0-9]*/),
  "extended identifier"
);

export const singleQuotedString: Parser = new Token(
  new RegexTerminal(/'([^\\']|\\.)*'/),
  "single-quoted string"
);

export const doubleQuotedString: Parser = new Token(
  new RegexTerminal(/"([^\\"]|\\.)*"/),
  "double-quoted string"
);

export const digit: Parser = new Token(new RegexTerminal(/\d/), "digit");

export const hexDigit: Parser = new Token(
  new RegexTerminal(/[\dA-Fa-f]/),
  "hexadecimal digit"
);

export const positiveInteger: Parser = new Token(
  new RegexTerminal(/\d+/),
  "positive integer"
);

export const negativeInteger: Parser = new Token(
  new RegexTerminal(/-\d+/),
  "negative integer"
);

export const integer: Parser = new Token(
  new RegexTerminal(/[-+]?\d+/),
  "integer"
);

export const number: Parser = new Token(
  new RegexTerminal(/[-+]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/),
  "number"
);
