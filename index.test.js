const { pegase, number, ident, doubleStr } = require("./lib/index");

test("Modulos in grammars should work", () => {
  function count(_, children) {
    return children.length;
  }

  const grammar = pegase`("1" % ',' ${count}) % '|' $`;
  const finalCount = [3, 5, 1, 2];

  expect(grammar.parse("  1 ,1,1 |1,1,  1,1|1 |1,1   ").complete).toBe(true);
  expect(grammar.children("1 ,1,1 |1,1, 1  ,   1,1|1 |   1,1 ")).toEqual(
    finalCount
  );
});

test("XML should be correctly converted to in-memory JSON", () => {
  function groupTags(_, children) {
    return children;
  }

  function emitTag(_, [openId, attributes, children, closeId]) {
    if (openId !== closeId)
      throw new Error("Openning and closing tags must match");
    return {
      tag: openId,
      attributes,
      children
    };
  }

  function emitText(raw) {
    return raw;
  }

  function merge(_, children) {
    return Object.assign({}, ...children);
  }

  function collect(_, [id, literal]) {
    return { [id]: literal };
  }

  try {
    const { xml } = pegase`
      tag: '<' ${ident} attributes '>' xml '<' '/' ${ident} '>' ${emitTag}
      |    unskipd[(!'<' .)+] ${emitText}
      
      xml: tag* ${groupTags}
      
      attributes: attribute* ${merge}
        
      attribute: ${ident} '=' ${doubleStr} ${collect}
    `;
  } catch (e) {
    console.log(e.failures);
  }

  /*expect(
    xml.value(`
      <ul class="mylist">
        <li>item 1</li>
        <li> item 2, click <a href="/item1">here</a></li>
      </ul>
    `)
  ).toEqual([
    {
      tag: "ul",
      attributes: {
        class: "mylist"
      },
      children: [
        {
          tag: "li",
          attributes: {},
          children: ["item 1"]
        },
        {
          tag: "li",
          attributes: {},
          children: [
            " item 2, click ",
            {
              tag: "a",
              attributes: {
                href: "/item1"
              },
              children: ["here"]
            }
          ]
        }
      ]
    }
  ]);*/
});

test("Math expressions should be correctly calculated", () => {
  function doop(left, op, right) {
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

  function fold(_, [first, ...rest]) {
    return rest.reduce((acc, op, index) => {
      return index % 2 ? acc : doop(acc, op, rest[index + 1]);
    }, first);
  }

  const { calc } = pegase`
    calc: expr $
    expr: term % ("+" | "-") ${fold}
    term: fact % ("*" | "/") ${fold}
    fact: ${number} | '(' expr ')'
  `;

  expect(calc.value("2 + 3")).toBe(5);
  expect(calc.value("2 * 3")).toBe(6);
  expect(calc.value("2 * -3")).toBe(-6);
  expect(calc.value("89")).toBe(89);
  expect(calc.value("2.53")).toBe(2.53);
  expect(calc.value("-1.2")).toBe(-1.2);
  expect(() => calc.value("")).toThrow();
  expect(() => calc.value("1 +")).toThrow();
  expect(() => calc.children("(1 +")).toThrow();
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
  expect(() => calc.value("  6  + c")).toThrow();
  expect(() => calc.value("  7 & 2")).toThrow();
  expect(() => calc.value(" %  ")).toThrow();
  expect(() => calc.value(" 5 + + 6")).toThrow();
  expect(calc.value("5/0")).toBe(Infinity);
  expect(calc.value("(2)")).toBe(2);
  expect(calc.value("(5 + 2*3 - 1 + 7 * 8)")).toBe(66);
  expect(calc.value("(67 + 2 * 3 - 67 + 2/1 - 7)")).toBe(1);
  expect(calc.value("(2) + (17*2-30) * (5)+2 - (8/2)*4")).toBe(8);
  expect(calc.value("(5*7/5) + (23) - 5 * (98-4)/(6*7-42)")).toBe(-Infinity);
  expect(calc.value("(((((5)))))")).toBe(5);
  expect(calc.value("(( ((2)) + 4))*((5))")).toBe(30);
  expect(calc.value("(( ((2)) + 4))*((5)  -1) ")).toBe(24);
  expect(() => calc.value("2 + (5 * 2")).toThrow();
  expect(() => calc.value("(((((4))))")).toThrow();
  expect(() => calc.value("((((4)))))")).toThrow();
  expect(() => calc.value("((2)) * ((3")).toThrow();
  expect(
    calc.value(
      " ( (( ( (485.56) -  318.95) *( 486.17/465.96 -  324.49/-122.8 )+ -422.8) * 167.73+-446.4 *-88.31) -271.61/ ( (( 496.31 / ((  -169.3*  453.70) ) )/-52.22 )* (( (-134.9* (-444.1-(( 278.79 * (  -384.5)) ) / (-270.6/  396.89-(  -391.5/150.39-  -422.9 )* -489.2 ) )+-38.02 )) )) )"
    )
  ).toBeCloseTo(71470.126502);
});
