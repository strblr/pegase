declare class Parser {}

declare class SuccessMatch {
  readonly children: any[];
  get parsed(): string;
}

type ParserInputPrimitive = string | RegExp | Parser;

type ParserInput = ParserInputPrimitive | ParserInputPrimitive[];

type Skipper = Parser | null;

type SemanticAction = (
  raw: string,
  children: any[],
  match: SuccessMatch
) => any;

type ParserJSON =
  | SequenceJSON
  | AlternativeJSON
  | NonTerminalJSON
  | RepetitionJSON
  | TokenJSON
  | LiteralJSON
  | RegexJSON;

interface SequenceJSON {
  type: "SEQUENCE";
  parsers: ParserJSON[];
}

interface AlternativeJSON {
  type: "ALTERNATIVE";
  parsers: ParserJSON[];
}

interface NonTerminalJSON {
  type: "NONTERMINAL";
  parser?: ParserJSON;
}

interface RepetitionJSON {
  type: "REPETITION";
  parser: ParserJSON;
  min: number;
  max: number;
}

interface TokenJSON {
  type: "TOKEN";
  parser: ParserJSON;
  identity: string;
}

interface LiteralJSON {
  type: "LITERAL";
  literal: string;
}

interface RegexJSON {
  type: "REGEX";
  pattern: string;
}

type Expectation = TokenExpectation | LiteralExpectation | RegexExpectation;

interface TokenExpectation {
  at: number;
  what: "TOKEN";
  identity: string;
}

interface LiteralExpectation {
  at: number;
  what: "LITERAL";
  literal: string;
}

interface RegexExpectation {
  at: number;
  what: "REGEX";
  pattern: RegExp;
}
