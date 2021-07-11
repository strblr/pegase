import { peg, SemanticArg } from ".";

function show(entity: any) {
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

test("Modulos in grammars should work", () => {
  const p = peg`("1" % ',') @count % '|'`;
  expect(p.parse(" 2, 1, 1 | 1").success).toBe(false);
  expect(p.parse("  1 ,1,1 |1,1,  1,1|1 |1,1   ").success).toBe(true);
  expect(p.parse("1 ,1,1 |1,1, 1  ,   1,1|1 |   1,1 ").value).toEqual([
    3,
    5,
    1,
    2
  ]);
});

test("Prefix math expressions should be correctly converted to postfix", () => {
  const p = peg`
    expr:
      operator <e1>expr <e2>expr ${({ operator, e1, e2 }) =>
        [e1, e2, operator].join(" ")}
    | number
    
    operator:
      "+" | "-" | "*" | "/"
      
    number @raw @token:
      [0-9]+
  `;
  expect(p.parse("+ - 1 25 * / 369 4 5").value).toBe("1 25 - 369 4 / 5 * +");
});

/*
test("Predicates should work correctly", () => {
  const { A } = peg`
    A: &B "1" $
    B: "1" "2" ("3" | "4")
  `;
  expect(() => A.value("  1 2 4 ")).toThrow();
});

test("Case directives should be respected", () => {
  const g1 = peg` 'test' $ `;
  const g2 = peg` ('test' @nocase) $ `;

  expect(g1.test.value("test")).toBe(true);
  expect(g1.test.value("TEST")).toBe(false);
  expect(g1.test.value("tEsT")).toBe(false);
  expect(g1.test.value("tEsTT")).toBe(false);

  expect(g1.nocase.test.value("test")).toBe(true);
  expect(g1.nocase.test.value("TEST")).toBe(true);
  expect(g1.nocase.test.value("tEsT")).toBe(true);
  expect(g1.nocase.test.value("tEsTT")).toBe(false);

  expect(g1.case.nocase.test.value("test")).toBe(true);
  expect(g1.case.nocase.test.value("TEST")).toBe(false);
  expect(g1.case.nocase.test.value("tEsT")).toBe(false);
  expect(g1.case.nocase.test.value("tEsTT")).toBe(false);

  expect(g2.test.value("test")).toBe(true);
  expect(g2.test.value("TEST")).toBe(true);
  expect(g2.test.value("tEsT")).toBe(true);
  expect(g2.test.value("tEsTT")).toBe(false);
});
*/

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

  const fold = ({ $match }: SemanticArg) =>
    ($match.value as Array<any>).reduce((acc, op, index) =>
      index % 2 ? doop(acc, op, $match.value[index + 1]) : acc
    );

  const calc = peg`
    calc: expr $ ${({ expr }) => expr}
    expr: term % ("+" | "-") ${fold}
    term: fact % ("*" | "/") ${fold}
    fact: num | '(' expr ')' ${({ expr }) => expr}
    num @token:
      '-'? [0-9]+ ('.' [0-9]*)? ${({ $raw }) => parseFloat($raw)}
  `;

  expect(calc.parse("2 + 3").value).toBe(5);
  expect(calc.parse("2 * 3").value).toBe(6);
  expect(calc.parse("2 * -3").value).toBe(-6);
  expect(calc.parse("89").value).toBe(89);
  expect(calc.parse("2.53").value).toBe(2.53);
  expect(calc.parse("-1.2").value).toBe(-1.2);
  expect(calc.parse("").success).toBe(false);
  expect(calc.parse("1 +").success).toBe(false);
  expect(calc.parse("(1 +").success).toBe(false);
  expect(calc.parse("   12        -  8   ").value).toBe(4);
  expect(calc.parse("142        -9   ").value).toBe(133);
  expect(calc.parse("72+  15").value).toBe(87);
  expect(calc.parse(" 12*  4").value).toBe(48);
  expect(calc.parse(" 50/10 ").value).toBe(5);
  expect(calc.parse("2.53").value).toBe(2.53);
  expect(calc.parse("4*2.5 + 8.5+1.5 / 3.0").value).toBe(19);
  expect(calc.parse("5.0005 + 0.0095").value).toBe(5.01);
  expect(calc.parse("67+2").value).toBe(69);
  expect(calc.parse(" 2-7").value).toBe(-5);
  expect(calc.parse("5*7").value).toBe(35);
  expect(calc.parse("8/4").value).toBe(2);
  expect(calc.parse("2 -4 +6 -1 -1- 0 +8").value).toBe(10);
  expect(calc.parse("1 -1   + 2   - 2   +  4 - 4 +    6").value).toBe(6);
  expect(calc.parse(" 2*3 - 4*5 + 6/3 ").value).toBe(-12);
  expect(calc.parse("2*3*4/8 -   5/2*4 +  6 + 0/3   ").value).toBe(-1);
  expect(calc.parse("10/4").value).toBe(2.5);
  expect(calc.parse("5/3").value).toBeCloseTo(1.66666);
  expect(calc.parse("3 + 8/5 -1 -2*5").value).toBeCloseTo(-6.4);
  /*expect(() => calc.parse("  6  + c")).toThrow();
  expect(() => calc.parse("  7 & 2")).toThrow();
  expect(() => calc.parse(" %  ")).toThrow();
  expect(() => calc.parse(" 5 + + 6")).toThrow();*/
  expect(calc.parse("5/0").value).toBe(Infinity);
  expect(calc.parse("(2)").value).toBe(2);
  expect(calc.parse("(5 + 2*3 - 1 + 7 * 8)").value).toBe(66);
  expect(calc.parse("(67 + 2 * 3 - 67 + 2/1 - 7)").value).toBe(1);
  expect(calc.parse("(2) + (17*2-30) * (5)+2 - (8/2)*4").value).toBe(8);
  expect(calc.parse("(5*7/5) + (23) - 5 * (98-4)/(6*7-42)").value).toBe(
    -Infinity
  );
  expect(calc.parse("(((((5)))))").value).toBe(5);
  expect(calc.parse("(( ((2)) + 4))*((5))").value).toBe(30);
  expect(calc.parse("(( ((2)) + 4))*((5)  -1) ").value).toBe(24);
  /*expect(() => calc.parse("2 + (5 * 2")).toThrow();
  expect(() => calc.parse("(((((4))))")).toThrow();
  expect(() => calc.parse("((((4)))))")).toThrow();
  expect(() => calc.parse("((2)) * ((3")).toThrow();*/
  expect(
    calc.parse(
      " ( (( ( (485.56) -  318.95) *( 486.17/465.96 -  324.49/-122.8 )+ -422.8) * 167.73+-446.4 *-88.31) -271.61/ ( (( 496.31 / ((  -169.3*  453.70) ) )/-52.22 )* (( (-134.9* (-444.1-(( 278.79 * (  -384.5)) ) / (-270.6/  396.89-(  -391.5/150.39-  -422.9 )* -489.2 ) )+-38.02 )) )) )"
    ).value
  ).toBeCloseTo(71470.126502);
});
