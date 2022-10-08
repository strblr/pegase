import {
  $children,
  $context,
  $emit,
  $fail,
  $raw,
  ActionParser,
  AlternativeParser,
  BackReferenceParser,
  CaptureParser,
  CutParser,
  defaultExtension,
  Directive,
  EndOfInputParser,
  GrammarParser,
  LiteralParser,
  log,
  modulo,
  NonTerminalParser,
  Parser,
  pegSkipper,
  pipeDirectives,
  PredicateParser,
  RegexParser,
  RepetitionParser,
  resolveCast,
  resolveDirective,
  SequenceParser,
  spaceCase,
  TokenParser
} from ".";

// createTag

export interface TagOptions {
  trace: boolean;
  extensions: Extension[];
}

export interface Extension {
  cast?(arg: any): Parser | undefined;
  directives?: Record<string, Directive>;
}

// This is basically a hack to replace "any" but without an "implicit any" error
// on function parameter destructuration
export type Any =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint
  | object
  | ((...args: any[]) => any);

export function createTag(options?: Partial<TagOptions>) {
  const metaparser = createMetaparser();
  const opts: TagOptions = {
    trace: false,
    extensions: [defaultExtension],
    ...options
  };

  function peg<Context = any>(
    chunks: TemplateStringsArray | string,
    ...args: Any[]
  ): Parser<Context> {
    const result = metaparser.parse(
      typeof chunks === "string"
        ? chunks
        : chunks.raw.reduce(
            (acc, chunk, index) => acc + `~${index - 1}` + chunk
          ),
      {
        skipper: pegSkipper,
        trace: opts.trace,
        context: { extensions: opts.extensions, args }
      }
    );
    if (!result.success) {
      throw new Error(log(result));
    }
    return result.children[0].compile();
  }

  return peg;
}

// createMetaparser

export interface MetaContext {
  extensions: Extension[];
  args: any[];
}

