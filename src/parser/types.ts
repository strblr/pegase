import { Parser } from ".";
import { Match } from "../match";

export type Options<TContext> = Readonly<{
  from: number;
  skipper: Parser<TContext> | null;
  skip: boolean;
  case: boolean;
  diagnose: boolean;
  trace: ((event: TraceEvent<TContext>) => void) | null;
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

export type TraceEvent<TContext> = Readonly<
  (
    | {
        type: "ENTERED" | "FAILED";
      }
    | {
        type: "MATCHED";
        match: Match<TContext>;
      }
  ) & {
    identity: string;
    input: string;
    stack: string[];
    options: Options<TContext>;
  }
>;
