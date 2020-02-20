export class Text {
  readonly lines: string[];

  constructor(text: string) {
    this.lines = text.split("\n");
  }

  positionToLine(pos: number): [number, number] {
    let acc = 0;
    for (let line = 0; line !== this.lines.length; ++line) {
      const length = this.lines[line].length + 1;
      if (acc + length > pos) return [line, pos - acc];
      else acc += length;
    }
    throw new Error("Falls outside");
  }

  highlight(from: number, to: number) {
    const [fromLine, fromPos] = this.positionToLine(from);
    const [toLine, toPos] = this.positionToLine(to);
    return `${this.lines[fromLine]}\n${" ".repeat(fromPos)}${"^".repeat(
      toPos - fromPos || 1
    )}`;
  }
}
