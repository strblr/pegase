declare class Parser {}

declare class SuccessMatch {}

type TemplateArgument = string | RegExp | Parser | SemanticAction;

type SemanticAction = (
  raw: string,
  children: any[],
  match: SuccessMatch
) => any;

type First = (FirstToken | FirstLiteral | FirstRegex) & {
  polarity: boolean;
};

type FirstToken = {
  what: "TOKEN";
  identity: string;
};

type FirstLiteral = {
  what: "LITERAL";
  literal: string;
};

type FirstRegex = {
  what: "REGEX";
  pattern: RegExp;
};

type Expectation = First & {
  at: number;
};
