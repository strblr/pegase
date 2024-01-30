import { ExpectationInput, Node, Options, Range, TransformPath } from ".";

export interface Hooks {
  $range(): Range;
  $values(): any[];
  $value(): any;
  $raw(): string;
  $context(): any;
  $options(): Options & Record<string, unknown>;
  $warn(message: string): void;
  $fail(message: string): void;
  $expected(expected: ExpectationInput[]): void;
  $commit(): void;
  $emit(children: any[]): void;
  $node(label: string, data: any): Node;
  $reduce(node: Node): any;
  $path(): TransformPath;
}

export const hookStack: Partial<Hooks>[] = [];

function hook<K extends keyof Hooks>(key: K) {
  return new Function(
    `return this[this.length-1].${key}.apply(null, arguments)`
  ).bind(hookStack) as Hooks[K];
}

export const $from = hook("$from");
export const $to = hook("$to");
export const $values = hook("$values");
export const $value = hook("$value");
export const $raw = hook("$raw");
export const $context = hook("$context");
export const $options = hook("$options");
export const $warn = hook("$warn");
export const $fail = hook("$fail");
export const $expected = hook("$expected");
export const $commit = hook("$commit");
export const $emit = hook("$emit");
export const $node = hook("$node");
export const $reduce = hook("$reduce");
export const $path = hook("$path");
