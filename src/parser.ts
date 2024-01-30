import { compile, Failure, Node, Range, Tracer, Warning } from ".";

export class Parser extends Node {
  parse: parseFunction;

  static undefinedParse(): never {
    throw new Error("Parser needs to be compiled before being used");
  }

  constructor(label: string, data: any, range: Range) {
    super("Parser", data, range);
    this.parse = Parser.undefinedParse;
  }

  test(input: string, options?: Partial<ParseOptions>) {
    return this.parse(input, options).success;
  }

  values(input: string, options?: Partial<ParseOptions>) {
    const result = this.parse(input, options);
    return !result.success ? undefined : result.values;
  }

  value(input: string, options?: Partial<ParseOptions>) {
    return this.values(input, options)?.[0];
  }

  compile() {
    this.parse = compile(this);
  }
}

export interface parseFunction {
  (input: string, options?: Partial<ParseOptions>): ParseResult;
}

export interface ParseOptions {
  from: number;
  complete: boolean;
  skipper: RegExp;
  skip: boolean;
  caseSensitive: boolean;
  tracer: Tracer;
  trace: boolean;
  silent: boolean;
  context: any;
}

export type ParseResult = ParseSuccess | ParseError;

export interface ParseSuccess extends Range {
  success: true;
  values: any[];
  warnings: Warning[];
  failures: Failure[];
}

export interface ParseError {
  success: false;
  warnings: Warning[];
  failures: Failure[];
}
