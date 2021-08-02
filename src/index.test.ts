import peg, { LiteralParser, RegExpParser } from ".";

function echo(entity: any) {
  console.log(
    JSON.stringify(
      entity,
      (_, val) => {
        if (val instanceof Map) return [...val.entries()];
        if (val instanceof RegExp) return val.toString();
        if (val instanceof Function) return val.toString();
        if (val === Infinity) return "Infinity";
        return val;
      },
      2
    )
  );
}

test("The peg tag should work with raw strings", () => {
  const g1 = peg` "My name is \"pegase\"." `;
  const g2 = peg`[\]]`;
  const g3 = peg`\s`;
  expect(g1).toBeInstanceOf(LiteralParser);
  expect((g1 as LiteralParser).literal).toBe('My name is "pegase".');
  expect(g2).toBeInstanceOf(RegExpParser);
  expect((g2 as RegExpParser).regExp.toString()).toBe("/[\\]]/");
  expect(g3).toBeInstanceOf(RegExpParser);
  expect((g3 as RegExpParser).regExp.toString()).toBe("/\\s/");
});

test("Repetition parsers should work", () => {
  const g1 = peg`"a"?`;
  const g2 = peg`"a" +`;
  const g3 = peg`"a"*`;
  const g4 = peg`"a"{3}`;
  const g5 = peg`"a" {2, ${4}}`;

  expect(g1.test("")).toBe(true);
  expect(g1.parse("a").value).toBe("a");
  expect(g1.parse("aa").children).toEqual(["a"]);
  expect(g2.test("")).toBe(false);
  expect(g2.parse("a").value).toBe("a");
  expect(g2.parse("aa").children).toEqual(["a", "a"]);
  expect(g2.parse("aaaa").children).toEqual(["a", "a", "a", "a"]);
  expect(g3.test("")).toBe(true);
  expect(g3.parse("a").value).toBe("a");
  expect(g3.parse("aa").children).toEqual(["a", "a"]);
  expect(g3.parse("aaaa").children).toEqual(["a", "a", "a", "a"]);
  expect(g4.test("a")).toBe(false);
  expect(g4.test("aa")).toBe(false);
  expect(g4.test("aaa")).toBe(true);
  expect(g4.parse("aaaaaa").children).toEqual(["a", "a", "a"]);
  expect(g5.test("a")).toBe(false);
  expect(g5.test("aa")).toBe(true);
  expect(g5.test("aaa")).toBe(true);
  expect(g5.parse("aaaaaa").children).toEqual(["a", "a", "a", "a"]);
});

test("Captures should work", () => {
  const g1 = peg`<val>([abc] @raw)`;
  const g2 = peg`${g1}*`;
  const g3 = peg`...<val>("a" | "b"){1}`;
  const g4 = peg`<val1>("a" <val2>("b" | "c") "d" @count)`;
  const g5 = peg`a: <val>b c ${({ val, b, c }) => val + c + b} b: "b" c: "c"`;
  const g6 = peg`'a' <val3>(${/(?<val>(?<val1>[bc])(?<val2>[de]))/} @raw) 'f'`;

  expect(g1.parse("a").captures.get("val")).toBe("a");
  expect(g2.parse("abc").captures.get("val")).toBe("c");
  expect(g3.parse("#@@@°#§¬ba.aps").captures.get("val")).toBe("b");
  const result = g4.parse("acd");
  expect(result.captures.get("val1")).toBe(3);
  expect(result.captures.get("val2")).toBe("c");
  expect(g5.parse("bc").value).toBe("bcb");
  const result2 = g6.parse("a ce f");
  expect(result2.captures.get("val")).toBe("ce");
  expect(result2.captures.get("val1")).toBe("c");
  expect(result2.captures.get("val2")).toBe("e");
  expect(result2.captures.get("val3")).toBe("ce");
});

test("Modulos in grammars should work", () => {
  const g1 = peg`"1" % ','`;
  expect(g1.parse("1").children).toEqual(["1"]);
  expect(g1.parse("1,1").children).toEqual(["1", "1"]);
  expect(g1.parse("1 ,1, 1 , 1").children).toEqual(["1", "1", "1", "1"]);

  const g2 = peg`"1" %? ','`;
  expect(g2.parse("1").children).toEqual(["1"]);
  expect(g2.parse("1,1").children).toEqual(["1", "1"]);
  expect(g2.parse("1 ,1, 1 , 1").children).toEqual(["1", "1"]);

  const g3 = peg`"1" %{2} ','`;
  expect(g3.test("1")).toBe(false);
  expect(g3.test("1,1")).toBe(false);
  expect(g3.parse("1 ,1, 1 , 1").children).toEqual(["1", "1", "1"]);

  const g4 = peg`("1" % ',' @count) % '|'`;
  expect(g4.test(" 2, 1, 1 | 1")).toBe(false);
  expect(g4.test("  1 ,1,1 |1,1,  1,1|1 |1,1   ")).toBe(true);
  expect(g4.parse("1 ,1,1 |1,1, 1  ,   1,1|1 |   1,1 ").children).toEqual([
    3,
    5,
    1,
    2
  ]);
});

