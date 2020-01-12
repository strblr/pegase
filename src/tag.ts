import { isFunction } from "lodash";

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 *
 * Meta-grammar
 *
 * pegase:      rule+ | derivation
 * rule:        "$"? identifier ":" derivation
 * derivation:  alternative ("|" alternative)*
 * alternative: step+
 * step:        unit ("?" | "+" | "*" ("[" integer "," integer "]")?)
 * unit:        "ε"
 *            | singleQuotedString
 *            | doubleQuotedString
 *            | "(" derivation ")"
 */

export function pegase(
  chunks: TemplateStringsArray,
  ...args: TemplateArgument[]
) {
  const template: string = chunks.reduce((acc, chunk, index) => {
    const ref =
      index === chunks.length - 1
        ? ""
        : isFunction(args[index])
        ? `@${index}`
        : index;
    return acc + chunk + ref;
  }, "");
  return template;
}
