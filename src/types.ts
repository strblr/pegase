import { GrammarParser, Parser } from ".";

export type Internals = {
  // TODO: putting captures here probably doesn't work because of nested overridings. Consider putting it as a field of Match
  captures: Record<string, any>;
  warnings: Array<Warning>;
  failures: Array<Failure>;
  committedFailures: Array<Failure>;
};

export type Warning = Range & {
  message: string;
};

export type Failure = ExpectationFailure | SemanticFailure;

export type ExpectationFailure = Range & {
  type: FailureType.Expectation;
  expected: Array<Expectation>;
};

export type SemanticFailure = Range & {
  type: FailureType.Semantic;
  message: string;
};

export enum FailureType {
  Expectation,
  Semantic
}

export type Expectation =
  | StringExpectation
  | RegExpExpectation
  | EdgeExpectation
  | TokenExpectation
  | MismatchExpectation;

export type StringExpectation = {
  type: ExpectationType.String;
  literal: string;
};

export type RegExpExpectation = {
  type: ExpectationType.RegExp;
  regExp: RegExp;
};

export type EdgeExpectation = {
  type: ExpectationType.Edge;
  edge: EdgeType;
};

export type TokenExpectation = {
  type: ExpectationType.Token;
  label?: string;
};

export type MismatchExpectation = {
  type: ExpectationType.Mismatch;
  match: Match<any>;
};

export enum ExpectationType {
  String,
  RegExp,
  Edge,
  Token,
  Mismatch
}

export type Range = {
  from: number;
  to: number;
};

export enum EdgeType {
  Start,
  End
}

export type ParseOptions<Context> = {
  input: string;
  from: number;
  grammar?: GrammarParser<any, Context>;
  skipper: Parser<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  context: Context;
};

export type SemanticAction<Value, Context> = (args: {
  $options: ParseOptions<Context>;
  $from: Range["from"];
  $to: Range["to"];
  $value: any;
  $raw: string;
  $captures: Record<string, any>;
  $commit(): void;
  $warn(message: string): void;
  $fail(message: string): void;
  [capture: string]: any;
}) => Value;

export type Match<Value> = Range & {
  value: Value;
};

export type Result<Value> = SuccessResult<Value> | FailResult;

export type SuccessResult<Value> = ResultCommon &
  Match<Value> & {
    success: true;
    raw: string;
  };

export type FailResult = ResultCommon & {
  success: false;
};

type ResultCommon = {
  captures: Record<string, any>;
  warnings: Array<Warning>;
  failures: Array<Failure>;
};
