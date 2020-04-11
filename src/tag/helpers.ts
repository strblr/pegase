import { SemanticAction } from "../match";

/**
 * function raw
 *
 * Creates a semantic action. If a callback is provided, the raw parsed substring
 * is passed to the callback, otherwise the substring becomes the synthesized attribute
 */

export function raw(callback?: (raw: string) => any): SemanticAction<any> {
  return callback ? ({ raw }) => callback(raw) : ({ raw }) => raw;
}
