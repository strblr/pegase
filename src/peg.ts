import {
  action,
  ActionParser,
  AnyParser,
  chain,
  Directives,
  end,
  lit,
  LiteralParser,
  MetaContext,
  OptionsParser,
  or,
  Parser,
  PegTemplateArg,
  ref,
  ReferenceParser,
  RegExpParser,
  repeat,
  RepetitionParser,
  rules,
  SequenceParser,
  token,
  tweak
} from ".";

export const preset = {
  eps: lit("", false),
  any: lit(/./),
  id: lit(/[$_a-zA-Z][$_a-zA-Z0-9]*/),
  actionArg: lit(/@@\d+/)
};

export const defaultDirectives: Directives = {
  raw: parser => action(parser, ({ $raw }) => $raw),
  omit: parser => action(parser, () => undefined),
  token: parser => token(parser),
  skip: parser => tweak(parser, { skip: true }),
  noskip: parser => tweak(parser, { skip: false }),
  case: parser => tweak(parser, { ignoreCase: false }),
  nocase: parser => tweak(parser, { ignoreCase: true }),
  count: parser =>
    action(parser, ({ $value }) =>
      Array.isArray($value) ? $value.length : -1
    ),
  test: parser =>
    or(
      action(parser, () => true),
      action(preset.eps, () => false)
    )
};

export function createPeg() {
  function peg<Value = any, Context = any>(
    chunks: TemplateStringsArray,
    ...args: Array<PegTemplateArg<Context>>
  ) {
    return {} as Parser<Value, Context>;
  }

  peg.directives = { ...defaultDirectives } as Directives;
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

const metagrammar = rules(
  [
    "parser",
    action(
      chain(
        or(
          ref<AnyParser, MetaContext>("grammar"),
          ref<AnyParser, MetaContext>("options")
        ),
        end<MetaContext>()
      ),
      ({ $value }) => $value[0]
    )
  ],
  [
    "grammar",
    action(
      repeat(
        chain(
          preset.id as RegExpParser<MetaContext>, // TODO: remove the "as", "any" contexts should be coerced when possible to narrower
          ref<Array<string>, MetaContext>("directives"),
          lit<false, MetaContext>(":", false),
          ref<AnyParser, MetaContext>("options")
        ),
        1,
        Infinity
      ),
      ({ $value, $context }) =>
        rules(
          // TODO: should not be of value "never"
          ...$value.map(([label, directives, parser]) => {
            const p = directives.reduce(
              (acc, directive) =>
                directive === "token"
                  ? token(acc, label)
                  : $context.directives[directive](acc),
              parser
            );
            return [label, p] as [string, AnyParser];
          })
        )
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
      ({ $value }) =>
        OptionsParser.create([$value[0], ...$value[1].map(([p]) => p)])
    )
  ],
  [
    "action",
    ActionParser.create(
      SequenceParser.create([
        ReferenceParser.create<AnyParser, MetaContext>("sequence"),
        RepetitionParser.create(actionArg as RegExpParser<MetaContext>, 0, 1)
      ] as const),
      ({ $value: [sequence, action], $context }) =>
        action.length === 0
          ? sequence
          : ActionParser.create(sequence, $context.actionArgs.get(action[0])!)
    )
  ],
  [
    "sequence",
    ActionParser.create(
      RepetitionParser.create(
        ReferenceParser.create<AnyParser, MetaContext>("sequence"),
        1,
        Infinity
      ),
      ({ $value }) => SequenceParser.create($value)
    )
  ],
  ["modulo", a],
  ["forward", a],
  ["predicate", a],
  ["repetition", a],
  ["directive", a],
  ["primary", a],
  ["directives", a]
);

export const peg = createPeg();

/*
const math = peg`
  expr: <first>term <rest>(("+" | "-") term)*
  term: <first>fact <rest>(("*" | "/") fact)*
  fact: 
`;
*/
