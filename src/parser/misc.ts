import { CompileOptions } from "../index.js";

export function uncompiledParse(): never {
  throw new Error("parse method cannot be called on uncompiled parsers");
}

export function cond(condition: unknown, code: string, elseCode = "") {
  return condition ? code : elseCode;
}

export function wrap(
  code: string,
  target: string,
  value: string,
  options: CompileOptions
) {
  const saved = options.id.generate();
  return `
    var ${saved} = ${target};
    ${target} = ${value};
    ${code}
    ${target} = ${saved};
  `;
}
