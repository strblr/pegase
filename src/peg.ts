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

export function createPeg() {
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
      { skipper: pegSkipper, context: { plugins: peg.plugins, args } }
    );
    if (!result.success) throw result;
    return result.value;
  }

  peg.plugins = [defaultPlugin];

  peg.addPlugin = (...plugins: Array<Plugin>) => {
    peg.plugins = [...plugins.slice().reverse(), ...peg.plugins];
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
 *   ('|' | '/')? actionParser % ('|' | '/')
 *
 * actionParser:  => Parser
 *   directiveParser actionTagArgument?
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
 *   forwardParser % '%'
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
 *   primaryParser ('?' | '+' | '*' | repetitionRange)?
 *
 * primaryParser:  => Parser
 * | '.'
 * | '$'
 * | 'ε'
 * | '^'
 * | '(' parser ')'
 * | identifier !(directives ':')
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
 *   '{' repetitionCount (',' repetitionCount)? '}'
 *
 * repetitionCount:  => number
 *   numberLiteral | numberTagArgument
 *
 * directives:  => [string, any[]][]
 *   directive*
 *
 * directive:  => [string, any[]]
 *   $directive directiveArguments?
 *
 * directiveArguments:  => any[]
 *   '(' directiveArgument % ',' ')'
 *
 * directiveArgument:  => [any]
 * | identifier
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
        1,
        Infinity
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
          0,
          1
        ),
        buildModulo(
          new ReferenceParser("actionParser"),
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
    "actionParser",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("directiveParser"),
        new RepetitionParser(new ReferenceParser("actionTagArgument"), 0, 1)
      ]),
      ({ directiveParser, actionTagArgument }) => {
        return !actionTagArgument
          ? directiveParser
          : new ActionParser(directiveParser, actionTagArgument);
      }
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
      new RepetitionParser(new ReferenceParser("minusParser"), 1, Infinity),
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
      buildModulo(new ReferenceParser("forwardParser"), new LiteralParser("%")),
      ({ $match }) =>
        ($match.children as Array<Parser>).reduce((acc, sep) =>
          buildModulo(acc, sep)
        )
    )
  ],
  [
    "forwardParser",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(new LiteralParser("...", true), 0, 1),
        new ReferenceParser("captureParser")
      ]),
      ({ captureParser, $match }) => {
        if ($match.children.length === 1) return captureParser;
        return new SequenceParser([
          new ActionParser(
            new RepetitionParser(
              new SequenceParser([
                new PredicateParser(captureParser, false),
                new RegExpParser(/./)
              ]),
              0,
              Infinity
            ),
            () => undefined
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
          0,
          1
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
          0,
          1
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
        new RepetitionParser(
          new OptionsParser([
            new LiteralParser("?", true),
            new LiteralParser("+", true),
            new LiteralParser("*", true),
            new ReferenceParser("repetitionRange")
          ]),
          0,
          1
        )
      ]),
      ({ primaryParser, $match }) => {
        if ($match.children.length === 1) return primaryParser;
        const quantifier = $match.children[1] as
          | "?"
          | "+"
          | "*"
          | [number, number];
        const [min, max] =
          quantifier === "?"
            ? [0, 1]
            : quantifier === "+"
            ? [1, Infinity]
            : quantifier === "*"
            ? [0, Infinity]
            : quantifier;
        return new RepetitionParser(primaryParser, min, max);
      }
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
      new ActionParser(
        new SequenceParser([
          new ReferenceParser("identifier"),
          new PredicateParser(
            new SequenceParser([
              new ReferenceParser("directives"),
              new LiteralParser(":")
            ]),
            false
          )
        ]),
        ({ identifier }) => new ReferenceParser(identifier)
      ),
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
    new TokenParser(new RegExpParser(/[_a-zA-Z][_a-zA-Z0-9]*/), "identifier")
  ],
  [
    "numberLiteral",
    new TokenParser(
      new ActionParser(new RegExpParser(/[0-9]+.?[0-9]*/), ({ $raw }) =>
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
        ({ $value, $options }) => {
          const caster = ($options.context as MetaContext).plugins.find(
            plugin => plugin.castParser?.($value) !== undefined
          );
          if (!caster)
            throw new Error(
              "The tag argument is not castable to Parser, you can add support for it via peg.addPlugin"
            );
          return caster.castParser!($value)!;
        }
      ),
      "castable tag argument"
    )
  ],
  [
    "actionTagArgument",
    new TokenParser(
      new ActionParser(new ReferenceParser("tagArgument"), ({ $value }) => {
        if (typeof $value !== "function")
          throw new Error("The tag argument is not a function");
        return $value;
      }),
      "action tag argument"
    )
  ],
  [
    "numberTagArgument",
    new TokenParser(
      new ActionParser(new ReferenceParser("tagArgument"), ({ $value }) => {
        if (typeof $value !== "number")
          throw new Error("The tag argument is not a number");
        return $value;
      }),
      "number tag argument"
    )
  ],
  [
    "repetitionRange",
    new ActionParser(
      new SequenceParser([
        new LiteralParser("{"),
        new ReferenceParser("repetitionCount"),
        new RepetitionParser(
          new SequenceParser([
            new LiteralParser(","),
            new ReferenceParser("repetitionCount")
          ]),
          0,
          1
        ),
        new LiteralParser("}")
      ]),
      ({
        $match: {
          children: [min, max]
        }
      }) => [min, max ?? min]
    )
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
      new RepetitionParser(new ReferenceParser("directive"), 0, Infinity),
      ({ $match }) => $match.children
    )
  ],
  [
    "directive",
    new ActionParser(
      new SequenceParser([
        new TokenParser(
          new SequenceParser([
            new LiteralParser("@"),
            new ReferenceParser("identifier")
          ]),
          "directive"
        ),
        new RepetitionParser(new ReferenceParser("directiveArguments"), 0, 1)
      ]),
      ({
        $match: {
          children: [directive, args]
        }
      }) => [directive, args ?? []]
    )
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
        new ActionParser(
          new ReferenceParser("identifier"),
          ({ $value }) => new ReferenceParser($value)
        ),
        new ReferenceParser("numberLiteral"),
        new ActionParser(
          new ReferenceParser("stringLiteral"),
          ({ $value: [value] }) => value
        ),
        new ReferenceParser("characterClass"),
        new ReferenceParser("tagArgument")
      ]),
      ({ $value }) => [$value]
    )
  ]
]);

// Default peg tag :

export const peg = createPeg();
