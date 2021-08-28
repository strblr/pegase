import {
  ActionParser,
  CaptureParser,
  CutParser,
  defaultPlugin,
  Directive,
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
    const result = metagrammar.parse(
      chunks.raw.reduce((acc, chunk, index) => acc + `~${index - 1}` + chunk),
      {
        skipper: pegSkipper,
        trace: peg.trace,
        context: { plugins: peg.plugins, args }
      }
    );
    if (!result.success) throw new Error(result.logs());
    return result.value;
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
 *   (identifier directives ':' optionsParser)+
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
 * | '(' parser ')'
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
            new NonTerminalParser("optionsParser")
          ]),
          ({ $children }) => $children
        ),
        [1, Infinity]
      ),
      ({ $context, $children }) =>
        new GrammarParser(
          $children.map(
            ([label, directives, parser]: [
              string,
              Array<[Directive, Array<any>]>,
              Parser
            ]) => {
              if (label.startsWith("$")) {
                label = label.substring(1);
                directives = [
                  ...directives,
                  [
                    resolveDirective(
                      ($context as MetaContext).plugins,
                      "token"
                    ),
                    [spaceCase(label)]
                  ]
                ];
              }
              return [label, pipeDirectives(parser, directives)];
            }
          )
        )
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
      ({ $children }) =>
        $children.length === 1 ? $children[0] : new OptionsParser($children)
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
      ({ $children }) =>
        $children.length === 1 ? $children[0] : new SequenceParser($children)
    )
  ],
  [
    "minusParser",
    new ActionParser(
      modulo(new NonTerminalParser("moduloParser"), new LiteralParser("-")),
      ({ $children }) =>
        ($children as Array<Parser>).reduce(
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
      ({ $children }) =>
        $children.reduce((acc, rep, index) =>
          index % 2 ? modulo(acc, $children[index + 1], rep) : acc
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
      ({ captureParser, $children }) => {
        if ($children.length === 1) return captureParser;
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
      ({ predicateParser, $children }) =>
        $children.length === 1
          ? predicateParser
          : new CaptureParser(predicateParser, $children[0])
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
      ({ repetitionParser, $children }) =>
        $children.length === 1
          ? repetitionParser
          : new PredicateParser(repetitionParser, $children[0] === "&")
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
        ({ identifier, $context }) =>
          new NonTerminalParser(
            identifier,
            ($context as MetaContext).plugins.find(plugin =>
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
      new ActionParser(new RegExpParser(/[0-9]+\.?[0-9]*/), ({ $raw }) =>
        Number($raw)
      ),
      "number literal"
    )
  ],
  [
    "stringLiteral",
    new TokenParser(
      new OptionsParser([
        new ActionParser(new RegExpParser(/'(?:[^\\']|\\.)*'/), ({ $raw }) => [
          JSON.parse(`"${$raw.substring(1, $raw.length - 1)}"`),
          false
        ]),
        new ActionParser(new RegExpParser(/"(?:[^\\"]|\\.)*"/), ({ $raw }) => [
          JSON.parse($raw),
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
        ({ $raw }) => new RegExp($raw)
      ),
      "character class"
    )
  ],
  [
    "escapedMeta",
    new TokenParser(
      new ActionParser(
        new RegExpParser(/\\[a-zA-Z0-9]+/),
        ({ $raw }) => new RegExp($raw)
      ),
      "escaped metacharacter"
    )
  ],
  [
    "tagArgument",
    new TokenParser(
      new ActionParser(
        new RegExpParser(/~\d+/),
        ({ $raw, $context }) => $context.args[$raw.substring(1)]
      ),
      "tag argument"
    )
  ],
  [
    "castableTagArgument",
    new TokenParser(
      new ActionParser(
        new NonTerminalParser("tagArgument"),
        ({ tagArgument, $context }) => {
          let parser: Parser | undefined;
          ($context as MetaContext).plugins.some(
            plugin => (parser = plugin.castParser?.(tagArgument))
          );
          if (!parser)
            throw new Error(
              "The tag argument is not castable to Parser, you can add support for it via peg.extend"
            );
          return parser;
        }
      ),
      "castable tag argument"
    )
  ],
  [
    "actionTagArgument",
    new TokenParser(
      new ActionParser(
        new NonTerminalParser("tagArgument"),
        ({ tagArgument }) => {
          if (typeof tagArgument !== "function")
            throw new Error("The tag argument is not a function");
          return tagArgument;
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
        ({ tagArgument }) => {
          if (typeof tagArgument !== "number")
            throw new Error("The tag argument is not a number");
          return tagArgument;
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
                new RepetitionParser(new NonTerminalParser("repetitionCount"), [
                  0,
                  1
                ]),
                ({ repetitionCount }) => repetitionCount ?? Infinity
              )
            ]),
            [0, 1]
          ),
          new LiteralParser("}")
        ]),
        ({
          $match: {
            children: [min, max]
          }
        }) => [min, max ?? min]
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
      ({ $children }) => $children
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
            ({ identifier, $context }) =>
              resolveDirective(($context as MetaContext).plugins, identifier)
          ),
          new ActionParser(
            new RepetitionParser(new NonTerminalParser("directiveArguments"), [
              0,
              1
            ]),
            ({ directiveArguments }) => directiveArguments ?? []
          )
        ]),
        ({ $children }) => $children
      ),
      new ActionParser(
        new NonTerminalParser("actionTagArgument"),
        ({ actionTagArgument, $context }) => [
          resolveDirective(($context as MetaContext).plugins, "action"),
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
      ({ $children }) => $children.flat()
    )
  ],
  [
    "directiveArgument",
    new ActionParser(
      new OptionsParser([
        new NonTerminalParser("nonTerminal"),
        new NonTerminalParser("numberLiteral"),
        new ActionParser(
          new NonTerminalParser("stringLiteral"),
          ({ stringLiteral: [value] }) => value
        ),
        new NonTerminalParser("characterClass"),
        new NonTerminalParser("escapedMeta"),
        new NonTerminalParser("tagArgument")
      ]),
      ({ $value }) => [$value]
    )
  ]
]);

// Default peg tag :

export const peg = createTag();
