import {
  Expectation,
  ExpectationType,
  Failure,
  FailureType,
  Location,
  LogPrintOptions,
  Warning,
  WarningType
} from ".";

// Logger

export class Logger {
  warnings: Warning[];
  failures: Failure[];
  private fpos: number;
  private ftype?: FailureType;
  private fsemantic?: string;
  private fexpectations: Expectation[];
  private readonly input: string;
  private readonly indexes: number[];

  constructor(input: string) {
    this.warnings = [];
    this.failures = [];
    this.fpos = 0;
    this.fexpectations = [];
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

  hasWarnings() {
    return this.warnings.length !== 0;
  }

  hasFailures() {
    return this.failures.length !== 0;
  }

  warn(warning: Warning) {
    this.warnings.push(warning);
  }

  fail(failure: Failure) {
    this.failures.push(failure);
  }

  ffSemantic(from: number, message: string) {
    if (this.fpos <= from) {
      this.fpos = from;
      this.ftype = FailureType.Semantic;
      this.fsemantic = message;
    }
  }

  ffExpectation(from: number, expectation: Expectation) {
    if (this.fpos < from) {
      this.fpos = from;
      this.ftype = FailureType.Expectation;
      this.fexpectations = [expectation];
    } else if (this.fpos === from && this.ftype === FailureType.Expectation)
      this.fexpectations.push(expectation);
  }

  commit() {
    if (this.ftype) {
      const pos = this.at(this.fpos);
      if (this.ftype === FailureType.Expectation)
        this.failures.push({
          from: pos,
          to: pos,
          type: FailureType.Expectation,
          expected: this.fexpectations
        });
      else
        this.failures.push({
          from: pos,
          to: pos,
          type: FailureType.Semantic,
          message: this.fsemantic!
        });
      this.ftype = undefined;
    }
  }

  save() {
    return {
      warnings: this.warnings.concat(),
      failures: this.failures.concat(),
      farthestPos: this.fpos,
      farthestType: this.ftype,
      farthestSemantic: this.fsemantic,
      farthestExpectations: this.fexpectations.concat()
    };
  }

  sync(save: ReturnType<typeof Logger.prototype.save>) {
    this.warnings = save.warnings;
    this.failures = save.failures;
    this.fpos = save.farthestPos;
    this.ftype = save.farthestType;
    this.fsemantic = save.farthestSemantic;
    this.fexpectations = save.farthestExpectations;
  }

  print(options?: Partial<LogPrintOptions>) {
    const opts: LogPrintOptions = {
      warnings: true,
      failures: true,
      codeFrames: true,
      linesBefore: 2,
      linesAfter: 2,
      ...options
    };
    const entries = [
      ...(opts.warnings ? this.warnings : []),
      ...(opts.failures ? this.failures : [])
    ].sort((a, b) => a.from.index - b.from.index);

    const stringifyEntry = (entry: Warning | Failure) => {
      switch (entry.type) {
        case WarningType.Message:
          return `Warning: ${entry.message}`;
        case FailureType.Semantic:
          return `Failure: ${entry.message}`;
        case FailureType.Expectation:
          const expectations = entry.expected
            .map(expectation => stringifyExpectation(expectation))
            .reduce(
              (acc, expected, index, { length }) =>
                `${acc}${index === length - 1 ? " or " : ", "}${expected}`
            );
          return `Failure: Expected ${expectations}`;
      }
    };

    const stringifyExpectation = (expectation: Expectation) => {
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
    };

    const codeFrame = (location: Location) => {
      const start = Math.max(1, location.line - opts.linesBefore);
      const end = Math.min(
        this.indexes.length,
        location.line + opts.linesAfter
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
    };

    return entries
      .map(entry => {
        let acc = `(${entry.from.line}:${entry.from.column}) ${stringifyEntry(
          entry
        )}`;
        if (opts.codeFrames) acc += `\n\n${codeFrame(entry.from)}`;
        return acc;
      })
      .join("\n");
  }
}
