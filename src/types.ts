import { Logger, Parser } from ".";

// Related to parser generation

export type MetaContext = {
  plugins: Array<Plugin>;
  args: Array<any>;
};

export type Plugin = {
  name?: string;
  grammar?: Parser;
  castParser?(arg: any): Parser | undefined;
  directives?: Record<string, Directive>;
};

export type Directive = (parser: Parser, ...args: Array<any>) => Parser;

export type SemanticAction<Value = any, Context = any> = (
  info: SemanticInfo<Context>
) => Value;

export type SemanticInfo<Context = any> = {
  $value: any;
  $raw: string;
  $from: Match["from"];
  $to: Match["to"];
  $children: Match["children"];
  $captures: Match["captures"];
  $options: ParseOptions<Context>;
  $context: Context;
  $commit(): void;
  $warn(message: string): void;
  $expected(expected: UncastArray<string | RegExp | Expectation>): void;
  $emit(children: Array<any>): void;
  $node(label: string, fields: Record<string, any>): Node;
  [capture: string]: any;
};

export type Node = {
  $label: string;
  $match: Match;
  [field: string]: any;
};

// Related to parsing processing

export type ParseOptions<Context = any> = {
  input: string;
  from: Location;
  grammar?: Parser;
  complete: boolean;
  skipper: Parser<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  tracer: Tracer<Context>;
  trace: boolean;
  context: Context;
  cut: { current: boolean };
  logger: Logger;
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
  rule: string;
  options: ParseOptions<Context>;
};

export type Warning = Range & {
  type: WarningType.Message;
  message: string;
};

export enum WarningType {
  Message = "MESSAGE"
}

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
  | MismatchExpectation
  | CustomExpectation;

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
  displayName: string;
};

export type MismatchExpectation = {
  type: ExpectationType.Mismatch;
  match: Match;
};

export type CustomExpectation = {
  type: ExpectationType.Custom;
  display: string;
  payload?: any;
};

export enum ExpectationType {
  Literal = "LITERAL",
  RegExp = "REGEXP",
  Token = "TOKEN",
  Mismatch = "MISMATCH",
  Custom = "CUSTOM"
}

export type Match = Range & {
  children: Array<any>;
  captures: Map<string, any>;
};

export type Range = {
  from: Location;
  to: Location;
};

export type Location = {
  index: number;
  line: number;
  column: number;
};

// Related to parsing results

export type Result<Value = any, Context = any> =
  | SuccessResult<Value, Context>
  | FailResult<Context>;

export type SuccessResult<Value = any, Context = any> = ResultCommon<Context> &
  Match & {
    success: true;
    value: Value;
    raw: string;
    complete: boolean;
  };

export type FailResult<Context = any> = ResultCommon<Context> & {
  success: false;
};

export type ResultCommon<Context = any> = {
  options: ParseOptions<Context>;
  logger: Logger;
};

export type LogOptions = {
  warnings: boolean;
  failures: boolean;
  codeFrames: boolean;
  linesBefore: number;
  linesAfter: number;
};

// Helpers

type UncastArray<T> = T | Array<T>;
