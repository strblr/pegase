import { Cache, Failures, Warnings } from "../internals";
import {
  Alternative,
  defaultOptions,
  Internals,
  NonTerminal,
  NonTerminalMode,
  Options,
  Text
} from ".";
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
  ) {
    const options = {
      ...defaultOptions(),
      ...partialOptions
    };
    const internals = {
      stack: [],
      failures: new Failures<TContext>(),
      warnings: new Warnings(),
      cache: new Cache<TContext>()
    };
    return new Report<TContext>(
      input,
      this._parse(input, options, internals),
      options,
      internals
    );
  }

  value(
    input: string,
    partialOptions: Partial<Options<TContext>> = defaultOptions()
  ) {
    return this.parse(input, partialOptions).match?.value;
  }

  abstract _parse(
    input: string,
    options: Options<TContext>,
    internals: Internals<TContext>
  ): Match<TContext> | null;

  // Directives

  get omit() {
    return new NonTerminal(this, NonTerminalMode.Bypass, null, () => undefined);
  }

  get raw() {
    return new NonTerminal(
      this,
      NonTerminalMode.Bypass,
      null,
      ({ raw }) => raw
    );
  }

  get children() {
    return new NonTerminal(
      this,
      NonTerminalMode.Bypass,
      null,
      ({ children }) => children
    );
  }

  get count() {
    return new NonTerminal(
      this,
      NonTerminalMode.Bypass,
      null,
      children => children.length
    );
  }

  get test(): Parser<TContext> {
    return new Alternative([
      new NonTerminal(this, NonTerminalMode.Bypass, null, () => true),
      new Text("", () => false)
    ]);
  }

  get token() {
    return new NonTerminal(this, NonTerminalMode.Token, null);
  }

  get skip() {
    return new NonTerminal(this, NonTerminalMode.Skip, null);
  }

  get noskip() {
    return new NonTerminal(this, NonTerminalMode.NoSkip, null);
  }

  get case() {
    return new NonTerminal(this, NonTerminalMode.Case, null);
  }

  get nocase() {
    return new NonTerminal(this, NonTerminalMode.NoCase, null);
  }

  get memo() {
    return new NonTerminal(this, NonTerminalMode.Cache, null);
  }
}
