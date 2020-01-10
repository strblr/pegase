import { $p } from "./parser";

export const eps: Parser = $p("");
export const eol: Parser = $p(/\n|\r|(\r\n)/);

export const space: Parser = $p(/\s/);
export const spaces: Parser = $p(/\s*/);

export const alpha: Parser = $p(/[A-z]/);
export const walpha: Parser = $p(/[A-zÀ-ÿ]/);
export const word: Parser = $p(/[A-zÀ-ÿ]+/);
export const ident: Parser = $p(/[_a-zA-Z][_a-zA-Z0-9]*/);

export const digit: Parser = $p(/\d/);
export const xdigit: Parser = $p(/[\dA-Fa-f]/);
export const int: Parser = $p(/[-+]?\d+/);
export const number: Parser = $p(
  /[-+]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/
);
