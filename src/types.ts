import { idGenerator, Logger, Parser, skip, trace } from ".";

// Related to parser generation

export type MetaContext = {
  plugins: Plugin[];
  args: any[];
};

export type Plugin = {
  name?: string;
  castParser?(arg: any): Parser | undefined;
  directives?: Record<string, Directive>;
  resolve?: Record<string, Parser>;
};

export type Directive = (parser: Parser, ...args: any[]) => Parser;

export type Tweaker = (
  options: Options,
  captures: Record<string, any>
) => (children: any[] | null) => any[] | null;

export type SemanticAction<Value = any> = (
  captures: Record<string, any>
) => Value;

export type CompileOptions = {
  id: ReturnType<typeof idGenerator>;
  children: string;
  captures: string;
  cut: string | null;
  links: Links;
};

export type Links = {
  nochild: [];
  assign: Function;
  skip: typeof skip;
  trace: typeof trace;
  [link: string]: any;
};

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

export type Node = {
  $label: string;
  $from: Location;
  $to: Location;
  [field: string]: any;
};

export type Visitor<Value = any> = Record<string, (node: Node) => Value>;

export type VisitOptions<Context = any> = Pick<
  Options,
  "logger" | "log" | "context"
>;

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

export type EnterEvent<Context = any> = TraceCommon<Context> & {
  type: TraceEventType.Enter;
};

export type MatchEvent<Context = any> = TraceCommon<Context> & {
  type: TraceEventType.Match;
  from: Location;
  to: Location;
  children: any[];
};

export type FailEvent<Context = any> = TraceCommon<Context> & {
  type: TraceEventType.Fail;
};

export type TraceCommon<Context = any> = {
  rule: string;
  at: Location;
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
