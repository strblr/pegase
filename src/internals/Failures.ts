import { InputRange, StackTrace } from ".";
import { BoundType, PredicatePolarity } from "../parser";
import { Match } from "../match";

export class Failures<TContext> {
  private readonly content: Array<Failure<TContext>> = [];
  private readonly archived: Array<Failure<TContext>> = [];

  read() {
    return [...this.archived, ...this.content];
  }

  write(failure: Failure<TContext>) {
    if (this.content.length === 0 || this.content[0].to === failure.to)
      this.content.push(failure);
    else if (this.content[0].to < failure.to)
      this.content.splice(0, this.content.length, failure);
  }

  farthest() {
    return this.content[0]?.to ?? null;
  }

  archive() {
    this.archived.push(...this.content);
    this.content.length = 0;
  }
}

export type Failure<TContext> =
  | TerminalFailure<TContext>
  | PredicateFailure<TContext>
  | SemanticFailure;

export enum FailureType {
  Terminal,
  Predicate,
  Semantic
}

export enum FailureTerminal {
  Text,
  Bound,
  Token
}

export type TerminalFailure<TContext> = InputRange &
  StackTrace &
  Readonly<
    {
      type: FailureType.Terminal;
    } & (
      | {
          terminal: FailureTerminal.Text;
          text: RegExp | string;
        }
      | {
          terminal: FailureTerminal.Bound;
          bound: BoundType;
        }
      | {
          terminal: FailureTerminal.Token;
          identity: string | null;
          failures: Array<Failure<TContext>>;
        }
    )
  >;

export type PredicateFailure<TContext> = InputRange &
  StackTrace &
  Readonly<
    {
      type: FailureType.Predicate;
    } & (
      | {
          polarity: PredicatePolarity.MustMatch;
          failures: Array<Failure<TContext>>;
        }
      | {
          polarity: PredicatePolarity.MustFail;
          match: Match<TContext>;
        }
    )
  >;

export type SemanticFailure = InputRange &
  StackTrace &
  Readonly<{
    type: FailureType.Semantic;
    message: string;
  }>;
