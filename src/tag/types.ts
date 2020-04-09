import { NonTerminal, Parser } from "../parser";
import { SemanticAction } from "../match";

export type TagArgument<TContext> =
  | string
  | RegExp
  | Parser<TContext>
  | SemanticAction<TContext>;

export type MetaContext<TContext> = Readonly<{
  args: TagArgument<TContext>[];
  rules: Record<string, NonTerminal<TContext>>;
}>;
