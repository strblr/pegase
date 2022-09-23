import { PredicateParser, RegexParser, TokenParser } from ".";
import { TraceEventType, Tracer } from "..";

export const defaultSkipper = new RegexParser(/\s*/).compile();

export const pegSkipper = new RegexParser(
  /(?:\s|#[^#\r\n]*[#\r\n])*/
).compile();

export const endOfInput = new TokenParser(
  new PredicateParser(new RegexParser(/./), false),
  "end of input"
).compile();

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
