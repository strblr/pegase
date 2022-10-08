import { Expectation, IdGenerator, Location, Options, Parser } from ".";

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

// Shared

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
