// v11.7: eval-special-forms 심화 테스트 (v11 실제 지원 패턴만)

import { lex } from "../lexer";
import { Parser } from "../parser";
import { Interpreter } from "../interpreter";

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

function run(source: string): any {
  const tokens = lex(source);
  const ast = new Parser(tokens).parse();
  return new Interpreter().interpret(ast).lastValue;
}

describe("define — 변수/함수", () => {
  test("define 변수 + 사용", () => {
    expect(run("(define x 42) (+ $x 0)")).toBe(42);
  });
  test("define 함수 3-arg + 호출", () => {
    expect(run("(define triple [$x] (* $x 3)) (triple 4)")).toBe(12);
  });
});

describe("set!", () => {
  test("기존 변수 재할당", () => {
    expect(run("(define x 1) (set! $x 99) (+ $x 0)")).toBe(99);
  });
});

describe("do / begin", () => {
  test("do: 마지막 값 반환", () => {
    expect(run("(do 1 2 3 4 5)")).toBe(5);
  });
  test("begin: 동일 동작", () => {
    expect(run("(begin (define x 10) (+ $x 0))")).toBe(10);
  });
});

describe("v11.1 defn + 호출", () => {
  test("defn $-params", () => {
    expect(run("(defn double [$x] (* $x 2)) (double 21)")).toBe(42);
  });
  test("defn bare symbol", () => {
    expect(run("(defn sq [x] (* x x)) (sq 7)")).toBe(49);
  });
  test("defn with multiple params", () => {
    expect(run("(defn add3 [a b c] (+ a b c)) (add3 10 20 30)")).toBe(60);
  });
});

describe("let 스코프", () => {
  test("let 외부 define 접근", () => {
    expect(run(`
      (define a 10)
      (let [b 5] (+ a b))
    `)).toBe(15);
  });
  test("let 중첩", () => {
    expect(run("(let [x 1] (let [y 2] (+ x y)))")).toBe(3);
  });
});

describe("and / or / not", () => {
  test("and false 단락", () => {
    expect(run("(and true false true)")).toBe(false);
  });
  test("or true 단락", () => {
    expect(run("(or false true false)")).toBe(true);
  });
  test("not", () => {
    expect(run("(not false)")).toBe(true);
  });
});

describe("cond 다중 분기", () => {
  test("cond first-match", () => {
    expect(run(`
      (define grade 85)
      (cond
        [(>= $grade 90) "A"]
        [(>= $grade 80) "B"]
        [(>= $grade 70) "C"]
        [true "F"])
    `)).toBe("B");
  });
  test("cond 기본값", () => {
    expect(run("(cond [false 1] [false 2] [true 99])")).toBe(99);
  });
});

describe("v11.1 — fn via define", () => {
  test("fn 저장 후 호출", () => {
    expect(run("(define f (fn [$x] (+ $x 10))) (f 5)")).toBe(15);
  });
  test("fn 다수 인자", () => {
    expect(run("(define g (fn [$a $b $c] (+ $a $b $c))) (g 1 2 3)")).toBe(6);
  });
  test("fn closure", () => {
    expect(run(`
      (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
      (define add10 (make-adder 10))
      (add10 5)
    `)).toBe(15);
  });
});
