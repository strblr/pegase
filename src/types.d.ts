declare class Parser {}

declare class SuccessMatch {}

type TemplateArgument = string | RegExp | Parser | SemanticAction;

type SemanticAction = (
  raw: string,
  children: any[],
  payload: any,
  match: SuccessMatch
) => any;

type NonEmptyArray<T> = [T, ...T[]];

type First = (
  | FirstToken
  | FirstLiteral
  | FirstRegex
  | FirstStart
  | FirstEnd
) & {
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

type FirstStart = {
  what: "START";
};

type FirstEnd = {
  what: "END";
};

type ExpectationError = First & {
  type: "EXPECTATION_ERROR";
};

type SemanticError = {
  type: "SEMANTIC_ERROR";
  message: string;
};

type PegaseError = (ExpectationError | SemanticError) & {
  at: number;
};
