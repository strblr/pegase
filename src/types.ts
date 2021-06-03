import { GrammarParser, Parser } from ".";

export type AnyParser = Parser<any, any>;

export type MetaContext = {
  directives: Directives;
  tagArgs: Map<string, PegTemplateArg<any>>;
};

export type PegTemplateArg<Context> =
  | string
  | RegExp
  | Parser<any, Context>
  | SemanticAction<any, any, Context>;

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

export type SemanticAction<Value, PValue, Context> = (args: {
  $options: ParseOptions<Context>;
  $context: Context;
  $raw: string;
  $from: Range["from"];
  $to: Range["to"];
  $value: PValue;
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

export type ContextOf<P> = P extends Parser<any, infer C> ? C : never;

export type ValueOfOptions<Ps> = Ps extends ReadonlyArray<Parser<infer V, any>>
  ? V
  : never;

export type ValueOfSequence<Ps> = Ps extends readonly [
  Parser<infer V, any>,
  ...(infer R)
]
  ? [V] extends [undefined]
    ? ValueOfSequence<R>
    : readonly [V, ...ValueOfSequence<R>]
  : readonly [];

export type ValueOfGrammar<Rs> = Rs extends readonly [
  readonly [string, Parser<infer V, any>],
  ...(infer R)
]
  ? V
  : Rs extends ReadonlyArray<readonly [string, Parser<infer V, any>]>
  ? V
  : never;

type A = [Parser<number, any>, Parser<string, any>];
type B = ValueOfOptions<A>;
