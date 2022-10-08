import { Expectation, Location, Options, Parser } from ".";

// Related to parser generation

export type Directive = (parser: Parser, ...args: any[]) => Parser;

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
