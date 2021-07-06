import {
  ActionParser,
  buildModulo,
  CaptureParser,
  Directives,
  EndEdgeParser,
  GrammarParser,
  LiteralParser,
  MetaContext,
  OptionsParser,
  Parser,
  PegTemplateArg,
  PredicateParser,
  ReferenceParser,
  RegExpParser,
  RepetitionParser,
  SequenceParser,
  TokenParser,
  TweakParser
} from ".";

export function createPeg() {
  function peg<Value = any, Context = any>(
    chunks: TemplateStringsArray,
    ...args: Array<PegTemplateArg<Context>>
  ) {
    const raw = chunks.reduce(
      (acc, chunk, index) =>
        `${acc}${
          typeof args[index - 1] === "function" ? `~${index - 1}` : index - 1
        }${chunk}`
    );
    const result = metagrammar.parse(raw, {
      context: { directives: peg.directives, args }
    });
    if (!result.success) throw result;
    return result.value as Parser<Value, Context>;
  }

  peg.directives = { ...defaultDirectives } as Directives;
  peg.extendDirectives = (addons: Directives) =>
    Object.assign(peg.directives, addons);

  return peg;
}

export const preset = {
  eps: new LiteralParser(""),
  any: new RegExpParser(/./),
  id: new RegExpParser(/[$_a-zA-Z][$_a-zA-Z0-9]*/),
  int: new ActionParser(new RegExpParser(/\d+/), ({ $raw }) => parseInt($raw)),
  actionRef: new ActionParser(new RegExpParser(/~\d+/), ({ $raw }) =>
    parseInt($raw.substring(1))
  )
};

export const defaultDirectives: Directives = {
  raw: parser => new ActionParser(parser, ({ $raw }) => $raw),
  omit: parser => new ActionParser(parser, () => undefined),
  token: parser => new TokenParser(parser),
  skip: parser => new TweakParser(parser, { skip: true }),
  noskip: parser => new TweakParser(parser, { skip: false }),
  case: parser => new TweakParser(parser, { ignoreCase: false }),
  nocase: parser => new TweakParser(parser, { ignoreCase: true }),
  index: parser => new ActionParser(parser, ({ $from }) => $from),
  count: parser =>
    new ActionParser(parser, ({ $value }) =>
      Array.isArray($value) ? $value.length : -1
    ),
  test: parser =>
    new OptionsParser([
      new ActionParser(parser, () => true),
      new ActionParser(preset.eps, () => false)
    ])
};

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
 * | '.' | '^' | '$' | 'ε'
 *
 * directives: $directive*
 *
 */

declare const a: Parser<Parser, MetaContext>;

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
      ({ $value: [parser] }) => parser
    )
  ],
  [
    "grammar",
    new ActionParser(
      new RepetitionParser(
        new SequenceParser([
          preset.id,
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
            ([label, directives, parser]: [string, Array<string>, Parser]) => {
              const p = directives.reduce(
                (acc, directive) =>
                  directive === "token"
                    ? new TokenParser(acc, label)
                    : $options.context.directives[directive](acc),
                parser
              );
              return [label, p];
            }
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
      ({ $match }) => new OptionsParser($match.value)
    )
  ],
  [
    "action",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("sequence"),
        new RepetitionParser(preset.actionRef, 0, 1)
      ]),
      ({ $options, $match }) => {
        const [sequence, action] = $match.value as [Parser, Array<number>];
        return action.length === 0
          ? sequence
          : new ActionParser(sequence, $options.context.args[action[0]]);
      }
    )
  ],
  [
    "sequence",
    new ActionParser(
      new RepetitionParser(new ReferenceParser("sequence"), 1, Infinity),
      ({ $value }) => new SequenceParser($value)
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
              new SequenceParser([
                new PredicateParser(directive, false),
                preset.any
              ]),
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
      ({ $options, $match }) => {
        const [capture, directives] = $match.value as [Parser, Array<string>];
        return directives.reduce(
          (acc, directive) => $options.context.directives[directive](acc),
          capture
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
            preset.id,
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
              preset.int,
              new RepetitionParser(
                new SequenceParser([new LiteralParser(","), preset.int]),
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
  ["primary", a],
  ["directives", a]
]);

export const peg = createPeg();

/*
const math = peg`
  expr: term % ("+" | "-")
  term: <first>fact <rest>(("*" | "/") fact)*
  fact: ${a => a.$options.context}
`;
*/
