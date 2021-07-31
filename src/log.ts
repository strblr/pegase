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

// log

export function log(result: Result, options?: Partial<LogOptions>) {
  const fullOptions: LogOptions = {
    warnings: true,
    failures: true,
    tokenDetail: false,
    codeFrames: true,
    linesBefore: 2,
    linesAfter: 2,
    ...options
  };

  const entries = [
    ...(fullOptions.warnings ? result.warnings : []),
    ...(fullOptions.failures ? result.failures : [])
  ].sort((a, b) => a.from - b.from);

  const lines = result.options.input.split(/\r\n|\r|\n/);
  const indexes = lines.reduce(
    (acc, curr) => [...acc, acc[acc.length - 1] + curr.length + 1],
    [0]
  );

  return entries
    .map(entry => {
      const [line, col] = lineCol(indexes, entry.from);
      let acc = `Line ${line}, col ${col} | `;
      const [type, detail] = stringifyEntry(entry, result, fullOptions);
      acc += `${type}: ${detail}`;
      if (fullOptions.codeFrames)
        acc += `\n\n${codeFrame(lines, line, col, fullOptions)}`;
      return acc;
    })
    .join("\n\n");
}

// lineCol

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

// stringifyEntry

export function stringifyEntry(
  entry: Warning | Failure,
  result: Result,
  options: LogOptions
) {
  switch (entry.type) {
    case WarningType.Message:
      return ["Warning", entry.message];
    case FailureType.Semantic:
      return ["Failure", entry.message];
    case FailureType.Expectation:
      const expectations = entry.expected
        .map(expectation => stringifyExpectation(expectation, result, options))
        .reduce(
          (acc, expected, index, { length }) =>
            `${acc}${index === length - 1 ? " or " : ", "}${expected}`
        );
      return ["Failure", `Expected ${expectations}`];
  }
}

// stringifyExpectation

export function stringifyExpectation(
  expectation: Expectation,
  result: Result,
  options: LogOptions
) {
  switch (expectation.type) {
    case ExpectationType.Literal:
      return `"${expectation.literal}"`;
    case ExpectationType.RegExp:
      return String(expectation.regExp);
    case ExpectationType.Token:
      let detail = "";
      if (options.tokenDetail)
        detail += ` (${expectation.failures
          .map(failure => stringifyEntry(failure, result, options)[1])
          .join(" | ")})`;
      return `${expectation.alias}${detail}`;
    case ExpectationType.Mismatch:
      return `mismatch of "${result.options.input.substring(
        expectation.match.from,
        expectation.match.to
      )}"`;
  }
}

// codeFrame

export function codeFrame(
  lines: Array<string>,
  line: number,
  col: number,
  options: LogOptions
) {
  const start = Math.max(1, line - options.linesBefore);
  const end = Math.min(lines.length, line + options.linesAfter);
  const maxLineNum = String(end).length;
  const padding = " ".repeat(maxLineNum);
  let acc = "";
  for (let i = start; i !== end + 1; i++) {
    const lineNum = (padding + i).slice(-maxLineNum);
    const current = lines[i - 1];
    const normalized = current.replace(/\t+/, tabs => "  ".repeat(tabs.length));
    if (i !== line) acc += `  ${lineNum} | ${normalized}\n`;
    else {
      const count = Math.max(0, normalized.length - current.length + col - 1);
      acc += `> ${lineNum} | ${normalized}\n`;
      acc += `  ${padding} | ${" ".repeat(count)}^\n`;
    }
  }
  return acc;
}
