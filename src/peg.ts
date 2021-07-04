import {
  action,
  AnyParser,
  chain,
  Directives,
  end,
  lit,
  MetaContext,
  or,
  Parser,
  PegTemplateArg,
  ref,
  repeat,
  rules,
  token,
  tweak
} from ".";

export const preset = {
  eps: lit("", false),
  any: lit(/./),
  id: lit(/[$_a-zA-Z][$_a-zA-Z0-9]*/),
  actionArg: lit(/@@\d+/)
};

export const defaultDirectives = {
  raw: <Value, Context>(parser: Parser<Value, Context>) =>
    action(parser, ({ $raw }) => $raw),
  omit: <Value, Context>(parser: Parser<Value, Context>) =>
    action(parser, () => undefined),
  token: <Value, Context>(parser: Parser<Value, Context>) => token(parser),
  skip: <Value, Context>(parser: Parser<Value, Context>) =>
    tweak(parser, { skip: true }),
  noskip: <Value, Context>(parser: Parser<Value, Context>) =>
    tweak(parser, { skip: false }),
  case: <Value, Context>(parser: Parser<Value, Context>) =>
    tweak(parser, { ignoreCase: false }),
  nocase: <Value, Context>(parser: Parser<Value, Context>) =>
    tweak(parser, { ignoreCase: true }),
  count: <Value, Context>(parser: Parser<Value, Context>) =>
    action(parser, ({ $value }) =>
      Array.isArray($value) ? $value.length : -1
    ),
  test: <Value, Context>(parser: Parser<Value, Context>) =>
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
        end()
      ),
      ({ $value }) => $value[0]
    )
  ],
  [
    "grammar",
    action(
      repeat(
        chain(
          preset.id,
          ref<Array<string>, MetaContext>("directives"),
          lit(":", false),
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
    action(
      chain(
        ref<AnyParser, MetaContext>("action"),
        repeat(
          chain(
            or(lit("|", false), lit("/", false)),
            ref<AnyParser, MetaContext>("action")
          ),
          0,
          Infinity
        )
      ),
      ({ $value }) => or($value[0], ...$value[1].map(([p]) => p))
    )
  ],
  [
    "action",
    action(
      chain(
        ref<AnyParser, MetaContext>("sequence"),
        repeat(preset.actionArg, 0, 1)
      ),
      ({ $value: [sequence, act], $context }) =>
        act.length === 0
          ? sequence
          : action(sequence, $context.actionArgs.get(act[0])!)
    )
  ],
  [
    "sequence",
    action(
      repeat(ref<AnyParser, MetaContext>("sequence"), 1, Infinity),
      ({ $value }) => chain(...$value)
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
