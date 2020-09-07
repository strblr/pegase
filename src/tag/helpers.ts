import { isArray, isFunction, isRegExp, isString } from "lodash";
import { Parser } from "../parser";
import { TagAction, TagEntity } from ".";

/**
 * function isTagEntity
 *
 * Checks if an entity is a valid TagEntity
 */

export function isTagEntity<TContext>(
  entity: any
): entity is TagEntity<TContext> {
  return isString(entity) || isRegExp(entity) || entity instanceof Parser;
}

/**
 * function isTagAction
 *
 * Checks if an entity is a valid TagAction
 */

export function isTagAction<TContext>(
  action: any
): action is TagAction<TContext> {
  return (
    isFunction(action) || (isArray(action) && action.every(f => isFunction(f)))
  );
}

/**
 * function pipeDirectives
 *
 * Builds a higher-order parser based on a list of directives
 */

export function pipeDirectives<TContext>(
  directives: string[],
  base: Parser<TContext>
) {
  return directives.reduce((parser, directive) => {
    switch (directive) {
      case "omit":
      case "raw":
      case "children":
      case "count":
      case "test":
      case "token":
      case "skip":
      case "noskip":
      case "case":
      case "nocase":
      case "memo":
        return parser[directive];
      default:
        throw new Error(`Invalid directive @${directive}`);
    }
  }, base);
}
