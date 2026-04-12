// integration.test.ts — FreeLang v9 E2E Integration Tests
// Phase 62: Jest 자동화 테스트

import { Interpreter } from "../interpreter";
import { lex } from "../lexer";
import { parse } from "../parser";

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("재귀 — factorial", () => {
  const factSrc = `
    (define factorial (fn [$n]
      (if (<= $n 1)
        1
        (* $n (factorial (- $n 1))))))
  `;

  test("factorial 0", () => {
    expect(run(factSrc + "(factorial 0)")).toBe(1);
  });

  test("factorial 1", () => {
    expect(run(factSrc + "(factorial 1)")).toBe(1);
  });

  test("factorial 5 = 120", () => {
    expect(run(factSrc + "(factorial 5)")).toBe(120);
  });

  test("factorial 10 = 3628800", () => {
    expect(run(factSrc + "(factorial 10)")).toBe(3628800);
  });
});

describe("재귀 — fibonacci", () => {
  const fibSrc = `
    (define fib (fn [$n]
      (if (< $n 2)
        $n
        (+ (fib (- $n 1)) (fib (- $n 2))))))
  `;

  test("fib 0", () => {
    expect(run(fibSrc + "(fib 0)")).toBe(0);
  });

  test("fib 1", () => {
    expect(run(fibSrc + "(fib 1)")).toBe(1);
  });

  test("fib 7 = 13", () => {
    expect(run(fibSrc + "(fib 7)")).toBe(13);
  });

  test("fib 10 = 55", () => {
    expect(run(fibSrc + "(fib 10)")).toBe(55);
  });
});

describe("loop 기반 — FizzBuzz", () => {
  const fizzSrc = `
    (define fizzbuzz (fn [$n]
      (cond
        [(= (% $n 15) 0) "FizzBuzz"]
        [(= (% $n 3) 0) "Fizz"]
        [(= (% $n 5) 0) "Buzz"]
        [true (num->str $n)])))
  `;

  test("fizzbuzz 15는 FizzBuzz", () => {
    expect(run(fizzSrc + "(fizzbuzz 15)")).toBe("FizzBuzz");
  });

  test("fizzbuzz 9는 Fizz", () => {
    expect(run(fizzSrc + "(fizzbuzz 9)")).toBe("Fizz");
  });

  test("fizzbuzz 10는 Buzz", () => {
    expect(run(fizzSrc + "(fizzbuzz 10)")).toBe("Buzz");
  });

  test("fizzbuzz 7는 숫자", () => {
    expect(run(fizzSrc + "(fizzbuzz 7)")).toBe("7");
  });
});

describe("고차 함수 — reduce 파이프라인", () => {
  test("reduce 합산", () => {
    expect(run(`
      (define numbers (list 1 2 3 4 5 6 7 8 9 10))
      (reduce $numbers 0 (fn [$acc $x] (+ $acc $x)))
    `)).toBe(55);
  });

  test("reduce 짝수 합 (조건 포함)", () => {
    expect(run(`
      (define numbers (list 1 2 3 4 5 6 7 8 9 10))
      (reduce $numbers 0 (fn [$acc $x] (if (even? $x) (+ $acc $x) $acc)))
    `)).toBe(30);
  });

  test("중첩 함수 합성", () => {
    expect(run(`
      (define double (fn [$x] (* $x 2)))
      (define inc (fn [$x] (+ $x 1)))
      (define double-then-inc (fn [$x] (inc (double $x))))
      (double-then-inc 5)
    `)).toBe(11);
  });

  test("reduce로 최대값 찾기", () => {
    expect(run(`
      (define nums (list 3 1 4 1 5 9 2 6))
      (reduce $nums (first $nums) (fn [$acc $x] (if (> $x $acc) $x $acc)))
    `)).toBe(9);
  });

  test("reduce로 문자열 빌더", () => {
    expect(run(`
      (define words (list "hello" " " "world"))
      (reduce $words "" (fn [$acc $x] (concat $acc $x)))
    `)).toBe("hello world");
  });
});

describe("재귀 — 꼬리 재귀 loop", () => {
  test("1부터 100까지 합 loop/recur", () => {
    expect(run(`
      (loop [i 1 acc 0]
        (if (> $i 100)
          $acc
          (recur (+ $i 1) (+ $acc $i))))
    `)).toBe(5050);
  });

  test("loop로 누적값 계산 (0~9 합)", () => {
    expect(run(`
      (loop [i 0 acc 0]
        (if (>= $i 10)
          $acc
          (recur (+ $i 1) (+ $acc $i))))
    `)).toBe(45);
  });
});

describe("Interpreter.run() 단축 메서드", () => {
  test("run() 메서드로 직접 실행", () => {
    const interp = new Interpreter();
    const ctx = interp.run("(+ 1 2 3)");
    expect(ctx.lastValue).toBe(6);
  });

  test("run() 여러 번 연속 호출", () => {
    const interp = new Interpreter();
    interp.run("(define x 10)");
    const ctx = interp.run("(* $x $x)");
    expect(ctx.lastValue).toBe(100);
  });

  test("run() 복합 표현식", () => {
    const interp = new Interpreter();
    const ctx = interp.run("(define fac (fn [$n] (if (<= $n 1) 1 (* $n (fac (- $n 1)))))) (fac 6)");
    expect(ctx.lastValue).toBe(720);
  });
});

describe("고차 함수 — 클로저 패턴", () => {
  test("make-adder 패턴", () => {
    expect(run(`
      (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
      (define add5 (make-adder 5))
      (define add10 (make-adder 10))
      (+ (add5 3) (add10 3))
    `)).toBe(21);
  });

  test("currying 시뮬레이션", () => {
    expect(run(`
      (define multiply (fn [$a] (fn [$b] (* $a $b))))
      (define triple (multiply 3))
      (triple 7)
    `)).toBe(21);
  });
});

describe("데이터 변환", () => {
  test("list 정렬 후 첫번째 요소", () => {
    expect(run(`
      (define nums (list 5 3 1 4 2))
      (first (sort $nums))
    `)).toBe(1);
  });

  test("list 정렬 후 마지막 요소", () => {
    expect(run(`
      (define nums (list 5 3 1 4 2))
      (last (sort $nums))
    `)).toBe(5);
  });

  test("중첩 배열 flatten 후 합산", () => {
    expect(run(`
      (define nested (list (list 1 2) (list 3 4) (list 5)))
      (define flat (flatten $nested))
      (reduce $flat 0 (fn [$acc $x] (+ $acc $x)))
    `)).toBe(15);
  });
});