export function createMetaparser(): Parser<MetaContext> {
  const unresolvedDirectiveFail = (directive: string) => {
    $fail(
      `Couldn't resolve directive "${directive}", you can add support for it via peg.extend`
    );
  };

  return new GrammarParser([
    [
      "parser",
      [],
      new AlternativeParser([
        new NonTerminalParser("grammarParser"),
        new NonTerminalParser("optionsParser")
      ])
    ],
    [
      "grammarParser",
      [],
      new ActionParser(
        new RepetitionParser(
          new ActionParser(
            new SequenceParser([
              new NonTerminalParser("identifier"),
              new NonTerminalParser("ruleParameterDefinitions"),
              new NonTerminalParser("directives"),
              new LiteralParser(":"),
              new CutParser(),
              new NonTerminalParser("optionsParser")
            ]),
            () => {
              let [rule, parameters, directives, parser] = $children();
              if (rule.startsWith("$")) {
                const token = resolveDirective($context().extensions, "token");
                if (!token) return unresolvedDirectiveFail("token");
                directives = [
                  ...directives,
                  [token, [spaceCase(rule.substring(1))]]
                ];
              }
              return [rule, parameters, pipeDirectives(parser, directives)];
            }
          ),
          [1, Infinity]
        ),
        () => new GrammarParser($children())
      )
    ],
    [
      "optionsParser",
      [],
      new ActionParser(
        new SequenceParser([
          new RepetitionParser(new LiteralParser("|"), [0, 1]),
          modulo(
            new NonTerminalParser("directiveParser"),
            new LiteralParser("|")
          )
        ]),
        () =>
          $children().length === 1
            ? $children()[0]
            : new AlternativeParser($children())
      )
    ],
    [
      "directiveParser",
      [],
      new ActionParser(
        new SequenceParser([
          new NonTerminalParser("sequenceParser"),
          new NonTerminalParser("directives")
        ]),
        () => pipeDirectives($children()[0], $children()[1])
      )
    ],
    [
      "sequenceParser",
      [],
      new ActionParser(
        new RepetitionParser(new NonTerminalParser("minusParser"), [
          1,
          Infinity
        ]),
        () =>
          $children().length === 1
            ? $children()[0]
            : new SequenceParser($children())
      )
    ],
    [
      "minusParser",
      [],
      new ActionParser(
        modulo(new NonTerminalParser("moduloParser"), new LiteralParser("-")),
        () =>
          ($children() as Parser[]).reduce(
            (acc, not) =>
              new SequenceParser([new PredicateParser(not, false), acc])
          )
      )
    ],
    [
      "moduloParser",
      [],
      new ActionParser(
        modulo(
          new NonTerminalParser("forwardParser"),
          new SequenceParser([
            new LiteralParser("%"),
            new AlternativeParser([
              new NonTerminalParser("repetitionRange"),
              new ActionParser(new LiteralParser(""), () => [0, Infinity])
            ])
          ])
        ),
        () =>
          $children().reduce((acc, rep, index) =>
            index % 2 ? modulo(acc, $children()[index + 1], rep) : acc
          )
      )
    ],
    [
      "forwardParser",
      [],
      new ActionParser(
        new SequenceParser([
          new RepetitionParser(new LiteralParser("...", true), [0, 1]),
          new NonTerminalParser("captureParser")
        ]),
        () => {
          if ($children().length === 1) return $children()[0];
          return new SequenceParser([
            new RepetitionParser(
              new SequenceParser([
                new PredicateParser($children()[1], false),
                new RegexParser(/./)
              ]),
              [0, Infinity]
            ),
            $children()[1]
          ]);
        }
      )
    ],
    [
      "captureParser",
      [],
      new ActionParser(
        new SequenceParser([
          new RepetitionParser(
            new ActionParser(
              new SequenceParser([
                new LiteralParser("<"),
                new RepetitionParser(new LiteralParser("...", true), [0, 1]),
                new AlternativeParser([
                  new NonTerminalParser("identifier"),
                  new ActionParser(new CutParser(), () => null)
                ]),
                new LiteralParser(">")
              ]),
              () =>
                $children().length === 1
                  ? [false, $children()[0]]
                  : [true, $children()[1]]
            ),
            [0, 1]
          ),
          new NonTerminalParser("predicateParser")
        ]),
        () => {
          if ($children().length === 1) return $children()[0];
          let [all, name] = $children()[0];
          if (name === null) {
            if (!($children()[1] instanceof NonTerminalParser))
              return $fail(
                "Auto-captures can only be applied to non-terminals"
              );
            name = $children()[1].rule;
          }
          return new CaptureParser($children()[1], name, all);
        }
      )
    ],
    [
      "predicateParser",
      [],
      new ActionParser(
        new SequenceParser([
          new RepetitionParser(
            new AlternativeParser([
              new LiteralParser("&", true),
              new LiteralParser("!", true)
            ]),
            [0, 1]
          ),
          new NonTerminalParser("repetitionParser")
        ]),
        () =>
          $children().length === 1
            ? $children()[0]
            : new PredicateParser($children()[1], $children()[0] === "&")
      )
    ],
    [
      "repetitionParser",
      [],
      new ActionParser(
        new SequenceParser([
          new NonTerminalParser("primaryParser"),
          new RepetitionParser(new NonTerminalParser("repetitionRange"), [0, 1])
        ]),
        () =>
          $children().length === 1
            ? $children()[0]
            : new RepetitionParser($children()[0], $children()[1])
      )
    ],
    [
      "primaryParser",
      [],
      new AlternativeParser([
        new ActionParser(new LiteralParser("."), () => new RegexParser(/./)),
        new ActionParser(
          new SequenceParser([
            new PredicateParser(new NonTerminalParser("identifier"), false),
            new LiteralParser("$")
          ]),
          () => new EndOfInputParser()
        ),
        new ActionParser(new LiteralParser("ε"), () => new LiteralParser("")),
        new ActionParser(new LiteralParser("^"), () => new CutParser()),
        new SequenceParser([
          new LiteralParser("("),
          new CutParser(),
          new NonTerminalParser("parser"),
          new LiteralParser(")")
        ]),
        new ActionParser(
          new SequenceParser([
            new LiteralParser("\\<"),
            new CutParser(),
            new NonTerminalParser("identifier"),
            new LiteralParser(">")
          ]),
          () => new BackReferenceParser($children()[0])
        ),
        new ActionParser(
          new SequenceParser([
            new LiteralParser("@"),
            new CutParser(),
            new NonTerminalParser("directive")
          ]),
          () => pipeDirectives(new LiteralParser(""), $children())
        ),
        new SequenceParser([
          new PredicateParser(
            new SequenceParser([
              new NonTerminalParser("identifier"),
              new NonTerminalParser("ruleParameterDefinitions"),
              new NonTerminalParser("directives"),
              new LiteralParser(":")
            ]),
            false
          ),
          new NonTerminalParser("nonTerminal")
        ]),
        new ActionParser(
          new NonTerminalParser("numberLiteral"),
          () => new LiteralParser(String($children()[0]))
        ),
        new ActionParser(new NonTerminalParser("stringLiteral"), () => {
          const [value, emit] = $children()[0];
          return new LiteralParser(value, emit);
        }),
        new ActionParser(
          new NonTerminalParser("characterClass"),
          () => new RegexParser($children()[0])
        ),
        new ActionParser(
          new NonTerminalParser("escapedMeta"),
          () => new RegexParser($children()[0])
        ),
        new ActionParser(
          new NonTerminalParser("regexLiteral"),
          () => new RegexParser($children()[0])
        ),
        new NonTerminalParser("castableTagArgument")
      ])
    ],
    [
      "nonTerminal",
      [],
      new ActionParser(
        new SequenceParser([
          new NonTerminalParser("identifier"),
          new NonTerminalParser("ruleParameters")
        ]),
        () => new NonTerminalParser($children()[0], $children()[1])
      )
    ],
    [
      "repetitionRange",
      [],
      new AlternativeParser([
        new ActionParser(new LiteralParser("?"), () => [0, 1]),
        new ActionParser(new LiteralParser("+"), () => [1, Infinity]),
        new ActionParser(new LiteralParser("*"), () => [0, Infinity]),
        new ActionParser(
          new SequenceParser([
            new LiteralParser("{"),
            new NonTerminalParser("value"),
            new RepetitionParser(
              new SequenceParser([
                new LiteralParser(","),
                new ActionParser(
                  new RepetitionParser(new NonTerminalParser("value"), [0, 1]),
                  () => ($children().length === 0 ? Infinity : undefined)
                )
              ]),
              [0, 1]
            ),
            new LiteralParser("}")
          ]),
          () => {
            const [min, max = min] = $children();
            if (typeof min !== "number" || typeof max !== "number")
              return $fail("A repetition range can be defined by numbers only");
            return [min, max];
          }
        )
      ])
    ],
    [
      "ruleParameterDefinitions",
      [],
      new ActionParser(
        new RepetitionParser(
          new SequenceParser([
            defaultExtension.directives!.noskip(new LiteralParser("(")),
            modulo(
              new ActionParser(
                new SequenceParser([
                  new NonTerminalParser("identifier"),
                  new AlternativeParser([
                    new SequenceParser([
                      new LiteralParser("="),
                      new NonTerminalParser("optionsParser")
                    ]),
                    new ActionParser(new CutParser(), () => null)
                  ])
                ]),
                () => $children()
              ),
              new LiteralParser(",")
            ),
            new LiteralParser(")")
          ]),
          [0, 1]
        ),
        () => $children()
      )
    ],
    [
      "ruleParameters",
      [],
      new ActionParser(
        new RepetitionParser(
          new SequenceParser([
            defaultExtension.directives!.noskip(new LiteralParser("(")),
            modulo(
              new AlternativeParser([
                new NonTerminalParser("optionsParser"),
                new ActionParser(new CutParser(), () => null)
              ]),
              new LiteralParser(",")
            ),
            new LiteralParser(")")
          ]),
          [0, 1]
        ),
        () => $children()
      )
    ],
    [
      "directives",
      [],
      new ActionParser(
        new RepetitionParser(new NonTerminalParser("directive"), [0, Infinity]),
        () => $children()
      )
    ],
    [
      "directive",
      [],
      new ActionParser(
        new AlternativeParser([
          new ActionParser(
            new SequenceParser([
              new LiteralParser("@"),
              new CutParser(),
              new NonTerminalParser("identifier"),
              new NonTerminalParser("directiveParameters")
            ]),
            () => $children()
          ),
          new ActionParser(new NonTerminalParser("actionTagArgument"), () => [
            "action",
            $children()
          ])
        ]),
        () => {
          const [name, args] = $children()[0];
          const directive = resolveDirective($context().extensions, name);
          return directive ? [directive, args] : unresolvedDirectiveFail(name);
        }
      )
    ],
    [
      "directiveParameters",
      [],
      new ActionParser(
        new RepetitionParser(
          new SequenceParser([
            defaultExtension.directives!.noskip(new LiteralParser("(")),
            modulo(new NonTerminalParser("value"), new LiteralParser(",")),
            new LiteralParser(")")
          ]),
          [0, 1]
        ),
        () => $children()
      )
    ],
    [
      "value",
      [],
      new AlternativeParser([
        new NonTerminalParser("tagArgument"),
        new ActionParser(
          new NonTerminalParser("stringLiteral"),
          () => $children()[0][0]
        ),
        new NonTerminalParser("numberLiteral"),
        new NonTerminalParser("nonTerminal"),
        new NonTerminalParser("characterClass"),
        new NonTerminalParser("escapedMeta"),
        new NonTerminalParser("regexLiteral")
      ])
    ],
    [
      "identifier",
      [],
      new TokenParser(
        new RegexParser(/(\$?[_a-zA-Z][_a-zA-Z0-9]*)/),
        "identifier"
      )
    ],
    [
      "numberLiteral",
      [],
      new TokenParser(
        new ActionParser(new RegexParser(/[0-9]+\.?[0-9]*/), () =>
          Number($raw())
        ),
        "number literal"
      )
    ],
    [
      "stringLiteral",
      [],
      new TokenParser(
        new AlternativeParser([
          new ActionParser(new RegexParser(/'((?:[^\\']|\\.)*)'/), () => [
            JSON.parse(`"${$children()[0]}"`),
            false
          ]),
          new ActionParser(new RegexParser(/"(?:[^\\"]|\\.)*"/), () => [
            JSON.parse($raw()),
            true
          ])
        ]),
        "string literal"
      )
    ],
    [
      "regexLiteral",
      [],
      new TokenParser(
        new ActionParser(
          new RegexParser(/\/((?:\[[^\]]*]|[^\\\/]|\\.)+)\//),
          () => new RegExp($children()[0])
        ),
        "regex literal"
      )
    ],
    [
      "characterClass",
      [],
      new TokenParser(
        new ActionParser(
          new RegexParser(/\[(?:[^\\\]]|\\.)*]/),
          () => new RegExp($raw())
        ),
        "character class"
      )
    ],
    [
      "escapedMeta",
      [],
      new TokenParser(
        new ActionParser(
          new RegexParser(/\\[a-zA-Z0-9]+/),
          () => new RegExp($raw())
        ),
        "escaped metacharacter"
      )
    ],
    [
      "tagArgument",
      [],
      new TokenParser(
        new ActionParser(new RegexParser(/~(\d+)/), () =>
          $emit([$context().args[$children()[0]]])
        ),
        "tag argument"
      )
    ],
    [
      "castableTagArgument",
      [],
      new TokenParser(
        new ActionParser(
          new NonTerminalParser("tagArgument"),
          () =>
            resolveCast($context().extensions, $children()[0]) ??
            $fail(
              "Couldn't cast value to Parser, you can add support for it via peg.extend"
            )
        ),
        "castable tag argument"
      )
    ],
    [
      "actionTagArgument",
      [],
      new TokenParser(
        new ActionParser(new NonTerminalParser("tagArgument"), () => {
          if (typeof $children()[0] !== "function")
            return $fail("The tag argument is not a function");
          return $children()[0];
        }),
        "action tag argument"
      )
    ]
  ]).compile();
}

// peg

export const peg = createTag();
