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
