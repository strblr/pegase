import { peg, reduceModulo } from ".";

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
  expect(p.parse("1 ,1,1 |1,1, 1  ,   1,1|1 |   1,1 ").children).toEqual([
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
    | operator <first>expr expr ${({ operator, first, expr }) =>
      [first, expr, operator].join(" ")}
   
    operator:
      "+" | "-" | "*" | "/"
      
    number @raw @token:
      [0-9]+
  `;
  expect(g.value("+ - 1 25 * / 369 4 5")).toBe("1 25 - 369 4 / 5 * +");
});

test("The cut operator should work correctly", () => {
  const g1 = peg`'a' "b" | 'a' "c"`;
  const g2 = peg`'a' ^ "b" | 'a' "c"`;
  expect(g1.value("ab")).toBe("b");
  expect(g2.value("ab")).toBe("b");
  expect(g1.value("ac")).toBe("c");
  expect(g2.value("ac")).toBe(undefined);
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
    expr: term % ("+" | "-") ${reduceModulo(doop)}
    term: fact % ("*" | "/") ${reduceModulo(doop)}
    fact: num | '(' expr ')'
    num @number @token:
      '-'? [0-9]+ ('.' [0-9]*)?
  `;

  expect(calc.value("2 + 3")).toBe(5);
  expect(calc.value("2 * 3")).toBe(6);
  expect(calc.value("2 * -3")).toBe(-6);
  expect(calc.value("89")).toBe(89);
  expect(calc.value("2.53")).toBe(2.53);
  expect(calc.value("-1.2")).toBe(-1.2);
  expect(calc.parse("").success).toBe(false);
  expect(calc.parse("1 +").success).toBe(false);
  expect(calc.parse("(1 +").success).toBe(false);
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
