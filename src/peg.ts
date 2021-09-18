import {
  $children,
  $context,
  $fail,
  $raw,
  $value,
  ActionParser,
  CaptureParser,
  CutParser,
  defaultPlugin,
  GrammarParser,
  LiteralParser,
  MetaContext,
  modulo,
  NonTerminalParser,
  OptionsParser,
  Parser,
  pegSkipper,
  pipeDirectives,
  Plugin,
  PredicateParser,
  RegExpParser,
  RepetitionParser,
  resolveCast,
  resolveDirective,
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

  peg.extend = (...plugins: Array<Plugin>) => {
    peg.plugins = [...peg.plugins, ...plugins];
  };

  peg.unextend = (...plugins: Array<Plugin>) => {
    const set = new Set(plugins);
    peg.plugins = peg.plugins.filter(plugin => !set.has(plugin));
  };

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
 *   ('<' identifier '>')? predicateParser
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
 * tagArgument:  => [any]
 *   $tagArgument
 *
 * castableTagArgument:  => Parser
 *   $castableTagArgument
 *
 * actionTagArgument:  => Function
 *   $actionTagArgument
 *
 * numberTagArgument:  => number
 *   $numberTagArgument
 *
 * repetitionRange:  => [number, number]
 * | '?'
 * | '+'
 * | '*'
 * | '{' repetitionCount (',' repetitionCount?)? '}'
 *
 * repetitionCount:  => number
 *   numberLiteral | numberTagArgument
 *
 * directives:  => [function, any[]][]
 *   directive*
 *
 * directive:  => [function, any[]]
 * | $directive directiveArguments?
 * | actionTagArgument
 *
 * directiveArguments:  => any[]
 *   '(' directiveArgument % ',' ')'
 *
 * directiveArgument:  => [any]
 * | nonTerminal
 * | numberLiteral
 * | stringLiteral
 * | characterClass
 * | escapedMeta
 * | tagArgument
 */

const metagrammar: Parser<Parser, MetaContext> = new GrammarParser([
  // Main rules :
  [
    "parser",
    new OptionsParser([
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
              const tokenDir = resolveDirective($context().plugins, "token");
              if (!tokenDir) return;
              directives = [...directives, [tokenDir, [spaceCase(rule)]]];
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
          new OptionsParser([new LiteralParser("|"), new LiteralParser("/")]),
          [0, 1]
        ),
        modulo(
          new NonTerminalParser("directiveParser"),
          new OptionsParser([new LiteralParser("|"), new LiteralParser("/")])
        )
      ]),
      () =>
        $children().length === 1
          ? $children()[0]
          : new OptionsParser($children())
    )
  ],
  [
    "directiveParser",
    new ActionParser(
      new SequenceParser([
        new NonTerminalParser("sequenceParser"),
        new NonTerminalParser("directives")
      ]),
      ({ sequenceParser, directives }) =>
        pipeDirectives(sequenceParser, directives)
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
          new OptionsParser([
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
      ({ captureParser }) => {
        if ($children().length === 1) return captureParser;
        return new SequenceParser([
          new RepetitionParser(
            new SequenceParser([
              new PredicateParser(captureParser, false),
              new RegExpParser(/./)
            ]),
            [0, Infinity]
          ),
          captureParser
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
            new NonTerminalParser("identifier"),
            new LiteralParser(">")
          ]),
          [0, 1]
        ),
        new NonTerminalParser("predicateParser")
      ]),
      ({ predicateParser }) =>
        $children().length === 1
          ? predicateParser
          : new CaptureParser(predicateParser, $children()[0])
    )
  ],
  [
    "predicateParser",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(
          new OptionsParser([
            new LiteralParser("&", true),
            new LiteralParser("!", true)
          ]),
          [0, 1]
        ),
        new NonTerminalParser("repetitionParser")
      ]),
      ({ repetitionParser }) =>
        $children().length === 1
          ? repetitionParser
          : new PredicateParser(repetitionParser, $children()[0] === "&")
    )
  ],
  [
    "repetitionParser",
    new ActionParser(
      new SequenceParser([
        new NonTerminalParser("primaryParser"),
        new RepetitionParser(new NonTerminalParser("repetitionRange"), [0, 1])
      ]),
      ({ primaryParser, repetitionRange }) =>
        !repetitionRange
          ? primaryParser
          : new RepetitionParser(primaryParser, repetitionRange)
    )
  ],
  [
    "primaryParser",
    new OptionsParser([
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
        ({ numberLiteral }) => new LiteralParser(String(numberLiteral))
      ),
      new ActionParser(
        new NonTerminalParser("stringLiteral"),
        ({ stringLiteral: [value, emit] }) => new LiteralParser(value, emit)
      ),
      new ActionParser(
        new NonTerminalParser("characterClass"),
        ({ characterClass }) => new RegExpParser(characterClass)
      ),
      new ActionParser(
        new NonTerminalParser("escapedMeta"),
        ({ escapedMeta }) => new RegExpParser(escapedMeta)
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
        ({ identifier }) =>
          new NonTerminalParser(
            identifier,
            ($context() as MetaContext).plugins.find(plugin =>
              (plugin.grammar as GrammarParser | undefined)?.rules?.get(
                identifier
              )
            )?.grammar
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
      new OptionsParser([
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
      new ActionParser(new RegExpParser(/~(\d+)/), () => [
        $context().args[$value()]
      ]),
      "tag argument"
    )
  ],
  [
    "castableTagArgument",
    new TokenParser(
      new ActionParser(
        new NonTerminalParser("tagArgument"),
        ({ tagArgument: [arg] }) => resolveCast($context().plugins, arg)
      ),
      "castable tag argument"
    )
  ],
  [
    "actionTagArgument",
    new TokenParser(
      new ActionParser(
        new NonTerminalParser("tagArgument"),
        ({ tagArgument: [arg] }) => {
          if (typeof arg !== "function")
            $fail("The tag argument is not a function");
          return arg;
        }
      ),
      "action tag argument"
    )
  ],
  [
    "numberTagArgument",
    new TokenParser(
      new ActionParser(
        new NonTerminalParser("tagArgument"),
        ({ tagArgument: [arg] }) => {
          if (typeof arg !== "number")
            $fail("The tag argument is not a number");
          return arg;
        }
      ),
      "number tag argument"
    )
  ],
  [
    "repetitionRange",
    new OptionsParser([
      new ActionParser(new LiteralParser("?"), () => [0, 1]),
      new ActionParser(new LiteralParser("+"), () => [1, Infinity]),
      new ActionParser(new LiteralParser("*"), () => [0, Infinity]),
      new ActionParser(
        new SequenceParser([
          new LiteralParser("{"),
          new NonTerminalParser("repetitionCount"),
          new RepetitionParser(
            new SequenceParser([
              new LiteralParser(","),
              new ActionParser(
                new RepetitionParser(
                  new NonTerminalParser("repetitionCount"),
                  [0, 1]
                ),
                ({ repetitionCount }) => repetitionCount ?? Infinity
              )
            ]),
            [0, 1]
          ),
          new LiteralParser("}")
        ]),
        () => {
          const [min, max] = $children();
          return [min, max ?? min];
        }
      )
    ])
  ],
  [
    "repetitionCount",
    new OptionsParser([
      new NonTerminalParser("numberLiteral"),
      new NonTerminalParser("numberTagArgument")
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
    new OptionsParser([
      new ActionParser(
        new SequenceParser([
          new ActionParser(
            new TokenParser(
              new SequenceParser([
                new LiteralParser("@"),
                new NonTerminalParser("identifier")
              ]),
              "directive"
            ),
            ({ identifier }) => resolveDirective($context().plugins, identifier)
          ),
          new ActionParser(
            new RepetitionParser(
              new NonTerminalParser("directiveArguments"),
              [0, 1]
            ),
            ({ directiveArguments }) => directiveArguments ?? []
          )
        ]),
        () => $children()
      ),
      new ActionParser(
        new NonTerminalParser("actionTagArgument"),
        ({ actionTagArgument }) => [
          resolveDirective($context().plugins, "action"),
          [actionTagArgument]
        ]
      )
    ])
  ],
  [
    "directiveArguments",
    new ActionParser(
      new SequenceParser([
        new LiteralParser("("),
        modulo(
          new NonTerminalParser("directiveArgument"),
          new LiteralParser(",")
        ),
        new LiteralParser(")")
      ]),
      () => $children().flat()
    )
  ],
  [
    "directiveArgument",
    new OptionsParser([
      new NonTerminalParser("tagArgument"),
      new ActionParser(
        new OptionsParser([
          new NonTerminalParser("nonTerminal"),
          new NonTerminalParser("numberLiteral"),
          new ActionParser(
            new NonTerminalParser("stringLiteral"),
            ({ stringLiteral: [value] }) => value
          ),
          new NonTerminalParser("characterClass"),
          new NonTerminalParser("escapedMeta")
        ]),
        () => [$value()]
      )
    ])
  ]
]);

// Default peg tag :

export const peg = createTag();
