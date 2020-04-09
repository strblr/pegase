import { Warning } from ".";

export class Warnings {
  private readonly warnings: Warning[] = [];

  read() {
    return this.warnings;
  }

  write(warning: Warning) {
    this.warnings.push(warning);
  }
}
