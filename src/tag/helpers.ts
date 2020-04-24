import { isArray, isFunction, isRegExp, isString } from "lodash";
import { Parser } from "../parser";
import { TagAction, TagEntity } from ".";

/**
 * function isTagEntity
 *
 * Checks if an entity is a valid TagEntity
 */

export function isTagEntity(entity: any): entity is TagEntity<any> {
  return isString(entity) || isRegExp(entity) || entity instanceof Parser;
}

/**
 * function isTagAction
 *
 * Checks if an entity is a valid TagAction
 */

export function isTagAction(action: any): action is TagAction<any> {
  return (
    isFunction(action) || (isArray(action) && action.every(f => isFunction(f)))
  );
}

/**
 * function pipeDirectives
 *
 * Builds a higher-order parser based on a list of directives
 */

export function pipeDirectives(directives: string[], base: Parser<any>) {
  return directives.reduce((parser, directive) => {
    switch (directive) {
      case "omit":
      case "raw":
      case "count":
      case "matches":
      case "token":
      case "skip":
      case "noskip":
      case "case":
      case "nocase":
      case "memo":
        return parser[directive];
      default:
        throw new Error(`Invalid directive <${directive}>`);
    }
  }, base);
}
