import {
  Expectation,
  Failure,
  FailureType,
  IdGenerator,
  Parser,
  Warning
} from ".";

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
  options: Options
) => (children: any[] | null) => any[] | null;

export type SemanticAction = (captures: Record<string, any>) => any;

export interface CompileOptions {
  id: IdGenerator;
  children: string;
  captures: {
    id: string | null;
  };
  cut: {
    possible: boolean;
    id: string | null;
  };
}

// Related to parsing

export interface Options<Context = any> {
  input: string;
  from: number;
  to: number;
  complete: boolean;
  skipper: RegExp;
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
  _ffExpect(expected: Expectation): void;
  _ffFail(message: string): void;
  _ffCommit(): void;
}

export type Result<Context = any> =
  | SuccessResult<Context>
  | FailResult<Context>;

export interface SuccessResult<Context = any> extends Range {
  success: true;
  children: any[];
  raw: string;
  complete: boolean;
  warnings: Warning[];
  failures: Failure[];
}

export interface FailResult<Context = any> {
  success: false;
  warnings: Warning[];
  failures: Failure[];
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
  input: string;
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
  rule: string,
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
