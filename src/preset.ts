import {
  ActionParser,
  LiteralParser,
  PredicateParser,
  RegExpParser,
  SequenceParser,
  TokenParser
} from ".";

export const eps = new LiteralParser("");

export const any = new RegExpParser(/./);

export const endAnchor = new TokenParser(
  new PredicateParser(any, false),
  "end of input"
);

export const id = new TokenParser(
  new RegExpParser(/[_a-zA-Z][_a-zA-Z0-9]*/),
  "identifier"
);

export const int = new TokenParser(
  new ActionParser(new RegExpParser(/\d+/), ({ $raw }) => Number($raw)),
  "integer"
);

export const actionRef = new TokenParser(
  new ActionParser(new RegExpParser(/~\d+/), ({ $raw }) =>
    Number($raw.substring(1))
  ),
  "semantic action"
);

export const charClass = new TokenParser(
  new ActionParser(
    new RegExpParser(/\[(?:[^\\\]]|\\.)*]/),
    ({ $raw }) => new RegExp($raw)
  ),
  "character class"
);

export const stringLit = new TokenParser(
  new ActionParser(new RegExpParser(/'(?:[^\\']|\\.)*'/), ({ $raw }) =>
    JSON.parse(`"${$raw.substring(1, $raw.length - 1)}"`)
  ),
  "string literal (single quote)"
);

export const stringLitDouble = new TokenParser(
  new ActionParser(new RegExpParser(/"(?:[^\\"]|\\.)*"/), ({ $raw }) =>
    JSON.parse($raw)
  ),
  "string literal (double quote)"
);

export const directive = new TokenParser(
  new SequenceParser([new LiteralParser("@"), id]),
  "directive"
);
