import { Parser } from "./parser";
import { SuccessMatch } from "./match";

export type NonEmptyArray<T> = [T, ...T[]];

export type TagArgument<TContext> =
  | string
  | RegExp
  | Parser<any, TContext>
  | SemanticAction<any, TContext>;

export type SemanticAction<TValue, TContext> = (
  raw: string,
  children: any[],
  context: TContext,
  match: SuccessMatch<TValue, TContext>
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
  cache: Map<Parser<any, TContext>, SuccessMatch<any, TContext>>[];
  warnings: Warning[];
  failures: Failure[];
}>;

export type ParseReport<TValue, TContext> = Readonly<{
  match: SuccessMatch<TValue, TContext> | null;
  warnings: Warning[];
  failures: Failure[];
}>;

export type First = Readonly<
  {
    polarity: boolean;
  } & (
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
  )
>;

export type Warning = Readonly<{
  at: number;
  type: "SEMANTIC_WARNING";
  message: string;
}>;

export type Failure = Readonly<
  {
    at: number;
  } & (
    | ({
        type: "EXPECTATION_FAILURE";
      } & First)
    | {
        type: "SEMANTIC_FAILURE";
        message: string;
      }
  )
>;