test("Prefix math expressions should be correctly converted to postfix", () => {
  const g = peg`
    expr:
    | number
    | operator <e1>expr <e2>expr ${({ operator, e1, e2 }) =>
      [e1, e2, operator].join(" ")}

    operator:
      "+" | "-" | "*" | "/"
      
    number @token("number") @raw:
      [0-9]+
  `;

  expect(g.value("23")).toBe("23");
  expect(g.value("+")).toBe(undefined);
  expect(g.value("+ 1 2")).toBe("1 2 +");
  expect(g.value("* + 1 2 3")).toBe("1 2 + 3 *");
  expect(g.value("+ - 1 25 * / 369 4 5")).toBe("1 25 - 369 4 / 5 * +");
});

test("The cut operator should work correctly", () => {
  const g1 = peg`'a' "b" | 'a' "c" | 'a' "d"`;
  const g2 = peg`'a' ^ "b" | 'a' "c" | 'a' "d"`;
  const g3 = peg`('a' ^ "b" | 'a' "c") | 'a' "d"`;

  expect(g1.value("ab")).toBe("b");
  expect(g2.value("ab")).toBe("b");
  expect(g3.value("ab")).toBe("b");
  expect(g1.value("ac")).toBe("c");
  expect(g2.value("ac")).toBe(undefined);
  expect(g3.value("ac")).toBe(undefined);
  expect(g1.value("ad")).toBe("d");
  expect(g2.value("ad")).toBe(undefined);
  expect(g3.value("ad")).toBe("d");
});

test("L-attributed grammars should be implementable using context", () => {
  const g = peg<number>`
    expr:
      (num ${({ num, $context }) => {
        $context.acc = num;
      }})
      exprRest
        @context(${{ acc: 0 }})
    
    exprRest:
    | ('-' num ${({ num, $context }) => {
      $context.acc -= num;
    }})
      exprRest
    | ε ${({ $context }) => $context.acc}
    
    num @number @token("number"):
      [0-9]+
  `;

  expect(g.test("")).toBe(false);
  expect(g.value("5")).toBe(5);
  expect(g.value("42-6")).toBe(36);
  expect(g.value(" 13 - 16 -1")).toBe(-4);
  expect(g.value("61- 20 -14  -  3")).toBe(24);
});

test("Math expressions should be correctly calculated", () => {
  function doop(left: number, op: string, right: number) {
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
  }

  const calc = peg<number>`
    calc: expr $
    expr: term % ("+" | "-") @infix(${doop})
    term: fact % ("*" | "/") @infix(${doop})
    fact: num | '(' expr ')'
    num @number @token("number"):
      '-'? [0-9]+ ('.' [0-9]*)?
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
  expect(calc.value("  6  + c")).toBe(undefined);
  expect(calc.value("  7 & 2")).toBe(undefined);
  expect(calc.value(" %  ")).toBe(undefined);
  expect(calc.value(" 5 + + 6")).toBe(undefined);
  expect(calc.value("5/0")).toBe(Infinity);
  expect(calc.value("(2)")).toBe(2);
  expect(calc.value("(5 + 2*3 - 1 + 7 * 8)")).toBe(66);
  expect(calc.value("(67 + 2 * 3 - 67 + 2/1 - 7)")).toBe(1);
  expect(calc.value("(2) + (17*2-30) * (5)+2 - (8/2)*4")).toBe(8);
  expect(calc.value("(5*7/5) + (23) - 5 * (98-4)/(6*7-42)")).toBe(-Infinity);
  expect(calc.value("(((((5)))))")).toBe(5);
  expect(calc.value("(( ((2)) + 4))*((5))")).toBe(30);
  expect(calc.value("(( ((2)) + 4))*((5)  -1) ")).toBe(24);
  expect(calc.value("2 + (5 * 2")).toBe(undefined);
  expect(calc.value("(((((4))))")).toBe(undefined);
  expect(calc.value("((((4)))))")).toBe(undefined);
  expect(calc.value("((2)) * ((3")).toBe(undefined);
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
    | '[' value %% ',' ']' ${({ $match }) => $match.children}
    | '{' (string ':' value) %% ',' '}'
        ${({ $match }) => {
          const result: any = {};
          for (let i = 0; i < $match.children.length; i += 2)
            result[$match.children[i]] = $match.children[i + 1];
          return result;
        }}
    
    string @token:
      '\"' ([^\"] | '\\'.)* '\"'
        ${({ $raw }) => $raw.substring(1, $raw.length - 1)}
      
    number @token:
      '-'? \d+ ('.' \d*)?
        ${({ $raw }) => Number($raw)}
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
});
