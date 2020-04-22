import { Parser } from ".";

export type Options<TContext> = Readonly<{
  from: number;
  skipper: Parser<TContext> | null;
  skip: boolean;
  ignoreCase: boolean;
  diagnose: boolean;
  context: TContext;
}>;

export type NonTerminalMode =
  | "BYPASS"
  | "TOKEN"
  | "SKIP"
  | "NOSKIP"
  | "CASE"
  | "NOCASE"
  | "CACHE";
