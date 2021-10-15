import { Logger, NonTerminalParser, Parser, Parser2 } from ".";

// Related to parser generation

export type MetaContext = {
  plugins: Plugin[];
  args: any[];
  refs: Set<NonTerminalParser>;
};

export type Plugin = {
  name?: string;
  castParser?(arg: any): Parser | undefined;
  directives?: Record<string, Directive>;
  resolve?: Record<string, Parser>;
};

export type Directive = (parser: Parser, ...args: any[]) => Parser;

export type Tweaker = (
  options: Options
) => (match: Match | null) => Match | null;

export type Tweaker2 = (
  options: Options2
) => (children: any[] | null) => any[] | null;

// Related to logging

export type LogOptions = {
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

// Related to parsing processing

export type Options<Context = any> = {
  input: string;
  from: number;
  to: number;
  complete: boolean;
  skipper: Parser<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  tracer: Tracer<Context>;
  trace: boolean;
  logger: Logger;
  log: boolean;
  context: Context;
  visit: Visitor | Visitor[];
  cut: boolean;
  captures: Record<string, any>;
  _ffIndex: number;
  _ffType: FailureType | null;
  _ffSemantic: string | null;
  _ffExpectations: Expectation[];
  _ffExpect(from: number, expected: Expectation): void;
  _ffFail(from: number, message: string): void;
  _ffCommit(): void;
};

export type Options2<Context = any> = {
  input: string;
  from: number;
  to: number;
  complete: boolean;
  skipper: Parser2<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  tracer: Tracer<Context>;
  trace: boolean;
  logger: Logger;
  log: boolean;
  context: Context;
  visit: Visitor | Visitor[];
  cut: boolean;
  captures: Record<string, any>;
  _ffIndex: number;
  _ffType: FailureType | null;
  _ffSemantic: string | null;
  _ffExpectations: Expectation[];
  _ffExpect(from: number, expected: Expectation): void;
  _ffFail(from: number, message: string): void;
  _ffCommit(): void;
};

export type Result<Value = any, Context = any> =
  | SuccessResult<Value, Context>
  | FailResult<Context>;

export type SuccessResult<Value = any, Context = any> = Range & {
  success: true;
  value: Value;
  children: any[];
  raw: string;
  complete: boolean;
  options: Options<Context>;
  logger: Logger;
};

export type FailResult<Context = any> = {
  success: false;
  options: Options<Context>;
  logger: Logger;
};

export type Result2<Value = any, Context = any> =
  | SuccessResult2<Value, Context>
  | FailResult2<Context>;

export type SuccessResult2<Value = any, Context = any> = Range & {
  success: true;
  value: Value;
  children: any[];
  raw: string;
  complete: boolean;
  options: Options2<Context>;
  logger: Logger;
};

export type FailResult2<Context = any> = {
  success: false;
  options: Options2<Context>;
  logger: Logger;
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
  children: any[];
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

export type ExpectationInput = string | RegExp | Expectation;

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
  $expected(expected: ExpectationInput[]): void;
  $commit(): void;
  $emit(children: any[]): void;
  $node(label: string, fields: Record<string, any>): Node;
  $visit(node: Node, visitor?: Visitor, context?: any): any;
  $parent(): Node | null;
};

// Other

// This is basically a hack to replace "any" but without an "implicit any" error
// on function parameter destructuration
export type Any =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint
  | object
  | ((...args: any[]) => any);
