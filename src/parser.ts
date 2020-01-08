import CallableInstance from "callable-instance2/import";
import { isString, isRegExp, isArray } from "lodash";
import { throwError } from "./error";

export function $p(parser: ParserInput, action?: SemanticAction): Parser {
  if (isString(parser)) return new Terminal(parser, action);
  if (isRegExp(parser)) return new RegexTerminal(parser, action);
  if (parser instanceof Parser) {
    if (!action) return parser;
    if (parser.action) return new NonTerminal(parser, action);
    parser.action = action;
    return parser;
  }
  if (isArray(parser))
    return new Or(
      parser.map(p => $p(p)),
      action
    );
  return throwError("Unknown parser primitive as argument for $p");
}

export const repeat = (
  parser: ParserInput,
  min: number,
  max: number,
  action?: SemanticAction
): Parser => new Repeat($p(parser, action), min, max);

export const maybe = (parser: ParserInput, action?: SemanticAction): Parser =>
  repeat(parser, 0, 1, action);

export const any = (parser: ParserInput, action?: SemanticAction): Parser =>
  repeat(parser, 0, Infinity, action);

export const some = (parser: ParserInput, action?: SemanticAction): Parser =>
  repeat(parser, 1, Infinity, action);

export const token = (
  parser: ParserInput,
  identity: string,
  action?: SemanticAction
): Parser => new Token($p(parser), identity, action);

$p.repeat = repeat;
$p.maybe = maybe;
$p.any = any;
$p.some = some;
$p.token = token;

abstract class Parser extends CallableInstance {
  action?: SemanticAction;

  constructor(action?: SemanticAction) {
    super("then");
    this.action = action;
  }

  then(parser: ParserInput, action?: SemanticAction): Parser {
    const next = $p(parser, action);
    return new Then([
      ...(this instanceof Then && !this.action ? this.parsers : [this]),
      ...(next instanceof Then && !next.action ? next.parsers : [next])
    ]);
  }

  or(parser: ParserInput, action?: SemanticAction): Parser {
    const next = $p(parser, action);
    return new Or([
      ...(this instanceof Or && !this.action ? this.parsers : [this]),
      ...(next instanceof Or && !next.action ? next.parsers : [next])
    ]);
  }

  mod(parser: ParserInput, action?: SemanticAction): Parser {
    return this.any($p(parser, action).then(this));
  }

  repeat(
    parser: ParserInput,
    min: number,
    max: number,
    action?: SemanticAction
  ): Parser {
    return this.then(repeat(parser, min, max, action));
  }

  maybe(parser: ParserInput, action?: SemanticAction): Parser {
    return this.then(maybe(parser, action));
  }

  any(parser: ParserInput, action?: SemanticAction): Parser {
    return this.then(any(parser, action));
  }

  some(parser: ParserInput, action?: SemanticAction): Parser {
    return this.then(some(parser, action));
  }

  token(
    parser: ParserInput,
    identity: string,
    action?: SemanticAction
  ): Parser {
    return this.then(token(parser, identity, action));
  }

  get json(): ParserJSON {
    return throwError("Cannot get json from abstract Parser class");
  }
}

class Then extends Parser {
  parsers: Parser[];

  constructor(parsers: Parser[], action?: SemanticAction) {
    super(action);
    this.parsers = parsers;
  }

  get json(): ThenJSON {
    return {
      type: "Then",
      parsers: this.parsers.map(parser => parser.json)
    };
  }
}

class Or extends Parser {
  parsers: Parser[];

  constructor(parsers: Parser[], action?: SemanticAction) {
    super(action);
    this.parsers = parsers;
  }

  get json(): OrJSON {
    return {
      type: "Or",
      parsers: this.parsers.map(parser => parser.json)
    };
  }
}

class NonTerminal extends Parser {
  parser: Parser;

  constructor(parser: Parser, action?: SemanticAction) {
    super(action);
    this.parser = parser;
  }

  get json(): NonTerminalJSON {
    return {
      type: "NonTerminal",
      parser: this.parser.json
    };
  }
}

class Repeat extends Parser {
  parser: Parser;
  min: number;
  max: number;

  constructor(
    parser: Parser,
    min: number,
    max: number,
    action?: SemanticAction
  ) {
    super(action);
    this.parser = parser;
    this.min = min;
    this.max = max;
  }

  get json(): RepeatJSON {
    return {
      type: "Repeat",
      parser: this.parser.json,
      min: this.min,
      max: this.max
    };
  }
}

class Token extends Parser {
  parser: Parser;
  identity: string;

  constructor(parser: Parser, identity: string, action?: SemanticAction) {
    super(action);
    this.parser = parser;
    this.identity = identity;
  }

  get json(): TokenJSON {
    return {
      type: "Token",
      parser: this.parser.json,
      identity: this.identity
    };
  }
}

class Terminal extends Parser {
  literal: string;

  constructor(literal: string, action?: SemanticAction) {
    super(action);
    this.literal = literal;
  }

  get json(): TerminalJSON {
    return {
      type: "Terminal",
      literal: this.literal
    };
  }
}

class RegexTerminal extends Parser {
  pattern: RegExp;

  constructor(pattern: RegExp, action?: SemanticAction) {
    super(action);
    this.pattern = pattern;
  }

  get json(): RegexTerminalJSON {
    return {
      type: "RegexTerminal",
      pattern: String(this.pattern)
    };
  }
}
