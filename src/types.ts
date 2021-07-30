import { Parser } from ".";

// Related to parser generation

export type MetaContext = {
  plugins: Array<Plugin>;
  args: Array<any>;
};

export type Plugin = {
  name?: string;
  castParser?(arg: any): Parser | undefined;
  directives?: Directives;
  grammar?: Parser;
};

export type Directives = Record<string, Directive>;

export type Directive = (parser: Parser, ...args: Array<any>) => Parser;

export type SemanticAction<Context = any> = (
  info: SemanticInfo<Context>
) => any;

export type SemanticInfo<Context = any> = {
  $value: any;
  $raw: string;
  $options: ParseOptions<Context>;
  $match: Match;
  $commit(): void;
  $warn(message: string): void;
  $expected(expected: Expectation | Array<Expectation>): void;
  $propagate(children?: Array<any>): void;
  [capture: string]: any;
};

// Related to parsing processing

export type ParseOptions<Context = any> = {
  input: string;
  from: number;
  grammar?: Parser<any, Context>;
  skipper: Parser<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  tracer: Tracer<Context>;
  trace: boolean;
  context: Context;
};

export type Tracer<Context = any> = (event: TraceEvent<Context>) => void;

export type TraceEvent<Context = any> =
  | EnterEvent<Context>
  | MatchEvent<Context>
  | FailEvent<Context>;

export type EnterEvent<Context = any> = TraceCommon<Context> & {
  type: TraceEventType.Enter;
};

export type MatchEvent<Context = any> = TraceCommon<Context> & {
  type: TraceEventType.Match;
  match: Match;
};

export type FailEvent<Context = any> = TraceCommon<Context> & {
  type: TraceEventType.Fail;
};

export enum TraceEventType {
  Enter = "ENTER",
  Match = "MATCH",
  Fail = "FAIL"
}

export type TraceCommon<Context = any> = {
  label: string;
  options: ParseOptions<Context>;
};

export type Internals = {
  cut: { active: boolean };
  warnings: Array<Warning>;
  failures: Array<Failure>;
  committed: Array<Failure>;
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
  Token = "TOKEN",
  Mismatch = "MISMATCH"
}

export type Match = Range & {
  children: Array<any>;
  captures: Map<string, any>;
};

export type Range = {
  from: number;
  to: number;
};

// Related to parsing results

export type Result<Value = any> = SuccessResult<Value> | FailResult;

export type SuccessResult<Value = any> = Match & {
  success: true;
  value: Value;
  raw: string;
  warnings: Array<Warning>;
};

export type FailResult = {
  success: false;
  value: undefined;
  children: [];
  captures: Map<string, any>;
  warnings: Array<Warning>;
  failures: Array<Failure>;
};
