import { uniq } from "lodash";
import { Internals } from "../internals";
import { NonTerminal, Options, Parser, Text } from ".";

/**
 * defaultOptions
 */

export function defaultOptions(): Options<any> {
  return {
    from: 0,
    skipper: new Text(/\s*/),
    skip: true,
    case: true,
    diagnose: true,
    trace: null,
    context: undefined
  };
}

/**
 * function rule
 *
 * Creates a new non-terminal with an undefined child parser
 */

export function rule<TContext = any>(identity?: string) {
  return new NonTerminal<TContext>(null, "BYPASS", identity || null);
}

/**
 * function token
 *
 * Creates a new token with an undefined child parser
 */

export function token<TContext = any>(identity?: string) {
  return new NonTerminal<TContext>(null, "TOKEN", identity || null);
}

/**
 * function preskip
 *
 * Tries to skip irrelevant parts of the input (usually whitespaces)
 */

export function preskip<TContext>(
  input: string,
  options: Options<TContext>,
  internals: Internals<TContext>
) {
  if (!options.skip || !options.skipper) return options.from;
  const match = options.skipper._parse(
    input,
    {
      ...options,
      skip: false
    },
    internals
  );
  return match && match.to;
}

/**
 * function extendFlags
 *
 * Creates a copy of "pattern" but with additional flags
 */

export function extendFlags(pattern: RegExp, flags: string) {
  return new RegExp(pattern, uniq([...pattern.flags, ...flags]).join(""));
}

/**
 * function inferIdentity
 *
 * Finds the nearest possible identity by going down the NonTerminal chain
 */

export function inferIdentity<TContext>(parser: Parser<TContext>) {
  if (!(parser instanceof NonTerminal)) return null;
  let cursor = parser;
  while (!cursor.identity && cursor.parser instanceof NonTerminal)
    cursor = cursor.parser;
  return cursor.identity || null;
}
