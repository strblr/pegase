import { Parser, skip, trace } from ".";

// Related to parser generation

export interface MetaContext {
  extensions: Extension[];
  args: any[];
}

export interface Extension {
  cast?(arg: any): Parser | undefined;
  directives?: Record<string, Directive>;
}

export type Directive = (parser: Parser, ...args: any[]) => Parser;

export type Tweaker = (
  options: Options,
  captures: Record<string, any>
) => (children: any[] | null) => any[] | null;

export type SemanticAction = (captures: Record<string, any>) => any;

export interface CompileOptions {
  id(): string;
  children: string;
  captures: string;
  cut: string | null;
  links: Links;
}

export interface Links {
  nochild: [];
  skip: typeof skip;
  trace: typeof trace;
  [link: string]: any;
}

// Related to parsing

export interface Options<Context = any> {
  input: string;
  from: number;
  to: number;
  complete: boolean;
  skipper: Parser<Context>;
  skip: boolean;
  ignoreCase: boolean;
  tracer: Tracer<Context>;
  trace: boolean;
  log: boolean;
  warnings: Warning[];
  failures: Failure[];
  context: Context;
  at(index: number): Location;
  _ffIndex: number;
  _ffType: FailureType | null;
  _ffSemantic: string | null;
  _ffExpectations: Expectation[];
  _ffExpect(from: number, expected: Expectation): void;
  _ffFail(from: number, message: string): void;
  _ffCommit(): void;
}

export type Result<Context = any> =
  | SuccessResult<Context>
  | FailResult<Context>;

export interface SuccessResult<Context = any>
  extends Range,
    ResultCommon<Context> {
  success: true;
  children: any[];
  raw: string;
  complete: boolean;
}

export interface FailResult<Context = any> extends ResultCommon<Context> {
  success: false;
}

export interface ResultCommon<Context = any> {
  options: Options<Context>;
  warnings: Warning[];
  failures: Failure[];
  log(options?: Partial<LogOptions>): string;
}

// Related to feedback

export interface LogOptions {
  warnings: Warning[];
  failures: Failure[];
  showWarnings: boolean;
  showFailures: boolean;
  showCodeFrames: boolean;
  linesBefore: number;
  linesAfter: number;
}

export interface Warning extends Range {
  type: WarningType.Message;
  message: string;
}

export enum WarningType {
  Message = "MESSAGE"
}

export type Failure = ExpectationFailure | SemanticFailure;

export interface ExpectationFailure extends Range {
  type: FailureType.Expectation;
  expected: Expectation[];
}

export interface SemanticFailure extends Range {
  type: FailureType.Semantic;
  message: string;
}

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

export interface LiteralExpectation {
  type: ExpectationType.Literal;
  literal: string;
}

export interface RegexExpectation {
  type: ExpectationType.RegExp;
  regex: RegExp;
}

export interface TokenExpectation {
  type: ExpectationType.Token;
  displayName: string;
}

export interface MismatchExpectation {
  type: ExpectationType.Mismatch;
  match: string;
}

export interface CustomExpectation {
  type: ExpectationType.Custom;
  display: string;
  [field: string]: any;
}

export enum ExpectationType {
  Literal = "LITERAL",
  RegExp = "REGEXP",
  Token = "TOKEN",
  Mismatch = "MISMATCH",
  Custom = "CUSTOM"
}

// Related to tracing

export type Tracer<Context = any> = (event: TraceEvent<Context>) => void;

export type TraceEvent<Context = any> =
  | EnterEvent<Context>
  | MatchEvent<Context>
  | FailEvent<Context>;

export enum TraceEventType {
  Enter = "ENTER",
  Match = "MATCH",
  Fail = "FAIL"
}

export interface EnterEvent<Context = any> extends TraceCommon<Context> {
  type: TraceEventType.Enter;
}

export interface MatchEvent<Context = any> extends TraceCommon<Context> {
  type: TraceEventType.Match;
  from: Location;
  to: Location;
  children: any[];
}

export interface FailEvent<Context = any> extends TraceCommon<Context> {
  type: TraceEventType.Fail;
}

export interface TraceCommon<Context = any> {
  rule: string;
  at: Location;
  options: Options<Context>;
}

// Shared

export interface Range {
  from: Location;
  to: Location;
}

export interface Location {
  index: number;
  line: number;
  column: number;
}

export type ExpectationInput = string | RegExp | Expectation;

export interface Hooks {
  $from(): Location;
  $to(): Location;
  $children(): any[];
  $raw(): string;
  $options(): Options;
  $context(): any;
  $warn(message: string): void;
  $fail(message: string): void;
  $expected(expected: ExpectationInput[]): void;
  $commit(): void;
  $emit(children: any[]): void;
}

// Other

export type RuleConfig = [
  parameters: [parameter: string, defaultValue: Parser | null][],
  definition: Parser
];

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
