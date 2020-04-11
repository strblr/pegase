import {
  dropRight,
  isFunction,
  isInteger,
  isRegExp,
  isString,
  last
} from "lodash";
import {
  Alternative,
  BoundTerminal,
  LiteralTerminal,
  NonTerminal,
  Parser,
  Predicate,
  RegexTerminal,
  Repetition,
  rule,
  Sequence,
  token
} from "../parser";
import { SemanticAction } from "../match";
import {
  anyChar,
  charClass,
  doubleString,
  epsilon,
  identifier,
  MetaContext,
  natural,
  singleString,
  TagArgument
} from ".";

/**
 * Meta-grammar
 *
 * * * * * * * * * * * * * * * * * * * * * * *
 *
 * pegase:     (definition+ | expression) $
 * definition: identifier ':' expression
 * expression: sequence % ('|' | '/')
 * sequence:   modulo+ ('@' integer)?
 * modulo:     prefix % '%'
 * prefix:     ('&' | '!')? suffix
 * suffix:     directive ('?' | '+' | '*' | '{' integer (',' integer)? '}')?
 * directive:  primary ('#' identifier)*
 * primary:    singleQuotedString
 *           | doubleQuotedString
 *           | characterClass
 *           | integer
 *           | identifier !':'
 *           | '(' expression ')'
 *           | 'ε'
 *           | '.'
 *           | '^'
 *           | !identifier '$'
 */

/**
 * Meta-grammar definition
 */

const metagrammar = {
  pegase: rule<MetaContext<any>>("pegase"),
  definition: rule<MetaContext<any>>("definition"),
  expression: rule<MetaContext<any>>("expression"),
  sequence: rule<MetaContext<any>>("sequence"),
  modulo: rule<MetaContext<any>>("modulo"),
  prefix: rule<MetaContext<any>>("prefix"),
  suffix: rule<MetaContext<any>>("suffix"),
  directive: rule<MetaContext<any>>("directive"),
  primary: rule<MetaContext<any>>("primary")
};

/**
 * "pegase" rule definition
 */

metagrammar.pegase.parser = new Sequence([
  new Alternative([
    new Repetition(metagrammar.definition, 1, Infinity),
    metagrammar.expression
  ]),
  new BoundTerminal("END")
]);

/**
 * "definition" rule definition
 */

metagrammar.definition.parser = new Sequence(
  [identifier, new LiteralTerminal(":"), metagrammar.expression],
  ({ children, context: { rules } }) => {
    const [id, expression] = children as [string, Parser<any>];
    if (!(id in rules)) rules[id] = (id.startsWith("$") ? token : rule)(id);
    if (rules[id].parser)
      throw new Error(`Multiple definitions of non-terminal <${id}>`);
    rules[id].parser = expression;
  }
);

/**
 * "expression" rule definition
 */

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
  ({ children }) => {
    return children.length === 1 ? children[0] : new Alternative<any>(children);
  }
);

/**
 * "sequence" rule definition
 */

metagrammar.sequence.parser = new Sequence(
  [
    new Repetition(metagrammar.modulo, 1, Infinity),
    new Repetition(new Sequence([new LiteralTerminal("@"), natural]), 0, 1)
  ],
  ({ children, context: { args } }) => {
    if (!isInteger(last(children)))
      return children.length === 1 ? children[0] : new Sequence<any>(children);
    const index: number = last(children);
    if (index >= args.length)
      throw new Error(
        `Invalid semantic action reference (@${index}) in parser expression`
      );
    const action = args[index] as SemanticAction<any>;
    children = dropRight(children);
    return children.length === 1
      ? new NonTerminal<any>(children[0], "BYPASS", null, action)
      : new Sequence<any>(children, action);
  }
);

/**
 * "modulo" rule definition
 */

metagrammar.modulo.parser = new Sequence(
  [
    metagrammar.prefix,
    new Repetition(
      new Sequence([new LiteralTerminal("%"), metagrammar.prefix]),
      0,
      Infinity
    )
  ],
  ({ children }) => {
    const [prefix, ...rest]: Parser<any>[] = children;
    if (rest.length === 0) return prefix;
    return rest.reduce(
      (acc, child) =>
        new Sequence<any>([
          acc,
          new Repetition<any>(
            new Sequence<any>([child, acc]),
            0,
            Infinity
          )
        ]),
      prefix
    );
  }
);

