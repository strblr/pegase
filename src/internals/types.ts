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

type StackTrace = Readonly<{
  stack: string[];
}>;

type SemanticWarningDescriptor = Readonly<{
  type: "SEMANTIC_WARNING";
  message: string;
}>;

type TerminalFailureDescriptor = Readonly<
  {
    type: "TERMINAL_FAILURE";
  } & (
    | {
        terminal: "LITERAL";
        literal: string;
      }
    | {
        terminal: "REGEX";
        pattern: RegExp;
      }
    | {
        terminal: "BOUND";
        bound: "START" | "END";
      }
  )
>;

type TokenFailureDescriptor = Readonly<{
  type: "TOKEN_FAILURE";
  identity: string | null;
  failures: Failure[];
}>;

type PredicateFailureDescriptor = Readonly<
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

type SemanticFailureDescriptor = Readonly<{
  type: "SEMANTIC_FAILURE";
  message: string;
}>;

export type Warning = InputRange & StackTrace & SemanticWarningDescriptor;

export type Failure = InputRange &
  StackTrace &
  (
    | TerminalFailureDescriptor
    | TokenFailureDescriptor
    | PredicateFailureDescriptor
    | SemanticFailureDescriptor
  );
