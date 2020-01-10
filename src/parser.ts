import CallableInstance from "callable-instance2/import";
import { isString, isRegExp, isArray, head, last } from "lodash";
import { Match, SuccessMatch, MatchFail } from "./match";
import { throwError } from "./error";

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export function $p(parser: ParserInput, action?: SemanticAction): Parser {
  if (isString(parser)) return new LiteralTerminal(parser, action);
  if (isRegExp(parser)) return new RegexTerminal(parser, action);
  if (parser instanceof Parser)
    return !action ? parser : new NonTerminal(parser, action);
  if (isArray(parser))
    return new Alternative(
      parser.map(p => $p(p)),
      action
    );
  return throwError("Unknown parser primitive as argument for $p");
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export const repeat = (
  parser: ParserInput,
  min: number,
  max: number,
  action?: SemanticAction
): Parser => new Repetition($p(parser, action), min, max);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export const maybe = (parser: ParserInput, action?: SemanticAction): Parser =>
  repeat(parser, 0, 1, action);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export const any = (parser: ParserInput, action?: SemanticAction): Parser =>
  repeat(parser, 0, Infinity, action);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export const some = (parser: ParserInput, action?: SemanticAction): Parser =>
  repeat(parser, 1, Infinity, action);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

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

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

abstract class Parser extends CallableInstance {
  readonly action: SemanticAction;

  protected constructor(action: SemanticAction) {
    super("then");
    this.action = action;
  }

  then(parser: ParserInput, action?: SemanticAction): Parser {
    const next = $p(parser, action);
    return new Sequence([
      ...(this instanceof Sequence && !this.action ? this.parsers : [this]),
      ...(next instanceof Sequence && !next.action ? next.parsers : [next])
    ]);
  }

  or(parser: ParserInput, action?: SemanticAction): Parser {
    const next = $p(parser, action);
    return new Alternative([
      ...(this instanceof Alternative && !this.action ? this.parsers : [this]),
      ...(next instanceof Alternative && !next.action ? next.parsers : [next])
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

  parse(input: string, skipper: Skipper = $p(/\s*/)): Match {
    return this._parse(input, skipper, 0, true);
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    return throwError("Cannot parse from abstract Parser class");
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

class Sequence extends Parser {
  readonly parsers: Parser[];

  static defaultAction: SemanticAction = () => {};

  constructor(parsers: Parser[], action?: SemanticAction) {
    super(action || Sequence.defaultAction);
    if (parsers.length === 0)
      throwError("A sequence must be built from at least one parser");
    this.parsers = parsers;
  }

  get json(): SequenceJSON {
    return {
      type: "SEQUENCE",
      parsers: this.parsers.map(parser => parser.json)
    };
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    const matches: SuccessMatch[] = [];
    let cursor = from;
    for (const parser of this.parsers) {
      const match = parser._parse(input, skipper, cursor, skip);
      if (match.failed) return match;
      const success = match as SuccessMatch;
      matches.push(success);
      cursor = success.to;
    }
    return new SuccessMatch(
      input,
      (head(matches) as SuccessMatch).from,
      cursor,
      matches.map(match => match.value).filter(value => value !== undefined),
      this.action
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

class Alternative extends Parser {
  readonly parsers: Parser[];

  static defaultAction: SemanticAction = () => {};

  constructor(parsers: Parser[], action?: SemanticAction) {
    super(action || Alternative.defaultAction);
    if (parsers.length === 0)
      throwError("An alternative must be built from at least one parser");
    this.parsers = parsers;
  }

  get json(): AlternativeJSON {
    return {
      type: "ALTERNATIVE",
      parsers: this.parsers.map(parser => parser.json)
    };
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    const fails: MatchFail[] = [];
    for (const parser of this.parsers) {
      const match = parser._parse(input, skipper, from, skip);
      if (match.failed) fails.push(match as MatchFail);
      else {
        const success = match as SuccessMatch;
        return new SuccessMatch(
          input,
          success.from,
          success.to,
          success.value === undefined ? [] : [success.value],
          this.action
        );
      }
    }
    return MatchFail.merge(fails);
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

class NonTerminal extends Parser {
  readonly parser: Parser;

  static defaultAction: SemanticAction = () => {};

  constructor(parser: Parser, action?: SemanticAction) {
    super(action || NonTerminal.defaultAction);
    this.parser = parser;
  }

  get json(): NonTerminalJSON {
    return {
      type: "NONTERMINAL",
      parser: this.parser.json
    };
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    const match = this.parser._parse(input, skipper, from, skip);
    if (match.failed) return match;
    const success = match as SuccessMatch;
    return new SuccessMatch(
      input,
      success.from,
      success.to,
      success.value === undefined ? [] : [success.value],
      this.action
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

class Repetition extends Parser {
  readonly parser: Parser;
  readonly min: number;
  readonly max: number;

  static defaultAction: SemanticAction = () => {};

  constructor(
    parser: Parser,
    min: number,
    max: number,
    action?: SemanticAction
  ) {
    super(action || Repetition.defaultAction);
    this.parser = parser;
    if (min < 0 || min > max)
      throwError(`Invalid repetition range [${min}, ${max}]`);
    this.min = min;
    this.max = max;
  }

  get json(): RepetitionJSON {
    return {
      type: "REPETITION",
      parser: this.parser.json,
      min: this.min,
      max: this.max
    };
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    for (let i = 0; ; ++i) {}
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

class Token extends Parser {
  readonly parser: Parser;
  readonly identity: string;

  static defaultAction: SemanticAction = () => {};

  constructor(parser: Parser, identity: string, action?: SemanticAction) {
    super(action || Token.defaultAction);
    this.parser = parser;
    this.identity = identity;
  }

  get json(): TokenJSON {
    return {
      type: "TOKEN",
      parser: this.parser.json,
      identity: this.identity
    };
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    if (skipper && skip) {
      const skipMatch = (skipper as Parser)._parse(input, null, from, false);
      if (skipMatch.failed) return skipMatch;
      from = (skipMatch as SuccessMatch).to;
    }
    const match = this.parser._parse(input, skipper, from, false);
    if (match.failed)
      return new MatchFail(input, [
        {
          what: "TOKEN",
          at: from,
          identity: this.identity
        }
      ]);
    const success = match as SuccessMatch;
    return new SuccessMatch(
      input,
      success.from,
      success.to,
      success.value === undefined ? [] : [success.value],
      this.action
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

class LiteralTerminal extends Parser {
  readonly literal: string;

  static defaultAction: SemanticAction = () => {};

  constructor(literal: string, action?: SemanticAction) {
    super(action || LiteralTerminal.defaultAction);
    this.literal = literal;
  }

  get json(): LiteralJSON {
    return {
      type: "LITERAL",
      literal: this.literal
    };
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    if (skipper && skip) {
      const skipMatch = (skipper as Parser)._parse(input, null, from, false);
      if (skipMatch.failed) return skipMatch;
      from = (skipMatch as SuccessMatch).to;
    }
    if (!input.startsWith(this.literal, from))
      return new MatchFail(input, [
        {
          what: "LITERAL",
          at: from,
          literal: this.literal
        }
      ]);
    return new SuccessMatch(
      input,
      from,
      from + this.literal.length,
      [],
      this.action
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

class RegexTerminal extends Parser {
  readonly pattern: RegExp;
  private readonly _pattern: RegExp;

  static defaultAction: SemanticAction = () => {};

  constructor(pattern: RegExp, action?: SemanticAction) {
    super(action || RegexTerminal.defaultAction);
    this.pattern = pattern;
    this._pattern = new RegExp(pattern, "y");
  }

  get json(): RegexJSON {
    return {
      type: "REGEX",
      pattern: String(this.pattern)
    };
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    if (skipper && skip) {
      const skipMatch = (skipper as Parser)._parse(input, null, from, false);
      if (skipMatch.failed) return skipMatch;
      from = (skipMatch as SuccessMatch).to;
    }
    this._pattern.lastIndex = from;
    const result = this._pattern.exec(input);
    if (result === null)
      return new MatchFail(input, [
        {
          what: "REGEX",
          at: from,
          pattern: this.pattern
        }
      ]);
    return new SuccessMatch(
      input,
      from,
      from + result[0].length,
      [],
      this.action
    );
  }
}
