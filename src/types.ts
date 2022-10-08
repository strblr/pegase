import { Expectation, IdGenerator, Location, Options, Parser } from ".";

// Related to parser generation

export interface Extension {
  cast?(arg: any): Parser | undefined;
  directives?: Record<string, Directive>;
}

export type Directive = (parser: Parser, ...args: any[]) => Parser;

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
