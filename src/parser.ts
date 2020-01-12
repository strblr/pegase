import { head, last, isEmpty } from "lodash";
import { Match, SuccessMatch, MatchFail } from "./match";
import { throwError } from "./error";

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export abstract class Parser {
  readonly action?: SemanticAction;

  protected constructor(action?: SemanticAction) {
    this.action = action;
  }

  parse(input: string, skipper: Skipper = defaultSkipper): Match {
    return this._parse(input, skipper, 0, true);
  }

  value(input: string, skipper: Skipper = defaultSkipper): any {
    return (this.parse(input, skipper) as SuccessMatch).value;
  }

  children(input: string, skipper: Skipper = defaultSkipper): any[] {
    return (this.parse(input, skipper) as SuccessMatch).children;
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

export class Sequence extends Parser {
  readonly parsers: Parser[];

  constructor(parsers: Parser[], action?: SemanticAction) {
    super(action);
    if (isEmpty(parsers))
      throwError("A sequence must be built from at least one parser");
    this.parsers = parsers;
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
      matches,
      this.action
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Alternative extends Parser {
  readonly parsers: Parser[];

  constructor(parsers: Parser[], action?: SemanticAction) {
    super(action);
    if (isEmpty(parsers))
      throwError("An alternative must be built from at least one parser");
    this.parsers = parsers;
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
          [success],
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

export function rule(): NonTerminal {
  return new NonTerminal();
}

export class NonTerminal extends Parser {
  parser?: Parser;

  constructor(parser?: Parser, action?: SemanticAction) {
    super(action);
    this.parser = parser;
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    if (!this.parser)
      return throwError(
        "Cannot parse non-terminal with undefined child parser"
      );
    const match = this.parser._parse(input, skipper, from, skip);
    if (match.failed) return match;
    const success = match as SuccessMatch;
    return new SuccessMatch(
      input,
      success.from,
      success.to,
      [success],
      this.action
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Repetition extends Parser {
  readonly parser: Parser;
  readonly min: number;
  readonly max: number;

  constructor(
    parser: Parser,
    min: number,
    max: number,
    action?: SemanticAction
  ) {
    super(action);
    this.parser = parser;
    if (min < 0 || min > max)
      throwError(`Invalid repetition range [${min}, ${max}]`);
    this.min = min;
    this.max = max;
  }

  _parse(input: string, skipper: Skipper, from: number, skip: boolean): Match {
    const matches: SuccessMatch[] = [];
    let counter = 0,
      cursor = from;

    const succeed = (): Match => {
      return new SuccessMatch(
        input,
        isEmpty(matches) ? from : (head(matches) as SuccessMatch).from,
        isEmpty(matches) ? from : (last(matches) as SuccessMatch).to,
        matches,
        this.action
      );
    };

    while (true) {
      if (counter === this.max) return succeed();
      const match = this.parser._parse(input, skipper, cursor, skip);
      if (match.failed) return counter < this.min ? match : succeed();
      else {
        const success = match as SuccessMatch;
        matches.push(success);
        cursor = success.to;
        counter++;
      }
    }
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Token extends Parser {
  readonly parser: Parser;
  readonly identity: string;

  constructor(parser: Parser, identity: string, action?: SemanticAction) {
    super(action);
    this.parser = parser;
    this.identity = identity;
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
          at: from,
          what: "TOKEN",
          identity: this.identity
        }
      ]);
    const success = match as SuccessMatch;
    return new SuccessMatch(
      input,
      success.from,
      success.to,
      [success],
      this.action
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class LiteralTerminal extends Parser {
  readonly literal: string;

  constructor(literal: string, action?: SemanticAction) {
    super(action);
    this.literal = literal;
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
          at: from,
          what: "LITERAL",
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

export class RegexTerminal extends Parser {
  readonly pattern: RegExp;
  private readonly _pattern: RegExp;

  constructor(pattern: RegExp, action?: SemanticAction) {
    super(action);
    this.pattern = pattern;
    this._pattern = new RegExp(pattern, "y");
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
          at: from,
          what: "REGEX",
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

const defaultSkipper = new RegexTerminal(/\s*/);
