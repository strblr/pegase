import { Failure } from ".";

export class Failures {
  private readonly archived: Failure[] = [];
  private readonly failures: Failure[] = [];

  read() {
    return [...this.archived, ...this.failures];
  }

  write(failure: Failure) {
    if (this.failures.length === 0 || this.failures[0].to === failure.to)
      this.failures.push(failure);
    else if (this.failures[0].to < failure.to)
      this.failures.splice(0, this.failures.length, failure);
  }

  farthest() {
    return this.failures[0]?.to ?? null;
  }

  archive() {
    this.archived.push(...this.failures);
    this.failures.length = 0;
  }
}
