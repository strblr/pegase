import {
  ActionParser,
  actionRef,
  any,
  buildModulo,
  CaptureParser,
  charClass,
  CutParser,
  directive,
  Directives,
  endAnchor,
  eps,
  GrammarParser,
  id,
  int,
  LiteralParser,
  MetaContext,
  nullObject,
  OptionsParser,
  Parser,
  pegSkipper,
  PegTemplateArg,
  pipeDirectives,
  PredicateParser,
  ReferenceParser,
  RegExpParser,
  RepetitionParser,
  SemanticAction,
  SequenceParser,
  stringLit,
  stringLitDouble,
  TokenParser,
  TweakParser
} from ".";

// The parser creator factory

export function createPeg() {
  function peg<Value = any, Context = any>(
    chunks: TemplateStringsArray,
    ...args: Array<PegTemplateArg<Context>>
  ): Parser<Value, Context> {
    const raw = chunks.reduce((acc, chunk, index) => {
      const arg = args[index - 1];
      let ref: string;
      if (
        typeof arg === "string" ||
        arg instanceof RegExp ||
        arg instanceof Parser
      )
        ref = `${index - 1}`;
      else if (typeof arg === "function") ref = `~${index - 1}`;
      else
        throw new Error(
          `Invalid tag argument. It should be a function (semantic action), a string, a RegExp or a Parser instance.`
        );
      return acc + ref + chunk;
    });
    const result = metagrammar.parse(raw, {
      skipper: pegSkipper,
      context: { directives: peg.directives, args }
    });
    if (!result.success) throw result;
    return result.value;
  }

  peg.directives = nullObject(defaultDirectives) as Directives;

  peg.extendDirectives = (addons: Directives) =>
    Object.assign(peg.directives, addons);

  return peg;
}

// The default directive definitions

export const defaultDirectives: Directives = nullObject({
  raw: parser => new ActionParser(parser, ({ $raw }) => $raw),
  omit: parser => new ActionParser(parser, () => undefined),
  token: (parser, rule) => new TokenParser(parser, rule),
  skip: parser => new TweakParser(parser, { skip: true }),
  noskip: parser => new TweakParser(parser, { skip: false }),
  case: parser => new TweakParser(parser, { ignoreCase: false }),
  nocase: parser => new TweakParser(parser, { ignoreCase: true }),
  index: parser => new ActionParser(parser, ({ $match }) => $match.from),
  children: parser => new ActionParser(parser, ({ $match }) => $match.children),
  captures: parser => new ActionParser(parser, ({ $match }) => $match.captures),
  count: parser =>
    new ActionParser(parser, ({ $match }) => $match.children.length),
  number: parser => new ActionParser(parser, ({ $raw }) => Number($raw)),
  test: parser =>
    new OptionsParser([
      new ActionParser(parser, () => true),
      new ActionParser(eps, () => false)
    ])
} as Directives);

/** The peg metagrammar
 *
 * pegase: parser $
 * parser: grammar | options
 * grammar: ($identifier directives ':' options)+
 * options: ('|' | '/')? action % ('|' | '/')
 * action: directive $actionArg?
 * directive: sequence directives
 * sequence: modulo+
 * modulo: forward % '%'
 * forward: '...'? capture
 * capture: ('<' $identifier '>')? predicate
 * predicate: ('&' | '!')? repetition
 * repetition: primary ('?' | '+' | '*' | '{' $integer (',' $integer)? '}')?
 * primary:
 *   $singleQuoteString
 * | $doubleQuoteString
 * | $characterClass
 * | $primaryArg
 * | $identifier !(directives ':')
 * | '(' parser ')'
 * | '.' | '$' | 'ε' | '^'
 *
 * directives: $directive*
 */

