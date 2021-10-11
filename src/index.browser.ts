import * as pegase from ".";

if (typeof window !== "undefined") {
  const keys: (keyof typeof pegase)[] = [
    "peg",
    "$from",
    "$to",
    "$children",
    "$value",
    "$raw",
    "$options",
    "$context",
    "$warn",
    "$fail",
    "$expected",
    "$commit",
    "$emit",
    "$node",
    "$visit",
    "$parent"
  ];
  for (const key of keys) (window as any)[key] = pegase[key];
}
