import { Location, Range, unique } from "..";

// Warning

export enum WarningType {
  Message = "MESSAGE"
}

export interface Warning extends Range {
  type: WarningType.Message;
  message: string;
}

export enum FailureType {
  Expectation = "EXPECTATION",
  Semantic = "SEMANTIC"
}

// Failure

export type Failure = ExpectationFailure | SemanticFailure;

export interface ExpectationFailure extends Range {
  type: FailureType.Expectation;
  expected: Expectation[];
}

export interface SemanticFailure extends Range {
  type: FailureType.Semantic;
  message: string;
}

export enum ExpectationType {
  Literal = "LITERAL",
  RegExp = "REGEXP",
  EndOfInput = "END_OF_INPUT",
  Token = "TOKEN",
  Mismatch = "MISMATCH",
  Custom = "CUSTOM"
}

export type Expectation =
  | LiteralExpectation
  | RegexExpectation
  | EndOfInputExpectation
  | TokenExpectation
  | MismatchExpectation
  | CustomExpectation;

export interface LiteralExpectation {
  type: ExpectationType.Literal;
  literal: string;
}

export interface RegexExpectation {
  type: ExpectationType.RegExp;
  regex: RegExp;
}

export interface EndOfInputExpectation {
  type: ExpectationType.EndOfInput;
}

export interface TokenExpectation {
  type: ExpectationType.Token;
  displayName: string;
}

export interface MismatchExpectation {
  type: ExpectationType.Mismatch;
  match: string;
}

export interface CustomExpectation {
  type: ExpectationType.Custom;
  display: string;
  [field: string]: any;
}

// Utility

export interface Entries {
  warnings?: Warning[];
  failures?: Failure[];
}

export interface LogOptions {
  showWarnings: boolean;
  showFailures: boolean;
  showCodeFrames: boolean;
  linesBefore: number;
  linesAfter: number;
}

/**
 * Stringifies a list of entries (warnings and failures) with code frames
 * @param entries
 * @param options
 */

export function log(entries: Entries, options?: Partial<LogOptions>) {
  const opts: LogOptions = {
    showWarnings: true,
    showFailures: true,
    showCodeFrames: true,
    linesBefore: 2,
    linesAfter: 2,
    ...options
  };
  const list = [
    ...((opts.showWarnings && entries.warnings) || []),
    ...((opts.showFailures && entries.failures) || [])
  ];
  if (list.length === 0) return "";
  const lines = list[0].from.input.split(/[\r\n]/);
  return list
    .sort((a, b) => a.from.index - b.from.index)
    .map(
      entry =>
        `(${entry.from.line}:${entry.from.column}) ${entryToString(entry)}${
          opts.showCodeFrames ? `\n\n${codeFrame(lines, entry.from, opts)}` : ""
        }`
    )
    .join("\n");
}

/**
 * Stringifies a log entry (a warning or a failure)
 * @param entry
 */

export function entryToString(entry: Warning | Failure) {
  switch (entry.type) {
    case WarningType.Message:
      return `Warning: ${entry.message}`;
    case FailureType.Semantic:
      return `Failure: ${entry.message}`;
    case FailureType.Expectation:
      const expectations = unique(
        entry.expected.map(expectationToString)
      ).reduce(
        (acc, expected, index, { length }) =>
          `${acc}${index === length - 1 ? " or " : ", "}${expected}`
      );
      return `Failure: Expected ${expectations}`;
  }
}

/**
 * Stringifies an expectation object (literal, regex, token, etc.)
 * @param expectation
 */

export function expectationToString(expectation: Expectation) {
  switch (expectation.type) {
    case ExpectationType.Literal:
      return `"${expectation.literal}"`;
    case ExpectationType.RegExp:
      return `${expectation.regex.source} (regex)`;
    case ExpectationType.EndOfInput:
      return "end of input";
    case ExpectationType.Token:
      return expectation.displayName;
    case ExpectationType.Mismatch:
      return `mismatch of "${expectation.match}"`;
    case ExpectationType.Custom:
      return expectation.display;
  }
}

/**
 * Creates a string code frame to highlight a location
 * @param lines
 * @param location
 * @param options
 */

export function codeFrame(
  lines: string[],
  location: Location,
  options: LogOptions
) {
  const start = Math.max(1, location.line - options.linesBefore);
  const end = Math.min(lines.length, location.line + options.linesAfter);
  const maxLineNum = String(end).length;
  const padding = " ".repeat(maxLineNum);
  let acc = "";
  for (let i = start; i !== end + 1; i++) {
    const lineNum = (padding + i).slice(-maxLineNum);
    const current = lines[i - 1];
    const normalized = current.replace(/\t+/, tabs => "  ".repeat(tabs.length));
    if (i !== location.line) acc += `  ${lineNum} | ${normalized}\n`;
    else {
      const count = Math.max(
        0,
        normalized.length - current.length + location.column - 1
      );
      acc += `> ${lineNum} | ${normalized}\n`;
      acc += `  ${padding} | ${" ".repeat(count)}^\n`;
    }
  }
  return acc;
}