const metagrammar: Parser<Parser, MetaContext> = new GrammarParser([
  ["pegase", new SequenceParser([new ReferenceParser("parser"), endAnchor])],
  [
    "parser",
    new OptionsParser([
      new ReferenceParser("grammar"),
      new ReferenceParser("options")
    ])
  ],
  [
    "grammar",
    new ActionParser(
      new RepetitionParser(
        new ActionParser(
          new SequenceParser([
            id,
            new ReferenceParser("directives"),
            new LiteralParser(":"),
            new ReferenceParser("options")
          ]),
          ({ $match }) => $match.children
        ),
        1,
        Infinity
      ),
      ({ $options, $match }) =>
        new GrammarParser(
          $match.children.map(
            ([label, directives, parser]: [string, Array<string>, Parser]) => [
              label,
              pipeDirectives(
                ($options.context as MetaContext).directives,
                parser,
                directives,
                label
              )
            ]
          )
        )
    )
  ],
  [
    "options",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(
          new OptionsParser([new LiteralParser("|"), new LiteralParser("/")]),
          0,
          1
        ),
        buildModulo(
          new ReferenceParser("action"),
          new OptionsParser([new LiteralParser("|"), new LiteralParser("/")])
        )
      ]),
      ({ $match }) =>
        $match.children.length === 1
          ? $match.children[0]
          : new OptionsParser($match.children)
    )
  ],
  [
    "action",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("directive"),
        new RepetitionParser(actionRef, 0, 1)
      ]),
      ({ directive, $options, $match }) => {
        const action: number | undefined = $match.children[1];
        return action === undefined
          ? directive
          : new ActionParser(
              directive,
              ($options.context as MetaContext).args[action] as SemanticAction
            );
      }
    )
  ],
  [
    "directive",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("sequence"),
        new ReferenceParser("directives")
      ]),
      ({ sequence, directives, $options }) => {
        return pipeDirectives(
          ($options.context as MetaContext).directives,
          sequence,
          directives
        );
      }
    )
  ],
  [
    "sequence",
    new ActionParser(
      new RepetitionParser(new ReferenceParser("modulo"), 1, Infinity),
      ({ $match }) =>
        $match.children.length === 1
          ? $match.children[0]
          : new SequenceParser($match.children)
    )
  ],
  [
    "modulo",
    new ActionParser(
      buildModulo(new ReferenceParser("forward"), new LiteralParser("%")),
      ({ $match }) =>
        ($match.children as Array<Parser>).reduce((acc, sep) =>
          buildModulo(acc, sep)
        )
    )
  ],
  [
    "forward",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(new LiteralParser("...", true), 0, 1),
        new ReferenceParser("capture")
      ]),
      ({ capture, $match }) => {
        if ($match.children.length === 1) return capture;
        return new SequenceParser([
          new ActionParser(
            new RepetitionParser(
              new SequenceParser([new PredicateParser(capture, false), any]),
              0,
              Infinity
            ),
            () => undefined
          ),
          capture
        ]);
      }
    )
  ],
  [
    "capture",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(
          new SequenceParser([
            new LiteralParser("<"),
            id,
            new LiteralParser(">")
          ]),
          0,
          1
        ),
        new ReferenceParser("predicate")
      ]),
      ({ predicate, $match }) =>
        $match.children.length === 1
          ? predicate
          : new CaptureParser(predicate, $match.children[0])
    )
  ],
  [
    "predicate",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(
          new OptionsParser([
            new LiteralParser("&", true),
            new LiteralParser("!", true)
          ]),
          0,
          1
        ),
        new ReferenceParser("repetition")
      ]),
      ({ repetition, $match }) =>
        $match.children.length === 1
          ? repetition
          : new PredicateParser(repetition, $match.children[0] === "&")
    )
  ],
  [
    "repetition",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("primary"),
        new RepetitionParser(
          new OptionsParser([
            new LiteralParser("?", true),
            new LiteralParser("+", true),
            new LiteralParser("*", true),
            new SequenceParser([
              new LiteralParser("{"),
              int,
              new RepetitionParser(
                new SequenceParser([new LiteralParser(","), int]),
                0,
                1
              ),
              new LiteralParser("}")
            ])
          ]),
          0,
          1
        )
      ]),
      ({ primary, $match }) => {
        if ($match.children.length === 1) return primary;
        const [, ...quantifier] = $match.children as [
          any,
          ...(["?" | "+" | "*" | number] | [number, number])
        ];
        const [min, max] =
          quantifier[0] === "?"
            ? [0, 1]
            : quantifier[0] === "+"
            ? [1, Infinity]
            : quantifier[0] === "*"
            ? [0, Infinity]
            : [quantifier[0], quantifier[1] ?? quantifier[0]];
        return new RepetitionParser(primary, min, max);
      }
    )
  ],
  [
    "primary",
    new OptionsParser([
      new ActionParser(stringLit, ({ $value }) => new LiteralParser($value)),
      new ActionParser(
        stringLitDouble,
        ({ $value }) => new LiteralParser($value, true)
      ),
      new ActionParser(charClass, ({ $value }) => new RegExpParser($value)),
      new ActionParser(int, ({ $value, $options }) => {
        const arg = ($options.context as MetaContext).args[$value] as Exclude<
          PegTemplateArg,
          SemanticAction
        >;
        if (typeof arg === "string") return new LiteralParser(arg);
        if (arg instanceof RegExp) return new RegExpParser(arg);
        return arg;
      }),
      new ActionParser(
        new SequenceParser([
          id,
          new PredicateParser(
            new SequenceParser([
              new ReferenceParser("directives"),
              new LiteralParser(":")
            ]),
            false
          )
        ]),
        ({ $value }) => new ReferenceParser($value)
      ),
      new ActionParser(
        new SequenceParser([
          new LiteralParser("("),
          new ReferenceParser("parser"),
          new LiteralParser(")")
        ]),
        ({ parser }) => parser
      ),
      new ActionParser(new LiteralParser("."), () => any),
      new ActionParser(new LiteralParser("$"), () => endAnchor),
      new ActionParser(new LiteralParser("ε"), () => eps),
      new ActionParser(new LiteralParser("^"), () => new CutParser())
    ])
  ],
  [
    "directives",
    new ActionParser(
      new RepetitionParser(directive, 0, Infinity),
      ({ $match }) => $match.children
    )
  ]
]);

// Default peg tag :

export const peg = createPeg();
