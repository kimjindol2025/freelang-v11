// core.test.ts — FreeLang v9 Special Forms & Closures
// Phase 62: Jest 자동화 테스트

import { Interpreter } from "../interpreter";
import { lex } from "../lexer";
import { parse } from "../parser";

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

// 테스트 중 외부 I/O 억제
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("Special Forms — define", () => {
  test("define 변수 — lastValue는 정의된 값", () => {
    // FreeLang v9에서 (define x 42)는 42를 lastValue로 설정
    expect(run("(define x 42)")).toBe(42);
  });

  test("define fn 클로저 + 호출", () => {
    expect(run("(define f (fn [$x] (* $x 2))) (f 5)")).toBe(10);
  });

  test("다중 define 및 계산", () => {
    expect(run("(define a 3) (define b 4) (+ $a $b)")).toBe(7);
  });

  test("define 후 산술 사용", () => {
    expect(run("(define x 10) (* $x $x)")).toBe(100);
  });
});

describe("Special Forms — if", () => {
  test("if true branch", () => {
    expect(run("(if true 1 2)")).toBe(1);
  });

  test("if false branch", () => {
    expect(run("(if false 1 2)")).toBe(2);
  });

  test("if 비교 조건", () => {
    expect(run("(if (> 5 3) \"yes\" \"no\")")).toBe("yes");
  });

  test("if 중첩", () => {
    expect(run("(if true (if false 0 1) 2)")).toBe(1);
  });

  test("if 수식 조건", () => {
    expect(run("(define n 7) (if (> $n 5) \"big\" \"small\")")).toBe("big");
  });
});

describe("Special Forms — let", () => {
  test("let 단순 바인딩", () => {
    expect(run("(let [[$x 5]] (* $x $x))")).toBe(25);
  });

  test("let 복수 바인딩", () => {
    expect(run("(let [[$a 3] [$b 4]] (+ $a $b))")).toBe(7);
  });

  test("let 스코프 외부 변수 접근", () => {
    expect(run("(define g 10) (let [[$x 5]] (+ $x $g))")).toBe(15);
  });

  test("let 중첩", () => {
    expect(run("(let [[$a 2]] (let [[$b 3]] (* $a $b)))")).toBe(6);
  });
});

describe("Special Forms — do/begin", () => {
  test("do 마지막 값 반환", () => {
    expect(run("(do 1 2 3)")).toBe(3);
  });

  test("do 단일 값", () => {
    expect(run("(do 42)")).toBe(42);
  });

  test("do 문자열 반환", () => {
    expect(run("(do \"a\" \"b\" \"c\")")).toBe("c");
  });
});

describe("Special Forms — loop/recur", () => {
  test("loop/recur 카운터", () => {
    expect(run("(loop [i 0] (if (>= $i 5) $i (recur (+ $i 1))))")).toBe(5);
  });

  test("loop/recur 합산", () => {
    expect(run("(loop [i 0 s 0] (if (> $i 5) $s (recur (+ $i 1) (+ $s $i))))")).toBe(15);
  });

  test("loop/recur 초기값 반환", () => {
    expect(run("(loop [i 0] (if (>= $i 0) $i (recur (+ $i 1))))")).toBe(0);
  });
});

describe("Special Forms — set!", () => {
  test("set! 뮤테이션 후 계산에 사용", () => {
    expect(run("(define x 1) (set! x 99) (+ $x 0)")).toBe(99);
  });

  test("set! 반복 갱신 후 계산", () => {
    expect(run("(define cnt 0) (set! cnt (+ $cnt 1)) (set! cnt (+ $cnt 1)) (+ $cnt 0)")).toBe(2);
  });

  test("set! 문자열", () => {
    expect(run("(define s \"hello\") (set! s \"world\") (str $s)")).toBe("world");
  });
});

describe("Special Forms — cond", () => {
  test("cond 첫 매칭 반환", () => {
    expect(run("(cond [false 1] [true 2] [true 3])")).toBe(2);
  });

  test("cond 단일 true", () => {
    expect(run("(cond [true 42])")).toBe(42);
  });

  test("cond 마지막 매칭", () => {
    expect(run("(cond [false 1] [false 2] [true 99])")).toBe(99);
  });
});

describe("Special Forms — and/or", () => {
  test("and 모두 true", () => {
    expect(run("(and true true)")).toBe(true);
  });

  test("and short-circuit false", () => {
    expect(run("(and true true false)")).toBe(false);
  });

  test("or 하나 true", () => {
    expect(run("(or false false true)")).toBe(true);
  });

  test("or 모두 false", () => {
    expect(run("(or false false)")).toBe(false);
  });

  test("not 연산자", () => {
    expect(run("(not false)")).toBe(true);
  });
});

describe("Closures", () => {
  test("fn은 외부 환경 캡처", () => {
    expect(run("(define n 10) (define f (fn [$x] (+ $x $n))) (f 5)")).toBe(15);
  });

  test("make-adder 고차 함수", () => {
    expect(run(`
      (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
      (define add5 (make-adder 5))
      (add5 3)
    `)).toBe(8);
  });

  test("중첩 클로저 — compose", () => {
    expect(run(`
      (define double (fn [$x] (* $x 2)))
      (define inc (fn [$x] (+ $x 1)))
      (inc (double 5))
    `)).toBe(11);
  });

  test("클로저 환경 독립성", () => {
    expect(run(`
      (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
      (define add3 (make-adder 3))
      (define add7 (make-adder 7))
      (+ (add3 10) (add7 10))
    `)).toBe(30);
  });
});
