import assign from "lodash/assign";
import isArray from "lodash/isArray";
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

export const directives: Directives = {
  raw: parser => new ActionParser(parser, ({ $raw }) => $raw),
  omit: parser => new ActionParser(parser, () => 45),
  token: parser => new TokenParser(parser),
  skip: parser => new OptionMergeParser(parser, { skip: true }),
  noskip: parser => new OptionMergeParser(parser, { skip: false }),
  case: parser => new OptionMergeParser(parser, { ignoreCase: false }),
  nocase: parser => new OptionMergeParser(parser, { ignoreCase: true }),
  count: parser =>
    new ActionParser(parser, ({ $value }) =>
      isArray($value) ? $value.length : -1
    ),
  test: parser =>
    new OptionParser([
      new ActionParser(parser, () => true),
      new ActionParser(new LiteralParser("", false), () => false)
    ])
};

export function extendDirectives(addons: Directives) {
  assign(directives, addons);
}

/** The peg metagrammar
 *
 * parser = grammar | expression
 * grammar = (identifier ':' expression)+
 * expression =
 *
 */

export function peg<Value = any, Context = any>(
  chunks: TemplateStringsArray,
  ...args: Array<PegTemplateArg<Context>>
) {
  return {} as Parser<Value, Context>;
}

/*
const math = peg`
  expr: <first>term <rest>(("+" | "-") term)*
  term: <first>fact <rest>(("*" | "/") fact)*
  fact: 
`;
*/
