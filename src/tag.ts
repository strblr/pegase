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
  token,
  Parser,
  Sequence,
  Alternative,
  Repetition,
  Predicate,
  Token,
  LiteralTerminal,
  NonTerminal,
  RegexTerminal,
  StartTerminal,
  EndTerminal
} from "./parser";
import { NonEmptyArray, SemanticAction, SuccessMatch } from "./match";
import {
  epsilon,
  spaces,
  anyCharacter,
  pegaseIdentifier,
  positiveInteger,
  singleQuotedString,
  doubleQuotedString
} from "./snippets";

type TemplateArgument = string | RegExp | Parser | SemanticAction;

// TODO add support for '%'

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 *
 * Meta-grammar
 *
 * pegase:
 *      (rule+ | derivation) $
 * rule:
 *      identifier ":" derivation
 * derivation:
 *      alternative (("|" | "/") alternative)*
 * alternative:
 *      step+ ("@" integer)?
 * step:
 *      item ("%" item)*
 * item:
 *      ("&" | "!") atom
 *    | atom ("?" | "+" | "*" | "{" integer ("," integer)? "}")?
 * atom:
 *      singleQuotedString
 *    | doubleQuotedString
 *    | integer
 *    | identifier !":"
 *    | "(" derivation ")"
 *    | "ε"
 *    | "."
 *    | "^"
 *    | !identifier "$"
 */

const metagrammar = {
  pegase: rule(),
  rule: rule(),
  derivation: rule(),
  alternative: rule(),
  step: rule(),
  item: rule(),
  atom: rule()
};

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.pegase.parser = new Sequence([
  new Alternative([
    new Repetition(metagrammar.rule, 1, Infinity),
    metagrammar.derivation
  ]),
  new EndTerminal()
]);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.rule.parser = new Sequence(
  [
    new NonTerminal(pegaseIdentifier, raw => raw),
    new LiteralTerminal(":"),
    metagrammar.derivation
  ],
  (_, children, payload): void => {
    const [identifier, derivation] = children as [string, Parser];
    if (identifier in payload.rules) {
      const parser = payload.rules[identifier];
      if (
        (!(parser instanceof NonTerminal) && !(parser instanceof Token)) ||
        parser.parser
      )
        throw new Error(`Multiple definitions of non-terminal ${identifier}`);
      payload.rules[identifier].parser = derivation;
    } else payload.rules[identifier] = derivation;
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
      new Sequence([
        new Alternative([new LiteralTerminal("|"), new LiteralTerminal("/")]),
        metagrammar.alternative
      ]),
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
      throw new Error(
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

metagrammar.step.parser = new Sequence(
  [
    metagrammar.item,
    new Repetition(
      new Sequence([new LiteralTerminal("%"), metagrammar.item]),
      0,
      Infinity
    )
  ],
  (_, children): Parser => {
    const [item, ...rest] = children;
    if (rest.length === 0) return item;
    // console.log("Got", [item, ...rest]);
    const r = rest.reduce(
      (acc, child) =>
        new Sequence([
          acc,
          new Repetition(new Sequence([child, acc]), 0, Infinity)
        ]),
      item
    );
    // console.log("End", r);
    return r;
  }
);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.item.parser = new Alternative([
  new Sequence(
    [
      new Alternative(
        [new LiteralTerminal("&"), new LiteralTerminal("!")],
        raw => raw
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
      const [min, max] = [
        quantifier[0],
        quantifier.length === 2 ? quantifier[1] : quantifier[0]
      ];
      if (min < 0 || max < 1 || max < min)
        throw new Error(`Invalid repetition range [${min}, ${max}]`);
      return new Repetition(atom, min, max);
    }
  )
]);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

metagrammar.atom.parser = new Alternative([
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
        throw new Error(`Invalid reference (${index}) in parser expression`);
      const item: TemplateArgument = payload.args[index];
      if (isString(item)) return new LiteralTerminal(item);
      if (isRegExp(item)) return new RegexTerminal(item);
      if (item instanceof Parser) return item;
      throw new Error(
        `Argument for reference ${index} is invalid (should be a string, a regexp, or a Parser instance)`
      );
    }
  ),
  new Sequence(
    [pegaseIdentifier, new Predicate(new LiteralTerminal(":"), false)],
    (raw, _, payload): Parser => {
      if (!(raw in payload.rules))
        payload.rules[raw] = raw.startsWith("$")
          ? token(raw.substring(1))
          : rule();
      return payload.rules[raw];
    }
  ),
  new Sequence([
    new LiteralTerminal("("),
    metagrammar.derivation,
    new LiteralTerminal(")")
  ]),
  new LiteralTerminal("ε", (): Parser => epsilon),
  new LiteralTerminal(".", (): Parser => anyCharacter),
  new LiteralTerminal("^", (): Parser => new StartTerminal()),
  new Sequence([
    new Predicate(pegaseIdentifier, false),
    new LiteralTerminal("$", (): Parser => new EndTerminal())
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
  const grammar = chunks.reduce(
    (acc, chunk, index) =>
      acc +
      chunk +
      (index === chunks.length - 1
        ? ""
        : isFunction(args[index])
        ? `@${index}`
        : index),
    ""
  );
  const payload = {
    args,
    rules: Object.create(null)
  };
  const match = metagrammar.pegase.parse(grammar, spaces, payload);
  if (match instanceof SuccessMatch) return match.value || payload.rules;
  throw match;
}
