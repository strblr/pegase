import { Logger, NonTerminalParser, Parser } from ".";

// Related to parser generation

export type MetaContext = {
  plugins: Plugin[];
  args: any[];
  refs: NonTerminalParser[];
};

export type Plugin = {
  name?: string;
  castParser?(arg: any): Parser | undefined;
  directives?: Record<string, Directive>;
  resolve?: Record<string, Parser>;
};

export type Directive = (parser: Parser, ...args: any[]) => Parser;

// Related to parsing processing

export type Options<Context = any> = {
  input: string;
  from: number;
  complete: boolean;
  skipper: Parser<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  tracer: Tracer<Context>;
  trace: boolean;
  context: Context;
  visit: UncastArray<Visitor>;
  cut: boolean;
  captures: Record<string, any>;
  logger: Logger;
  log: boolean;
};

export type Match = {
  from: number;
  to: number;
  children: any[];
};

export type SemanticAction<Value = any> = (
  captures: Record<string, any>
) => Value;

export type Node = {
  $label: string;
  $from: Location;
  $to: Location;
  [field: string]: any;
};

export type Visitor<Value = any> = Record<string, (node: Node) => Value>;

export type Hooks = {
  $from(): Location;
  $to(): Location;
  $children(): any[];
  $value(): any;
  $raw(): string;
  $options(): Options;
  $context(): any;
  $warn(message: string): void;
  $fail(message: string): void;
  $expected(expected: UncastArray<string | RegExp | Expectation>): void;
  $commit(): void;
  $emit(children: any[]): void;
  $node(label: string, fields: Record<string, any>): Node;
  $visit(node: Node, visitor?: Visitor, context?: any): any;
  $parent(): Node | null;
};

// Related to tracing

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
  to: Location;
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
  from: Location;
  options: Options<Context>;
};

// Related to logging

export type LogPrintOptions = {
  warnings: boolean;
  failures: boolean;
  codeFrames: boolean;
  linesBefore: number;
  linesAfter: number;
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
  expected: Expectation[];
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
  | RegexExpectation
  | TokenExpectation
  | MismatchExpectation
  | CustomExpectation;

export type LiteralExpectation = {
  type: ExpectationType.Literal;
  literal: string;
};

export type RegexExpectation = {
  type: ExpectationType.RegExp;
  regex: RegExp;
};

export type TokenExpectation = {
  type: ExpectationType.Token;
  displayName: string;
};

export type MismatchExpectation = {
  type: ExpectationType.Mismatch;
  match: string;
};

export type CustomExpectation = {
  type: ExpectationType.Custom;
  display: string;
  [field: string]: any;
};

export enum ExpectationType {
  Literal = "LITERAL",
  RegExp = "REGEXP",
  Token = "TOKEN",
  Mismatch = "MISMATCH",
  Custom = "CUSTOM"
}

// Related to parsing results

export type Result<Value = any, Context = any> =
  | SuccessResult<Value, Context>
  | FailResult<Context>;

export type SuccessResult<Value = any, Context = any> = ResultCommon<Context> &
  Range & {
    success: true;
    value: Value;
    children: any[];
    raw: string;
    complete: boolean;
  };

export type FailResult<Context = any> = ResultCommon<Context> & {
  success: false;
};

export type ResultCommon<Context = any> = {
  options: Options<Context>;
  logger: Logger;
};

// Shared

export type Range = {
  from: Location;
  to: Location;
};

export type Location = {
  index: number;
  line: number;
  column: number;
};

// Helpers

export type UncastArray<T> = T | T[];
