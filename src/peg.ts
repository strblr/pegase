import {
  $children,
  $context,
  $emit,
  $fail,
  $raw,
  $value,
  ActionParser,
  AlternativeParser,
  CaptureParser,
  CutParser,
  defaultPlugin,
  GrammarParser,
  LiteralParser,
  MetaContext,
  modulo,
  NonTerminalParser,
  Parser,
  pegSkipper,
  pipeDirectives,
  PredicateParser,
  RegExpParser,
  RepetitionParser,
  resolveCast,
  resolveDirective,
  resolveFallback,
  SequenceParser,
  spaceCase,
  TokenParser
} from "."; // The parser creator factory

// The parser creator factory

export function createTag() {
  // This is basically a hack to replace "any" but without an "implicit any" error
  // on function parameter destructuration (don't know why, but hey)
  type Any =
    | null
    | undefined
    | string
    | number
    | boolean
    | symbol
    | bigint
    | object
    | ((...args: Array<any>) => any);

  function peg<Value = any, Context = any>(
    chunks: TemplateStringsArray,
    ...args: Array<Any>
  ): Parser<Value, Context> {
    return metagrammar.value(
      chunks.raw.reduce((acc, chunk, index) => acc + `~${index - 1}` + chunk),
      {
        skipper: pegSkipper,
        trace: peg.trace,
        context: { plugins: peg.plugins, args }
      }
    );
  }

  peg.trace = false;
  peg.plugins = [defaultPlugin];
  return peg;
}

/** The peg metagrammar
 *
 * # Main rules :
 *
 * parser:  => Parser
 *   grammarParser | optionsParser
 *
 * grammarParser:  => Parser
 *   (identifier directives ':' ^ optionsParser)+
 *
 * optionsParser:  => Parser
 *   ('|' | '/')? directiveParser % ('|' | '/')
 *
 * directiveParser:  => Parser
 *   sequenceParser directives
 *
 * sequenceParser:  => Parser
 *   minusParser+
 *
 * minusParser:  => Parser
 *   moduloParser % '-'
 *
 * moduloParser:  => Parser
 *   forwardParser % ('%' repetitionRange?)
 *
 * forwardParser:  => Parser
 *   '...'? captureParser
 *
 * captureParser:  => Parser
 *   ('<' identifier? '>')? predicateParser
 *
 * predicateParser:  => Parser
 *   ('&' | '!')? repetitionParser
 *
 * repetitionParser:  => Parser
 *   primaryParser repetitionRange?
 *
 * primaryParser:  => Parser
 * | '.'
 * | '$' - identifier
 * | 'ε'
 * | '^'
 * | '(' ^ parser ')'
 * | nonTerminal !(directives ':')
 * | numberLiteral
 * | stringLiteral
 * | characterClass
 * | escapedMeta
 * | castableTagArgument
 *
 *
 * # Secondary bricks :
 *
 * identifier:  => string
 *   $identifier
 *
 * nonTerminal:  => Parser
 *   identifier
 *
 * numberLiteral:  => number
 *   $number
 *
 * stringLiteral:  => [string, boolean]
 *   $singleQuoteString | $doubleQuoteString
 *
 * characterClass:  => RegExp
 *   $characterClass
 *
 * escapedMeta:  => RegExp
 *   $escapedMeta
 *
 * tagArgument:  => any
 *   $tagArgument
 *
 * castableTagArgument:  => Parser
 *   $castableTagArgument
 *
 * actionTagArgument:  => Function
 *   $actionTagArgument
 *
 * repetitionRange:  => [number, number]
 * | '?'
 * | '+'
 * | '*'
 * | '{' value (',' value?)? '}'
 *
 * directives:  => [function, any[]][]
 *   directive*
 *
 * directive:  => [function, any[]]
 * | '@' ^ identifier directiveArguments
 * | actionTagArgument
 * | '=>' value
 *
 * directiveArguments:  => any[]
 *   ('(' value % ',' ')')?
 *
 * value:  => any
 * | tagArgument
 * | stringLiteral
 * | numberLiteral
 * | nonTerminal
 * | characterClass
 * | escapedMeta
 */

