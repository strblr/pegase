import {
  ActionParser,
  AnyParser,
  Directives,
  EndEdgeParser,
  GrammarParser,
  LiteralParser,
  MetaContext,
  OptionMergeParser,
  OptionsParser,
  Parser,
  PegTemplateArg,
  ReferenceParser,
  RepetitionParser,
  SequenceParser,
  TokenParser
} from ".";

export function createPeg() {
  function peg<Value = any, Context = any>(
    chunks: TemplateStringsArray,
    ...args: Array<PegTemplateArg<Context>>
  ) {
    return {} as Parser<Value, Context>;
  }

  peg.directives = {
    raw: parser => new ActionParser(parser, ({ $raw }) => $raw),
    omit: parser => new ActionParser(parser, () => 45),
    token: parser => new TokenParser(parser),
    skip: parser => new OptionMergeParser(parser, { skip: true }),
    noskip: parser => new OptionMergeParser(parser, { skip: false }),
    case: parser => new OptionMergeParser(parser, { ignoreCase: false }),
    nocase: parser => new OptionMergeParser(parser, { ignoreCase: true }),
    count: parser =>
      new ActionParser(parser, ({ $value }) =>
        Array.isArray($value) ? $value.length : -1
      ),
    test: parser =>
      new OptionsParser([
        new ActionParser(parser, () => true),
        new ActionParser(new LiteralParser("", false), () => false)
      ])
  } as Directives;

  peg.extendDirectives = (addons: Directives) =>
    Object.assign(peg.directives, addons);

  return peg;
}

/** The peg metagrammar
 *
 * parser: (grammar | options) $
 * grammar: ($identifier directives ':' options)+
 * options: action % ('|' | '/')
 * action: sequence $actionArg?
 * sequence: modulo+
 * modulo: forward % '%'
 * forward: '>'? predicate
 * predicate: ('&' | '!')? repetition
 * repetition: directive ('?' | '+' | '*' | '{' $integer (',' $integer)? '}')?
 * directive: primary directives
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

const a = new OptionsParser<Parser<any, any>, MetaContext>([
  new ReferenceParser<Parser<any, any>, MetaContext>("grammar"),
  new ReferenceParser<Parser<any, any>, MetaContext>("options")
]);

const metagrammar = new GrammarParser<AnyParser, MetaContext>(
  new Map<string, Parser<AnyParser, MetaContext>>([
    [
      "parser",
      new ActionParser(
        new SequenceParser<[AnyParser], MetaContext>([
          new OptionsParser([
            new ReferenceParser("grammar"),
            new ReferenceParser("options")
          ]),
          new EndEdgeParser()
        ]),
        ({ $value }) => $value[0]
      )
    ],
    [
      "grammar",
      new ActionParser(
        new RepetitionParser<
          Array<[string, Array<string>, AnyParser]>,
          MetaContext
        >(new SequenceParser([]), 1, Infinity),
        ({ $value, $context }) => {
          return new GrammarParser(
            new Map(
              $value.map(([label, directives, parser]) => {
                return [
                  label,
                  directives.reduce((acc, directive) => {
                    if (directive === "token")
                      return new TokenParser(acc, label);
                    return $context.directives[directive](acc);
                  }, parser)
                ] as const;
              })
            )
          );
        }
      )
    ],
    ["options", a],
    ["action", a],
    ["sequence", a],
    ["modulo", a],
    ["forward", a],
    ["predicate", a],
    ["repetition", a],
    ["directive", a],
    ["primary", a],
    ["directives", a]
  ])
);

export const peg = createPeg();

/*
const math = peg`
  expr: <first>term <rest>(("+" | "-") term)*
  term: <first>fact <rest>(("*" | "/") fact)*
  fact: 
`;
*/
