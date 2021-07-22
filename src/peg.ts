import {
  ActionParser,
  actionRef,
  any,
  buildModulo,
  CaptureParser,
  charClass,
  CutParser,
  defaultPlugin,
  directive,
  endAnchor,
  eps,
  GrammarParser,
  id,
  int,
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
  SemanticAction,
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

/** The peg meta-grammar
 *
 * # Main rules :
 *
 * peg:
 *   parser $
 *
 * parser:
 *   grammar | options
 *
 * grammar:
 *   (identifier directives ':' options)+
 *
 * options:
 *   ('|' | '/')? action % ('|' | '/')
 *
 * action:
 *   directive actionArgument?
 *
 * directive:
 *   sequence directives
 *
 * sequence:
 *   minus+
 *
 * minus:
 *   modulo % '-'
 *
 * modulo:
 *   forward % '%'
 *
 * forward:
 *   '...'? capture
 *
 * capture:
 *   ('<' identifier '>')? predicate
 *
 * predicate:
 *   ('&' | '!')? repetition
 *
 * repetition:
 *   primary ('?' | '+' | '*' | repetitionRange)?
 *
 * primary:
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
 *   '(' directiveArgument (',' directiveArgument)* ')'
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
  ["peg", new SequenceParser([new ReferenceParser("parser"), endAnchor])],
  [
    "parser",
    new OptionsParser([
      new ReferenceParser("grammar"),
      new ReferenceParser("options")
    ])
  ],
  [
    "grammar",
    new ActionParser(
      new RepetitionParser(
        new ActionParser(
          new SequenceParser([
            id,
            new ReferenceParser("directives"),
            new LiteralParser(":"),
            new ReferenceParser("options")
          ]),
          ({ $match }) => $match.children
        ),
        1,
        Infinity
      ),
      ({ $options, $match }) =>
        new GrammarParser(
          $match.children.map(
            ([label, directives, parser]: [string, Array<string>, Parser]) => [
              label,
              pipeDirectives(
                ($options.context as MetaContext).directives,
                parser,
                directives,
                label
              )
            ]
          )
        )
    )
  ],
  [
    "options",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(
          new OptionsParser([new LiteralParser("|"), new LiteralParser("/")]),
          0,
          1
        ),
        buildModulo(
          new ReferenceParser("action"),
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
    "action",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("directive"),
        new RepetitionParser(actionRef, 0, 1)
      ]),
      ({ directive, $options, $match }) => {
        const action: number | undefined = $match.children[1];
        return action === undefined
          ? directive
          : new ActionParser(
              directive,
              ($options.context as MetaContext).args[action] as SemanticAction
            );
      }
    )
  ],
  [
    "directive",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("sequence"),
        new ReferenceParser("directives")
      ]),
      ({ sequence, directives, $options }) => {
        return pipeDirectives(
          ($options.context as MetaContext).directives,
          sequence,
          directives
        );
      }
    )
  ],
  [
    "sequence",
    new ActionParser(
      new RepetitionParser(new ReferenceParser("minus"), 1, Infinity),
      ({ $match }) =>
        $match.children.length === 1
          ? $match.children[0]
          : new SequenceParser($match.children)
    )
  ],
  [
    "minus",
    new ActionParser(
      buildModulo(new ReferenceParser("modulo"), new LiteralParser("-")),
      ({ $match }) =>
        ($match.children as Array<Parser>).reduce(
          (acc, not) =>
            new SequenceParser([new PredicateParser(not, false), acc])
        )
    )
  ],
  [
    "modulo",
    new ActionParser(
      buildModulo(new ReferenceParser("forward"), new LiteralParser("%")),
      ({ $match }) =>
        ($match.children as Array<Parser>).reduce((acc, sep) =>
          buildModulo(acc, sep)
        )
    )
  ],
  [
    "forward",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(new LiteralParser("...", true), 0, 1),
        new ReferenceParser("capture")
      ]),
      ({ capture, $match }) => {
        if ($match.children.length === 1) return capture;
        return new SequenceParser([
          new ActionParser(
            new RepetitionParser(
              new SequenceParser([new PredicateParser(capture, false), any]),
              0,
              Infinity
            ),
            () => undefined
          ),
          capture
        ]);
      }
    )
  ],
  [
    "capture",
    new ActionParser(
      new SequenceParser([
        new RepetitionParser(
          new SequenceParser([
            new LiteralParser("<"),
            id,
            new LiteralParser(">")
          ]),
          0,
          1
        ),
        new ReferenceParser("predicate")
      ]),
      ({ predicate, $match }) =>
        $match.children.length === 1
          ? predicate
          : new CaptureParser(predicate, $match.children[0])
    )
  ],
  [
    "predicate",
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
        new ReferenceParser("repetition")
      ]),
      ({ repetition, $match }) =>
        $match.children.length === 1
          ? repetition
          : new PredicateParser(repetition, $match.children[0] === "&")
    )
  ],
  [
    "repetition",
    new ActionParser(
      new SequenceParser([
        new ReferenceParser("primary"),
        new RepetitionParser(
          new OptionsParser([
            new LiteralParser("?", true),
            new LiteralParser("+", true),
            new LiteralParser("*", true),
            new SequenceParser([
              new LiteralParser("{"),
              int,
              new RepetitionParser(
                new SequenceParser([new LiteralParser(","), int]),
                0,
                1
              ),
              new LiteralParser("}")
            ])
          ]),
          0,
          1
        )
      ]),
      ({ primary, $match }) => {
        if ($match.children.length === 1) return primary;
        const [, ...quantifier] = $match.children as [
          any,
          ...(["?" | "+" | "*" | number] | [number, number])
        ];
        const [min, max] =
          quantifier[0] === "?"
            ? [0, 1]
            : quantifier[0] === "+"
            ? [1, Infinity]
            : quantifier[0] === "*"
            ? [0, Infinity]
            : [quantifier[0], quantifier[1] ?? quantifier[0]];
        return new RepetitionParser(primary, min, max);
      }
    )
  ],
  [
    "primary",
    new OptionsParser([
      new ActionParser(
        new ReferenceParser("templateArgument"),
        ({ $value, $expected }) => {
          if (typeof $value === "number")
            return new LiteralParser($value.toString());
          if (typeof $value === "string") return new LiteralParser($value);
          if ($value instanceof RegExp) return new RegExpParser($value);
          if ($value instanceof Parser) return $value;
          $expected([
            "number argument",
            "string argument",
            "regexp argument",
            "parser argument"
          ]);
        }
      ),
      new ActionParser(
        new ReferenceParser("numberLiteral"),
        ({ $value }) => new LiteralParser($value.toString())
      ),
      new ActionParser(
        new ReferenceParser("stringLiteral"),
        ({ $value: [value, emit] }) => new LiteralParser(value, emit)
      ),
      new ActionParser(charClass, ({ $value }) => new RegExpParser($value)),
      new ActionParser(int, ({ $value, $options }) => {
        const arg = ($options.context as MetaContext).args[$value] as Exclude<
          PegTemplateArg,
          SemanticAction
        >;
        if (typeof arg === "string") return new LiteralParser(arg);
        if (arg instanceof RegExp) return new RegExpParser(arg);
        return arg;
      }),
      new ActionParser(
        new SequenceParser([
          id,
          new PredicateParser(
            new SequenceParser([
              new ReferenceParser("directives"),
              new LiteralParser(":")
            ]),
            false
          )
        ]),
        ({ $value }) => new ReferenceParser($value)
      ),
      new ActionParser(
        new SequenceParser([
          new LiteralParser("("),
          new ReferenceParser("parser"),
          new LiteralParser(")")
        ]),
        ({ parser }) => parser
      ),
      new ActionParser(new LiteralParser("."), () => any),
      new ActionParser(new LiteralParser("$"), () => endAnchor),
      new ActionParser(new LiteralParser("ε"), () => eps),
      new ActionParser(new LiteralParser("^"), () => new CutParser())
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
            plugin => plugin.castArgument?.($value) !== undefined
          );
          if (!caster)
            throw new Error(
              "The tag argument is not castable to Parser, you can add support for it via plugins"
            );
          return caster.castArgument!($value)!;
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
          throw new Error(
            "The tag argument is not a semantic action (function)"
          );
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
        new ReferenceParser("directiveArgument"),
        new RepetitionParser(
          new SequenceParser([
            new LiteralParser(","),
            new ReferenceParser("directiveArgument")
          ]),
          0,
          Infinity
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
