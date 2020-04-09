import { Parser } from ".";

export type Options<TContext> = Readonly<{
  from: number;
  skipper: Parser<TContext> | null;
  skip: boolean;
  diagnose: boolean;
  context: TContext;
}>;

export type NonTerminalMode = "BYPASS" | "SKIP" | "UNSKIP" | "TOKEN" | "CACHE";
