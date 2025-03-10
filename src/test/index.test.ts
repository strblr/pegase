import { expect, test } from "vitest";
import * as competitor from "./competitor.js";
import peg, {
  $children,
  $context,
  $emit,
  $fail,
  $raw,
  $warn,
  ActionParser,
  createMetaparser,
  createTag,
  defaultExtension,
  LiteralParser,
  log,
  RegexParser,
  SuccessResult
} from "../index";
import { format } from "prettier";

function echoBuild(p: any) {
  console.log(format(p.parse.code, { parser: "babel" }));
}

test("The peg tag should work with raw strings", () => {
  /*let a = peg`a: ^ b: ^`;
  let c = peg`
    c @include(${a}): ^
  `;
  echoBuild(c);*/

  const g1 = peg` "My name is \"pegase\"." `;
  const g2 = peg`[\]]`;
  const g3 = peg`\s`;
  expect(g1).toBeInstanceOf(LiteralParser);
  expect((g1 as LiteralParser).literal).toBe('My name is "pegase".');
  expect(g2).toBeInstanceOf(RegexParser);
  expect((g2 as RegexParser).regex.toString()).toBe("/[\\]]/");
  expect(g3).toBeInstanceOf(RegexParser);
  expect((g3 as RegexParser).regex.toString()).toBe("/\\s/");
  expect(g3.test("", { skip: false })).toBe(false);
  expect(g3.test(" ", { skip: false })).toBe(true);
});

