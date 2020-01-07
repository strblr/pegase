declare class Parser {}

declare class Token {
  identity: string;
}

declare class Terminal {
  literal: string;
}

declare class RegexTerminal {
  pattern: RegExp;
}

type ParserInputPrimitive = string | RegExp | Parser;
type ParserInput = ParserInputPrimitive | ParserInputPrimitive[];
type SemanticAction = (...nodes: any[]) => any;

interface Expectation {
  at: number;
  what: Token | Terminal | RegexTerminal;
}
