import {
  ActionParser,
  AnyParser,
  Directives,
  EndEdgeParser,
  GrammarParser,
  identifier,
  LiteralParser,
  MetaContext,
  OptionMergeParser,
  OptionsParser,
  Parser,
  PegTemplateArg,
  ReferenceParser,
  RegExpParser,
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
 * options: action % ('|' | '/')   => action (('|' | '/') action)*
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

declare const a: Parser<AnyParser, MetaContext>;

const metagrammar = GrammarParser.create([
  [
    "parser",
    ActionParser.create(
      SequenceParser.create([
        OptionsParser.create([
          ReferenceParser.create<AnyParser, MetaContext>("grammar"),
          ReferenceParser.create<AnyParser, MetaContext>("options")
        ] as const),
        EndEdgeParser.create<MetaContext>()
      ] as const),
      ({ $value }) => $value[0]
    )
  ],
  [
    "grammar",
    ActionParser.create(
      RepetitionParser.create(
        SequenceParser.create([
          identifier as RegExpParser<MetaContext>,
          ReferenceParser.create<ReadonlyArray<string>, MetaContext>(
            "directives"
          ),
          LiteralParser.create<undefined, MetaContext>(":", false),
          ReferenceParser.create<AnyParser, MetaContext>("options")
        ] as const),
        1,
        Infinity
      ),
      ({ $value, $context }) => {
        const rules = $value.map(([label, directives, parser]) => {
          const p = directives.reduce(
            (acc, directive) =>
              directive === "token"
                ? TokenParser.create(acc, label)
                : $context.directives[directive](acc),
            parser
          );
          return [label, p] as const;
        });
        return GrammarParser.create(rules);
      }
    )
  ],
  [
    "options",
    ActionParser.create(
      SequenceParser.create([
        ReferenceParser.create<AnyParser, MetaContext>("action"),
        RepetitionParser.create(
          SequenceParser.create([
            OptionsParser.create([
              LiteralParser.create<undefined, MetaContext>("|", false),
              LiteralParser.create<undefined, MetaContext>("/", false)
            ] as const),
            ReferenceParser.create<AnyParser, MetaContext>("action")
          ] as const),
          0,
          Infinity
        )
      ] as const),
      ({ $value }) => {
        return OptionsParser.create([$value[0], ...$value[1].map(([p]) => p)]);
      }
    )
  ],
  ["action", a],
  ["sequence", a],
  ["modulo", a],
  ["forward", a],
  ["predicate", a],
  ["repetition", a],
  ["directive", a],
  ["primary", a],
  ["directives", a]
] as const);

export const peg = createPeg();

/*
const math = peg`
  expr: <first>term <rest>(("+" | "-") term)*
  term: <first>fact <rest>(("*" | "/") fact)*
  fact: 
`;
*/
