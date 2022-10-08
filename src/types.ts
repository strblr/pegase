import { Parser } from ".";

// Related to parser generation

export type Directive = (parser: Parser, ...args: any[]) => Parser;
