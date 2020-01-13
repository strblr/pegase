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

metagrammar.rule.parser = new Sequence(
  [
    new NonTerminal(extendedIdentifier, (raw: string) => raw),
    new LiteralTerminal(":"),
    metagrammar.derivation
  ],
  (_, children, payload): void => {
    const [identifier, derivation] = children as [string, Parser];
    if (identifier in payload.rules)
      payload.rules[identifier].parser = derivation;
    else payload.rules[identifier] = derivation;
  }
);

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
  (_, children, payload): Parser => {
    if (!isInteger(last(children)))
      return children.length === 1
        ? children[0]
        : new Sequence(children as NonEmptyArray<Parser>);
    const index = last(children);
    if (index >= payload.args.length)
      return throwError(
        `Invalid action reference (@${index}) in parser expression`
      );
    const action = payload.args[index];
    children = dropRight(children, 1);
    return children.length === 1
      ? new NonTerminal(children[0], action)
      : new Sequence(children as NonEmptyArray<Parser>, action);
  }
);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.step.parser = new Alternative([
  new Sequence(
    [
      new Alternative(
        [new LiteralTerminal("&"), new LiteralTerminal("!")],
        (raw: string) => raw
      ),
      metagrammar.atom
    ],
    (_, children): Parser => {
      const [operator, atom] = children as [string, Parser];
      return new Predicate(atom, operator === "&");
    }
  ),
  new Sequence(
    [
      metagrammar.atom,
      new Repetition(
        new Alternative([
          new LiteralTerminal("?", raw => raw),
          new LiteralTerminal("+", raw => raw),
          new LiteralTerminal("*", raw => raw),
          new Sequence([
            new LiteralTerminal("{"),
            new NonTerminal(positiveInteger, raw => parseInt(raw, 10)),
            new Repetition(
              new Sequence([
                new LiteralTerminal(","),
                new NonTerminal(positiveInteger, raw => parseInt(raw, 10))
              ]),
              0,
              1
            ),
            new LiteralTerminal("}")
          ])
        ]),
        0,
        1
      )
    ],
    (_, children): Parser => {
      const [atom, ...quantifier] = children;
      if (quantifier.length === 0) return atom;
      if (quantifier[0] === "?") return new Repetition(atom, 0, 1);
      if (quantifier[0] === "+") return new Repetition(atom, 1, Infinity);
      if (quantifier[0] === "*") return new Repetition(atom, 0, Infinity);
      return new Repetition(
        atom,
        quantifier[0],
        quantifier.length === 2 ? quantifier[1] : quantifier[0]
      );
    }
  )
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
    (raw): Parser =>
      new LiteralTerminal(JSON.parse(`"${raw.substring(1, raw.length - 1)}"`))
  ),
  new NonTerminal(
    doubleQuotedString,
    (raw): Parser => new LiteralTerminal(JSON.parse(raw), raw => raw)
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
  const result = metagrammar.pegase.value(template, spaces, payload);
  return result || payload.rules;
}