/**
 * "prefix" rule definition
 */

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
  ({ children }) => {
    if (children.length === 1) return children[0];
    const [operator, suffix] = children as [string, Parser<any>];
    return new Predicate<any>(suffix, operator === "&");
  }
);

/**
 * "suffix" rule definition
 */

metagrammar.suffix.parser = new Sequence(
  [
    metagrammar.directive,
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
  ({ children }) => {
    const [directive, ...quantifier] = children as [Parser<any>, ...any[]];
    if (quantifier.length === 0) return directive;
    if (quantifier[0] === "?") return new Repetition<any>(directive, 0, 1);
    if (quantifier[0] === "+")
      return new Repetition<any>(directive, 1, Infinity);
    if (quantifier[0] === "*")
      return new Repetition<any>(directive, 0, Infinity);
    const [min, max] = [
      quantifier[0],
      quantifier.length === 2 ? quantifier[1] : quantifier[0]
    ];
    if (min < 0 || max < 1 || max < min)
      throw new Error(`Invalid repetition range [${min}, ${max}]`);
    return new Repetition<any>(directive, min, max);
  }
);

/**
 * "directive" rule definition
 */

metagrammar.directive.parser = new Sequence(
  [
    metagrammar.primary,
    new Repetition(
      new Sequence([new LiteralTerminal("#"), identifier]),
      0,
      Infinity
    )
  ],
  ({ children }) => {
    const [primary, ...directives] = children as [Parser<any>, ...string[]];
    if (directives.length === 0) return primary;
    return directives.reduce((acc, directive) => {
      if (
        ["omit", "raw", "token", "skip", "unskip", "memo", "matches"].includes(
          directive
        )
      )
        return (acc as any)[directive];
      throw new Error(`Invalid directive <${directive}>`);
    }, primary);
  }
);

/**
 * "primary" rule definition
 */

metagrammar.primary.parser = new Alternative([
  new NonTerminal(
    singleString,
    "BYPASS",
    null,
    ([literal]) => new LiteralTerminal<any>(literal)
  ),
  new NonTerminal(
    doubleString,
    "BYPASS",
    null,
    ([literal]) => new LiteralTerminal<any>(literal, ({ raw }) => raw)
  ),
  new NonTerminal(
    charClass,
    "BYPASS",
    null,
    ([classRegex]) => new RegexTerminal<any>(classRegex)
  ),
  new NonTerminal(natural, "BYPASS", null, ([index], { context: { args } }) => {
    if (index >= args.length)
      throw new Error(`Invalid reference (${index}) in parser expression`);
    const item = args[index];
    if (isString(item)) return new LiteralTerminal<any>(item);
    if (isRegExp(item)) return new RegexTerminal<any>(item);
    if (item instanceof Parser) return item;
    throw new Error(
      `Template argument ${index} is invalid (should be a string, a regexp, or a Parser)`
    );
  }),
  new Sequence(
    [identifier, new Predicate(new LiteralTerminal(":"), false)],
    ([id], { context: { rules } }) => {
      if (!(id in rules)) rules[id] = (id.startsWith("$") ? token : rule)(id);
      return rules[id];
    }
  ),
  new Sequence([
    new LiteralTerminal("("),
    metagrammar.expression,
    new LiteralTerminal(")")
  ]),
  new LiteralTerminal("ε", () => epsilon),
  new LiteralTerminal(".", () => anyChar),
  new LiteralTerminal("^", () => new BoundTerminal<any>("START")),
  new Sequence(
    [new Predicate(identifier, false), new LiteralTerminal("$")],
    () => new BoundTerminal<any>("END")
  )
]);

/**
 * The template tag function
 */

export function peg<TContext = any>(
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
  const context = { args, rules: Object.create(null) };
  const report = metagrammar.pegase.parse(grammar, { context });
  if (report.match) return report.match.value || context.rules;
  throw report;
}
