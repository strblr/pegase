import { Parser } from ".";

export type MetaContext = {
  directives: Directives;
  args: Array<PegTemplateArg>;
};

export type PegTemplateArg<Context = any> =
  | string
  | RegExp
  | Parser<any, Context>
  | SemanticAction<Context>;

export type Directives = Record<string, (parser: Parser) => Parser>;

export type Internals = {
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
  | LiteralExpectation
  | RegExpExpectation
  | EndEdgeExpectation
  | TokenExpectation
  | MismatchExpectation;

export type LiteralExpectation = {
  type: ExpectationType.Literal;
  literal: string;
};

export type RegExpExpectation = {
  type: ExpectationType.RegExp;
  regExp: RegExp;
};

export type EndEdgeExpectation = {
  type: ExpectationType.EndEdge;
};

export type TokenExpectation = {
  type: ExpectationType.Token;
  alias?: string;
};

export type MismatchExpectation = {
  type: ExpectationType.Mismatch;
  match: Match;
};

export enum ExpectationType {
  Literal,
  RegExp,
  EndEdge,
  Token,
  Mismatch
}

export type Range = {
  from: number;
  to: number;
};

export type ParseOptions<Context = any> = {
  input: string;
  from: number;
  grammar?: Parser<any, Context>;
  skipper: Parser<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  context: Context;
};

export type SemanticAction<Context = any> = (args: {
  $raw: string;
  $options: ParseOptions<Context>;
  $match: Match;
  $commit(): void;
  $warn(message: string): void;
  [capture: string]: any;
}) => any;

export type Match<Value = any> = Range & {
  value: Value;
  captures: Record<string, any>;
};

export type Result<Value = any> = SuccessResult<Value> | FailResult;

export type SuccessResult<Value = any> = ResultCommon &
  Match<Value> & {
    success: true;
    raw: string;
  };

export type FailResult = ResultCommon & {
  success: false;
};

export type ResultCommon = {
  warnings: Array<Warning>;
  failures: Array<Failure>;
};
