import { Parser } from "./parser";
import { SuccessMatch } from "./match";

export type NonEmptyArray<T> = [T, ...T[]];

export type TagArgument = string | RegExp | Parser | SemanticAction;

export type SemanticAction = (
  raw: string,
  children: any[],
  payload: any,
  match: SuccessMatch
) => any;

export type Options = {
  skipper: Parser | null;
  diagnose: boolean;
  payload: any;
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
