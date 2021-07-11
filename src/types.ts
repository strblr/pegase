import { Parser } from ".";

// Related to parser generation

export type PegTemplateArg<Context = any> =
  | string
  | RegExp
  | Parser<any, Context>
  | SemanticAction<Context>;

export type SemanticAction<Context = any> = (arg: SemanticArg<Context>) => any;

export type SemanticArg<Context = any> = {
  $raw: string;
  $options: ParseOptions<Context>;
  $match: Match;
  $commit(): void;
  $warn(message: string): void;
  [capture: string]: any;
};

export type MetaContext = {
  directives: Directives;
  args: Array<PegTemplateArg>;
};

export type Directives = Record<
  string,
  (parser: Parser, rule?: string) => Parser
>;

// Related to parsing processing

export type ParseOptions<Context = any> = {
  input: string;
  from: number;
  grammar?: Parser<any, Context>;
  skipper: Parser<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  context: Context;
  tracer?(event: TraceEvent, label: string): void;
};

export enum TraceEvent {
  Entered = "ENTERED",
  Matched = "MATCHED",
  Failed = "FAILED"
}

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
  Expectation = "EXPECTATION",
  Semantic = "SEMANTIC"
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
  failures: Array<Failure>;
};

export type MismatchExpectation = {
  type: ExpectationType.Mismatch;
  match: Match;
};

export enum ExpectationType {
  Literal = "LITERAL",
  RegExp = "REGEXP",
  EndEdge = "END_EDGE",
  Token = "TOKEN",
  Mismatch = "MISMATCH"
}

export type Match<Value = any> = Range & {
  value: Value;
  captures: Record<string, any>;
};

export type Range = {
  from: number;
  to: number;
};

// Related to parsing results

export type Result<Value = any> = SuccessResult<Value> | FailResult;

export type SuccessResult<Value = any> = Match<Value> & {
  success: true;
  raw: string;
  warnings: Array<Warning>;
};

export type FailResult = {
  success: false;
  value: undefined;
  captures: {};
  warnings: Array<Warning>;
  failures: Array<Failure>;
};
