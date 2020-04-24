import { NonTerminal, Parser } from "../parser";
import { SemanticAction } from "../match";

export type TagEntity<TContext> = string | RegExp | Parser<TContext>;

export type TagAction<TContext> =
  | SemanticAction<TContext>
  | ((arg: any) => any)[];

export type TagArgument<TContext> = TagEntity<TContext> | TagAction<TContext>;

export type Grammar<TContext> = Record<string, NonTerminal<TContext>>;

export type MetaContext<TContext> = Readonly<{
  args: TagArgument<TContext>[];
  grammar: Grammar<TContext>;
}>;
