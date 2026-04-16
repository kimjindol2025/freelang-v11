// v11 Script Mode Tests

import { scriptLex } from "../script-lexer";
import { compileScript } from "../script-compiler";

describe("Script Lexer", () => {
  test("lexes simple function", () => {
    const code = "func greet(name) { return name }";
    const tokens = scriptLex(code);
    expect(tokens[0].value).toBe("func");
    expect(tokens[1].value).toBe("greet");
  });

  test("lexes variable assignment", () => {
    const code = "x = 10";
    const tokens = scriptLex(code);
    expect(tokens[0].value).toBe("x");
    expect(tokens[1].value).toBe("=");
    expect(tokens[2].value).toBe("10");
  });

  test("lexes operators", () => {
    const code = "a + b * c";
    const tokens = scriptLex(code);
    expect(tokens.filter(t => t.type === "OPERATOR").map(t => t.value)).toEqual(["+", "*"]);
  });

  test("lexes comparison operators", () => {
    const code = "x == 5 && y > 3";
    const tokens = scriptLex(code);
    const ops = tokens.filter(t => t.type === "OPERATOR").map(t => t.value);
    expect(ops).toContain("==");
    expect(ops).toContain("&&");
  });

  test("lexes string", () => {
    const code = 'msg = "Hello, World!"';
    const tokens = scriptLex(code);
    const str = tokens.find(t => t.type === "STRING");
    expect(str?.value).toBe("Hello, World!");
  });
});

describe("Script Compiler", () => {
  test("compiles simple function", () => {
    const code = "func greet(name) { return name }";
    const result = compileScript(code);
    expect(result).toContain("defn");
    expect(result).toContain("greet");
  });

  test("compiles variable assignment", () => {
    const code = "x = 10";
    const result = compileScript(code);
    expect(result).toContain("def");
    expect(result).toContain("x");
    expect(result).toContain("10");
  });

  test("compiles arithmetic", () => {
    const code = "result = 2 + 3 * 4";
    const result = compileScript(code);
    expect(result).toContain("+");
    expect(result).toContain("*");
  });

  test("compiles function call", () => {
    const code = "print(x)";
    const result = compileScript(code);
    expect(result).toContain("print");
  });

  test("compiles if statement", () => {
    const code = "if x > 5 { return x }";
    const result = compileScript(code);
    expect(result).toContain("if");
    expect(result).toContain(">");
  });

  test("compiles while loop", () => {
    const code = "while x > 0 { x = x - 1 }";
    const result = compileScript(code);
    expect(result).toContain("while");
    expect(result).toContain("-");
  });

  test("compiles multiple statements", () => {
    const code = `
x = 5
y = 10
z = x + y
`;
    const result = compileScript(code);
    expect(result).toContain("def");
    expect(result).toContain("x");
    expect(result).toContain("y");
    expect(result).toContain("z");
  });

  test("compiles comparison operators", () => {
    const code = "if x == 5 && y > 3 { return true }";
    const result = compileScript(code);
    expect(result).toContain("=");
    expect(result).toContain("and");
  });

  test("compiles logical operators", () => {
    const code = "result = a && b || !c";
    const result = compileScript(code);
    expect(result).toContain("and");
    expect(result).toContain("or");
    expect(result).toContain("not");
  });

  test("compiles function with parameters", () => {
    const code = "func add(a, b) { return a + b }";
    const result = compileScript(code);
    expect(result).toContain("add");
    expect(result).toContain("[a b]");
    expect(result).toContain("+");
  });

  test("compiles nested if", () => {
    const code = `
if x > 0 {
  if x > 5 {
    return "large"
  }
}
`;
    const result = compileScript(code);
    const ifCount = (result.match(/if/g) || []).length;
    expect(ifCount).toBeGreaterThan(1);
  });

  test("compiles boolean literals", () => {
    const code = "flag = true";
    const result = compileScript(code);
    expect(result).toContain("true");
  });

  test("compiles string literals", () => {
    const code = 'msg = "hello"';
    const result = compileScript(code);
    expect(result).toContain('"hello"');
  });

  test("compiles fibonacci", () => {
    const code = `
func fib(n) {
  if n <= 1 {
    return n
  }
  return fib(n - 1) + fib(n - 2)
}
`;
    const result = compileScript(code);
    expect(result).toContain("defn");
    expect(result).toContain("fib");
    expect(result).toContain("<=");
  });

  test("compiles factorial", () => {
    const code = `
func fact(n) {
  if n == 0 {
    return 1
  }
  return n * fact(n - 1)
}
`;
    const result = compileScript(code);
    expect(result).toContain("fact");
    expect(result).toContain("*");
  });

  test("compiles mixed operators", () => {
    const code = "result = (a + b) * (c - d) / (e % f)";
    const result = compileScript(code);
    expect(result).toContain("+");
    expect(result).toContain("-");
    expect(result).toContain("*");
    expect(result).toContain("/");
  });

  test("handles comments", () => {
    const code = `
# 이것은 주석
x = 10 # x에 10 할당
`;
    const result = compileScript(code);
    expect(result).toContain("def");
    expect(result).toContain("x");
    expect(result).not.toContain("#");
  });

  test("handles empty function", () => {
    const code = "func noop() { }";
    const result = compileScript(code);
    expect(result).toContain("noop");
  });

  test("compiles multiple functions", () => {
    const code = `
func double(x) { return x * 2 }
func triple(x) { return x * 3 }
`;
    const result = compileScript(code);
    expect(result).toContain("double");
    expect(result).toContain("triple");
  });
});
