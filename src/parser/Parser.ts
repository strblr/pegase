import { Cache, Failures, Internals, Warnings } from "../internals";
import {
  Alternative,
  defaultOptions,
  LiteralTerminal,
  NonTerminal,
  Options
} from ".";
import { Match, SemanticAction } from "../match";
import { Report } from "../report";

export abstract class Parser<TContext> {
  protected readonly action: SemanticAction<TContext> | null;

  protected constructor(action?: SemanticAction<TContext>) {
    this.action = action || null;
  }

  parse(
    input: string,
    partialOptions: Partial<Options<TContext>> = defaultOptions
  ): Report<TContext> {
    const options = {
      ...defaultOptions,
      ...partialOptions
    };
    const internals = {
      stack: [],
      failures: new Failures(),
      warnings: new Warnings(),
      cache: new Cache<TContext>()
    };
    return new Report(
      input,
      this._parse(input, options, internals),
      options,
      internals
    );
  }

  match(input: string, options: Partial<Options<TContext>> = defaultOptions) {
    return this.parse(input, options).match !== null;
  }

  value<TValue = any>(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): TValue {
    const report = this.parse(input, options);
    if (report.match) return report.match.value;
    throw report;
  }

  children<TChildren = any[]>(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions
  ): TChildren {
    const report = this.parse(input, options);
    if (report.match) return (report.match.children as unknown) as TChildren;
    throw report;
  }

  abstract _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TContext> | null;

  // Directives

  get omit() {
    return new NonTerminal(this, "BYPASS", null, () => undefined);
  }

  get raw() {
    return new NonTerminal(this, "BYPASS", null, ({ raw }) => raw);
  }

  get token() {
    return new NonTerminal(this, "TOKEN", null);
  }

  get skip() {
    return new NonTerminal(this, "SKIP", null);
  }

  get unskip() {
    return new NonTerminal(this, "UNSKIP", null);
  }

  get memo() {
    return new NonTerminal(this, "CACHE", null);
  }

  get matches(): Parser<TContext> {
    return new Alternative([
      new NonTerminal(this, "BYPASS", null, () => true),
      new LiteralTerminal("", () => false)
    ]);
  }
}
