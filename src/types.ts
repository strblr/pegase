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

export type MetaContext<TContext> = {
  args: TagArgument<TContext>[];
  rules: {
    [id: string]: Parser<any, TContext>;
  };
};

export type Options<TContext> = {
  skipper: Parser<any, TContext> | null;
  diagnose: boolean;
  context: TContext;
};

export type FirstSet = First[];

export type First = {
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
);

export type Failure = {
  at: number;
} & (
  | ({
      type: "EXPECTATION_FAIL";
    } & First)
  | {
      type: "SEMANTIC_FAIL";
      message: string;
    }
);
