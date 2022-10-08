import { Location, Options, Range } from "../index.js";

// Trace events

export enum TraceEventType {
  Enter = "ENTER",
  Match = "MATCH",
  Fail = "FAIL"
}

export type TraceEvent<Context = any> =
  | EnterEvent<Context>
  | MatchEvent<Context>
  | FailEvent<Context>;

export interface EnterEvent<Context = any> extends TraceCommon<Context> {
  type: TraceEventType.Enter;
}

export interface MatchEvent<Context = any> extends Range, TraceCommon<Context> {
  type: TraceEventType.Match;
  children: any[];
}

export interface FailEvent<Context = any> extends TraceCommon<Context> {
  type: TraceEventType.Fail;
}

export interface TraceCommon<Context = any> {
  rule: string;
  at: Location;
  options: Options<Context>;
}

// Tracer signature

export type Tracer<Context = any> = (event: TraceEvent<Context>) => void;

/**
 * A generic predefined tracer to quickly debug a grammar
 * @param event
 */

export const defaultTracer: Tracer = event => {
  const { at } = event;
  let adjective = "";
  let complement = "";
  switch (event.type) {
    case TraceEventType.Enter:
      adjective = "Entered";
      complement = `at (${at.line}:${at.column})`;
      break;
    case TraceEventType.Match:
      const { from, to } = event;
      adjective = "Matched";
      complement = `from (${from.line}:${from.column}) to (${to.line}:${to.column})`;
      break;
    case TraceEventType.Fail:
      adjective = "Failed";
      complement = `at (${at.line}:${at.column})`;
      break;
  }
  console.log(adjective, `"${event.rule}"`, complement);
};
