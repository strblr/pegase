import { last, isEmpty } from "lodash";
import { Match, SuccessMatch, MatchFail } from "./match";

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

  get first(): First[] {
    throw new Error("Cannot get first from abstract Parser class");
  }

  parse(
    input: string,
    skipper: Parser | null = defaultSkipper,
    payload?: any
  ): Match {
    try {
      return this._parse(input, 0, skipper, true, payload);
    } catch (fail) {
      if (fail instanceof MatchFail) return fail;
      throw fail;
    }
  }

  value(
    input: string,
    skipper: Parser | null = defaultSkipper,
    payload?: any
  ): any {
    return this._parse(input, 0, skipper, true, payload).value;
  }

  children(
    input: string,
    skipper: Parser | null = defaultSkipper,
    payload?: any
  ): any[] {
    return this._parse(input, 0, skipper, true, payload).children;
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    throw new Error("Cannot parse from abstract Parser class");
  }
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

  get first(): First[] {
    return this.parsers[0].first;
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    const matches: SuccessMatch[] = [];
    let cursor = from;
    for (const parser of this.parsers) {
      const match = parser._parse(input, cursor, skipper, skip, payload);
      matches.push(match);
      cursor = match.to;
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

  get first(): First[] {
    return this.parsers.reduce(
      (acc, parser) => [...acc, ...parser.first],
      [] as First[]
    );
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    let match: SuccessMatch | null = null;
    // noinspection JSMismatchedCollectionQueryUpdate
    const fails: MatchFail[] = [];
    for (const parser of this.parsers) {
      try {
        match = parser._parse(input, from, skipper, skip, payload);
        break;
      } catch (fail) {
        if (fail instanceof MatchFail) fails.push(fail);
        else throw fail;
      }
    }
    if (!match) throw MatchFail.merge(fails as NonEmptyArray<MatchFail>);
    else
      return new SuccessMatch(
        input,
        match.from,
        match.to,
        [match],
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

export class NonTerminal extends Parser {
  parser: Parser | null;

  constructor(parser: Parser | null, action?: SemanticAction) {
    super(action);
    this.parser = parser;
  }

  get first(): First[] {
    if (!this.parser)
      throw new Error("Cannot get first from undefined child parser");
    return this.parser.first;
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    if (!this.parser)
      throw new Error("Cannot parse non-terminal with undefined child parser");
    const match = this.parser._parse(input, from, skipper, skip, payload);
    return new SuccessMatch(
      input,
      match.from,
      match.to,
      [match],
      this.action,
      payload
    );
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

  get first(): First[] {
    return this.parser.first;
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    const matches: SuccessMatch[] = [];
    let counter = 0,
      cursor = from;

    const succeed = (): SuccessMatch => {
      return new SuccessMatch(
        input,
        isEmpty(matches) ? from : matches[0].from,
        isEmpty(matches) ? from : (last(matches) as SuccessMatch).to,
        matches,
        this.action,
        payload
      );
    };

    while (true) {
      if (counter === this.max) return succeed();
      try {
        const match = this.parser._parse(input, cursor, skipper, skip, payload);
        matches.push(match);
        cursor = match.to;
        counter++;
      } catch (fail) {
        if (!(fail instanceof MatchFail) || counter < this.min) throw fail;
        else return succeed();
      }
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

  get first(): First[] {
    return this.parser.first.map(first => ({
      ...first,
      polarity: this.polarity === first.polarity
    }));
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    let match: SuccessMatch | null = null;
    try {
      match = this.parser._parse(input, from, skipper, skip, payload);
    } catch (fail) {
      if (!(fail instanceof MatchFail) || this.polarity) throw fail;
      return new SuccessMatch(input, from, from, [], this.action, payload);
    }
    if (this.polarity)
      return new SuccessMatch(input, from, from, [], this.action, payload);
    throw new MatchFail(
      input,
      this.first.map(first => ({
        at: (match as SuccessMatch).from,
        type: "EXPECTATION_ERROR",
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "TOKEN",
        identity: this.identity
      }
    ];
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    if (!this.parser)
      throw new Error(
        `Cannot parse token ${this.identity} with undefined child parser`
      );
    if (skipper && skip)
      from = skipper._parse(input, from, null, false, payload).to;
    let match: SuccessMatch | null = null;
    try {
      match = this.parser._parse(input, from, skipper, false, payload);
    } catch (fail) {
      throw !(fail instanceof MatchFail)
        ? fail
        : new MatchFail(
            input,
            this.first.map(first => ({
              at: from,
              type: "EXPECTATION_ERROR",
              ...first
            }))
          );
    }
    return new SuccessMatch(
      input,
      match.from,
      match.to,
      [match],
      this.action,
      payload
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "LITERAL",
        literal: this.literal
      }
    ];
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    if (skipper && skip)
      from = skipper._parse(input, from, null, false, payload).to;
    if (!input.startsWith(this.literal, from))
      throw new MatchFail(
        input,
        this.first.map(first => ({
          at: from,
          type: "EXPECTATION_ERROR",
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "REGEX",
        pattern: this.pattern
      }
    ];
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    if (skipper && skip)
      from = skipper._parse(input, from, null, false, payload).to;
    this.pattern.lastIndex = from;
    const result = this.pattern.exec(input);
    if (result === null)
      throw new MatchFail(
        input,
        this.first.map(first => ({
          at: from,
          type: "EXPECTATION_ERROR",
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "START"
      }
    ];
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    if (from !== 0)
      throw new MatchFail(
        input,
        this.first.map(first => ({
          at: from,
          type: "EXPECTATION_ERROR",
          ...first
        }))
      );
    return new SuccessMatch(input, 0, 0, [], this.action, payload);
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

  get first(): First[] {
    return [
      {
        polarity: true,
        what: "END"
      }
    ];
  }

  _parse(
    input: string,
    from: number,
    skipper: Parser | null,
    skip: boolean,
    payload: any
  ): SuccessMatch {
    if (skipper && skip)
      from = skipper._parse(input, from, null, false, payload).to;
    if (from !== input.length)
      throw new MatchFail(
        input,
        this.first.map(first => ({
          at: from,
          type: "EXPECTATION_ERROR",
          ...first
        }))
      );
    return new SuccessMatch(input, from, from, [], this.action, payload);
  }
}
