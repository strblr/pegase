import {
  ActionParser,
  buildModulo,
  CaptureParser,
  CutParser,
  defaultPlugin,
  GrammarParser,
  LiteralParser,
  MetaContext,
  OptionsParser,
  Parser,
  pegSkipper,
  pipeDirectives,
  Plugin,
  PredicateParser,
  ReferenceParser,
  RegExpParser,
  RepetitionParser,
  SequenceParser,
  TokenParser
} from ".";

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
      chunks.reduce((acc, chunk, index) => acc + `~${index - 1}` + chunk),
      {
        skipper: pegSkipper,
        trace: peg.trace,
        context: { plugins: peg.plugins, args }
      }
    );
    if (!result.success) throw result;
    return result.value;
  }

  peg.trace = false;
  peg.plugins = [defaultPlugin];

  peg.addPlugin = (...plugins: Array<Plugin>) => {
    peg.plugins = [...[...plugins].reverse(), ...peg.plugins];
  };

  peg.removePlugin = (...plugins: Array<Plugin>) => {
    peg.plugins = peg.plugins.filter(plugin => !plugins.includes(plugin));
  };

  return peg;
}

/** The peg metagrammar
 *
 * # Main rules :
 *
 * peg:  => Parser
 *   parser $
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
 * | '$'
 * | 'ε'
 * | '^'
 * | '(' parser ')'
 * | reference !(directives ':')
 * | numberLiteral
 * | stringLiteral
 * | characterClass
 * | castableTagArgument
 *
 *
 * # Secondary bricks :
 *
 * identifier:  => string
 *   $identifier
 *
 * reference:  => Parser
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
 * | '{' repetitionCount %? ',' '}'
 *
 * repetitionCount:  => number
 *   numberLiteral | numberTagArgument
 *
 * directives:  => [string, any[]][]
 *   directive*
 *
 * directive:  => [string, any[]]
 * | $directive directiveArguments?
 * | actionTagArgument
 *
 * directiveArguments:  => any[]
 *   '(' directiveArgument % ',' ')'
 *
 * directiveArgument:  => [any]
 * | reference
 * | numberLiteral
 * | stringLiteral
 * | characterClass
 * | tagArgument
 */