const metagrammar: Parser<Parser, MetaContext> = new GrammarParser([
  // Main rules :
  [
    "parser",
    new AlternativeParser([
      new NonTerminalParser("grammarParser"),
      new NonTerminalParser("optionsParser")
    ])
  ],
  [
    "grammarParser",
    new ActionParser(
      new RepetitionParser(
        new ActionParser(
          new SequenceParser([
            new NonTerminalParser("identifier"),
            new NonTerminalParser("directives"),
            new LiteralParser(":"),
            new CutParser(),
            new NonTerminalParser("optionsParser")
          ]),
          () => {
            let [rule, directives, parser] = $children();
            if (rule.startsWith("$")) {
              rule = rule.substring(1);
              const token = resolveDirective($context().plugins, "token");
              if (!token) return;
              directives = [...directives, [token, [spaceCase(rule)]]];
            }
            return [rule, pipeDirectives(parser, directives)];
          }
        ),
        [1, Infinity]
      ),
      () => new GrammarParser($children())
    )
  ],
  [
    "optionsParser",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(
          new AlternativeParser([
            new LiteralParser("|"),
            new LiteralParser("/")
          ]),
          [0, 1]
        ),
        modulo(
          new NonTerminalParser("directiveParser"),
          new AlternativeParser([
            new LiteralParser("|"),
            new LiteralParser("/")
          ])
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
    new ActionParser(
      new RepetitionParser(new NonTerminalParser("minusParser"), [1, Infinity]),
      () =>
        $children().length === 1
          ? $children()[0]
          : new SequenceParser($children())
    )
  ],
  [
    "minusParser",
    new ActionParser(
      modulo(new NonTerminalParser("moduloParser"), new LiteralParser("-")),
      () =>
        ($children() as Array<Parser>).reduce(
          (acc, not) =>
            new SequenceParser([new PredicateParser(not, false), acc])
        )
    )
  ],
  [
    "moduloParser",
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
              new RegExpParser(/./)
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
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(
          new SequenceParser([
            new LiteralParser("<"),
            new AlternativeParser([
              new NonTerminalParser("identifier"),
              new ActionParser(new CutParser(), () => null)
            ]),
            new LiteralParser(">")
          ]),
          [0, 1]
        ),
        new NonTerminalParser("predicateParser")
      ]),
      () => {
        if ($children().length === 1) return $children()[0];
        let name = $children()[0];
        if (name === null) {
          if (!($children()[1] instanceof NonTerminalParser))
            return $fail("Auto-captures can only be applied to non-terminals");
          name = $children()[1].rule;
        }
        return new CaptureParser($children()[1], name);
      }
    )
  ],
  [
    "predicateParser",
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
    new AlternativeParser([
      new ActionParser(new LiteralParser("."), () => new RegExpParser(/./)),
      new ActionParser(
        new SequenceParser([
          new PredicateParser(new NonTerminalParser("identifier"), false),
          new LiteralParser("$")
        ]),
        () =>
          new TokenParser(
            new PredicateParser(new RegExpParser(/./), false),
            "end of input"
          )
      ),
      new ActionParser(new LiteralParser("ε"), () => new LiteralParser("")),
      new ActionParser(new LiteralParser("^"), () => new CutParser()),
      new SequenceParser([
        new LiteralParser("("),
        new CutParser(),
        new NonTerminalParser("parser"),
        new LiteralParser(")")
      ]),
      new SequenceParser([
        new NonTerminalParser("nonTerminal"),
        new PredicateParser(
          new SequenceParser([
            new NonTerminalParser("directives"),
            new LiteralParser(":")
          ]),
          false
        )
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
        () => new RegExpParser($children()[0])
      ),
      new ActionParser(
        new NonTerminalParser("escapedMeta"),
        () => new RegExpParser($children()[0])
      ),
      new NonTerminalParser("castableTagArgument")
    ])
  ],
  // Secondary bricks :
  [
    "identifier",
    new TokenParser(
      new RegExpParser(/(\$?[_a-zA-Z][_a-zA-Z0-9]*)/),
      "identifier"
    )
  ],
  [
    "nonTerminal",
    new TokenParser(
      new ActionParser(
        new NonTerminalParser("identifier"),
        () =>
          new NonTerminalParser(
            $children()[0],
            resolveFallback($context().plugins, $children()[0])
          )
      ),
      "non-terminal"
    )
  ],
  [
    "numberLiteral",
    new TokenParser(
      new ActionParser(new RegExpParser(/[0-9]+\.?[0-9]*/), () =>
        Number($raw())
      ),
      "number literal"
    )
  ],
  [
    "stringLiteral",
    new TokenParser(
      new AlternativeParser([
        new ActionParser(new RegExpParser(/'((?:[^\\']|\\.)*)'/), () => [
          JSON.parse(`"${$value()}"`),
          false
        ]),
        new ActionParser(new RegExpParser(/"(?:[^\\"]|\\.)*"/), () => [
          JSON.parse($raw()),
          true
        ])
      ]),
      "string literal"
    )
  ],
  [
    "characterClass",
    new TokenParser(
      new ActionParser(
        new RegExpParser(/\[(?:[^\\\]]|\\.)*]/),
        () => new RegExp($raw())
      ),
      "character class"
    )
  ],
  [
    "escapedMeta",
    new TokenParser(
      new ActionParser(
        new RegExpParser(/\\[a-zA-Z0-9]+/),
        () => new RegExp($raw())
      ),
      "escaped metacharacter"
    )
  ],
  [
    "tagArgument",
    new TokenParser(
      new ActionParser(new RegExpParser(/~(\d+)/), () =>
        $emit([$context().args[$children()[0]]])
      ),
      "tag argument"
    )
  ],
  [
    "castableTagArgument",
    new TokenParser(
      new ActionParser(new NonTerminalParser("tagArgument"), () =>
        resolveCast($context().plugins, $children()[0])
      ),
      "castable tag argument"
    )
  ],
  [
    "actionTagArgument",
    new TokenParser(
      new ActionParser(new NonTerminalParser("tagArgument"), () => {
        if (typeof $children()[0] !== "function")
          return $fail("The tag argument is not a function");
        return $children()[0];
      }),
      "action tag argument"
    )
  ],
  [
    "repetitionRange",
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
    "directives",
    new ActionParser(
      new RepetitionParser(new NonTerminalParser("directive"), [0, Infinity]),
      () => $children()
    )
  ],
  [
    "directive",
    new AlternativeParser([
      new ActionParser(
        new SequenceParser([
          new LiteralParser("@"),
          new CutParser(),
          new ActionParser(new NonTerminalParser("identifier"), () =>
            resolveDirective($context().plugins, $children()[0])
          ),
          new NonTerminalParser("directiveArguments")
        ]),
        () => $children()
      ),
      new ActionParser(new NonTerminalParser("actionTagArgument"), () => [
        resolveDirective($context().plugins, "action"),
        $children()
      ]),
      new SequenceParser([
        new LiteralParser("=>"),
        new ActionParser(new NonTerminalParser("value"), () =>
          typeof $children()[0] !== "string"
            ? $fail("A node label can only be a string")
            : [resolveDirective($context().plugins, "node"), $children()]
        )
      ])
    ])
  ],
  [
    "directiveArguments",
    new ActionParser(
      new RepetitionParser(
        new SequenceParser([
          new LiteralParser("("),
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
    new AlternativeParser([
      new NonTerminalParser("tagArgument"),
      new ActionParser(
        new NonTerminalParser("stringLiteral"),
        () => $children()[0][0]
      ),
      new NonTerminalParser("numberLiteral"),
      new NonTerminalParser("nonTerminal"),
      new NonTerminalParser("characterClass"),
      new NonTerminalParser("escapedMeta")
    ])
  ]
]);

// Default peg tag :

export const peg = createTag();
