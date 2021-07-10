import {
  ActionParser,
  actionRef,
  any,
  buildModulo,
  CaptureParser,
  charClass,
  directive,
  Directives,
  EndEdgeParser,
  eps,
  GrammarParser,
  id,
  int,
  LiteralParser,
  MetaContext,
  nullObject,
  OptionsParser,
  Parser,
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
  count: parser =>
    new ActionParser(parser, ({ $match }) =>
      Array.isArray($match.value) ? $match.value.length : -1
    ),
  test: parser =>
    new OptionsParser([
      new ActionParser(parser, () => true),
      new ActionParser(eps, () => false)
    ])
} as Directives);

/** The peg metagrammar
 *
 * parser: (grammar | options) $
 * grammar: ($identifier directives ':' options)+
 * options: action % ('|' | '/')   => action (('|' | '/') action)*
 * action: sequence $actionArg?
 * sequence: modulo+
 * modulo: forward % '%'
 * forward: '>>'? directive
 * directive: capture directives
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
 * | '.' | '$' | 'ε'
 *
 * directives: $directive*
 *
 */

const metagrammar: Parser<Parser, MetaContext> = new GrammarParser([
  [
    "parser",
    new ActionParser(
      new SequenceParser([
        new OptionsParser([
          new ReferenceParser("grammar"),
          new ReferenceParser("options")
        ]),
        new EndEdgeParser()
      ]),
      ({ $match }) => $match.value[0]
    )
  ],
  [
    "grammar",
    new ActionParser(
      new RepetitionParser(
        new SequenceParser([
          id,
          new ReferenceParser("directives"),
          new LiteralParser(":"),
          new ReferenceParser("options")
        ]),
        1,
        Infinity
      ),
      ({ $options, $match }) =>
        new GrammarParser(
          $match.value.map(
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
      buildModulo(
        new ReferenceParser("action"),
        new OptionsParser([new LiteralParser("|"), new LiteralParser("/")])
      ),
      ({ $match }) =>
        $match.value.length === 1
          ? $match.value[0]
          : new OptionsParser($match.value)
    )
  ],
  [
    "action",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("sequence"),
        new RepetitionParser(actionRef, 0, 1)
      ]),
      ({ $options, $match }) => {
        const [sequence, action] = $match.value as [Parser, Array<number>];
        return action.length === 0
          ? sequence
          : new ActionParser(
              sequence,
              ($options.context as MetaContext).args[
                action[0]
              ] as SemanticAction
            );
      }
    )
  ],
  [
    "sequence",
    new ActionParser(
      new RepetitionParser(new ReferenceParser("modulo"), 1, Infinity),
      ({ $match }) =>
        $match.value.length === 1
          ? $match.value[0]
          : new SequenceParser($match.value)
    )
  ],
  [
    "modulo",
    new ActionParser(
      buildModulo(new ReferenceParser("forward"), new LiteralParser("%")),
      ({ $match }) =>
        ($match.value as Array<Parser>).reduce((acc, sep) =>
          buildModulo(acc, sep)
        )
    )
  ],
  [
    "forward",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(new LiteralParser(">>", true), 0, 1),
        new ReferenceParser("directive")
      ]),
      ({ $match }) => {
        const [operator, directive] = $match.value as [[] | [">"], Parser];
        if (operator.length === 0) return directive;
        return new ActionParser(
          new SequenceParser([
            new RepetitionParser(
              new SequenceParser([new PredicateParser(directive, false), any]),
              0,
              Infinity
            ),
            directive
          ]),
          ({ $match }) => $match.value[1]
        );
      }
    )
  ],
  [
    "directive",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("capture"),
        new ReferenceParser("directives")
      ]),
      ({ capture, directives, $options }) => {
        return pipeDirectives(
          ($options.context as MetaContext).directives,
          capture,
          directives
        );
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
      ({ $match }) => {
        const [rep, predicate] = $match.value as [[] | [[string]], Parser];
        if (rep.length === 0) return predicate;
        return new CaptureParser(predicate, rep[0][0]);
      }
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
      ({ $match }) => {
        const [polarity, repetition] = $match.value as [[] | [string], Parser];
        if (polarity.length === 0) return repetition;
        return new PredicateParser(repetition, polarity[0] === "&");
      }
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
      ({ $match }) => {
        const [primary, quant] = $match.value as [
          Parser,
          [] | ["?" | "+" | "*" | [number, [] | [[number]]]]
        ];
        if (quant.length === 0) return primary;
        const op = quant[0];
        const [min, max] =
          op === "?"
            ? [0, 1]
            : op === "+"
            ? [1, Infinity]
            : op === "*"
            ? [0, Infinity]
            : op.flat(2);
        return new RepetitionParser(primary, min, max ?? min);
      }
    )
  ],
  [
    "primary",
    new OptionsParser([
      new ActionParser(
        stringLit,
        ({ $match }) => new LiteralParser($match.value)
      ),
      new ActionParser(
        stringLitDouble,
        ({ $match }) => new LiteralParser($match.value, true)
      ),
      new ActionParser(
        charClass,
        ({ $match }) => new RegExpParser($match.value)
      ),
      new ActionParser(int, ({ $match, $options }) => {
        const arg = ($options.context as MetaContext).args[
          $match.value
        ] as Exclude<PegTemplateArg, SemanticAction>;
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
        ({ $match }) => new ReferenceParser($match.value[0])
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
      new ActionParser(new LiteralParser("$"), () => new EndEdgeParser()),
      new ActionParser(new LiteralParser("ε"), () => eps)
    ])
  ],
  ["directives", new RepetitionParser(directive, 0, Infinity)]
]);

// Default peg tag :

export const peg = createPeg();
