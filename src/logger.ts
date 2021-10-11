import {
  Expectation,
  ExpectationType,
  Failure,
  FailureType,
  Location,
  LogOptions,
  unique,
  Warning,
  WarningType
} from ".";

export class Logger {
  readonly input: string;
  readonly warnings: Warning[] = [];
  readonly failures: Failure[] = [];
  private readonly indexes;

  constructor(input: string) {
    this.input = input;
    let acc = 0;
    this.indexes = input.split(/[\r\n]/).map(chunk => {
      const start = acc;
      acc += chunk.length + 1;
      return start;
    });
  }

  at(index: number): Location {
    let line = 0;
    let n = this.indexes.length - 1;
    while (line < n) {
      const k = line + ((n - line) >> 1);
      if (index < this.indexes[k]) n = k - 1;
      else if (index >= this.indexes[k + 1]) line = k + 1;
      else {
        line = k;
        break;
      }
    }
    return {
      index,
      line: line + 1,
      column: index - this.indexes[line] + 1
    };
  }

  toString(options?: Partial<LogOptions>) {
    const opts: LogOptions = {
      warnings: true,
      failures: true,
      codeFrames: true,
      linesBefore: 2,
      linesAfter: 2,
      ...options
    };
    return [
      ...(opts.warnings ? this.warnings : []),
      ...(opts.failures ? this.failures : [])
    ]
      .sort((a, b) => a.from.index - b.from.index)
      .map(
        entry =>
          `(${entry.from.line}:${entry.from.column}) ${Logger.entryToString(
            entry
          )}${opts.codeFrames ? `\n\n${this.codeFrame(opts, entry.from)}` : ""}`
      )
      .join("\n");
  }

  private static entryToString(entry: Warning | Failure) {
    switch (entry.type) {
      case WarningType.Message:
        return `Warning: ${entry.message}`;
      case FailureType.Semantic:
        return `Failure: ${entry.message}`;
      case FailureType.Expectation:
        const expectations = unique(
          entry.expected.map(Logger.expectationToString)
        ).reduce(
          (acc, expected, index, { length }) =>
            `${acc}${index === length - 1 ? " or " : ", "}${expected}`
        );
        return `Failure: Expected ${expectations}`;
    }
  }

  private static expectationToString(expectation: Expectation) {
    switch (expectation.type) {
      case ExpectationType.Literal:
        return `"${expectation.literal}"`;
      case ExpectationType.RegExp:
        return String(expectation.regex);
      case ExpectationType.Token:
        return expectation.displayName;
      case ExpectationType.Mismatch:
        return `mismatch of "${expectation.match}"`;
      case ExpectationType.Custom:
        return expectation.display;
    }
  }

  private codeFrame(options: LogOptions, location: Location) {
    const start = Math.max(1, location.line - options.linesBefore);
    const end = Math.min(
      this.indexes.length,
      location.line + options.linesAfter
    );
    const maxLineNum = String(end).length;
    const padding = " ".repeat(maxLineNum);
    let acc = "";
    for (let i = start; i !== end + 1; i++) {
      const lineNum = (padding + i).slice(-maxLineNum);
      const current = this.input.substring(
        this.indexes[i - 1],
        (this.indexes[i] ?? this.input.length + 1) - 1
      );
      const normalized = current.replace(/\t+/, tabs =>
        "  ".repeat(tabs.length)
      );
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
}
