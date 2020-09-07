import { Cache, Failure, Failures, Warnings } from "../internals";
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

export type Internals<TContext> = Readonly<{
  stack: Array<string>;
  warnings: Warnings;
  failures: Failures<TContext>;
  cache: Cache<TContext>;
}>;

export enum TraceEventType {
  Entered,
  Matched,
  Failed
}

export type TraceEvent<TContext> = Readonly<
  (
    | {
        type: TraceEventType.Entered;
      }
    | {
        type: TraceEventType.Matched;
        match: Match<TContext>;
      }
    | {
        type: TraceEventType.Failed;
        failures: Array<Failure<TContext>>;
      }
  ) & {
    identity: string;
    input: string;
    stack: Array<string>;
    options: Options<TContext>;
  }
>;