const metagrammar: Parser<Parser, MetaContext> = new GrammarParser([
  // Main rules :
  [
    "peg",
    new SequenceParser([
      new ReferenceParser("parser"),
      new TokenParser(
        new PredicateParser(new RegExpParser(/./), false),
        "end of input"
      )
    ])
  ],
  [
    "parser",
    new OptionsParser([
      new ReferenceParser("grammarParser"),
      new ReferenceParser("optionsParser")
    ])
  ],
  [
    "grammarParser",
    new ActionParser(
      new RepetitionParser(
        new ActionParser(
          new SequenceParser([
            new ReferenceParser("identifier"),
            new ReferenceParser("directives"),
            new LiteralParser(":"),
            new ReferenceParser("optionsParser")
          ]),
          ({ $match }) => $match.children
        ),
        [1, Infinity]
      ),
      ({ $options, $match }) =>
        new GrammarParser(
          $match.children.map(
            ([label, directives, parser]: [
              string,
              Array<[string, Array<any>]>,
              Parser
            ]) => [
              label,
              pipeDirectives(
                ($options.context as MetaContext).plugins,
                parser,
                directives
              )
            ]
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
        buildModulo(
          new ReferenceParser("directiveParser"),
          new OptionsParser([new LiteralParser("|"), new LiteralParser("/")])
        )
      ]),
      ({ $match }) =>
        $match.children.length === 1
          ? $match.children[0]
          : new OptionsParser($match.children)
    )
  ],
  [
    "directiveParser",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("sequenceParser"),
        new ReferenceParser("directives")
      ]),
      ({ sequenceParser, directives, $options }) => {
        return pipeDirectives(
          ($options.context as MetaContext).plugins,
          sequenceParser,
          directives
        );
      }
    )
  ],
  [
    "sequenceParser",
    new ActionParser(
      new RepetitionParser(new ReferenceParser("minusParser"), [1, Infinity]),
      ({ $match }) =>
        $match.children.length === 1
          ? $match.children[0]
          : new SequenceParser($match.children)
    )
  ],
  [
    "minusParser",
    new ActionParser(
      buildModulo(new ReferenceParser("moduloParser"), new LiteralParser("-")),
      ({ $match }) =>
        ($match.children as Array<Parser>).reduce(
          (acc, not) =>
            new SequenceParser([new PredicateParser(not, false), acc])
        )
    )
  ],
  [
    "moduloParser",
    new ActionParser(
      buildModulo(
        new ReferenceParser("forwardParser"),
        new SequenceParser([
          new LiteralParser("%"),
          new OptionsParser([
            new ReferenceParser("repetitionRange"),
            new ActionParser(new LiteralParser(""), () => [0, Infinity])
          ])
        ])
      ),
      ({ $match }) =>
        $match.children.reduce((acc, rep, index) =>
          index % 2 ? buildModulo(acc, $match.children[index + 1], rep) : acc
        )
    )
  ],
  [
    "forwardParser",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(new LiteralParser("...", true), [0, 1]),
        new ReferenceParser("captureParser")
      ]),
      ({ captureParser, $match }) => {
        if ($match.children.length === 1) return captureParser;
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
            new ReferenceParser("identifier"),
            new LiteralParser(">")
          ]),
          [0, 1]
        ),
        new ReferenceParser("predicateParser")
      ]),
      ({ predicateParser, $match }) =>
        $match.children.length === 1
          ? predicateParser
          : new CaptureParser(predicateParser, $match.children[0])
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
        new ReferenceParser("repetitionParser")
      ]),
      ({ repetitionParser, $match }) =>
        $match.children.length === 1
          ? repetitionParser
          : new PredicateParser(repetitionParser, $match.children[0] === "&")
    )
  ],
  [
    "repetitionParser",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("primaryParser"),
        new RepetitionParser(new ReferenceParser("repetitionRange"), [0, 1])
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
        new LiteralParser("$"),
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
        new ReferenceParser("parser"),
        new LiteralParser(")")
      ]),
      new SequenceParser([
        new ReferenceParser("reference"),
        new PredicateParser(
          new SequenceParser([
            new ReferenceParser("directives"),
            new LiteralParser(":")
          ]),
          false
        )
      ]),
      new ActionParser(
        new ReferenceParser("numberLiteral"),
        ({ numberLiteral }) => new LiteralParser(String(numberLiteral))
      ),
      new ActionParser(
        new ReferenceParser("stringLiteral"),
        ({ stringLiteral: [value, emit] }) => new LiteralParser(value, emit)
      ),
      new ActionParser(
        new ReferenceParser("characterClass"),
        ({ characterClass }) => new RegExpParser(characterClass)
      ),
      new ReferenceParser("castableTagArgument")
    ])
  ],
  // Secondary bricks :

  [
    "identifier",
    new TokenParser(new RegExpParser(/([_a-zA-Z][_a-zA-Z0-9]*)/), "identifier")
  ],
  [
    "reference",
    new TokenParser(
      new ActionParser(
        new ReferenceParser("identifier"),
        ({ identifier, $options }) =>
          new ReferenceParser(
            identifier,
            ($options.context as MetaContext).plugins.find(plugin =>
              (plugin.grammar as GrammarParser | undefined)?.rules?.get(
                identifier
              )
            )?.grammar
          )
      ),
      "reference"
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
    "tagArgument",
    new TokenParser(
      new ActionParser(
        new RegExpParser(/~\d+/),
        ({ $raw, $options }) => $options.context.args[$raw.substring(1)]
      ),
      "tag argument"
    )
  ],
  [
    "castableTagArgument",
    new TokenParser(
      new ActionParser(
        new ReferenceParser("tagArgument"),
        ({ tagArgument, $options }) => {
          let parser: Parser | undefined;
          ($options.context as MetaContext).plugins.some(
            plugin => (parser = plugin.castParser?.(tagArgument))
          );
          if (!parser)
            throw new Error(
              "The tag argument is not castable to Parser, you can add support for it via peg.addPlugin"
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
        new ReferenceParser("tagArgument"),
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
        new ReferenceParser("tagArgument"),
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
          buildModulo(
            new ReferenceParser("repetitionCount"),
            new LiteralParser(","),
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
      new ReferenceParser("numberLiteral"),
      new ReferenceParser("numberTagArgument")
    ])
  ],
  [
    "directives",
    new ActionParser(
      new RepetitionParser(new ReferenceParser("directive"), [0, Infinity]),
      ({ $match }) => $match.children
    )
  ],
  [
    "directive",
    new OptionsParser([
      new ActionParser(
        new SequenceParser([
          new TokenParser(
            new SequenceParser([
              new LiteralParser("@"),
              new ReferenceParser("identifier")
            ]),
            "directive"
          ),
          new RepetitionParser(new ReferenceParser("directiveArguments"), [
            0,
            1
          ])
        ]),
        ({ identifier, directiveArguments }) => [
          identifier,
          directiveArguments ?? []
        ]
      ),
      new ActionParser(
        new ReferenceParser("actionTagArgument"),
        ({ actionTagArgument }) => ["action", [actionTagArgument]]
      )
    ])
  ],
  [
    "directiveArguments",
    new ActionParser(
      new SequenceParser([
        new LiteralParser("("),
        buildModulo(
          new ReferenceParser("directiveArgument"),
          new LiteralParser(",")
        ),
        new LiteralParser(")")
      ]),
      ({ $match }) => $match.children.flat()
    )
  ],
  [
    "directiveArgument",
    new ActionParser(
      new OptionsParser([
        new ReferenceParser("reference"),
        new ReferenceParser("numberLiteral"),
        new ActionParser(
          new ReferenceParser("stringLiteral"),
          ({ stringLiteral: [value] }) => value
        ),
        new ReferenceParser("characterClass"),
        new ReferenceParser("tagArgument")
      ]),
      ({ $value }) => [$value]
    )
  ]
]);

// Default peg tag :

export const peg = createTag();
