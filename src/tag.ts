import { isFunction } from "lodash";
import {
  rule,
  Sequence,
  Alternative,
  Repetition,
  Predicate,
  LiteralTerminal
} from "./parser";
import {
  extendedIdentifier,
  positiveInteger,
  singleQuotedString,
  doubleQuotedString
} from "./snippets";

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 *
 * Meta-grammar
 *
 * pegase:
 *      rule+
 *    | derivation
 * rule:
 *      identifier ":" derivation
 * derivation:
 *      alternative ("|" alternative)*
 * alternative:
 *      step+ ("@" integer)?
 * step:
 *      ("&" | "!") atom
 *    | atom ("?" | "+" | "*" | "{" integer ("," integer)? "}")?
 * atom:"ε"
 *    | singleQuotedString
 *    | doubleQuotedString
 *    | integer
 *    | identifier !":"
 *    | "(" derivation ")"
 */

const metagrammar = {
  pegase: rule(),
  rule: rule(),
  derivation: rule(),
  alternative: rule(),
  step: rule(),
  atom: rule()
};

metagrammar.pegase.parser = new Alternative([
  new Repetition(metagrammar.rule, 1, Infinity),
  metagrammar.derivation
]);

metagrammar.rule.parser = new Sequence([
  extendedIdentifier,
  new LiteralTerminal(":"),
  metagrammar.derivation
]);

metagrammar.derivation.parser = new Sequence([
  metagrammar.alternative,
  new Repetition(
    new Sequence([new LiteralTerminal("|"), metagrammar.alternative]),
    0,
    Infinity
  )
]);

metagrammar.alternative.parser = new Sequence([
  new Repetition(metagrammar.step, 1, Infinity),
  new Repetition(
    new Sequence([new LiteralTerminal("@"), positiveInteger]),
    0,
    1
  )
]);

metagrammar.step.parser = new Alternative([
  new Sequence([
    new Alternative([new LiteralTerminal("&"), new LiteralTerminal("!")]),
    metagrammar.atom
  ]),
  new Sequence([
    metagrammar.atom,
    new Alternative([
      new LiteralTerminal("?"),
      new LiteralTerminal("+"),
      new LiteralTerminal("*"),
      new Sequence([
        new LiteralTerminal("{"),
        positiveInteger,
        new Repetition(
          new Sequence([new LiteralTerminal(","), positiveInteger]),
          0,
          1
        ),
        new LiteralTerminal("}")
      ])
    ])
  ])
]);

metagrammar.atom.parser = new Alternative([
  new LiteralTerminal("ε"),
  singleQuotedString,
  doubleQuotedString,
  positiveInteger,
  new Sequence([
    extendedIdentifier,
    new Predicate(new LiteralTerminal(":"), false)
  ]),
  new Sequence([
    new LiteralTerminal("("),
    metagrammar.derivation,
    new LiteralTerminal(")")
  ])
]);

export function pegase(
  chunks: TemplateStringsArray,
  ...args: TemplateArgument[]
) {
  return metagrammar.pegase.parse(chunks.join(""));
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
