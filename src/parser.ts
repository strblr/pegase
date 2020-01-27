import { random, sum, times } from "lodash";
import {
  First,
  Match,
  SuccessMatch,
  MatchFail,
  SemanticAction,
  NonEmptyArray
} from "./match";

type Skipper = Parser | null;

type FirstSet = First[];

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export abstract class Parser {
  readonly action: SemanticAction | null;

  protected constructor(action?: SemanticAction) {
    this.action = action || null;
  }

  abstract get first(): FirstSet;

  parse(
    input: string,
    skipper: Skipper = defaultSkipper,
    payload?: any
  ): Match {
    return this._parse(input, 0, skipper, payload);
  }

  value(input: string, skipper: Skipper = defaultSkipper, payload?: any): any {
    const match = this._parse(input, 0, skipper, payload);
    if (match instanceof SuccessMatch) return match.value;
    throw match;
  }

  children(
    input: string,
    skipper: Skipper = defaultSkipper,
    payload?: any
  ): any[] {
    const match = this._parse(input, 0, skipper, payload);
    if (match instanceof SuccessMatch) return match.children;
    throw match;
  }

  abstract _parse(
    input: string,
    from: number,
    skipper: Skipper,
    payload: any
  ): Match;
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Sequence extends Parser {
  readonly parsers: NonEmptyArray<Parser>;

  constructor(parsers: NonEmptyArray<Parser>, action?: SemanticAction) {
    super(action);
    this.parsers = parsers;
  }

  get first(): FirstSet {
    return this.parsers[0].first;
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    const matches: SuccessMatch[] = [];
    let cursor = from;
    for (const parser of this.parsers) {
      const match = parser._parse(input, cursor, skipper, payload);
      if (match instanceof SuccessMatch) {
        matches.push(match);
        cursor = match.to;
      } else return match;
    }
    return new SuccessMatch(
      input,
      matches[0].from,
      cursor,
      matches,
      this.action,
      payload
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Alternative extends Parser {
  readonly parsers: NonEmptyArray<Parser>;

  constructor(parsers: NonEmptyArray<Parser>, action?: SemanticAction) {
    super(action);
    this.parsers = parsers;
  }

  get first(): FirstSet {
    return this.parsers.reduce(
      (acc, parser) => [...acc, ...parser.first],
      [] as FirstSet
    );
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    // noinspection JSMismatchedCollectionQueryUpdate
    const fails: MatchFail[] = [];
    for (const parser of this.parsers) {
      const match = parser._parse(input, from, skipper, payload);
      if (match instanceof SuccessMatch)
        return new SuccessMatch(
          input,
          match.from,
          match.to,
          [match],
          this.action,
          payload
        );
      fails.push(match as MatchFail);
    }
    return MatchFail.merge(fails as NonEmptyArray<MatchFail>);
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class NonTerminal extends Parser {
  parser: Parser | null;

  constructor(parser: Parser | null, action?: SemanticAction) {
    super(action);
    this.parser = parser;
  }

  get first(): FirstSet {
    if (!this.parser)
      throw new Error("Cannot get first from undefined child parser");
    return this.parser.first;
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    if (!this.parser)
      throw new Error("Cannot parse non-terminal with undefined child parser");
    const match = this.parser._parse(input, from, skipper, payload);
    if (match instanceof SuccessMatch)
      return new SuccessMatch(
        input,
        match.from,
        match.to,
        [match],
        this.action,
        payload
      );
    return match;
  }
}

export function rule(): NonTerminal {
  return new NonTerminal(null);
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
    this.min = min;
    this.max = max;
  }

  get first(): FirstSet {
    return this.parser.first;
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    const matches: SuccessMatch[] = [];
    let counter = 0,
      cursor = from;
    const succeed = (): SuccessMatch => {
      return new SuccessMatch(
        input,
        matches.length === 0 ? from : matches[0].from,
        matches.length === 0 ? from : matches[matches.length - 1].to,
        matches,
        this.action,
        payload
      );
    };
    while (true) {
      if (counter === this.max) return succeed();
      const match = this.parser._parse(input, cursor, skipper, payload);
      if (match instanceof SuccessMatch) {
        matches.push(match);
        cursor = match.to;
        counter++;
      } else if (counter < this.min) return match;
      else return succeed();
    }
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Predicate extends Parser {
  readonly parser: Parser;
  readonly polarity: boolean;

  constructor(parser: Parser, polarity: boolean, action?: SemanticAction) {
    super(
      action &&
        ((...args) => {
          action(...args);
        })
    );
    this.parser = parser;
    this.polarity = polarity;
  }

  get first(): FirstSet {
    return this.parser.first.map(first => ({
      ...first,
      polarity: this.polarity === first.polarity
    }));
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    const match = this.parser._parse(input, from, skipper, payload);
    if (match instanceof MatchFail) {
      if (this.polarity) return match;
      return new SuccessMatch(input, from, from, [], this.action, payload);
    } else {
      if (this.polarity)
        return new SuccessMatch(input, from, from, [], this.action, payload);
      return new MatchFail(
        input,
        this.first.map(first => ({
          at: (match as SuccessMatch).from,
          type: "EXPECTATION_FAIL",
          ...first
        }))
      );
    }
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class Token extends Parser {
  parser: Parser | null;
  readonly identity: string;

  constructor(
    parser: Parser | null,
    identity: string,
    action?: SemanticAction
  ) {
    super(action);
    this.parser = parser;
    this.identity = identity;
  }

  get first(): FirstSet {
    return [
      {
        polarity: true,
        what: "TOKEN",
        identity: this.identity
      }
    ];
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    if (!this.parser)
      throw new Error(
        `Cannot parse token ${this.identity} with undefined child parser`
      );
    if (skipper) {
      const skipMatch = skipper._parse(input, from, null, payload);
      if (skipMatch instanceof SuccessMatch) from = skipMatch.to;
      else return skipMatch;
    }
    const match = this.parser._parse(input, from, null, payload);
    if (match instanceof SuccessMatch)
      return new SuccessMatch(
        input,
        match.from,
        match.to,
        [match],
        this.action,
        payload
      );
    return new MatchFail(
      input,
      this.first.map(first => ({
        at: from,
        type: "EXPECTATION_FAIL",
        ...first
      }))
    );
  }
}

export function token(identity: string): Token {
  return new Token(null, identity);
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

  get first(): FirstSet {
    return [
      {
        polarity: true,
        what: "LITERAL",
        literal: this.literal
      }
    ];
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    if (skipper) {
      const skipMatch = skipper._parse(input, from, null, payload);
      if (skipMatch instanceof SuccessMatch) from = skipMatch.to;
      else return skipMatch;
    }
    if (!input.startsWith(this.literal, from))
      return new MatchFail(
        input,
        this.first.map(first => ({
          at: from,
          type: "EXPECTATION_FAIL",
          ...first
        }))
      );
    return new SuccessMatch(
      input,
      from,
      from + this.literal.length,
      [],
      this.action,
      payload
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class RegexTerminal extends Parser {
  private readonly pattern: RegExp;

  constructor(pattern: RegExp, action?: SemanticAction) {
    super(action);
    this.pattern = new RegExp(
      pattern,
      pattern.flags.includes("y") ? pattern.flags : `${pattern.flags}y`
    );
  }

  get first(): FirstSet {
    return [
      {
        polarity: true,
        what: "REGEX",
        pattern: this.pattern
      }
    ];
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    if (skipper) {
      const skipMatch = skipper._parse(input, from, null, payload);
      if (skipMatch instanceof SuccessMatch) from = skipMatch.to;
      else return skipMatch;
    }
    this.pattern.lastIndex = from;
    const result = this.pattern.exec(input);
    if (result === null)
      return new MatchFail(
        input,
        this.first.map(first => ({
          at: from,
          type: "EXPECTATION_FAIL",
          ...first
        }))
      );
    return new SuccessMatch(
      input,
      from,
      from + result[0].length,
      [],
      this.action,
      payload
    );
  }
}

const defaultSkipper = new RegexTerminal(/\s*/);

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class StartTerminal extends Parser {
  constructor(action?: SemanticAction) {
    super(action);
  }

  get first(): FirstSet {
    return [
      {
        polarity: true,
        what: "START"
      }
    ];
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    if (from === 0)
      return new SuccessMatch(input, 0, 0, [], this.action, payload);
    return new MatchFail(
      input,
      this.first.map(first => ({
        at: from,
        type: "EXPECTATION_FAIL",
        ...first
      }))
    );
  }
}

/**
 * This is a static member.
 *
 * Static members should not be inherited.
 */

export class EndTerminal extends Parser {
  constructor(action?: SemanticAction) {
    super(action);
  }

  get first(): FirstSet {
    return [
      {
        polarity: true,
        what: "END"
      }
    ];
  }

  _parse(input: string, from: number, skipper: Skipper, payload: any): Match {
    if (skipper) {
      const skipMatch = skipper._parse(input, from, null, payload);
      if (skipMatch instanceof SuccessMatch) from = skipMatch.to;
      else return skipMatch;
    }
    if (from === input.length)
      return new SuccessMatch(input, from, from, [], this.action, payload);
    return new MatchFail(
      input,
      this.first.map(first => ({
        at: from,
        type: "EXPECTATION_FAIL",
        ...first
      }))
    );
  }
}
