import { Parser, SemanticAction } from ".";

/** The peg metagrammar
 *
 * parser = grammar | expression
 * grammar = (identifier ':' expression)+
 * expression =
 *
 */

export type PegTemplateArg<Context> =
  | string
  | RegExp
  | Parser<any, Context>
  | SemanticAction<any, Context>;

export function peg<Value = any, Context = any>(
  chunks: TemplateStringsArray,
  ...args: Array<PegTemplateArg<Context>>
) {
  return {} as Parser<Value, Context>;
}

const math = peg`
  expr: <first>term <rest>(("+" | "-") term)*
  term: <first>fact <rest>(("*" | "/") fact)*
  fact: 
`;
