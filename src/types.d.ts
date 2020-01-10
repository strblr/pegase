declare class Parser {}

declare class SuccessMatch {}

type ParserInputPrimitive = string | RegExp | Parser;

type ParserInput = ParserInputPrimitive | ParserInputPrimitive[];

type Skipper = Parser | null;

type SemanticAction = (match: SuccessMatch) => any;

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
  parser: ParserJSON;
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

interface ExpectationShared {
  at: number;
}

interface TokenExpectation extends ExpectationShared {
  what: "TOKEN";
  identity: string;
}

interface LiteralExpectation extends ExpectationShared {
  what: "LITERAL";
  literal: string;
}

interface RegexExpectation extends ExpectationShared {
  what: "REGEX";
  pattern: RegExp;
}
