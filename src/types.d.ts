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

type ParserJSON =
  | ThenJSON
  | OrJSON
  | NonTerminalJSON
  | RepeatJSON
  | TokenJSON
  | TerminalJSON
  | RegexTerminalJSON;

interface ParserBaseJSON {
  type: string;
}

interface ThenJSON extends ParserBaseJSON {
  parsers: ParserJSON[];
}

interface OrJSON extends ParserBaseJSON {
  parsers: ParserJSON[];
}

interface NonTerminalJSON extends ParserBaseJSON {
  parser: ParserJSON;
}

interface RepeatJSON extends ParserBaseJSON {
  parser: ParserJSON;
  min: number;
  max: number;
}

interface TokenJSON extends ParserBaseJSON {
  parser: ParserJSON;
  identity: string;
}

interface TerminalJSON extends ParserBaseJSON {
  literal: string;
}

interface RegexTerminalJSON extends ParserBaseJSON {
  pattern: string;
}

interface Expectation {
  at: number;
  what: Token | Terminal | RegexTerminal;
}
