import { GrammarParser, Parser } from ".";

export type AnyParser = Parser<any, any>;

export type MetaContext = {
  directives: Directives;
  args: Array<PegTemplateArg<any>>;
};

export type PegTemplateArg<Context> =
  | PegTemplatePrimaryArg<Context>
  | PegTemplateActionArg<Context>;

export type PegTemplatePrimaryArg<Context> =
  | string
  | RegExp
  | Parser<any, Context>;

export type PegTemplateActionArg<Context> = SemanticAction<any, any, Context>;

export type Directives = Record<string, (parser: AnyParser) => AnyParser>;

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
  match: Match<any>;
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

export type ParseOptions<Context> = {
  input: string;
  from: number;
  grammar?: GrammarParser<any, Context>;
  skipper: Parser<any, Context>;
  skip: boolean;
  ignoreCase: boolean;
  context: Context;
};

export type SemanticAction<Value, PreviousValue, Context> = (args: {
  $options: ParseOptions<Context>;
  $context: Context;
  $raw: string;
  $from: Range["from"];
  $to: Range["to"];
  $value: PreviousValue;
  $captures: Record<string, any>;
  $commit(): void;
  $warn(message: string): void;
  [capture: string]: any;
}) => Value;

export type Match<Value> = Range & {
  value: Value;
  captures: Record<string, any>;
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

export type ResultCommon = {
  warnings: Array<Warning>;
  failures: Array<Failure>;
};

// Helpers

type IsAny<T> = 0 extends 1 & T ? true : false;

type IsAnyOrUnknown<T> = unknown extends T ? true : false;

type IsUnknown<T> = IsAny<T> extends true
  ? false
  : IsAnyOrUnknown<T> extends true
  ? true
  : false;

export type ItemOf<A extends Array<any>> = A[number];

export type MapSecond<A extends Array<any>> = A extends [
  [any, infer Second],
  ...(infer Rest)
]
  ? [Second, ...MapSecond<Rest>]
  : [];

export type JoinedContext<Parsers extends Array<any>> = Parsers extends [
  Parser<any, infer ContextA>,
  ...(infer R)
]
  ? JoinedContext<R> extends infer ContextB
    ? IsAny<ContextA> extends true
      ? ContextB
      : IsUnknown<ContextA> extends true
      ? IsAny<ContextB> extends true
        ? ContextA
        : ContextB
      : IsAnyOrUnknown<ContextB> extends true
      ? ContextA
      : ContextA & ContextB
    : never
  : any;

export type ValueOfOptions<Parsers extends Array<any>> = Parsers extends Array<
  Parser<infer Value, any>
>
  ? Value
  : never;

export type ValueOfSequence<Parsers extends Array<any>> = Parsers extends [
  Parser<infer Value, any>,
  ...(infer Rest)
]
  ? ValueOfSequence<Rest> extends [...(infer RestValue)]
    ? IsAnyOrUnknown<Value> extends true
      ? RestValue | [Value, ...RestValue]
      : [Value] extends [undefined]
      ? RestValue
      : undefined extends Value
      ? RestValue | [Exclude<Value, undefined>, ...RestValue]
      : [Value, ...RestValue]
    : never
  : Parsers extends []
  ? []
  : Parsers extends Array<Parser<infer Value, any>>
  ? [Exclude<Value, undefined>] extends [never]
    ? []
    : Array<Exclude<Value, undefined>>
  : never;

export type ValueOfGrammar<Rules extends Array<any>> = Rules extends [
  [string, Parser<infer Value, any>],
  ...any
]
  ? Value
  : Rules extends []
  ? never
  : Rules extends Array<[string, Parser<infer Value, any>]>
  ? Value
  : never;

/*
type A = [
  Parser<number, { x: number }>,
  Parser<string, { y: string }>,
  Parser<unknown, unknown>,
  Parser<undefined, any>,
  Parser<boolean, { z: boolean }>,
  Parser<any, any>
];

type B = A[number][];

type C = [A[0], A[1], ...A[number][]];

type G = [["A", A[0]], ["B", A[1]]];

type H = G[number][];

type R = ValueOfGrammar<H>;
*/
