import { Token, RegexTerminal } from "./parser";

export function raw(transformer?: (parsed: string) => any): SemanticAction {
  return transformer ? parsed => transformer(parsed) : parsed => parsed;
}

export function children(
  transformer?: (children: any[]) => any
): SemanticAction {
  return transformer
    ? (_, children) => transformer(children)
    : (_, children) => children;
}

/*
export const eps: Parser = _("");

export const eol: Parser = token(/\n|\r|(\r\n)/, "eol");

export const space: Parser = token(/\s/, "space");

export const spaces: Parser = token(/\s*!/, "spaces");

export const alpha: Parser = token(/[A-z]/, "alpha");

export const walpha: Parser = token(/[A-zÀ-ÿ]/, "walpha");

export const word: Parser = token(/[A-zÀ-ÿ]+/, "word");

export const digit: Parser = token(/\d/, "digit");

export const xdigit: Parser = token(/[\dA-Fa-f]/, "xdigit");

export const int: Parser = token(/[-+]?\d+/, "int");*/

export const identifier: Parser = new Token(
  new RegexTerminal(/[_a-zA-Z][_a-zA-Z0-9]*!/),
  "identifier"
);

export const singleQuotedString: Parser = new Token(
  new RegexTerminal(/'([^\\']|\\.)*'/),
  "single-quoted string"
);

export const doubleQuotedString: Parser = new Token(
  new RegexTerminal(/"([^\\"]|\\.)*"/),
  "double-quoted string"
);

export const number: Parser = new Token(
  new RegexTerminal(/[-+]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/),
  "number"
);

export const integer: Parser = new Token(
  new RegexTerminal(/[-+]?\d+/),
  "integer"
);
