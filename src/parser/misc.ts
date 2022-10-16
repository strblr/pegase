import { CompileOptions } from "../index.js";

export type SemanticAction = (captures: Record<string, any>) => any;

export const defaultSkipper = /\s*/y;

export function uncompiledParse(): never {
  throw new Error("parse method cannot be called on uncompiled parsers");
}

export function cond(condition: unknown, code: string, elseCode = "") {
  return condition ? code : elseCode;
}

export function noop(options: CompileOptions) {
  return `
    options.to = options.from;
    ${options.children} = [];
  `;
}
