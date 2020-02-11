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
import { SuccessMatch } from "./match";
import {
  char,
  doubleStr,
  eps,
  natural,
  pegaseId,
  singleStr,
  spaces
} from "./snippets";
import { MetaContext, NonEmptyArray, TagArgument } from "./types";

/**
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
  pegase: rule<Parser<any, any> | undefined, any>(),
  rule: rule<undefined, any>(),
  derivation: rule<Parser<any, any>, any>(),
  alternative: rule<Parser<any, any>, any>(),
  step: rule<Parser<any, any>, any>(),
  item: rule<Parser<any, any>, any>(),
  atom: rule<Parser<any, any>, any>()
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
  [pegaseId, new LiteralTerminal(":"), metagrammar.derivation],
  (_, [id, derivation], payload): void => {
    if (!(id in payload.rules)) payload.rules[id] = derivation;
    else {
      const parser = payload.rules[id];
      if (
        (!(parser instanceof NonTerminal) && !(parser instanceof Token)) ||
        parser.parser
      )
        throw new Error(`Multiple definitions of non-terminal ${id}`);
      parser.parser = derivation;
    }
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
    new Repetition(new Sequence([new LiteralTerminal("@"), natural]), 0, 1)
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
    const [item, ...rest] = children as NonEmptyArray<Parser>;
    if (rest.length === 0) return item;
    return rest.reduce(
      (acc, child) =>
        new Sequence([
          acc,
          new Repetition(new Sequence([child, acc]), 0, Infinity)
        ]),
      item
    );
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
            natural,
            new Repetition(
              new Sequence([new LiteralTerminal(","), natural]),
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
  new NonTerminal(singleStr, (_, [literal]) => new LiteralTerminal(literal)),
  new NonTerminal(
    doubleStr,
    (_, [literal]) => new LiteralTerminal(literal, raw => raw)
  ),
  new NonTerminal(
    natural,
    (_, [index], payload): Parser => {
      if (index >= payload.args.length)
        throw new Error(`Invalid reference (${index}) in parser expression`);
      const item: TagArgument = payload.args[index];
      if (isString(item)) return new LiteralTerminal(item);
      if (isRegExp(item)) return new RegexTerminal(item);
      if (item instanceof Parser) return item;
      throw new Error(
        `Argument for reference ${index} is invalid (should be a string, a regexp, or a Parser instance)`
      );
    }
  ),
  new Sequence(
    [pegaseId, new Predicate(new LiteralTerminal(":"), false)],
    (_, [id], payload): Parser => {
      if (!(id in payload.rules))
        payload.rules[id] = id.startsWith("$")
          ? token(id.substring(1))
          : rule();
      return payload.rules[id];
    }
  ),
  new Sequence([
    new LiteralTerminal("("),
    metagrammar.derivation,
    new LiteralTerminal(")")
  ]),
  new LiteralTerminal("ε", () => eps),
  new LiteralTerminal(".", () => char),
  new LiteralTerminal("^", () => new StartTerminal()),
  new Sequence([
    new Predicate(pegaseId, false),
    new LiteralTerminal("$", () => new EndTerminal())
  ])
]);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export function pegase<TContext>(
  chunks: TemplateStringsArray,
  ...args: TagArgument<TContext>[]
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
  const context: MetaContext<TContext> = {
    args,
    rules: Object.create(null)
  };
  const match = metagrammar.pegase.parse(grammar, { skipper: spaces, context });
  if (match instanceof SuccessMatch) return match.value || context.rules;
  throw match;
}
