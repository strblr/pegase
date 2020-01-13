import {
  isString,
  isRegExp,
  isFunction,
  isInteger,
  last,
  dropRight
} from "lodash";
import {
  rule,
  Parser,
  Sequence,
  Alternative,
  Repetition,
  Predicate,
  LiteralTerminal,
  NonTerminal,
  RegexTerminal
} from "./parser";
import {
  epsilon,
  spaces,
  anyCharacter,
  extendedIdentifier,
  positiveInteger,
  singleQuotedString,
  doubleQuotedString
} from "./snippets";
import { throwError } from "./error";

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
 *    | "."
 *    | singleQuotedString
 *    | doubleQuotedString
 *    | integer
 *    | identifier !":"
 *    | "(" derivation ")"
 */

export const metagrammar = {
  pegase: rule(),
  rule: rule(),
  derivation: rule(),
  alternative: rule(),
  step: rule(),
  atom: rule()
};

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.pegase.parser = new Alternative([
  new Repetition(metagrammar.rule, 1, Infinity),
  metagrammar.derivation
]);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.rule.parser = new Sequence([
  extendedIdentifier,
  new LiteralTerminal(":"),
  metagrammar.derivation
]);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.derivation.parser = new Sequence(
  [
    metagrammar.alternative,
    new Repetition(
      new Sequence([new LiteralTerminal("|"), metagrammar.alternative]),
      0,
      Infinity
    )
  ],
  (_, children): Parser => {
    if (children.length === 1) return children[0];
    return new Alternative(children as NonEmptyArray<Parser>);
  }
);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.alternative.parser = new Sequence(
  [
    new Repetition(metagrammar.step, 1, Infinity),
    new Repetition(
      new Sequence([
        new LiteralTerminal("@"),
        new NonTerminal(positiveInteger, raw => parseInt(raw, 10))
      ]),
      0,
      1
    )
  ],
  (_, children, payload) => {
    if (!isInteger(last(children)))
      return new Sequence(children as NonEmptyArray<Parser>);
    const index = last(children);
    if (index >= payload.args.length)
      return throwError(
        `Invalid action reference (@${index}) in parser expression`
      );
    return new Sequence(
      dropRight(children, 1) as NonEmptyArray<Parser>,
      payload.args[index]
    );
  }
);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.step.parser = new Alternative([
  new Sequence([
    new Alternative([new LiteralTerminal("&"), new LiteralTerminal("!")]),
    metagrammar.atom
  ]),
  new Sequence([
    metagrammar.atom,
    new Repetition(
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
      ]),
      0,
      1
    )
  ])
]);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.atom.parser = new Alternative([
  new LiteralTerminal("ε", (): Parser => epsilon),
  new LiteralTerminal(".", (): Parser => anyCharacter),
  new NonTerminal(
    singleQuotedString,
    (raw): Parser => new LiteralTerminal(JSON.parse(raw))
  ),
  new NonTerminal(
    doubleQuotedString,
    raw => new LiteralTerminal(JSON.parse(raw), raw => raw)
  ),
  new NonTerminal(
    positiveInteger,
    (raw, _, payload): Parser => {
      const index = parseInt(raw, 10);
      if (index >= payload.args.length)
        return throwError(`Invalid reference (${index}) in parser expression`);
      const item: TemplateArgument = payload.args[index];
      if (isString(item)) return new LiteralTerminal(item);
      if (isRegExp(item)) return new RegexTerminal(item);
      if (item instanceof Parser) return item;
      return throwError(
        `Argument for reference ${index} is invalid (should be a string, a regexp, or a Parser instance)`
      );
    }
  ),
  new Sequence(
    [extendedIdentifier, new Predicate(new LiteralTerminal(":"), false)],
    (raw, _, payload): Parser => {
      if (!(raw in payload.rules)) payload.rules[raw] = rule();
      return payload.rules[raw];
    }
  ),
  new Sequence([
    new LiteralTerminal("("),
    metagrammar.derivation,
    new LiteralTerminal(")")
  ])
]);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
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
  const payload = {
    args,
    rules: Object.create(null)
  };
  return metagrammar.pegase.parse(template, spaces, payload);
}
