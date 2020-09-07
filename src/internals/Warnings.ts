import { InputRange, StackTrace } from ".";

export class Warnings {
  private readonly content: Array<Warning> = [];

  read() {
    return this.content;
  }

  write(warning: Warning) {
    this.content.push(warning);
  }
}

export type Warning = SemanticWarning;

export enum WarningType {
  Semantic
}

export type SemanticWarning = InputRange &
  StackTrace &
  Readonly<{
    type: WarningType.Semantic;
    message: string;
  }>;
