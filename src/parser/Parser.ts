import { Cache, Failures, Internals, Warnings } from "../internals";
import { Alternative, defaultOptions, NonTerminal, Options, Text } from ".";
import { Match, SemanticAction } from "../match";
import { Report } from "../report";

export abstract class Parser<TContext> {
  protected readonly action: SemanticAction<TContext> | null;

  protected constructor(action?: SemanticAction<TContext>) {
    this.action = action ?? null;
  }

  parse(
    input: string,
    partialOptions: Partial<Options<TContext>> = defaultOptions()
  ): Report<TContext> {
    const options = {
      ...defaultOptions(),
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

  value<TValue = any>(
    input: string,
    options: Partial<Options<TContext>> = defaultOptions()
  ): TValue {
    const report = this.parse(input, options);
    if (report.match) return report.match.value;
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

  get children() {
    return new NonTerminal(this, "BYPASS", null, ({ children }) => children);
  }

  get count() {
    return new NonTerminal(this, "BYPASS", null, children => children.length);
  }

  get test(): Parser<TContext> {
    return new Alternative([
      new NonTerminal(this, "BYPASS", null, () => true),
      new Text("", () => false)
    ]);
  }

  get token() {
    return new NonTerminal(this, "TOKEN", null);
  }

  get skip() {
    return new NonTerminal(this, "SKIP", null);
  }

  get noskip() {
    return new NonTerminal(this, "NOSKIP", null);
  }

  get case() {
    return new NonTerminal(this, "CASE", null);
  }

  get nocase() {
    return new NonTerminal(this, "NOCASE", null);
  }

  get memo() {
    return new NonTerminal(this, "CACHE", null);
  }
}
