import { fallback, Range, Visitor, VisitorValue } from ".";

export class Node<Label extends string = string, Data = any> {
  label: Label;
  data: Data;
  range: Range;

  constructor(label: Label, data: Data, range: Range) {
    this.label = label;
    this.data = data;
    this.range = range;
  }

  accept<
    V extends Visitor<any, { [label in Label]: Data } & Record<string, any>>
  >(visitor: V): VisitorValue<V> {
    const callback = visitor[this.label] ?? visitor[fallback];
    if (!callback) throw new Error(`No visitor entry for ${this.label}`);
    return callback(this.data);
  }
}

// Exemple of how to build Parser:

const n = new Node("test", { a: 1 }, {} as Range);
n.accept({});

type ParserDataMap = {
  repetition: {
    min: number;
    max: number;
    parser: Parser;
  };
  regex: {
    regex: RegExp;
  };
  literal: {
    literal: string;
  };
};

class Parser<
  Label extends keyof ParserDataMap = keyof ParserDataMap
> extends Node<Label, ParserDataMap[Label]> {
  constructor(label: Label, data: ParserDataMap[Label], range: Range) {
    super(label, data, range);
  }
}

const vis: Visitor<string, ParserDataMap> = {
  literal: data => data.toString()
};

const lit = new Parser("literal", { literal: "a" }, {} as Range);

const reg = new Parser("regex", { regex: /a/ }, {} as Range);

const p = new Parser(
  "repetition",
  {
    min: 1,
    max: 2,
    parser: lit
  },
  {} as Range
);

const r = lit.accept(vis);
const w = p.accept(vis);
const z = reg.accept(vis);
