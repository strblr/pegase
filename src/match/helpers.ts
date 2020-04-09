import { Internals } from "../internals";
import { Options } from "../parser";
import { Match, SemanticAction, SemanticMatchReport } from ".";

/**
 * function buildSafeMatch
 *
 * Tries to build a Match object as the result of a successful parsing. If an error is thrown
 * while doing so, a failure is stored and null is returned instead.
 */

export function buildSafeMatch<TContext>(
  input: string,
  from: number,
  to: number,
  matches: Match<TContext>[],
  action: SemanticAction<TContext> | null,
  options: Options<TContext>,
  internals: Internals<TContext>
) {
  try {
    return new Match(input, from, to, matches, action, options, internals);
  } catch (failure) {
    if (!(failure instanceof Error)) throw failure;
    options.diagnose &&
      internals.failures.write({
        from,
        to,
        stack: internals.stack,
        type: "SEMANTIC_FAILURE",
        message: failure.message
      });
    return null;
  }
}

/**
 * function buildSemanticMatchReport
 *
 * Builds an object storing information that needs to be passed down to semantic actions.
 * This uses Object.defineProperties since inheriting from Array is forbidden in ES5.
 */

export function buildSemanticMatchReport<TContext>(
  input: string,
  from: number,
  to: number,
  children: any[],
  options: Options<TContext>,
  internals: Internals<TContext>
): SemanticMatchReport<TContext> {
  return Object.defineProperties([...children], {
    input: { value: input },
    from: { value: from },
    to: { value: to },
    raw: {
      get: () => input.substring(from, to)
    },
    stack: { value: internals.stack },
    children: { value: children },
    context: { value: options.context },
    warn: {
      value: (message: string) =>
        options.diagnose &&
        internals.warnings.write({
          from,
          to,
          stack: internals.stack,
          type: "SEMANTIC_WARNING",
          message
        })
    },
    saveErrors: {
      value: () => options.diagnose && internals.failures.save()
    }
  });
}
