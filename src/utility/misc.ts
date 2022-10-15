// Location types

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

// Predefined skippers

export const defaultSkipper = /\s*/y;

export const pegSkipper = /(?:\s|#[^#\r\n]*[#\r\n])*/y;

/**
 * Creates a duplicate-free version of an iterable
 * @param items
 */

export function unique<T>(items: Iterable<T>) {
  return [...new Set(items)];
}

/**
 * Converts a string to space case
 * @param input
 */

export function spaceCase(input: string) {
  return input
    .replace("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}
