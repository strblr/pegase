import { codeFrameColumns } from "@babel/code-frame";
import lineColumn from "line-column";
import joinn from "joinn";
import { groupBy, values, sortBy } from "lodash";
import {
  Failure,
  Internals,
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
        const from = lineReader.fromIndex(chunk[0].from);
        const to = lineReader.fromIndex(chunk[0].to);
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
                      case "LITERAL":
                        return `"${failure.literal}"`;
                      case "REGEX":
                        return failure.pattern.toString();
                      case "BOUND":
                        return failure.bound === "END"
                          ? "end of input"
                          : "start of input";
                      case "TOKEN":
                        return failure.identity
                          ? `token ${failure.identity}`
                          : "unnamed token";
                    }
                  }
                ),
                ", ",
                " or "
              )
          );

        return codeFrameColumns(
          this.input,
          {
            start: { line: from.line, column: from.col },
            end: { line: to.line, column: to.col }
          },
          { message: message.join("\n") }
        );
      })
      .join("\n\n");

    /*const breakInput = (from: number, to: number) =>
      this.input.substring(from, to).replace("\n", "\\n");

    const highlight = (info: string, from: number, to: number) => {
      const before = breakInput(from - 10, from);
      const inner = breakInput(from, to);
      const after = breakInput(to, to + 10);
      const { line, col } = reader.fromIndex(from)!;
      const pointer = `${" ".repeat(before.length)}${"^".repeat(
        inner.length || 1
      )}`;
      return `Line ${line}:${col}: ${info}\n${before}${inner}${after}\n${pointer}`;
    };

    return [...this.warnings, ...this.failures]
      .map(log => {
        let info = "";
        switch (log.type) {
          case "SEMANTIC_WARNING":
          case "SEMANTIC_FAILURE":
            info = log.message;
            break;
          case "TERMINAL_FAILURE":
            info =
              log.terminal === "LITERAL"
                ? `Expected literal "${log.literal}"`
                : log.terminal === "REGEX"
                ? `Expected match with ${log.pattern.toString()}`
                : log.terminal === "BOUND"
                ? `Expected ${log.bound === "START" ? "start" : "end"} of input`
                : "";
            break;
          case "TOKEN_FAILURE":
            info = `Expected token <${log.identity || "anonymous"}>`;
            break;
          case "PREDICATE_FAILURE":
            info = `Predicate failed (should ${
              log.polarity ? "" : "not "
            }have matched)`;
            break;
        }
        info += ` [${log.stack.join(" > ")}]`;
        return highlight(info, log.from, log.to);
      })
      .join("\n");*/
  }
}
