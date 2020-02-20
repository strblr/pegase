import {
  isString,
  isRegExp,
  isFunction,
  isInteger,
  last,
  dropRight
} from "lodash";
import {
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
import { char, doubleStr, eps, natural, pegaseId, singleStr } from "./snippets";
import {
  MetaContext,
  NonEmptyArray,
  SemanticAction,
  TagArgument
} from "./types";

export function rule<TValue, TContext>() {
  return new NonTerminal<TValue, TContext>();
}

export function token<TValue, TContext>(identity?: string) {
  return new Token<TValue, TContext>(undefined, identity);
}

/**
 * The meta-grammar
 *
 ***************************************************
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
 *    | identifier !":" ("[" derivation "]")?
 *    | "(" derivation ")"
 *    | "ε"
 *    | "."
 *    | "^"
 *    | !identifier "$"
 */

const metagrammar = {
  pegase: rule<Parser<any, any> | undefined, MetaContext<any>>(),
  rule: rule<undefined, MetaContext<any>>(),
  derivation: rule<Parser<any, any>, MetaContext<any>>(),
  alternative: rule<Parser<any, any>, MetaContext<any>>(),
  step: rule<Parser<any, any>, MetaContext<any>>(),
  item: rule<Parser<any, any>, MetaContext<any>>(),
  atom: rule<Parser<any, any>, MetaContext<any>>()
};

/***************************************************/

metagrammar.pegase.parser = new Sequence([
  new Alternative([
    new Repetition(metagrammar.rule, 1, Infinity),
    metagrammar.derivation
  ]),
  new EndTerminal()
]);

/***************************************************/

metagrammar.rule.parser = new Sequence(
  [pegaseId, new LiteralTerminal(":"), metagrammar.derivation],
  (_, [id, derivation], { rules }): void => {
    if (!(id in rules)) rules[id] = derivation;
    else {
      const parser = rules[id];
      if (
        (!(parser instanceof NonTerminal) && !(parser instanceof Token)) ||
        parser.parser
      )
        throw new Error(`Multiple definitions of non-terminal <${id}>`);
      parser.parser = derivation;
    }
  }
);

/***************************************************/

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
  (_, children): Parser<any, any> => {
    if (children.length === 1) return children[0];
    return new Alternative(children as NonEmptyArray<Parser<any, any>>);
  }
);

/***************************************************/

metagrammar.alternative.parser = new Sequence(
  [
    new Repetition(metagrammar.step, 1, Infinity),
    new Repetition(new Sequence([new LiteralTerminal("@"), natural]), 0, 1)
  ],
  (_, children, { args }): Parser<any, any> => {
    if (!isInteger(last(children)))
      return children.length === 1
        ? children[0]
        : new Sequence(children as NonEmptyArray<Parser<any, any>>);
    const index = last(children);
    if (index >= args.length)
      throw new Error(
        `Invalid semantic action reference (@${index}) in parser expression`
      );
    const action = args[index] as SemanticAction<any, any>;
    children = dropRight(children, 1);
    return children.length === 1
      ? new NonTerminal(children[0], action)
      : new Sequence(children as NonEmptyArray<Parser<any, any>>, action);
  }
);

/***************************************************/

metagrammar.step.parser = new Sequence(
  [
    metagrammar.item,
    new Repetition(
      new Sequence([new LiteralTerminal("%"), metagrammar.item]),
      0,
      Infinity
    )
  ],
  (_, children): Parser<any, any> => {
    const [item, ...rest] = children as NonEmptyArray<Parser<any, any>>;
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

/***************************************************/

metagrammar.item.parser = new Alternative([
  new Sequence(
    [
      new Alternative(
        [new LiteralTerminal("&"), new LiteralTerminal("!")],
        raw => raw
      ),
      metagrammar.atom
    ],
    (_, children): Parser<any, any> => {
      const [operator, atom] = children as [string, Parser<any, any>];
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
    (_, children): Parser<any, any> => {
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

/***************************************************/

metagrammar.atom.parser = new Alternative([
  new NonTerminal(
    singleStr,
    (_, [literal]): Parser<any, any> => new LiteralTerminal(literal)
  ),
  new NonTerminal(
    doubleStr,
    (_, [literal]): Parser<any, any> => new LiteralTerminal(literal, raw => raw)
  ),
  new NonTerminal(
    natural,
    (_, [index], { args }): Parser<any, any> => {
      if (index >= args.length)
        throw new Error(`Invalid reference (${index}) in parser expression`);
      const item = args[index];
      if (isString(item)) return new LiteralTerminal(item);
      if (isRegExp(item)) return new RegexTerminal(item);
      if (item instanceof Parser) return item;
      throw new Error(
        `Template argument ${index} is invalid (should be a string, a regexp, or a Parser instance)`
      );
    }
  ),
  new Sequence(
    [
      pegaseId,
      new Predicate(new LiteralTerminal(":"), false),
      new Repetition(
        new Sequence([
          new LiteralTerminal("["),
          metagrammar.derivation,
          new LiteralTerminal("]")
        ]),
        0,
        1
      )
    ],
    (_, [id, derivation], { rules }): Parser<any, any> => {
      if (!derivation) {
        if (!(id in rules))
          rules[id] = id.startsWith("$") ? token(id.substring(1)) : rule();
        return rules[id];
      } else {
        if (["omit", "raw", "token", "skip", "unskip", "matches"].includes(id))
          return derivation[id];
        throw new Error(`Invalid directive <${id}>`);
      }
    }
  ),
  new Sequence([
    new LiteralTerminal("("),
    metagrammar.derivation,
    new LiteralTerminal(")")
  ]),
  new LiteralTerminal("ε", (): Parser<any, any> => eps),
  new LiteralTerminal(".", (): Parser<any, any> => char),
  new LiteralTerminal("^", (): Parser<any, any> => new StartTerminal()),
  new Sequence(
    [new Predicate(pegaseId, false), new LiteralTerminal("$")],
    (): Parser<any, any> => new EndTerminal()
  )
]);

/**
 * The template tag function
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
  const report = metagrammar.pegase.parse(grammar, { context });
  if (report.match) return report.match.value || context.rules;
  throw new Error(report.humanLogs);
}
