import { Cache, Failures, Warnings } from ".";
import { Match } from "../match";

export type Internals<TContext> = Readonly<{
  stack: string[];
  warnings: Warnings;
  failures: Failures;
  cache: Cache<TContext>;
}>;

export type InputRange = Readonly<{
  from: number;
  to: number;
}>;

export type StackTrace = Readonly<{
  stack: string[];
}>;

export type SemanticWarning = InputRange &
  StackTrace &
  Readonly<{
    type: "SEMANTIC_WARNING";
    message: string;
  }>;

export type TerminalFailure = InputRange &
  StackTrace &
  Readonly<
    {
      type: "TERMINAL_FAILURE";
    } & (
      | {
          terminal: "TEXT";
          text: RegExp | string;
        }
      | {
          terminal: "BOUND";
          bound: "START" | "END";
        }
      | {
          terminal: "TOKEN";
          identity: string | null;
          failures: Failure[];
        }
    )
  >;

export type PredicateFailure = InputRange &
  StackTrace &
  Readonly<
    {
      type: "PREDICATE_FAILURE";
    } & (
      | {
          polarity: true;
          failures: Failure[];
        }
      | {
          polarity: false;
          match: Match<any>;
        }
    )
  >;

export type SemanticFailure = InputRange &
  StackTrace &
  Readonly<{
    type: "SEMANTIC_FAILURE";
    message: string;
  }>;

export type Warning = SemanticWarning;

export type Failure = TerminalFailure | PredicateFailure | SemanticFailure;
