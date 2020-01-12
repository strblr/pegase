declare class Parser {
  readonly action?: SemanticAction;
}

declare class SuccessMatch {
  readonly children: any[];
  get parsed(): string;
}

type SemanticAction = (
  raw: string,
  children: any[],
  match: SuccessMatch
) => any;

type TemplateArgument = string | RegExp | Parser | SemanticAction;

type Skipper = Parser | null;

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
