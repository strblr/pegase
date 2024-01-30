export const fallback = Symbol("test");

export type Visitor<
  Value = any,
  DataMap extends Record<string, any> = Record<string, any>
> = {
  [label in keyof DataMap]?: (data: DataMap[label]) => Value;
} & {
  [fallback]?: (data: DataMap[keyof DataMap]) => Value;
};

export type VisitorValue<V extends Visitor> = V extends Visitor<infer Value>
  ? Value
  : never;
