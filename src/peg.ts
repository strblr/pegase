import {
  $children,
  $context,
  $emit,
  $fail,
  $raw,
  $value,
  ActionParser,
  AlternativeParser,
  Any,
  CaptureParser,
  CutParser,
  defaultPlugin,
  LiteralParser,
  MetaContext,
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
  resolveRule,
  SequenceParser,
  spaceCase,
  TokenParser,
  TweakParser
} from "."; // The parser creator factory

// createTag

export function createTag() {
  function peg<Value = any, Context = any>(
    chunks: TemplateStringsArray | string,
    ...args: Any[]
  ): Parser<Value, Context> {
    return _.parser.value(
      typeof chunks === "string"
        ? chunks
        : chunks.raw.reduce(
            (acc, chunk, index) => acc + `~${index - 1}` + chunk
          ),
      {
        skipper: pegSkipper,
        trace: peg.trace,
        context: { plugins: peg.plugins, args, refs: new Set() }
      }
    );
  }

  peg.trace = false;
  peg.plugins = [defaultPlugin];
  return peg;
}

// metagrammar

const _ = {
  parser: new NonTerminalParser("parser"),
  grammarParser: new NonTerminalParser("grammarParser"),
  optionsParser: new NonTerminalParser("optionsParser"),
  directiveParser: new NonTerminalParser("directiveParser"),
  sequenceParser: new NonTerminalParser("sequenceParser"),
  minusParser: new NonTerminalParser("minusParser"),
  moduloParser: new NonTerminalParser("moduloParser"),
  forwardParser: new NonTerminalParser("forwardParser"),
  captureParser: new NonTerminalParser("captureParser"),
  predicateParser: new NonTerminalParser("predicateParser"),
  repetitionParser: new NonTerminalParser("repetitionParser"),
  primaryParser: new NonTerminalParser("primaryParser"),
  repetitionRange: new NonTerminalParser("repetitionRange"),
  directives: new NonTerminalParser("directives"),
  directive: new NonTerminalParser("directive"),
  directiveArguments: new NonTerminalParser("directiveArguments"),
  value: new NonTerminalParser("value"),
  identifier: new NonTerminalParser("identifier"),
  nonTerminal: new NonTerminalParser("nonTerminal"),
  numberLiteral: new NonTerminalParser("numberLiteral"),
  stringLiteral: new NonTerminalParser("stringLiteral"),
  regexLiteral: new NonTerminalParser("regexLiteral"),
  characterClass: new NonTerminalParser("characterClass"),
  escapedMeta: new NonTerminalParser("escapedMeta"),
  tagArgument: new NonTerminalParser("tagArgument"),
  castableTagArgument: new NonTerminalParser("castableTagArgument"),
  actionTagArgument: new NonTerminalParser("actionTagArgument")
};

_.parser.parser = new ActionParser(
  new AlternativeParser([_.grammarParser, _.optionsParser]),
  () => {
    const { plugins, refs } = $context() as MetaContext;
    for (const ref of refs) {
      const definition = resolveRule(plugins, ref.rule);
      if (definition) ref.parser = definition;
      else
        return $fail(
          `Couldn't resolve non-terminal "${ref.rule}", you can define it in a grammar or via peg.extend`
        );
    }
  }
);

_.grammarParser.parser = new ActionParser(
  new RepetitionParser(
    new ActionParser(
      new SequenceParser([
        _.identifier,
        _.directives,
        new LiteralParser(":"),
        new CutParser(),
        _.optionsParser
      ]),
      () => {
        let [rule, directives, parser] = $children();
        if (rule.startsWith("$")) {
          const token = resolveDirective($context().plugins, "token");
          if (!token) return unresolvedDirectiveFail("token");
          rule = rule.substring(1);
          directives.push([token, [spaceCase(rule)]]);
        }
        return [rule, pipeDirectives(parser, directives)];
      }
    ),
    [1, Infinity]
  ),
  () => {
    const { refs } = $context() as MetaContext;
    const rules = $children();
    const mapped = new Map<string, Parser>(rules);
    for (const ref of refs) {
      const definition = mapped.get(ref.rule);
      if (definition) {
        ref.parser = definition;
        refs.delete(ref);
      }
    }
    return new NonTerminalParser(rules[0][0], rules[0][1]);
  }
);

_.optionsParser.parser = new ActionParser(
  new SequenceParser([
    new RepetitionParser(new LiteralParser("|"), [0, 1]),
    modulo(_.directiveParser, new LiteralParser("|"))
  ]),
  () =>
    $children().length === 1
      ? $children()[0]
      : new AlternativeParser($children())
);

