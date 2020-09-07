import { isFunction } from "lodash";
import {
  Alternative,
  Bound,
  BoundType,
  NonTerminal,
  NonTerminalMode,
  Parser,
  Predicate,
  PredicatePolarity,
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
  pipeDirectives,
  singleQuotedString,
  tagAction,
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
 * semantic:   sequence tagAction?

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

export type TagEntity<TContext> = string | RegExp | Parser<TContext>;

export type TagAction<TContext> =
  | SemanticAction<TContext>
  | [(raw: string) => any, ...Array<(value: any) => any>];

export type TagArgument<TContext> =
  | TagEntity<TContext>
  | TagAction<TContext>
  | Fragment<TContext>;

export type Grammar<TContext = any> = Record<string, NonTerminal<TContext>>;

/**
 * Meta-grammar definition
 */

type MetaContext = Readonly<{
  args: Array<TagArgument<any>>;
  grammar: Grammar;
}>;

const metagrammar: Grammar<MetaContext> = {
  pegase: rule("pegase"),
  definition: rule("definition"),
  expression: rule("expression"),
  semantic: rule("semantic"),
  sequence: rule("sequence"),
  modulo: rule("modulo"),
  forward: rule("forward"),
  prefix: rule("prefix"),
  suffix: rule("suffix"),
  primary: rule("primary")
};

metagrammar.pegase.parser = new Sequence([
  new Alternative([
    new Repetition(metagrammar.definition, 1, Infinity),
    metagrammar.expression
  ]),
  new Bound(BoundType.End)
]);

metagrammar.definition.parser = new Sequence(
  [identifier, directives, new Text(":"), metagrammar.expression],
  ({ context: { grammar } }, id, directives, expression) => {
    if (!(id in grammar)) grammar[id] = rule();
    if (grammar[id].parser)
      throw new Error(`Multiple definitions of non-terminal "${id}"`);
    grammar[id].parser = pipeDirectives(
      directives,
      new NonTerminal(expression, NonTerminalMode.Bypass, id)
    );
  }
);

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

metagrammar.semantic.parser = new Sequence(
  [metagrammar.sequence, new Repetition(tagAction, 0, 1)],
  ({ context: { args } }, directive, index) => {
    if (index === undefined) return directive;
    if (index >= args.length)
      throw new Error(
        `Invalid tag action reference (${index}) in parser expression`
      );
    const action = args[index];
    if (!isTagAction(action))
      throw new Error(
        `Tag action ${index} is invalid (it should be a function or an array of functions)`
      );
    const final: SemanticAction<any> = isFunction(action)
      ? action
      : ({ raw }) => action.reduce((arg, fn) => fn(arg), raw);
    return new NonTerminal(directive, NonTerminalMode.Bypass, null, final);
  }
);

metagrammar.sequence.parser = new Repetition(
  metagrammar.modulo,
  1,
  Infinity,
  ({ children }) =>
    children.length === 1 ? children[0] : new Sequence<any>(children)
);

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

metagrammar.forward.parser = new Sequence(
  [new Repetition(new Text(">>", ({ raw }) => raw), 0, 1), metagrammar.prefix],
  ({ children }) =>
    children.length === 1
      ? children[0]
      : new Sequence<any>([
          new Repetition(
            new Sequence([
              new Predicate(children[1], PredicatePolarity.MustFail),
              anyChar
            ]),
            0,
            Infinity
          ),
          children[1]
        ])
);

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
      : new Predicate<any>(
          children[1],
          children[0] === "&"
            ? PredicatePolarity.MustMatch
            : PredicatePolarity.MustFail
        )
);

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
  (_, primary, ...quantifier) => {
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

metagrammar.primary.parser = new Alternative([
  new NonTerminal(
    singleQuotedString,
    NonTerminalMode.Bypass,
    null,
    ([literal]) => new Text<any>(literal)
  ),
  new NonTerminal(
    doubleQuotedString,
    NonTerminalMode.Bypass,
    null,
    ([literal]) => new Text<any>(literal, ({ raw }) => raw)
  ),
  new NonTerminal(
    characterClass,
    NonTerminalMode.Bypass,
    null,
    ([classRegex]) => new Text<any>(classRegex)
  ),
  new NonTerminal(
    tagEntity,
    NonTerminalMode.Bypass,
    null,
    ({ context: { args } }, index) => {
      if (index >= args.length)
        throw new Error(
          `Invalid tag entity reference (${index}) in parser expression`
        );
      const item = args[index];
      if (!isTagEntity(item))
        throw new Error(
          `Tag entity ${index} is invalid (it should be a string, a RegExp, or a Parser)`
        );
      return item instanceof Parser ? item : new Text<any>(item);
    }
  ),
  new Sequence(
    [
      identifier,
      new Predicate(
        new Sequence([directives, new Text(":")]),
        PredicatePolarity.MustFail
      )
    ],
    ({ context: { grammar } }, id) => {
      if (!(id in grammar)) grammar[id] = rule();
      return grammar[id];
    }
  ),
  new Sequence([new Text("("), metagrammar.expression, new Text(")")]),
  new Text("ε", () => epsilon),
  new Text(".", () => anyChar),
  new Text("^", () => new Bound<any>(BoundType.Start)),
  new Text("$", () => new Bound<any>(BoundType.End))
]);

/**
 * The final template tag function and the fragment function
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

peg.fragment = function<TContext = any>(
  chunks: TemplateStringsArray,
  ...args: Array<TagArgument<TContext>>
) {
  return new Fragment<TContext>(chunks, args);
};

export class Fragment<TContext> {
  chunks: TemplateStringsArray;
  args: Array<TagArgument<TContext>>;

  constructor(
    chunks: TemplateStringsArray,
    args: Array<TagArgument<TContext>>
  ) {
    this.chunks = chunks;
    this.args = args;
  }
}

export function defragment<TContext>(
  fragment: Fragment<TContext>
): [Array<string>, Array<Exclude<TagArgument<TContext>, Fragment<TContext>>>] {
  const chunks = [...fragment.chunks];
  const args = [...fragment.args];
  fragment.args.forEach((arg, index) => {});
  return [chunks, args];
}
