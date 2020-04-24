import { Internals } from "../internals";
import { Options } from "../parser";
import { Match, SemanticAction, SemanticMatchReport } from ".";

/**
 * function inferChildren
 *
 * Infers the children array of a Match, given the array of its sub-matches
 */

export function inferChildren<TContext>(matches: Match<TContext>[]) {
  return matches.reduce<any[]>(
    (acc, match) => [
      ...acc,
      ...(match.synthesized
        ? match.value !== undefined
          ? [match.value]
          : []
        : match.children)
    ],
    []
  );
}

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
  children: any[],
  action: SemanticAction<TContext> | null,
  options: Options<TContext>,
  internals: Internals<TContext>
) {
  try {
    return new Match(input, from, to, children, action, options, internals);
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
      value: (message: string) => {
        options.diagnose &&
          internals.warnings.write({
            from,
            to,
            stack: internals.stack,
            type: "SEMANTIC_WARNING",
            message
          });
      }
    },
    archiveFailures: {
      value: () => {
        options.diagnose && internals.failures.archive();
      }
    }
  });
}