_.directiveParser.parser = new ActionParser(
  new SequenceParser([_.sequenceParser, _.directives]),
  () => pipeDirectives($children()[0], $children()[1])
);

_.sequenceParser.parser = new ActionParser(
  new RepetitionParser(_.minusParser, [1, Infinity]),
  () =>
    $children().length === 1 ? $children()[0] : new SequenceParser($children())
);

_.minusParser.parser = new ActionParser(
  modulo(_.moduloParser, new LiteralParser("-")),
  () =>
    ($children() as Parser[]).reduce(
      (acc, not) => new SequenceParser([new PredicateParser(not, false), acc])
    )
);

_.moduloParser.parser = new ActionParser(
  modulo(
    _.forwardParser,
    new SequenceParser([
      new LiteralParser("%"),
      new AlternativeParser([
        _.repetitionRange,
        new ActionParser(new LiteralParser(""), () => [0, Infinity])
      ])
    ])
  ),
  () =>
    $children().reduce((acc, rep, index) =>
      index % 2 ? modulo(acc, $children()[index + 1], rep) : acc
    )
);

_.forwardParser.parser = new ActionParser(
  new SequenceParser([
    new RepetitionParser(new LiteralParser("...", true), [0, 1]),
    _.captureParser
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
);

_.captureParser.parser = new ActionParser(
  new SequenceParser([
    new RepetitionParser(
      new ActionParser(
        new SequenceParser([
          new LiteralParser("<"),
          new RepetitionParser(new LiteralParser("...", true), [0, 1]),
          new AlternativeParser([
            _.identifier,
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
    _.predicateParser
  ]),
  () => {
    if ($children().length === 1) return $children()[0];
    let [all, name] = $children()[0];
    if (name === null) {
      if (!($children()[1] instanceof NonTerminalParser))
        return $fail("Auto-captures can only be applied to non-terminals");
      name = $children()[1].rule;
    }
    return new CaptureParser($children()[1], name, all);
  }
);

_.predicateParser.parser = new ActionParser(
  new SequenceParser([
    new RepetitionParser(
      new AlternativeParser([
        new LiteralParser("&", true),
        new LiteralParser("!", true)
      ]),
      [0, 1]
    ),
    _.repetitionParser
  ]),
  () =>
    $children().length === 1
      ? $children()[0]
      : new PredicateParser($children()[1], $children()[0] === "&")
);

_.repetitionParser.parser = new ActionParser(
  new SequenceParser([
    _.primaryParser,
    new RepetitionParser(_.repetitionRange, [0, 1])
  ]),
  () =>
    $children().length === 1
      ? $children()[0]
      : new RepetitionParser($children()[0], $children()[1])
);

_.primaryParser.parser = new AlternativeParser([
  new ActionParser(new LiteralParser("."), () => new RegexParser(/./)),
  new ActionParser(
    new SequenceParser([
      new PredicateParser(_.identifier, false),
      new LiteralParser("$")
    ]),
    () =>
      new TokenParser(
        new PredicateParser(new RegexParser(/./), false),
        "end of input"
      )
  ),
  new ActionParser(new LiteralParser("ε"), () => new LiteralParser("")),
  new ActionParser(new LiteralParser("^"), () => new CutParser()),
  new SequenceParser([
    new LiteralParser("("),
    new CutParser(),
    _.optionsParser,
    new LiteralParser(")")
  ]),
  new ActionParser(
    new SequenceParser([
      new LiteralParser(">"),
      new CutParser(),
      _.identifier,
      new LiteralParser("<")
    ]),
    () => {
      const name = $children()[0];
      const parser = new LiteralParser("");
      return new TweakParser(parser, options => {
        parser.reset(options.captures[name]);
        return match => match;
      });
    }
  ),
  new ActionParser(
    new SequenceParser([
      _.nonTerminal,
      new PredicateParser(
        new SequenceParser([_.directives, new LiteralParser(":")]),
        false
      )
    ]),
    () => {
      $context().refs.add($children()[0]);
    }
  ),
  new ActionParser(
    _.numberLiteral,
    () => new LiteralParser(String($children()[0]))
  ),
  new ActionParser(_.stringLiteral, () => {
    const [value, emit] = $children()[0];
    return new LiteralParser(value, emit);
  }),
  new ActionParser(_.characterClass, () => new RegexParser($children()[0])),
  new ActionParser(_.escapedMeta, () => new RegexParser($children()[0])),
  new ActionParser(_.regexLiteral, () => new RegexParser($children()[0])),
  _.castableTagArgument
]);

_.repetitionRange.parser = new AlternativeParser([
  new ActionParser(new LiteralParser("?"), () => [0, 1]),
  new ActionParser(new LiteralParser("+"), () => [1, Infinity]),
  new ActionParser(new LiteralParser("*"), () => [0, Infinity]),
  new ActionParser(
    new SequenceParser([
      new LiteralParser("{"),
      _.value,
      new RepetitionParser(
        new SequenceParser([
          new LiteralParser(","),
          new ActionParser(new RepetitionParser(_.value, [0, 1]), () =>
            $children().length === 0 ? Infinity : undefined
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
]);

_.directives.parser = new ActionParser(
  new RepetitionParser(_.directive, [0, Infinity]),
  () => $children()
);

_.directive.parser = new ActionParser(
  new AlternativeParser([
    new ActionParser(
      new SequenceParser([
        new LiteralParser("@"),
        new CutParser(),
        _.identifier,
        _.directiveArguments
      ]),
      () => $children()
    ),
    new ActionParser(_.actionTagArgument, () => ["action", $children()]),
    new SequenceParser([
      new LiteralParser("=>"),
      new ActionParser(_.value, () =>
        typeof $children()[0] !== "string"
          ? $fail("A node label can only be a string")
          : ["node", $children()]
      )
    ])
  ]),
  () => {
    const [name, args] = $children()[0];
    const directive = resolveDirective($context().plugins, name);
    return directive ? [directive, args] : unresolvedDirectiveFail(name);
  }
);

_.directiveArguments.parser = new ActionParser(
  new RepetitionParser(
    new SequenceParser([
      new LiteralParser("("),
      modulo(_.value, new LiteralParser(",")),
      new LiteralParser(")")
    ]),
    [0, 1]
  ),
  () => $children()
);

_.value.parser = new AlternativeParser([
  _.tagArgument,
  new ActionParser(_.stringLiteral, () => $children()[0][0]),
  _.numberLiteral,
  new ActionParser(_.nonTerminal, () => {
    $context().refs.add($children()[0]);
  }),
  _.characterClass,
  _.escapedMeta,
  _.regexLiteral
]);

_.identifier.parser = new TokenParser(
  new RegexParser(/(\$?[_a-zA-Z][_a-zA-Z0-9]*)/),
  "identifier"
);

_.nonTerminal.parser = new TokenParser(
  new ActionParser(_.identifier, () => new NonTerminalParser($children()[0])),
  "non-terminal"
);

_.numberLiteral.parser = new TokenParser(
  new ActionParser(new RegexParser(/[0-9]+\.?[0-9]*/), () => Number($raw())),
  "number literal"
);

_.stringLiteral.parser = new TokenParser(
  new AlternativeParser([
    new ActionParser(new RegexParser(/'((?:[^\\']|\\.)*)'/), () => [
      JSON.parse(`"${$value()}"`),
      false
    ]),
    new ActionParser(new RegexParser(/"(?:[^\\"]|\\.)*"/), () => [
      JSON.parse($raw()),
      true
    ])
  ]),
  "string literal"
);

_.regexLiteral.parser = new TokenParser(
  new ActionParser(
    new RegexParser(/\/((?:\[[^\]]*]|[^\\\/]|\\.)+)\//),
    () => new RegExp($children()[0])
  ),
  "regex literal"
);

_.characterClass.parser = new TokenParser(
  new ActionParser(
    new RegexParser(/\[(?:[^\\\]]|\\.)*]/),
    () => new RegExp($raw())
  ),
  "character class"
);

_.escapedMeta.parser = new TokenParser(
  new ActionParser(new RegexParser(/\\[a-zA-Z0-9]+/), () => new RegExp($raw())),
  "escaped metacharacter"
);

_.tagArgument.parser = new TokenParser(
  new ActionParser(new RegexParser(/~(\d+)/), () =>
    $emit([$context().args[$children()[0]]])
  ),
  "tag argument"
);

_.castableTagArgument.parser = new TokenParser(
  new ActionParser(
    _.tagArgument,
    () =>
      resolveCast($context().plugins, $children()[0]) ??
      $fail(
        "Couldn't cast value to Parser, you can add support for it via peg.extend"
      )
  ),
  "castable tag argument"
);

_.actionTagArgument.parser = new TokenParser(
  new ActionParser(_.tagArgument, () => {
    if (typeof $children()[0] !== "function")
      return $fail("The tag argument is not a function");
    return $children()[0];
  }),
  "action tag argument"
);

function unresolvedDirectiveFail(directive: string) {
  $fail(
    `Couldn't resolve directive "${directive}", you can add support for it via peg.extend`
  );
}

// peg

export const peg = createTag();
