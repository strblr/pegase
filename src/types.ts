import { Parser } from "./index.js";

// Related to parser generation

export type Directive = (parser: Parser, ...args: any[]) => Parser;
