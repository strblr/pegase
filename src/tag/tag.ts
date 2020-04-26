import { isFunction } from "lodash";
import {
  Alternative,
  Bound,
  NonTerminal,
  Parser,
  Predicate,
  Repetition,
  rule,
  Sequence,
  Text
} from "../parser";
import { SemanticAction } from "../match";
import {
  anyChar,
  characterClass,
  directives,
  doubleQuotedString,
  epsilon,
  identifier,
  integer,
  isTagAction,
  isTagEntity,
  MetaContext,
  pipeDirectives,
  singleQuotedString,
  tagAction,
  TagArgument,
  tagEntity
} from ".";

/**
 * Meta-grammar
 *
 * * * * * * * * * * * * * * * * * * * * * * *
 *
 * pegase:     (definition+ | expression) $
 * definition: identifier directives ':' expression
 * expression: semantic % ('|' | '/')
 * semantic:   directive tagAction?
 * directive:  sequence directives
 * sequence:   modulo+
 * modulo:     forward % '%'
 * forward:    '>>'? prefix
 * prefix:     ('&' | '!')? suffix
 * suffix:     primary ('?' | '+' | '*' | '{' integer (',' integer)? '}')?
 * primary:    singleQuotedString
 *           | doubleQuotedString
 *           | characterClass
 *           | tagEntity
 *           | identifier !(directives ':')
 *           | '(' expression ')'
 *           | 'ε'
 *           | '.'
 *           | '^'
 *           | '$'
 */

/*peg`
  expr: operator (expr*) @count
  rule: term @count *
  keyword: "declare" @nocase "let"
  term: (fact % '+') @children
  term: fact % '+' @raw
  
  expr: operator expr* @count
  rule: (term @count)*
  keyword: "declare" @nocase "let"
  term: (fact % '+') @children
  term: fact % '+' @raw
  
  expr: operator (expr* @count)
  rule: (term @count)*
  keyword: ("declare" @nocase) "let"
  term: fact % '+' @children
  term: fact % ('+' @raw)
  
  instrs: (instr | >> ';')*
  test: >> number % >> ','
  test: >> &number
  test: >> number+
  rule: a >> b
`;*/

/**
 * Meta-grammar definition
 */

const metagrammar = {
  pegase: rule<MetaContext<any>>("pegase"),
  definition: rule<MetaContext<any>>("definition"),
  expression: rule<MetaContext<any>>("expression"),
  semantic: rule<MetaContext<any>>("semantic"),
  directive: rule<MetaContext<any>>("directive"),
  sequence: rule<MetaContext<any>>("sequence"),
  modulo: rule<MetaContext<any>>("modulo"),
  forward: rule<MetaContext<any>>("forward"),
  prefix: rule<MetaContext<any>>("prefix"),
  suffix: rule<MetaContext<any>>("suffix"),
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
  new Bound("END")
]);

/**
 * "definition" rule definition
 */

metagrammar.definition.parser = new Sequence(
  [identifier, directives, new Text(":"), metagrammar.expression],
  ([id, directives, expression], { context: { grammar } }) => {
    if (!(id in grammar)) grammar[id] = rule();
    if (grammar[id].parser)
      throw new Error(`Multiple definitions of non-terminal <${id}>`);
    grammar[id].parser = pipeDirectives(
      directives,
      new NonTerminal<any>(expression, "BYPASS", id)
    );
  }
);

/**
 * "expression" rule definition
 */

metagrammar.expression.parser = new Sequence(
  [
    metagrammar.semantic,
    new Repetition(
      new Sequence([
        new Alternative([new Text("|"), new Text("/")]),
        metagrammar.semantic
      ]),
      0,
      Infinity
    )
  ],
  ({ children }) =>
    children.length === 1 ? children[0] : new Alternative<any>(children)
);

/**
 * "semantic" rule definition
 */

metagrammar.semantic.parser = new Sequence(
  [metagrammar.directive, new Repetition(tagAction, 0, 1)],
  ([directive, index], { context: { args } }) => {
    if (index === undefined) return directive;
    if (index >= args.length)
      throw new Error(
        `Invalid tag action reference (${index}) in parser expression`
      );
    const action = args[index];
    if (!isTagAction(action))
      throw new Error(
        `Tag action ${index} is invalid (should be a function or an array of functions)`
      );
    const final: SemanticAction<any> = isFunction(action)
      ? action
      : ({ raw }) => action.reduce((arg, fn) => fn(arg), raw);
    return new NonTerminal<any>(directive, "BYPASS", null, final);
  }
);

/**
 * "directive" rule definition
 */

metagrammar.directive.parser = new Sequence(
  [metagrammar.sequence, directives],
  ([sequence, directives]) => pipeDirectives(directives, sequence)
);

/**
 * "sequence" rule definition
 */

