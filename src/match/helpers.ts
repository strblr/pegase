import { FailureType, WarningType } from "../internals";
import { Internals, Options } from "../parser";
import { Match, SemanticAction, SemanticMatchReport } from ".";

/**
 * function inferChildren
 *
 * Infers the children array of a Match, given the array of its sub-matches
 */

export function inferChildren<TContext>(matches: Array<Match<TContext>>) {
  return matches.reduce<Array<any>>(
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
  children: Array<any>,
  action: SemanticAction<TContext> | null,
  options: Options<TContext>,
  internals: Internals<TContext>
) {
  try {
    return new Match(input, from, to, children, action, options, internals);
  } catch (failure) {
    if (!(failure instanceof Error)) throw failure;
    if (options.diagnose)
      internals.failures.write({
        from,
        to,
        stack: internals.stack,
        type: FailureType.Semantic,
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
  match: Match<TContext>,
  children: Array<any>,
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
      value(message: string) {
        if (options.diagnose)
          internals.warnings.write({
            from,
            to,
            stack: internals.stack,
            type: WarningType.Semantic,
            message
          });
      }
    },
    fail: {
      value(message: string) {
        throw new Error(message);
      }
    },
    archive: {
      value() {
        if (options.diagnose) internals.failures.archive();
      }
    },
    propagate: {
      value() {
        (match as any).synthesized = false;
      }
    }
  });
}
