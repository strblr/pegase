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

  parse(input: string, skipper: Parser | null = defaultSkipper): Match {
    try {
      return this._parse(input, skipper, 0, true);
    } catch (fail) {
      if (fail instanceof MatchFail) return fail;
      throw fail;
    }
  }

  value(input: string, skipper: Parser | null = defaultSkipper): any {
    return this._parse(input, skipper, 0, true).value;
  }

  children(input: string, skipper: Parser | null = defaultSkipper): any[] {
    return this._parse(input, skipper, 0, true).children;
  }

  get first(): First[] {
    return throwError("Cannot get first from abstract Parser class");
  }

  _parse(
    input: string,
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
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

  get first(): First[] {
    return (head(this.parsers) as Parser).first;
  }

  _parse(
    input: string,
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
    const matches: SuccessMatch[] = [];
    let cursor = from;
    for (const parser of this.parsers) {
      const match = parser._parse(input, skipper, cursor, skip);
      matches.push(match);
      cursor = match.to;
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

  get first(): First[] {
    return this.parsers.reduce(
      (acc, parser) => [...acc, ...parser.first],
      [] as First[]
    );
  }

  _parse(
    input: string,
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
    const fails: MatchFail[] = [];
    for (const parser of this.parsers) {
      try {
        const match = parser._parse(input, skipper, from, skip);
        return new SuccessMatch(
          input,
          match.from,
          match.to,
          [match],
          this.action
        );
      } catch (fail) {
        if (fail instanceof MatchFail) fails.push(fail);
        else throw fail;
      }
    }
    throw MatchFail.merge(fails);
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
      return throwError("Cannot get first from undefined child parser");
    return this.parser.first;
  }

  _parse(
    input: string,
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
    if (!this.parser)
      return throwError(
        "Cannot parse non-terminal with undefined child parser"
      );
    const match = this.parser._parse(input, skipper, from, skip);
    return new SuccessMatch(input, match.from, match.to, [match], this.action);
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
    if (min < 0 || max < 1 || max < min)
      throwError(`Invalid repetition range [${min}, ${max}]`);
    this.min = min;
    this.max = max;
  }

  get first(): First[] {
    return this.parser.first;
  }

  _parse(
    input: string,
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
    const matches: SuccessMatch[] = [];
    let counter = 0,
      cursor = from;

    const succeed = (): SuccessMatch => {
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
      try {
        const match = this.parser._parse(input, skipper, cursor, skip);
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
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
    try {
      this.parser._parse(input, skipper, from, skip);
    } catch (fail) {
      if (!(fail instanceof MatchFail) || this.polarity) throw fail;
      return new SuccessMatch(input, from, from, [], this.action);
    }
    if (this.polarity)
      return new SuccessMatch(input, from, from, [], this.action);
    throw new MatchFail(
      input,
      this.first.map(first => ({ at: from, ...first }))
    );
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
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
    if (skipper && skip) from = skipper._parse(input, null, from, false).to;
    try {
      const match = this.parser._parse(input, skipper, from, false);
      return new SuccessMatch(
        input,
        match.from,
        match.to,
        [match],
        this.action
      );
    } catch (fail) {
      throw !(fail instanceof MatchFail)
        ? fail
        : new MatchFail(
            input,
            this.first.map(first => ({ at: from, ...first }))
          );
    }
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
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
    if (skipper && skip) from = skipper._parse(input, null, from, false).to;
    if (!input.startsWith(this.literal, from))
      throw new MatchFail(
        input,
        this.first.map(first => ({ at: from, ...first }))
      );
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
    skipper: Parser | null,
    from: number,
    skip: boolean
  ): SuccessMatch {
    if (skipper && skip) from = skipper._parse(input, null, from, false).to;
    this._pattern.lastIndex = from;
    const result = this._pattern.exec(input);
    if (result === null)
      throw new MatchFail(
        input,
        this.first.map(first => ({ at: from, ...first }))
      );
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
