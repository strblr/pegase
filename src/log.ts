import {
  Expectation,
  ExpectationType,
  Failure,
  FailureType,
  LogOptions,
  Result,
  Warning,
  WarningType
} from ".";

export function log(result: Result, options?: Partial<LogOptions>) {
  const entries = (result.success
    ? result.warnings
    : [...result.warnings, ...result.failures]
  ).sort((a, b) => a.from - b.from);

  const fullOptions: LogOptions = {
    codeFrames: true,
    linesBefore: 3,
    linesAfter: 3,
    ...options
  };

  const lines = result.options.input.split(/\n|\r(?!\n)/g);
  const indexes = lines.reduce(
    (acc, curr) => [...acc, acc[acc.length - 1] + curr.length + 1],
    [0]
  );

  return entries
    .map(entry => {
      const [line, col] = lineCol(indexes, entry.from);
      let acc = `Line ${line}, col ${col}: `;
      acc += stringifyEntry(entry, result.options.input);
      if (fullOptions.codeFrames)
        acc += `\n${codeFrame(lines, indexes, line, col, fullOptions)}`;
      return acc;
    })
    .join("\n\n");
}

// Helper functions

export function lineCol(indexes: Array<number>, index: number) {
  let line = 0;
  let n = indexes.length - 2;
  while (line < n) {
    const k = line + ((n - line) >> 1);
    if (index < indexes[k]) n = k - 1;
    else if (index >= indexes[k + 1]) line = k + 1;
    else {
      line = k;
      break;
    }
  }
  return [line + 1, index - indexes[line] + 1];
}

export function stringifyEntry(entry: Warning | Failure, input: string) {
  switch (entry.type) {
    case WarningType.Message:
    case FailureType.Semantic:
      return entry.message;
    case FailureType.Expectation:
      const expectations = entry.expected
        .map(expectation => stringifyExpectation(expectation, input))
        .join(", ");
      return `Expected ${expectations}`;
  }
}

export function stringifyExpectation(expectation: Expectation, input: string) {
  switch (expectation.type) {
    case ExpectationType.Literal:
      return `"${expectation.literal}"`;
    case ExpectationType.RegExp:
      return String(expectation.regExp);
    case ExpectationType.Token:
      return expectation.alias;
    case ExpectationType.Mismatch:
      return `mismatch of ${input.substring(
        expectation.match.from,
        expectation.match.to
      )}`;
  }
}

export function codeFrame(
  lines: Array<string>,
  indexes: Array<number>,
  line: number,
  col: number,
  options: LogOptions
) {
  const start = Math.max(0, line - options.linesBefore);
  const end = Math.min(lines.length, line + options.linesAfter + 1);
  const maxChars = String(end).length;
  const padding = " ".repeat(maxChars);
  let acc = "";
  for (let i = start; i < end; i++) {
    const chunk = lines[i];
    const currentLine = (padding + (i + 1)).slice(-maxChars);
    const normalized = lines[i].replace(/^\t+/, tabs =>
      "  ".repeat(tabs.length)
    );
    if (i !== line) acc += `  ${currentLine} | ${normalized}\n`;
    else {
      acc += `> ${currentLine} | ${normalized}\n`;
      const count = Math.max(0, normalized.length - chunk.length + col);
      acc += `  ${padding} | ${" ".repeat(count)}^\n`;
    }
  }
  return acc;
}
