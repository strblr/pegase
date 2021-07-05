import { Failure, FailureType, Internals, ParseOptions } from ".";

export function extendFlags(regExp: RegExp, flags: string) {
  return new RegExp(regExp, [...new Set([...regExp.flags, ...flags])].join(""));
}

export function preskip<Context>(
  options: ParseOptions<Context>,
  internals: Internals
) {
  if (!options.skip) return options.from;
  const match = options.skipper.exec({ ...options, skip: false }, internals);
  return match && match.to;
}

export function mergeFailures(failures: Array<Failure>) {
  return failures.reduce((failure, current) => {
    if (current.to > failure.to) return current;
    if (current.to < failure.to) return failure;
    if (current.type === FailureType.Semantic) return current;
    if (failure.type === FailureType.Semantic) return failure;
    failure.expected.push(...current.expected);
    return failure;
  });
}

export function flattenModulo<T, S = never>(value: [T, Array<[T] | [S, T]>]) {
  return [
    value[0],
    ...value[1].reduce<Array<T | S>>((acc, elem) => [...acc, ...elem], [])
  ];
}
