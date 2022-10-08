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

/**
 * Generates a location factory from an input
 * @param input
 */

export function locationGenerator(input: string) {
  let acc = 0;
  const indexes = input.split(/[\r\n]/).map(chunk => {
    const start = acc;
    acc += chunk.length + 1;
    return start;
  });
  return (index: number): Location => {
    let line = 0;
    let n = indexes.length - 1;
    while (line < n) {
      const k = line + ((n - line) >> 1);
      if (index < indexes[k]) n = k - 1;
      else if (index >= indexes[k + 1]) line = k + 1;
      else {
        line = k;
        break;
      }
    }
    return {
      input,
      index,
      line: line + 1,
      column: index - indexes[line] + 1
    };
  };
}
