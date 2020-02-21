/**
 * Meta-grammar
 *
 ***********************
 *
 * pegase:
 *      (definition+ | expression) $
 * definition:
 *      identifier ":" expression
 * expression:
 *      sequence (("|" | "/") sequence)*
 * sequence:
 *      modulo+ ("@" integer)?
 * modulo:
 *      prefix ("%" prefix)*
 * prefix:
 *      ("&" | "!")? suffix
 *
 * suffix:
 *      primary ("?" | "+" | "*" | "{" integer ("," integer)? "}")?
 *
 * primary:
 *      singleQuotedString
 *    | doubleQuotedString
 *    | integer
 *    | identifier !":" ("[" expression "]")?
 *    | "(" expression ")"
 *    | "ε"
 *    | "."
 *    | "^"
 *    | !identifier "$"
 */

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
  LiteralTerminal,
  NonTerminal,
  RegexTerminal,
  StartTerminal,
  EndTerminal
} from "./parser";
import { char, doubleStr, eps, natural, pegaseId, singleStr } from "./snippets";
import {
  AnyParser,
  MetaContext,
  NonEmptyArray,
  SemanticAction,
  TagArgument
} from "./types";

/**
 * Utility
 */

export function rule<TValue, TContext>() {
  return new NonTerminal<TValue, TContext>(null, "BYPASS", null);
}

export function token<TValue, TContext>(identity?: string) {
  return new NonTerminal<TValue, TContext>(null, "TOKEN", identity || null);
}

/**
 * Meta-grammar definition
 */

const metagrammar = {
  pegase: rule<AnyParser | undefined, MetaContext<any>>(),
  definition: rule<undefined, MetaContext<any>>(),
  expression: rule<AnyParser, MetaContext<any>>(),
  sequence: rule<AnyParser, MetaContext<any>>(),
  modulo: rule<AnyParser, MetaContext<any>>(),
  prefix: rule<AnyParser, MetaContext<any>>(),
  suffix: rule<AnyParser, MetaContext<any>>(),
  primary: rule<AnyParser, MetaContext<any>>()
};

/***************************************************/

metagrammar.pegase.parser = new Sequence([
  new Alternative([
    new Repetition(metagrammar.definition, 1, Infinity),
    metagrammar.expression
  ]),
  new EndTerminal()
]);

/***************************************************/

metagrammar.definition.parser = new Sequence(
  [pegaseId, new LiteralTerminal(":"), metagrammar.expression],
  ([id, derivation], { context: { rules } }): void => {
    if (!(id in rules)) rules[id] = derivation;
    else {
      const parser = rules[id];
      if (!(parser instanceof NonTerminal) || parser.parser)
        throw new Error(`Multiple definitions of non-terminal <${id}>`);
      parser.parser = derivation;
    }
  }
);

/***************************************************/

metagrammar.expression.parser = new Sequence(
  [
    metagrammar.sequence,
    new Repetition(
      new Sequence([
        new Alternative([new LiteralTerminal("|"), new LiteralTerminal("/")]),
        metagrammar.sequence
      ]),
      0,
      Infinity
    )
  ],
  ({ children }): AnyParser => {
    if (children.length === 1) return children[0];
    return new Alternative(children as NonEmptyArray<AnyParser>);
  }
);

/***************************************************/

metagrammar.sequence.parser = new Sequence(
  [
    new Repetition(metagrammar.modulo, 1, Infinity),
    new Repetition(new Sequence([new LiteralTerminal("@"), natural]), 0, 1)
  ],
  ({ children, context: { args } }): AnyParser => {
    if (!isInteger(last(children)))
      return children.length === 1
        ? children[0]
        : new Sequence(children as NonEmptyArray<AnyParser>);
    const index = last(children);
    if (index >= args.length)
      throw new Error(
        `Invalid semantic action reference (@${index}) in parser expression`
      );
    const action = args[index] as SemanticAction<any, any>;
    children = dropRight(children, 1);
    return children.length === 1
      ? new NonTerminal(children[0], "BYPASS", null, action)
      : new Sequence(children as NonEmptyArray<AnyParser>, action);
  }
);

/***************************************************/

metagrammar.modulo.parser = new Sequence(
  [
    metagrammar.prefix,
    new Repetition(
      new Sequence([new LiteralTerminal("%"), metagrammar.prefix]),
      0,
      Infinity
    )
  ],
  ({ children }): AnyParser => {
    const [item, ...rest] = children as NonEmptyArray<AnyParser>;
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

metagrammar.prefix.parser = new Sequence(
  [
    new Repetition(
      new Alternative(
        [new LiteralTerminal("&"), new LiteralTerminal("!")],
        ({ raw }) => raw
      ),
      0,
      1
    ),
    metagrammar.suffix
  ],
  ({ children }): AnyParser => {
    if (children.length === 1) return children[0];
    const [operator, suffix] = children as [string, AnyParser];
    return new Predicate(suffix, operator === "&");
  }
);

/***************************************************/

metagrammar.suffix.parser = new Sequence(
  [
    metagrammar.primary,
    new Repetition(
      new Alternative([
        new LiteralTerminal("?", ({ raw }) => raw),
        new LiteralTerminal("+", ({ raw }) => raw),
        new LiteralTerminal("*", ({ raw }) => raw),
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
  ({ children }): AnyParser => {
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
);

/***************************************************/

metagrammar.primary.parser = new Alternative([
  new NonTerminal(
    singleStr,
    "BYPASS",
    null,
    ([literal]): AnyParser => new LiteralTerminal(literal)
  ),
  new NonTerminal(
    doubleStr,
    "BYPASS",
    null,
    ([literal]): AnyParser => new LiteralTerminal(literal, ({ raw }) => raw)
  ),
  new NonTerminal(
    natural,
    "BYPASS",
    null,
    ([index], { context: { args } }): AnyParser => {
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
          metagrammar.expression,
          new LiteralTerminal("]")
        ]),
        0,
        1
      )
    ],
    ([id, derivation], { context: { rules } }): AnyParser => {
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
    metagrammar.expression,
    new LiteralTerminal(")")
  ]),
  new LiteralTerminal("ε", (): AnyParser => eps),
  new LiteralTerminal(".", (): AnyParser => char),
  new LiteralTerminal("^", (): AnyParser => new StartTerminal()),
  new Sequence(
    [new Predicate(pegaseId, false), new LiteralTerminal("$")],
    (): AnyParser => new EndTerminal()
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