test("The peg tag should correctly parse regex literals", () => {
  const g1 = peg`/abc/` as RegexParser;
  const g2 = peg`/a\//` as RegexParser;
  const g3 = peg`/a\\\//` as RegexParser;
  const g4 = peg`/a[ab/cd]b/` as RegexParser;
  const g5 = peg`/[[^()]*|(\(.*?\))]*/` as RegexParser;
  expect(g1.regex.toString()).toBe(/abc/.toString());
  expect(g2.regex.toString()).toBe(/a\//.toString());
  expect(g3.regex.toString()).toBe(/a\\\//.toString());
  expect(g4.regex.toString()).toBe(/a[ab/cd]b/.toString());
  expect(g5.regex.toString()).toBe(/[[^()]*|(\(.*?\))]*/.toString());
});

test("The 'complete' option should work", () => {
  const p = peg`0`;
  expect(p.test(" 0 ")).toBe(true);
  expect(p.test("  0 1 ")).toBe(false);
  expect(p.test(" 0 ", { complete: false })).toBe(true);
  expect(p.test("  0 1 ", { complete: false })).toBe(true);
});

test("Repetition parsers should work", () => {
  const g1 = peg`"a"?`;
  const g2 = peg`"a" +`;
  const g3 = peg`"a"*`;
  const g4 = peg`"a"{3}`;
  const g5 = peg`"a" {2, ${4}}`;
  const g6 = peg`"a"{2,} `;

  const a = (n: number) => [..."a".repeat(n)];

  expect(g1.test("")).toBe(true);
  expect(g1.value("a")).toBe("a");
  expect(g1.children("aa", { complete: false })).toEqual(["a"]);
  expect(g2.test("")).toBe(false);
  expect(g2.value("a")).toBe("a");
  expect(g2.children("aa")).toEqual(a(2));
  expect(g2.children("aaaa")).toEqual(a(4));
  expect(g3.test("")).toBe(true);
  expect(g3.value("a")).toBe("a");
  expect(g3.children("aa")).toEqual(a(2));
  expect(g3.children("aaaa")).toEqual(a(4));
  expect(g4.test("a")).toBe(false);
  expect(g4.test("aa")).toBe(false);
  expect(g4.test("aaa")).toBe(true);
  expect(g4.children("aaaaaa", { complete: false })).toEqual(a(3));
  expect(g5.test("a")).toBe(false);
  expect(g5.test("aa")).toBe(true);
  expect(g5.test("aaa")).toBe(true);
  expect(g5.children("aaaaaa", { complete: false })).toEqual(a(4));
  expect(g6.test("a")).toBe(false);
  expect(g6.test("aa")).toBe(true);
  expect(g6.test("aaa")).toBe(true);
  expect(g6.children("a".repeat(103))).toEqual(a(103));
});

test("Captures should work", () => {
  const g1 = peg`<val>([abc] @raw)`;
  const g2 = peg`${g1}*`;
  const g3 = peg`...<val>("a" | "b"){1} .*`;
  const g4 = peg`<val1>("a" <val2>("b" | "c") "d" @count)`;
  const g5 = peg`a: <val>(<>b) <>c ${({ val, b, c }) =>
    val + c + b} b: "b" c: "c"`;
  const g6 = peg`'a' <val3>(${/(?<val>(?<val1>[bc])(?<val2>[de]))/} @raw) 'f'`;
  const g7 = peg`&(<val>("0" | "1")) ("0" | "1")`;

  // TODO: Add tests to verify scopes of captures

  /*expect((g1.parse("a") as SuccessResult).captures.get("val")).toBe("a");
  expect((g2.parse("abc") as SuccessResult).captures.get("val")).toBe("c");
  expect(
    (g3.parse("#@@@°#§¬ba.aps") as SuccessResult).captures.get("val")
  ).toBe("b");
  expect(g5.value("bc")).toBe("bcb");
  expect((g7.parse("1") as SuccessResult).captures.get("val")).toBe("1");

  const result = g4.parse("acd") as SuccessResult;
  expect(result.captures.get("val1")).toBe(3);
  expect(result.captures.get("val2")).toBe("c");

  const result2 = g6.parse("a ce f") as SuccessResult;
  expect(result2.captures.get("val")).toBe("ce");
  expect(result2.captures.get("val1")).toBe("c");
  expect(result2.captures.get("val2")).toBe("e");
  expect(result2.captures.get("val3")).toBe("ce");*/

  try {
    peg`<>"a"`;
  } catch (e: any) {
    expect(e.message)
      .toBe(`(1:1) Failure: Auto-captures can only be applied to non-terminals

> 1 | <>"a"
    | ^
`);
  }
});

test("The modulo operator should work", () => {
  const i = (n: number) => [..."1".repeat(n)];

  const g1 = peg`"1" % ','`;
  expect(g1.children("1")).toEqual(["1"]);
  expect(g1.children("1,1")).toEqual(i(2));
  expect(g1.children("1 ,1, 1 , 1")).toEqual(i(4));

  const g2 = peg`"1" %? ','`;
  expect(g2.children("1")).toEqual(["1"]);
  expect(g2.children("1,1")).toEqual(i(2));
  expect(g2.children("1 ,1, 1 , 1", { complete: false })).toEqual(i(2));

  const g3 = peg`"1" %{2} ','`;
  expect(g3.test("1")).toBe(false);
  expect(g3.test("1,1")).toBe(false);
  expect(g3.children("1 ,1, 1 , 1", { complete: false })).toEqual(i(3));

  const g4 = peg`("1" % ',' @count) % '|'`;
  expect(g4.test(" 2, 1, 1 | 1")).toBe(false);
  expect(g4.test("  1 ,1,1 |1,1,  1,1|1 |1,1   ")).toBe(true);
  expect(g4.children("1 ,1,1 |1,1, 1  ,   1,1|1 |   1,1 ")).toEqual([
    3, 5, 1, 2
  ]);
});

test("Parametrized rules should work", () => {
  const g = peg`
    root: array | array('a') | array('b' | 'c')
    array(item = \d): '[' commaList(item) ']'
    commaList(item): item % ','
  `;

  expect(g.test("[ a, a, a, a]")).toBe(true); // true
  expect(g.test("[ a, 5, a, a]")).toBe(false); // false
  expect(g.test("[b, c]")).toBe(true); // true
  expect(g.test("[b, a]")).toBe(false); // false
  expect(g.test("[4, 5, 3, 9, 0]")).toBe(true); // true
});

test("Prefix math expressions should be correctly converted to postfix", () => {
  const g = peg`
    expr:
    | $number
    | <>operator <e1>expr <e2>expr ${({ operator, e1, e2 }) =>
      [e1, e2, operator].join(" ")}

    operator:
      "+" | "-" | "*" | "/"
      
    $number @raw:
      [0-9]+
  `;

  expect(g.value("23")).toBe("23");
  expect(g.test("+")).toBe(false);
  expect(g.value("+ 1 2")).toBe("1 2 +");
  expect(g.value("* + 1 2 3")).toBe("1 2 + 3 *");
  expect(g.value("+ - 1 25 * / 369 4 5")).toBe("1 25 - 369 4 / 5 * +");
});

test("The cut operator should work correctly", () => {
  const g1 = peg`'a' 'b' | 'a' 'c' | 'a' 'd'`;
  const g2 = peg`'a' ^ 'b' | 'a' 'c' | 'a' 'd'`;
  const g3 = peg`('a' ^ 'b' | 'a' 'c') | 'a' 'd'`;

  expect(g1.test("ab")).toBe(true);
  expect(g2.test("ab")).toBe(true);
  expect(g3.test("ab")).toBe(true);
  expect(g1.test("ac")).toBe(true);
  expect(g2.test("ac")).toBe(false);
  expect(g3.test("ac")).toBe(false);
  expect(g1.test("ad")).toBe(true);
  expect(g2.test("ad")).toBe(false);
  expect(g3.test("ad")).toBe(true);
});

test("Back references should work correctly", () => {
  const g = peg`<a>(\d @raw) \<a>*`;
  expect(g.test("5")).toBe(true);
  expect(g.test("6 6")).toBe(true);
  expect(g.test("7 7 6")).toBe(false);
  expect(log(g.parse("7 7 6")))
    .toBe(`(1:5) Failure: Expected "7" or end of input

> 1 | 7 7 6
    |     ^
`);
});

test("The extension system should work", () => {
  const custom = createTag({
    extensions: [
      defaultExtension,
      {
        directives: {
          min: parser => peg`${parser} ${() => Math.min(...$children())}`,
          max: parser =>
            new ActionParser(parser, () => Math.max(...$children()))
        }
      }
    ]
  });

  const max = custom`
    list: $int+ @max
    $int: \d+ @number
  `;

  expect(max.value("36 12 42 3")).toBe(42);
});

test("Semantic actions must correctly propagate children (including undefined)", () => {
  const g = peg`(
    | 0 ${() => $emit([undefined])}
    | 1 ${() => 1}
    | 2 ${() => undefined}
  ) % ','`;

  expect(g.children("0,1,1,2,0,0,1,2,0")).toEqual([
    undefined,
    1,
    1,
    undefined,
    undefined,
    1,
    undefined
  ]);
});

test("Tracing should work", () => {
  const g = peg`
    a: b(d)
    b(c): c
    d: 'a'
  `;

  let output = "";
  const saved = console.log;
  console.log = (...args) => (output += args.join(" ") + "\n");
  g.test("a", { trace: true });
  console.log = saved;
  expect(output).toBe(`Entered "a" at (1:1)
Entered "b" at (1:1)
Entered "c" at (1:1)
Entered "d" at (1:1)
Matched "d" from (1:1) to (1:2)
Matched "c" from (1:1) to (1:2)
Matched "b" from (1:1) to (1:2)
Matched "a" from (1:1) to (1:2)
`);

  /*const traced: Array<{
    event: string;
    rule: string;
    at: string;
    from?: string;
    to?: string;
    input: string;
  }> = [];

  const formatLocation = (loc: Location) => `(${loc.line}:${loc.column})`;
  const inputSubstring = (loc: Location) =>
    loc.input.substring(loc.index, loc.index + 8);

  g.test(" a", {
    trace: true,
    tracer(event) {
      const common = { rule: event.rule, at: formatLocation(event.at) };
      switch (event.type) {
        case TraceEventType.Enter:
          traced.push({
            event: "Entered",
            ...common,
            input: inputSubstring(event.at)
          });
          break;
        case TraceEventType.Match:
          traced.push({
            event: "Matched",
            ...common,
            from: formatLocation(event.from),
            to: formatLocation(event.to),
            input: inputSubstring(event.from)
          });
          break;
        case TraceEventType.Fail:
          traced.push({
            event: "Failed",
            ...common,
            input: inputSubstring(event.at)
          });
      }
    }
  });

  console.table(traced, ["event", "rule", "at", "from", "to", "input"]);*/
});

test("L-attributed grammars should be implementable using context", () => {
  const g = peg<number>`
    expr:
      (num ${() => ($context().acc = $children()[0])})
      exprRest
        ${() => $context().acc}
        @context(${{ acc: 0 }})
    
    exprRest:
    | ('-' num ${() => ($context().acc -= $children()[0])})
      exprRest
    | ε
    
    num @number @token("number"):
      [0-9]+
  `;

  expect(g.test("")).toBe(false);
  expect(g.value("5")).toBe(5);
  expect(g.value("42-6")).toBe(36);
  expect(g.value(" 13 - 16 -1")).toBe(-4);
  expect(g.value("61- 20 -14  -  3")).toBe(24);
});

test("Warnings should work correctly", () => {
  const g = peg`
    class:
      'class'
      ($identifier ${() => {
        if (!/^[A-Z]/.test($raw())) $warn("Class names should be capitalized");
      }})
      '{' '}'
    
    $identifier @raw: [a-zA-Z]+
  `;

  expect(log(g.parse("class test {")))
    .toBe(`(1:7) Warning: Class names should be capitalized

> 1 | class test {
    |       ^

(1:13) Failure: Expected "}"

> 1 | class test {
    |             ^
`);
});

test("Grammar fragmentation should work", () => {
  const c = peg`
    c: 'c' d
  `;
  const d = peg`
    d: 'd' a?
  `;
  const g1 = peg`
    @import(${c}, ${d})
    
    a: 'a' b
    b: 'b' c
  `;
  const g2 = peg`
    @import(${c})
    @import(${d})
    
    a: 'a' b
    b: 'b' c
  `;

  expect(g1.test("abc")).toBe(false);
  expect(g1.test("abcd")).toBe(true);
  expect(g1.test("abcdabcc")).toBe(false);
  expect(g1.test("abcdabcd")).toBe(true);
  expect(g2.test("abc")).toBe(false);
  expect(g2.test("abcd")).toBe(true);
  expect(g2.test("abcdabcc")).toBe(false);
  expect(g2.test("abcdabcd")).toBe(true);
});

test("Failure recovery should work", () => {
  const g = peg`
    bitArray: '[' (bit | sync) % ',' ']'
    bit: 0 | 1
    sync: @@commit ...&(',' | ']')
  `;

  const result = g.parse("[1, 0, 1, 3, 0, 1, 2, 1]");

  expect(result.success).toBe(true);
  expect(log(result)).toBe(`(1:11) Failure: Expected "0" or "1"

> 1 | [1, 0, 1, 3, 0, 1, 2, 1]
    |           ^

(1:20) Failure: Expected "0" or "1"

> 1 | [1, 0, 1, 3, 0, 1, 2, 1]
    |                    ^
`);
});

test("Failure heuristic should work correctly", () => {
  const g1 = peg`[a-z]+ ${() => {
    const val = $context().get($raw());
    if (!val) $fail(`Undeclared identifier "${$raw()}"`);
    return val;
  }}`;

  const context = new Map([
    ["foo", 42],
    ["bar", 18]
  ]);

  expect(g1.value("foo", { context })).toBe(42);
  expect(log(g1.parse("baz", { context })))
    .toBe(`(1:1) Failure: Undeclared identifier "baz"

> 1 | baz
    | ^
`);
});

test("Hooks should work correctly", () => {
  const a = peg`"0" ${() => {}}`;
  const b = peg`"1" ${() => {
    a.parse("0");
    $warn("This is a warning");
    return $children()[0];
  }}`;

  const r = b.parse("1") as SuccessResult;
  expect(r.children).toEqual(["1"]);
  expect(log(r)).toBe(`(1:1) Warning: This is a warning

> 1 | 1
    | ^
`);
});

test("Benchmark between Pegase and competitor", () => {
  const lowOp = (left: number, op: string, right: number) => {
    switch (op) {
      case "+":
        return left + right;
      case "-":
        return left - right;
    }
  };

  const highOp = (left: number, op: string, right: number) => {
    switch (op) {
      case "*":
        return left * right;
      case "/":
        return left / right;
    }
  };

  const calc = peg<number>`
    expr: term % ("+" | "-") @infix(${lowOp})
    term: fact % ("*" | "/") @infix(${highOp})
    fact: '(' expr ')' | $integer
    $integer @number: [0-9]+
  `;

  const a = new Date();
  for (let i = 0; i !== 20000; ++i) {
    calc.parse("42");
    calc.parse("42 +  63");
    calc.parse("42 +  63 * (12 / 3)");
  }
  const b = new Date();
  for (let i = 0; i !== 20000; ++i) {
    competitor.parse("42");
    competitor.parse("42 +  63");
    competitor.parse("42 +  63 * (12 / 3)");
  }
  const c = new Date();
  const pegaseTime = b.getTime() - a.getTime();
  const competitorTime = c.getTime() - b.getTime();
  console.log(
    pegaseTime,
    "ms vs.",
    competitorTime,
    "ms |",
    pegaseTime - competitorTime,
    "ms"
  );
});

test("Benchmark of metaparsing", () => {
  const a = new Date();
  for (let i = 0; i !== 1000; ++i) createMetaparser();
  const b = new Date();
  console.log(b.getTime() - a.getTime(), "ms");
});

test("Math expressions should be correctly calculated", () => {
  const doop = (left: number, op: string, right: number) => {
    switch (op) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return left / right;
    }
  };

  const calc = peg<number>`
    expr: operation(term, "+" | "-")
    term: operation(fact, "*" | "/")
    fact: $number | '(' expr ')'
    $number @number:
      '-'? [0-9]+ ('.' [0-9]*)?
      
    operation(operand, operator):
      operand % operator @infix(${doop})
  `;

  expect(calc.value("2 + 3")).toBe(5);
  expect(calc.value("2 * 3")).toBe(6);
  expect(calc.value("2 * -3")).toBe(-6);
  expect(calc.value("89")).toBe(89);
  expect(calc.value("2.53")).toBe(2.53);
  expect(calc.value("-1.2")).toBe(-1.2);
  expect(calc.test("")).toBe(false);
  expect(calc.test("1 +")).toBe(false);
  expect(calc.test("(1 +")).toBe(false);
  expect(calc.value("   12        -  8   ")).toBe(4);
  expect(calc.value("142        -9   ")).toBe(133);
  expect(calc.value("72+  15")).toBe(87);
  expect(calc.value(" 12*  4")).toBe(48);
  expect(calc.value(" 50/10 ")).toBe(5);
  expect(calc.value("2.53")).toBe(2.53);
  expect(calc.value("4*2.5 + 8.5+1.5 / 3.0")).toBe(19);
  expect(calc.value("5.0005 + 0.0095")).toBe(5.01);
  expect(calc.value("67+2")).toBe(69);
  expect(calc.value(" 2-7")).toBe(-5);
  expect(calc.value("5*7")).toBe(35);
  expect(calc.value("8/4")).toBe(2);
  expect(calc.value("2 -4 +6 -1 -1- 0 +8")).toBe(10);
  expect(calc.value("1 -1   + 2   - 2   +  4 - 4 +    6")).toBe(6);
  expect(calc.value(" 2*3 - 4*5 + 6/3 ")).toBe(-12);
  expect(calc.value("2*3*4/8 -   5/2*4 +  6 + 0/3   ")).toBe(-1);
  expect(calc.value("10/4")).toBe(2.5);
  expect(calc.value("5/3")).toBeCloseTo(1.66666);
  expect(calc.value("3 + 8/5 -1 -2*5")).toBeCloseTo(-6.4);
  expect(calc.test("  6  + c")).toBe(false);
  expect(calc.test("  7 & 2")).toBe(false);
  expect(calc.test(" %  ")).toBe(false);
  expect(calc.test(" 5 + + 6")).toBe(false);
  expect(calc.value("5/0")).toBe(Infinity);
  expect(calc.value("(2)")).toBe(2);
  expect(calc.value("(5 + 2*3 - 1 + 7 * 8)")).toBe(66);
  expect(calc.value("(67 + 2 * 3 - 67 + 2/1 - 7)")).toBe(1);
  expect(calc.value("(2) + (17*2-30) * (5)+2 - (8/2)*4")).toBe(8);
  expect(calc.value("(5*7/5) + (23) - 5 * (98-4)/(6*7-42)")).toBe(-Infinity);
  expect(calc.value("(((((5)))))")).toBe(5);
  expect(calc.value("(( ((2)) + 4))*((5))")).toBe(30);
  expect(calc.value("(( ((2)) + 4))*((5)  -1) ")).toBe(24);
  expect(calc.test("2 + (5 * 2")).toBe(false);
  expect(calc.test("(((((4))))")).toBe(false);
  expect(calc.test("((((4)))))")).toBe(false);
  expect(calc.test("((2)) * ((3")).toBe(false);
  expect(
    calc.value(
      " ( (( ( (485.56) -  318.95) *( 486.17/465.96 -  324.49/-122.8 )+ -422.8) * 167.73+-446.4 *-88.31) -271.61/ ( (( 496.31 / ((  -169.3*  453.70) ) )/-52.22 )* (( (-134.9* (-444.1-(( 278.79 * (  -384.5)) ) / (-270.6/  396.89-(  -391.5/150.39-  -422.9 )* -489.2 ) )+-38.02 )) )) )"
    )
  ).toBeCloseTo(71470.126502);
});

test("JSON.parse should be correctly reproduced", () => {
  const json = peg`
    json:
      value $
    
    value:
    | string
    | number
    | 'true' ${() => true}
    | 'false' ${() => false}
    | 'null' ${() => null}
    | '[' (value % ',')? ']' ${() => $children()}
    | '{' ((string ':' value) % ',')? '}'
        ${() => {
          const result: any = {};
          for (let i = 0; i < $children().length; i += 2)
            result[$children()[i]] = $children()[i + 1];
          return result;
        }}
    
    string @token:
      '\"' ([^\"] | '\\'.)* '\"'
        ${() => $raw().substring(1, $raw().length - 1)}
      
    number @token:
      '-'? \d+ ('.' \d*)?
        ${() => Number($raw())}
  `;

  expect(json.value(`"test"`)).toBe("test");
  expect(json.value("true")).toBe(true);
  expect(json.value("null")).toBe(null);
  expect(json.value("[]")).toEqual([]);
  expect(json.value("{}")).toEqual({});
  expect(json.value("[true, null, false]")).toEqual([true, null, false]);
  expect(json.value("[[], {}, [[] ]]")).toEqual([[], {}, [[]]]);
  expect(json.value(`[{ "pi": 3.14 }]`)).toEqual([{ pi: 3.14 }]);
  expect(json.value(`{ "x": {"y" :null }}`)).toEqual({ x: { y: null } });
  expect(json.value(`{"x": 45,"y":false  ,  "z" :[1, "test"] } `)).toEqual({
    x: 45,
    y: false,
    z: [1, "test"]
  });

  const bigSample = `
    {"web-app": {
      "servlet": [   
        {
          "servlet-name": "cofaxCDS",
          "servlet-class": "org.cofax.cds.CDSServlet",
          "init-param": {
            "configGlossary:installationAt": "Philadelphia, PA",
            "configGlossary:adminEmail": "ksm@pobox.com",
            "configGlossary:poweredBy": "Cofax",
            "configGlossary:poweredByIcon": "/images/cofax.gif",
            "configGlossary:staticPath": "/content/static",
            "templateProcessorClass": "org.cofax.WysiwygTemplate",
            "templateLoaderClass": "org.cofax.FilesTemplateLoader",
            "templatePath": "templates",
            "templateOverridePath": "",
            "defaultListTemplate": "listTemplate.htm",
            "defaultFileTemplate": "articleTemplate.htm",
            "useJSP": false,
            "jspListTemplate": "listTemplate.jsp",
            "jspFileTemplate": "articleTemplate.jsp",
            "cachePackageTagsTrack": 200,
            "cachePackageTagsStore": 200,
            "cachePackageTagsRefresh": 60,
            "cacheTemplatesTrack": 100,
            "cacheTemplatesStore": 50,
            "cacheTemplatesRefresh": 15,
            "cachePagesTrack": 200,
            "cachePagesStore": 100,
            "cachePagesRefresh": 10,
            "cachePagesDirtyRead": 10,
            "searchEngineListTemplate": "forSearchEnginesList.htm",
            "searchEngineFileTemplate": "forSearchEngines.htm",
            "searchEngineRobotsDb": "WEB-INF/robots.db",
            "useDataStore": true,
            "dataStoreClass": "org.cofax.SqlDataStore",
            "redirectionClass": "org.cofax.SqlRedirection",
            "dataStoreName": "cofax",
            "dataStoreDriver": "com.microsoft.jdbc.sqlserver.SQLServerDriver",
            "dataStoreUrl": "jdbc:microsoft:sqlserver://LOCALHOST:1433;DatabaseName=goon",
            "dataStoreUser": "sa",
            "dataStorePassword": "dataStoreTestQuery",
            "dataStoreTestQuery": "SET NOCOUNT ON;select test='test';",
            "dataStoreLogFile": "/usr/local/tomcat/logs/datastore.log",
            "dataStoreInitConns": 10,
            "dataStoreMaxConns": 100,
            "dataStoreConnUsageLimit": 100,
            "dataStoreLogLevel": "debug",
            "maxUrlLength": 500}},
        {
          "servlet-name": "cofaxEmail",
          "servlet-class": "org.cofax.cds.EmailServlet",
          "init-param": {
          "mailHost": "mail1",
          "mailHostOverride": "mail2"}},
        {
          "servlet-name": "cofaxAdmin",
          "servlet-class": "org.cofax.cds.AdminServlet"},
     
        {
          "servlet-name": "fileServlet",
          "servlet-class": "org.cofax.cds.FileServlet"},
        {
          "servlet-name": "cofaxTools",
          "servlet-class": "org.cofax.cms.CofaxToolsServlet",
          "init-param": {
            "templatePath": "toolstemplates/",
            "log": 1,
            "logLocation": "/usr/local/tomcat/logs/CofaxTools.log",
            "logMaxSize": "",
            "dataLog": 1,
            "dataLogLocation": "/usr/local/tomcat/logs/dataLog.log",
            "dataLogMaxSize": "",
            "removePageCache": "/content/admin/remove?cache=pages&id=",
            "removeTemplateCache": "/content/admin/remove?cache=templates&id=",
            "fileTransferFolder": "/usr/local/tomcat/webapps/content/fileTransferFolder",
            "lookInContext": 1,
            "adminGroupID": 4,
            "betaServer": true}}],
      "servlet-mapping": {
        "cofaxCDS": "/",
        "cofaxEmail": "/cofaxutil/aemail/*",
        "cofaxAdmin": "/admin/*",
        "fileServlet": "/static/*",
        "cofaxTools": "/tools/*"},
     
      "taglib": {
        "taglib-uri": "cofax.tld",
        "taglib-location": "/WEB-INF/tlds/cofax.tld"}}}
  `;

  expect(json.value(bigSample)).toEqual(JSON.parse(bigSample));
});
