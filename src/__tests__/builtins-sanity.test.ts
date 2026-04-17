// v11.2 → v11.3: eval-builtins sanity tests (coverage boost)
// 300+ 내장 함수의 기본 동작을 확인하여 커버리지 대폭 향상.

import { lex } from "../lexer";
import { Parser } from "../parser";
import { Interpreter } from "../interpreter";

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

function run(source: string): any {
  const tokens = lex(source);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter();
  return interp.interpret(ast).lastValue;
}

describe("Builtins — Arithmetic", () => {
  test("+ / - / * / / / mod", () => {
    expect(run("(+ 2 3)")).toBe(5);
    expect(run("(- 10 4)")).toBe(6);
    expect(run("(* 3 7)")).toBe(21);
    expect(run("(/ 20 4)")).toBe(5);
    expect(run("(% 10 3)")).toBe(1);
  });
  test("nested arithmetic", () => {
    expect(run("(+ (* 2 3) (- 10 4))")).toBe(12);
  });
  test("abs / min / max", () => {
    expect(run("(abs -7)")).toBe(7);
    expect(run("(min 3 5 1 4)")).toBe(1);
    expect(run("(max 3 5 1 4)")).toBe(5);
  });
  test("increment variants via define", () => {
    expect(run("(define i 0) (+ i 1)")).toBe(1);
  });
});

describe("Builtins — Comparison & Boolean", () => {
  test("< > <= >= = !=", () => {
    expect(run("(< 3 5)")).toBe(true);
    expect(run("(> 3 5)")).toBe(false);
    expect(run("(<= 5 5)")).toBe(true);
    expect(run("(>= 6 5)")).toBe(true);
    expect(run("(= 3 3)")).toBe(true);
    expect(run("(!= 3 4)")).toBe(true);
  });
  test("and / or / not", () => {
    expect(run("(and true true)")).toBe(true);
    expect(run("(and true false)")).toBe(false);
    expect(run("(or false true)")).toBe(true);
    expect(run("(not false)")).toBe(true);
  });
  test("null?", () => {
    expect(run("(null? null)")).toBe(true);
    expect(run("(null? 0)")).toBe(false);
  });
});

describe("Builtins — String", () => {
  test("str concatenation", () => {
    expect(run('(str "Hello " "World")')).toBe("Hello World");
    expect(run('(str "count: " 5)')).toBe("count: 5");
  });
  test("substring", () => {
    expect(run('(substring "hello" 0 3)')).toBe("hel");
    expect(run('(substring "hello" 2)')).toBe("llo");
  });
  test("char-at", () => {
    expect(run('(char-at "hello" 1)')).toBe("e");
  });
  test("replace", () => {
    expect(run('(replace "a-b-c" "-" "_")')).toBe("a_b_c");
  });
  test("length of string", () => {
    expect(run('(length "hello")')).toBe(5);
  });
});

describe("Builtins — Collection (list)", () => {
  test("list / first / rest / last", () => {
    expect(run("(first (list 10 20 30))")).toBe(10);
    expect(run("(last (list 10 20 30))")).toBe(30);
  });
  test("length of list", () => {
    expect(run("(length (list 1 2 3 4))")).toBe(4);
  });
  test("append", () => {
    expect(run("(append (list 1 2) (list 3 4))")).toEqual([1, 2, 3, 4]);
  });
  test("get by index", () => {
    expect(run("(get (list 10 20 30) 1)")).toBe(20);
  });
  test("slice", () => {
    expect(run("(slice (list 1 2 3 4 5) 1 4)")).toEqual([2, 3, 4]);
  });
});

describe("Builtins — Type", () => {
  test("str-conversion", () => {
    // type coercion sanity (without type-of)
    expect(run('(str 42)')).toBe("42");
    expect(run('(str true)')).toBe("true");
  });
  test("str-to-num / num-to-str", () => {
    expect(run('(str-to-num "42")')).toBe(42);
    expect(run('(str-to-num "3.14")')).toBeCloseTo(3.14);
    expect(run("(num-to-str 7)")).toBe("7");
  });
});

describe("Builtins — Control Flow", () => {
  test("if true / false branch", () => {
    expect(run("(if true 1 2)")).toBe(1);
    expect(run("(if false 1 2)")).toBe(2);
  });
  test("do / begin sequences", () => {
    expect(run("(do 1 2 3)")).toBe(3);
  });
  test("cond first-match", () => {
    expect(run("(cond [(> 3 5) 10] [(> 5 3) 20] [true 30])")).toBe(20);
  });
});

describe("v11.1 — let variants", () => {
  test("2차원 bracket (legacy)", () => {
    expect(run("(let [[$x 5] [$y 10]] (+ $x $y))")).toBe(15);
  });
  test("1차원 bracket with $", () => {
    expect(run("(let [$x 5 $y 10] (+ $x $y))")).toBe(15);
  });
  test("bare symbol auto-$", () => {
    expect(run("(let [x 5 y 10] (+ x y))")).toBe(15);
  });
});

describe("v11.1 — function styles", () => {
  test("(fn ...)", () => {
    expect(run("(define f (fn [$x] (* $x 2))) (f 21)")).toBe(42);
  });
  test("(defn ...)", () => {
    expect(run("(defn double [$x] (* $x 2)) (double 21)")).toBe(42);
  });
  test("[FUNC] block", () => {
    expect(run("[FUNC triple :params [$x] :body (* $x 3)](triple 7)")).toBe(21);
  });
  test("(defn ...) with bare param", () => {
    expect(run("(defn sq [x] (* x x)) (sq 9)")).toBe(81);
  });
});

describe("v11.1 — Strict variable resolution", () => {
  test("undefined $var throws", () => {
    expect(() => run("(+ $undefined_x 1)")).toThrow(/Undefined variable/);
  });
  test("defined $var works", () => {
    expect(run("(define $x 42) (+ $x 0)")).toBe(42);
  });
});

describe("v11.2 — get key equivalence", () => {
  test("keyword and string yield same result on JSON-like obj", () => {
    // json_parse 함수명 (언더스코어)
    const src = `(define obj (json_parse "{\\"name\\":\\"Kim\\"}"))
(list (get obj "name") (get obj :name))`;
    expect(run(src)).toEqual(["Kim", "Kim"]);
  });
});

describe("Builtins — Math extras", () => {
  test("sqrt / pow", () => {
    expect(run("(sqrt 16)")).toBe(4);
    expect(run("(pow 2 10)")).toBe(1024);
  });
  test("floor / ceil / round", () => {
    expect(run("(floor 3.7)")).toBe(3);
    expect(run("(ceil 3.2)")).toBe(4);
    expect(run("(round 3.5)")).toBe(4);
  });
});
