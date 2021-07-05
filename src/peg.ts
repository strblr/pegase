import {
  action,
  AnyParser,
  chain,
  Directives,
  end,
  flattenModulo,
  lit,
  MetaContext,
  or,
  Parser,
  PegTemplateActionArg,
  PegTemplateArg,
  ref,
  repeat,
  rules,
  token,
  tweak
} from ".";

export function createPeg() {
  function peg<Value = any, Context = any>(
    chunks: TemplateStringsArray,
    ...args: Array<PegTemplateArg<Context>>
  ) {
    const raw = chunks.reduce(
      (acc, chunk, index) =>
        acc +
        (typeof args[index - 1] === "function" ? `~${index - 1}` : index - 1) +
        chunk
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
  eps: lit("", false),
  any: lit(/./),
  id: lit(/[$_a-zA-Z][$_a-zA-Z0-9]*/),
  actionArg: action(lit(/~\d+/), ({ $raw }) => parseInt($raw.substring(1))),
  primaryArg: lit(/\d+/)
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
  index: <Value, Context>(parser: Parser<Value, Context>) =>
    action(parser, ({ $from }) => $from),
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
      ({ $value: [parser] }) => parser
    )
  ],
  [
    "grammar",
    action(
      repeat(
        chain(
          preset.id,
          ref<Array<string>, MetaContext>("directives"),
          lit<false, MetaContext>(":", false),
          ref<AnyParser, MetaContext>("options")
        ),
        1,
        Infinity
      ),
      ({ $value, $context }) =>
        rules(
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
            or(
              lit<false, MetaContext>("|", false),
              lit<false, MetaContext>("/", false)
            ),
            ref<AnyParser, MetaContext>("action")
          ),
          0,
          Infinity
        )
      ),
      ({ $value }) => or(...flattenModulo($value))
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
          : action(sequence, $context.args[act[0]] as PegTemplateActionArg<any>)
    )
  ],
  [
    "sequence",
    action(
      repeat(ref<AnyParser, MetaContext>("sequence"), 1, Infinity),
      ({ $value }) => chain(...$value)
    )
  ],
  [
    "modulo",
    action(
      chain(
        ref<AnyParser, MetaContext>("forward"),
        repeat(
          chain(
            lit<false, MetaContext>("%", false),
            ref<AnyParser, MetaContext>("forward")
          ),
          0,
          Infinity
        )
      ),
      ({ $value }) =>
        flattenModulo($value).reduce((acc, sep) =>
          action(
            chain(acc, repeat(chain(sep, acc), 0, Infinity)),
            ({ $value }) => flattenModulo($value)
          )
        )
    )
  ],
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
