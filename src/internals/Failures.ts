import { Failure } from ".";

export class Failures {
  private readonly chunks: Failure[][] = [[]];

  read() {
    return this.chunks.reduce((acc, chunk) => [...acc, ...chunk], []);
  }

  farthest() {
    const chunk = this.chunks[0];
    return chunk.length === 0 ? null : chunk[0].to;
  }

  save() {
    this.chunks.unshift([]);
  }

  write(failure: Failure) {
    const chunk = this.chunks[0];
    if (chunk.length === 0 || chunk[0].to === failure.to) chunk.push(failure);
    else if (chunk[0].to < failure.to)
      chunk.splice(0, this.chunks.length, failure);
  }
}
