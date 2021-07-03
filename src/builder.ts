import {
  ActionParser,
  AnyParser,
  CaptureParser,
  ContextOf,
  EndEdgeParser,
  GrammarParser,
  LiteralParser,
  OptionsParser,
  ParseOptions,
  Parser,
  ReferenceParser,
  RegExpParser,
  RepetitionParser,
  SemanticAction,
  SequenceParser,
  TokenParser,
  TweakParser,
  ValueOfGrammar,
  ValueOfOptions,
  ValueOfSequence
} from ".";

export function lit<Emit extends boolean, Context>(
  literal: string,
  emit: Emit
): LiteralParser<Emit extends true ? string : undefined, Context>;

export function lit<Context>(regExp: RegExp): RegExpParser<Context>;

export function lit(literal: string | RegExp, emit?: boolean) {
  if (typeof literal === "string")
    return new LiteralParser(literal, emit ?? false);
  return new RegExpParser(literal);
}

export function end<Context>() {
  return new EndEdgeParser<Context>();
}

export function ref<Value, Context>(label: string) {
  return new ReferenceParser<Value, Context>(label);
}

export function or<Parsers extends Array<AnyParser>>(...parsers: Parsers) {
  return new OptionsParser<ValueOfOptions<Parsers>, ContextOf<Parsers[number]>>(
    parsers
  );
}

export function chain<Parsers extends Array<AnyParser>>(...parsers: Parsers) {
  return new SequenceParser<
    ValueOfSequence<Parsers>,
    ContextOf<Parsers[number]>
  >(parsers);
}

export function rules<Rules extends Array<[string, AnyParser]>>(
  ...rules: Rules
) {
  return new GrammarParser<ValueOfGrammar<Rules>, ContextOf<Rules[number][1]>>(
    rules
  );
}

export function token<Value, Context>(
  parser: Parser<Value, Context>,
  alias?: string
) {
  return new TokenParser(parser, alias);
}

export function repeat<Value, Context>(
  parser: Parser<Value, Context>,
  min: number,
  max: number
) {
  return new RepetitionParser<Array<Value>, Context>(parser, min, max);
}

export function tweak<Value, Context>(
  parser: Parser<Value, Context>,
  options: Partial<ParseOptions<Context>>
) {
  return new TweakParser(parser, options);
}

export function capture<Value, Context>(
  parser: Parser<Value, Context>,
  name: string
) {
  return new CaptureParser(parser, name);
}

export function action<Value, PValue, Context>(
  parser: Parser<PValue, Context>,
  action: SemanticAction<Value, PValue, Context>
) {
  return new ActionParser(parser, action);
}
