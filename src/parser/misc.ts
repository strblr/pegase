import {
  CompileOptions,
  consoleTracer,
  defaultSkipper,
  FailureType,
  locationGenerator,
  Options
} from "../index.js";

export function buildOptions<Context>(
  input: string,
  partialOptions?: Partial<Options<Context>>
): Options<Context> {
  return Object.assign<Options<Context>, typeof partialOptions>(
    {
      from: 0,
      to: 0,
      complete: true,
      skipper: defaultSkipper,
      skip: true,
      ignoreCase: false,
      tracer: consoleTracer,
      trace: false,
      log: true,
      warnings: [],
      failures: [],
      context: undefined as any,
      at: locationGenerator(input),
      ffIndex: 0,
      ffType: null,
      ffSemantic: null,
      ffExpectations: [],
      ffExpect(expected) {
        if (
          this.ffIndex === this.from &&
          this.ffType !== FailureType.Semantic
        ) {
          this.ffType = FailureType.Expectation;
          this.ffExpectations.push(expected);
        } else if (this.ffIndex < this.from) {
          this.ffIndex = this.from;
          this.ffType = FailureType.Expectation;
          this.ffExpectations = [expected];
        }
      },
      ffFail(message: string) {
        if (this.ffIndex <= this.from) {
          this.ffIndex = this.from;
          this.ffType = FailureType.Semantic;
          this.ffSemantic = message;
        }
      },
      ffCommit() {
        if (this.ffType !== null) {
          const pos = this.at(this.ffIndex);
          if (this.ffType === FailureType.Expectation)
            this.failures.push({
              from: pos,
              to: pos,
              type: FailureType.Expectation,
              expected: this.ffExpectations
            });
          else
            this.failures.push({
              from: pos,
              to: pos,
              type: FailureType.Semantic,
              message: this.ffSemantic!
            });
          this.ffType = null;
        }
      }
    },
    partialOptions
  );
}

export function cond(condition: unknown, code: string, elseCode = "") {
  return condition ? code : elseCode;
}

export function wrap(
  code: string,
  target: string,
  value: string,
  options: CompileOptions
) {
  const saved = options.id.generate();
  return `
    var ${saved} = ${target};
    ${target} = ${value};
    ${code}
    ${target} = ${saved};
  `;
}
