import { NonTerminal, Parser } from "../parser";
import { SemanticAction } from "../match";

export type TagEntity<TContext> = string | RegExp | Parser<TContext>;

export type TagAction<TContext> = SemanticAction<TContext>;

export type TagArgument<TContext> = TagEntity<TContext> | TagAction<TContext>;

export type MetaContext<TContext> = Readonly<{
  args: TagArgument<TContext>[];
  rules: Record<string, NonTerminal<TContext>>;
}>;
