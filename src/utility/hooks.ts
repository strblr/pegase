import { Expectation, ExpectationType, Location, Options } from "../index.js";

// Hooks

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

function hook<K extends keyof Hooks>(key: K) {
  return new Function(
    `return this[this.length-1].${key}.apply(null, arguments)`
  ).bind(hooks) as Hooks[K];
}

export const hooks: Hooks[] = [];
export const $from = hook("$from");
export const $to = hook("$to");
export const $children = hook("$children");
export const $raw = hook("$raw");
export const $options = hook("$options");
export const $context = hook("$context");
export const $warn = hook("$warn");
export const $fail = hook("$fail");
export const $expected = hook("$expected");
export const $commit = hook("$commit");
export const $emit = hook("$emit");

// Hooks utilities

export type ExpectationInput = string | RegExp | Expectation;

export function castExpectation(expected: ExpectationInput): Expectation {
  return typeof expected === "string"
    ? { type: ExpectationType.Literal, literal: expected }
    : expected instanceof RegExp
    ? { type: ExpectationType.RegExp, regex: expected }
    : expected;
}
