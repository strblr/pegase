import {
  ActionParser,
  Directives,
  LiteralParser,
  OptionMergeParser,
  OptionParser,
  Parser,
  PegTemplateArg,
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
      new OptionParser([
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
 * parser: grammar | option
 * grammar: ($identifier directives ':' option)+
 * option: action % ('|' | '/')
 * action: sequence $actionArg
 * sequence: modulo+
 * modulo: forward % '%'
 * forward: '>'? predicate
 * predicate: ('&' | '!')? repetition
 * repetition: primary ('?' | '+' | '*' | '{' $integer (',' $integer)? '}')?
 * primary:
 *   $singleQuoteString
 * | $doubleQuoteString
 * | $characterClass
 * | $primaryArg
 * | $identifier !(directives ':')
 * | '(' parser ')'
 * | '.' | '^' | '$'
 *
 */

export const peg = createPeg();

/*
const math = peg`
  expr: <first>term <rest>(("+" | "-") term)*
  term: <first>fact <rest>(("*" | "/") fact)*
  fact: 
`;
*/
