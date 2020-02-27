import { Cache, FailureTracker, WarningTracker } from "./tracker";
import { Parser } from "./parser";

export type AnyParser = Parser<any, any>;
export type NonEmptyArray<T> = [T, ...T[]];
export type NonTerminalMode = "BYPASS" | "SKIP" | "UNSKIP" | "TOKEN";

export type TagArgument<TContext> =
  | string
  | RegExp
  | Parser<any, TContext>
  | SemanticAction<any, TContext>;

export type SemanticMatchReport<TContext> = any[] &
  Readonly<{
    input: string;
    from: number;
    to: number;
    raw: string;
    children: any[];
    context: TContext;
    warn: (message: string) => void;
  }>;

export type SemanticAction<TValue, TContext> = (
  arg: SemanticMatchReport<TContext>,
  arg_: SemanticMatchReport<TContext>
) => TValue;

export type MetaContext<TContext> = Readonly<{
  args: TagArgument<TContext>[];
  rules: Record<string, Parser<any, TContext>>;
}>;

export type Options<TContext> = Readonly<{
  from: number;
  skipper: Parser<any, TContext> | null;
  skip: boolean;
  diagnose: boolean;
  cached: boolean;
  context: TContext;
}>;

export type Internals<TContext> = Readonly<{
  failures: FailureTracker;
  warnings: WarningTracker;
  cache: Cache<TContext>;
}>;

export type Terminal = Readonly<
  | {
      what: "TOKEN";
      identity: string;
    }
  | {
      what: "LITERAL";
      literal: string;
    }
  | {
      what: "REGEX";
      pattern: RegExp;
    }
  | {
      what: "START" | "END";
    }
>;

export type Warning = Readonly<{
  from: number;
  to: number;
  type: "SEMANTIC_WARNING";
  message: string;
}>;

export type Failure = Readonly<
  {
    from: number;
    to: number;
  } & (
    | ({
        type: "EXPECTATION_FAILURE";
      } & Terminal)
    | {
        type: "PREDICATE_FAILURE";
      }
    | {
        type: "SEMANTIC_FAILURE";
        message: string;
      }
  )
>;