metagrammar.sequence.parser = new Repetition(
  metagrammar.modulo,
  1,
  Infinity,
  ({ children }) =>
    children.length === 1 ? children[0] : new Sequence<any>(children)
);

/**
 * "modulo" rule definition
 */

metagrammar.modulo.parser = new Sequence(
  [
    metagrammar.forward,
    new Repetition(
      new Sequence([new Text("%"), metagrammar.prefix]),
      0,
      Infinity
    )
  ],
  ({ children }) =>
    children.reduce(
      (acc, child) =>
        new Sequence<any>([
          acc,
          new Repetition<any>(
            new Sequence<any>([child, acc]),
            0,
            Infinity
          )
        ])
    )
);

/**
 * "forward" rule definition
 */

metagrammar.forward.parser = new Sequence(
  [new Repetition(new Text(">>", ({ raw }) => raw), 0, 1), metagrammar.prefix],
  ({ children }) =>
    children.length === 1
      ? children[0]
      : new Sequence<any>([
          new Repetition(
            new Sequence([new Predicate(children[1], false), anyChar]),
            0,
            Infinity
          ),
          children[1]
        ])
);

/**
 * "prefix" rule definition
 */

metagrammar.prefix.parser = new Sequence(
  [
    new Repetition(
      new Alternative([new Text("&"), new Text("!")], ({ raw }) => raw),
      0,
      1
    ),
    metagrammar.suffix
  ],
  ({ children }) =>
    children.length === 1
      ? children[0]
      : new Predicate<any>(children[1], children[0] === "&")
);

/**
 * "suffix" rule definition
 */

metagrammar.suffix.parser = new Sequence(
  [
    metagrammar.primary,
    new Repetition(
      new Alternative([
        new Text("?", ({ raw }) => raw),
        new Text("+", ({ raw }) => raw),
        new Text("*", ({ raw }) => raw),
        new Sequence([
          new Text("{"),
          integer,
          new Repetition(new Sequence([new Text(","), integer]), 0, 1),
          new Text("}")
        ])
      ]),
      0,
      1
    )
  ],
  ([primary, ...quantifier]) => {
    if (quantifier.length === 0) return primary;
    if (quantifier[0] === "?") return new Repetition<any>(primary, 0, 1);
    if (quantifier[0] === "+") return new Repetition<any>(primary, 1, Infinity);
    if (quantifier[0] === "*") return new Repetition<any>(primary, 0, Infinity);
    const [min, max] = [quantifier[0], quantifier[1] ?? quantifier[0]];
    if (min < 0 || max < 1 || max < min)
      throw new Error(`Invalid repetition range [${min}, ${max}]`);
    return new Repetition<any>(primary, min, max);
  }
);

/**
 * "primary" rule definition
 */

metagrammar.primary.parser = new Alternative([
  new NonTerminal(
    singleQuotedString,
    "BYPASS",
    null,
    ([literal]) => new Text<any>(literal)
  ),
  new NonTerminal(
    doubleQuotedString,
    "BYPASS",
    null,
    ([literal]) => new Text<any>(literal, ({ raw }) => raw)
  ),
  new NonTerminal(
    characterClass,
    "BYPASS",
    null,
    ([classRegex]) => new Text<any>(classRegex)
  ),
  new NonTerminal(
    tagEntity,
    "BYPASS",
    null,
    ([index], { context: { args } }) => {
      if (index >= args.length)
        throw new Error(
          `Invalid tag entity reference (${index}) in parser expression`
        );
      const item = args[index];
      if (!isTagEntity(item))
        throw new Error(
          `Tag entity ${index} is invalid (should be a string, a RegExp, or a Parser)`
        );
      return item instanceof Parser ? item : new Text<any>(item);
    }
  ),
  new Sequence(
    [
      identifier,
      new Predicate(new Sequence([directives, new Text(":")]), false)
    ],
    ([id], { context: { grammar } }) => {
      if (!(id in grammar)) grammar[id] = rule();
      return grammar[id];
    }
  ),
  new Sequence([new Text("("), metagrammar.expression, new Text(")")]),
  new Text("ε", () => epsilon),
  new Text(".", () => anyChar),
  new Text("^", () => new Bound<any>("START")),
  new Text("$", () => new Bound<any>("END"))
]);

/**
 * The template tag function
 */

export function peg<TContext = any>(
  chunks: TemplateStringsArray,
  ...args: TagArgument<TContext>[]
) {
  const raw = chunks.reduce(
    (acc, chunk, index) =>
      acc + (isTagAction(args[index - 1]) ? `~${index - 1}` : index - 1) + chunk
  );
  const context = { args, grammar: Object.create(null) };
  const report = metagrammar.pegase.parse(raw, { context });
  if (report.match) return report.match.value ?? context.grammar;
  throw report;
}
