import { Parser } from "./parser";
import { Tracker } from "./tracker";

export type NonEmptyArray<T> = [T, ...T[]];
export type NonTerminalMode = "BYPASS" | "SKIP" | "UNSKIP" | "TOKEN";

export type TagArgument<TContext> =
  | string
  | RegExp
  | Parser<any, TContext>
  | SemanticAction<any, TContext>;

export type SemanticArgument<TContext> = Array<any> &
  Readonly<{
    from: number;
    to: number;
    raw: string;
    context: TContext;
  }>;

export type SemanticAction<TValue, TContext> = (
  arg: SemanticArgument<TContext>,
  arg_: SemanticArgument<TContext>
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
  tracker: Tracker<TContext>;
}>;

export type Match<TValue> = {
  from: number;
  to: number;
  value: TValue;
  children: any[];
};

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
      } & First)
    | {
        type: "SEMANTIC_FAILURE";
        message: string;
      }
  )
>;
