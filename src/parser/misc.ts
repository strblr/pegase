import {
  defaultSkipper,
  defaultTracer,
  FailureType,
  locationGenerator,
  Options
} from "../index.js";

export function buildOptions<Context>(
  input: string,
  defaultOptions?: Partial<Options<Context>>,
  partialOptions?: Partial<Options<Context>>
): Options<Context> {
  input = partialOptions?.input ?? input;
  const startOptions: Options<Context> = {
    input,
    from: 0,
    to: 0,
    complete: true,
    skipper: defaultSkipper,
    skip: true,
    ignoreCase: false,
    tracer: defaultTracer,
    trace: false,
    log: true,
    warnings: [],
    failures: [],
    context: undefined as any,
    at: locationGenerator(input),
    _ffIndex: 0,
    _ffType: null,
    _ffSemantic: null,
    _ffExpectations: [],
    _ffExpect(expected) {
      if (
        this._ffIndex === this.from &&
        this._ffType !== FailureType.Semantic
      ) {
        this._ffType = FailureType.Expectation;
        this._ffExpectations.push(expected);
      } else if (this._ffIndex < this.from) {
        this._ffIndex = this.from;
        this._ffType = FailureType.Expectation;
        this._ffExpectations = [expected];
      }
    },
    _ffFail(message: string) {
      if (this._ffIndex <= this.from) {
        this._ffIndex = this.from;
        this._ffType = FailureType.Semantic;
        this._ffSemantic = message;
      }
    },
    _ffCommit() {
      if (this._ffType !== null) {
        const pos = this.at(this._ffIndex);
        if (this._ffType === FailureType.Expectation)
          this.failures.push({
            from: pos,
            to: pos,
            type: FailureType.Expectation,
            expected: this._ffExpectations
          });
        else
          this.failures.push({
            from: pos,
            to: pos,
            type: FailureType.Semantic,
            message: this._ffSemantic!
          });
        this._ffType = null;
      }
    }
  };
  return Object.assign(startOptions, defaultOptions, partialOptions);
}

export function printIf(condition: unknown, code: string, elseCode = "") {
  return condition ? code : elseCode;
}
