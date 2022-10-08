// Predefined skippers

import { GrammarParser, Parser } from "../parser";

export const defaultSkipper = /\s*/y;

export const pegSkipper = /(?:\s|#[^#\r\n]*[#\r\n])*/y;

/**
 * Creates a duplicate-free version of an iterable
 * @param items
 */

export function unique<T>(items: Iterable<T>) {
  return [...new Set(items)];
}

/**
 * Duplicates a RegExp with new flags
 * @param regex
 * @param flags
 */

export function extendFlags(regex: RegExp, flags: string) {
  return new RegExp(regex, unique([...regex.flags, ...flags]).join(""));
}

/**
 * Converts a string to space case
 * @param input
 */

export function spaceCase(input: string) {
  return input
    .replace("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

/**
 * Merges two grammar parsers into one
 * @param grammars
 */

export function merge<Context = any>(...grammars: Parser[]): Parser<Context> {
  return new GrammarParser(
    grammars.flatMap(grammar => {
      if (!(grammar instanceof GrammarParser))
        throw new Error("Only GrammarParser can be merged");
      return grammar.rules;
    })
  ).compile();
}
