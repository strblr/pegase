import { Failure, InputRange, Warning } from "../internals";

type Log = Warning | Failure;

type Keyed<T extends Log> = {
  [P in T["type"]]: T extends infer U
    ? T["type"] extends P
      ? U[]
      : never
    : never;
};

type FactoredLogs = InputRange & Readonly<Keyed<Log>>;
