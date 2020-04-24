import { codeFrameColumns } from "@babel/code-frame";
import lineColumn from "line-column";
import joinn from "joinn";
import { groupBy, isString, lowerCase, values, sortBy } from "lodash";
import {
  Failure,
  Internals,
  PredicateFailure,
  SemanticFailure,
  SemanticWarning,
  TerminalFailure,
  Warning
} from "../internals";
import { Options } from "../parser";
import { Match } from "../match";

/**
 * class Report
 *
 * Stores a recap of a parsing.
 */

export class Report<TContext> {
  readonly input: string;
  readonly match: Match<TContext> | null;
  readonly warnings: Warning[];
  readonly failures: Failure[];

  constructor(
    input: string,
    match: Match<TContext> | null,
    options: Options<TContext>,
    internals: Internals<TContext>
  ) {
    this.input = input;
    this.match = match;
    this.warnings = internals.warnings.read();
    this.failures = match === null ? internals.failures.read() : [];
  }

  log() {
    const lineReader = lineColumn(this.input);
    const bound = (index: number) =>
      index >= this.input.length ? index - 1 : index;

    const factored = sortBy(
      values(
        groupBy(
          [...this.warnings, ...this.failures],
          ({ from, to }) => `${from}-${to}`
        )
      ),
      chunk => chunk[0].to
    );

    return factored
      .map(chunk => {
        const from = lineReader.fromIndex(bound(chunk[0].from));
        const to = lineReader.fromIndex(bound(chunk[0].to));
        const overflow = chunk[0].to >= this.input.length;

        if (!from || !to) return "";
        const message = [];
        const packed = groupBy(chunk, "type");

        if (packed["SEMANTIC_WARNING"])
          message.push(
            (packed["SEMANTIC_WARNING"] as SemanticWarning[])
              .map(({ message }) => `Warning: ${message}`)
              .join("\n")
          );

        if (packed["TERMINAL_FAILURE"])
          message.push(
            "Failure: Expected " +
              joinn(
                (packed["TERMINAL_FAILURE"] as TerminalFailure[]).map(
                  failure => {
                    switch (failure.terminal) {
                      case "TEXT":
                        return isString(failure.text)
                          ? `"${failure.text}"`
                          : failure.text.toString();
                      case "BOUND":
                        return failure.bound === "END"
                          ? "end of input"
                          : "start of input";
                      case "TOKEN":
                        return failure.identity
                          ? lowerCase(failure.identity)
                          : "unnamed token";
                    }
                  }
                ),
                ", ",
                " or "
              )
          );

        if (packed["PREDICATE_FAILURE"])
          message.push(
            (packed["PREDICATE_FAILURE"] as PredicateFailure[])
              .map(() => "Failure: Predicate failed")
              .join("\n")
          );

        if (packed["SEMANTIC_FAILURE"])
          message.push(
            (packed["SEMANTIC_FAILURE"] as SemanticFailure[])
              .map(({ message }) => `Failure: ${message}`)
              .join("\n")
          );

        return [
          message.join("\n"),
          codeFrameColumns(this.input, {
            start: { line: from.line, column: from.col + (overflow ? 1 : 0) },
            end: { line: to.line, column: to.col + (overflow ? 1 : 0) }
          })
        ].join("\n");
      })
      .join("\n\n");
  }
}
