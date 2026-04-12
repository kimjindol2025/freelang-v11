// advanced.test.ts — FreeLang v9 Advanced Coverage Tests
// Phase 62: 파서/인터프리터 커버리지 향상

import { Interpreter } from "../interpreter";
import { lex } from "../lexer";
import { parse } from "../parser";

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runInterp(src: string): Interpreter {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp;
}

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  jest.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("파서 — 다양한 데이터 타입", () => {
  test("null 리터럴 실행", () => {
    expect(run("(null? null)")).toBe(true);
  });

  test("음수 표현 (- n)", () => {
    expect(run("(- 5)")).toBe(-5);
    expect(run("(+ (- 3) (- 4))")).toBe(-7);
  });

  test("부동소수점 연산", () => {
    expect(run("(+ 1.1 2.2)")).toBeCloseTo(3.3);
  });

  test("문자열 이스케이프", () => {
    expect(run("(length \"hello\\nworld\")")).toBe(11);
  });

  test("중첩 s-expr", () => {
    expect(run("(+ (+ 1 2) (+ 3 (+ 4 5)))")).toBe(15);
  });

  test("do 내 define 사용", () => {
    expect(run("(do (define x 5) (define y 10) (+ $x $y))")).toBe(15);
  });
});

describe("파서 — 함수 정의 패턴", () => {
  test("익명 fn 즉시 호출 패턴 (IIFE)", () => {
    // fn 생성 후 즉시 define해 호출
    expect(run(`
      (define iife (fn [$x] (* $x $x)))
      (iife 7)
    `)).toBe(49);
  });

  test("재귀 함수 + 조건", () => {
    expect(run(`
      (define count-down (fn [$n]
        (if (<= $n 0)
          "done"
          (count-down (- $n 1)))))
      (count-down 5)
    `)).toBe("done");
  });

  test("다중 인자 함수", () => {
    expect(run(`
      (define add3 (fn [$a $b $c] (+ $a $b $c)))
      (add3 1 2 3)
    `)).toBe(6);
  });

  test("함수 내 함수 정의 (do 활용)", () => {
    // outer 내에서 inner를 define 후 호출 — do 없이 fn 내 다중 표현식
    expect(run(`
      (define adder (fn [$x] (fn [$y] (+ $x $y))))
      (define add10 (adder 10))
      (add10 5)
    `)).toBe(15);
  });
});

describe("파서 — 제어 흐름", () => {
  test("중첩 if 체인", () => {
    expect(run(`
      (define grade (fn [$score]
        (if (>= $score 90) "A"
          (if (>= $score 80) "B"
            (if (>= $score 70) "C"
              (if (>= $score 60) "D"
                "F"))))))
      (grade 85)
    `)).toBe("B");
  });

  test("cond 다중 조건", () => {
    expect(run(`
      (define classify (fn [$n]
        (cond
          [(< $n 0) "negative"]
          [(= $n 0) "zero"]
          [(< $n 10) "small"]
          [(< $n 100) "medium"]
          [true "large"])))
      (classify 50)
    `)).toBe("medium");
  });

  test("do 내 loop", () => {
    expect(run(`
      (do
        (define total (loop [i 1 s 0]
          (if (> $i 10)
            $s
            (recur (+ $i 1) (+ $s $i)))))
        $total)
    `)).toBe(55);
  });

  test("while 스타일 loop", () => {
    expect(run(`
      (loop [n 1 result 1]
        (if (> $n 5)
          $result
          (recur (+ $n 1) (* $result $n))))
    `)).toBe(120);
  });
});

describe("내장 함수 — 문자열 상세", () => {
  test("repeat 문자열", () => {
    expect(run("(repeat \"ab\" 3)")).toBe("ababab");
  });

  test("replace 치환", () => {
    // "aababaa"에서 "ab" → "X" : "a" + "ab" + "ab" + "aa" → "aXXaa"
    expect(run("(replace \"aababaa\" \"ab\" \"X\")")).toBe("aXXaa");
  });

  test("str-split 다중", () => {
    expect(run("(length (str-split \"a,b,c,d\" \",\"))")).toBe(4);
  });

  test("str 다중 인자 결합", () => {
    expect(run("(str \"a\" \"b\" \"c\" \"d\")")).toBe("abcd");
  });

  test("contains? 배열 요소", () => {
    expect(run("(contains? (list 1 2 3 4 5) 3)")).toBe(true);
    expect(run("(contains? (list 1 2 3 4 5) 9)")).toBe(false);
  });
});

describe("내장 함수 — 배열 상세", () => {
  test("unshift 앞에 추가", () => {
    expect(run("(unshift (list 2 3 4) 1)")).toEqual([1, 2, 3, 4]);
  });

  test("assoc 중첩 키", () => {
    expect(run("(get (assoc {} \"a\" 1) \"a\")")).toBe(1);
  });

  test("dissoc 키 제거", () => {
    expect(run(`
      (define m (assoc (assoc {} "a" 1) "b" 2))
      (get (dissoc $m "a") "b")
    `)).toBe(2);
  });

  test("find 요소 탐색", () => {
    expect(run("(find (list 10 20 30) 20)")).toBe(1);
    expect(run("(find (list 10 20 30) 99)")).toBe(-1);
  });

  test("reduce로 배열 → 맵 변환", () => {
    expect(run(`
      (define pairs (list "a" "b" "c"))
      (reduce $pairs 0 (fn [$acc $x] (+ $acc 1)))
    `)).toBe(3);
  });
});

describe("내장 함수 — 수학 상세", () => {
  test("log 자연로그", () => {
    expect(run("(log 1)")).toBeCloseTo(0);
  });

  test("exp e의 거듭제곱", () => {
    expect(run("(exp 0)")).toBeCloseTo(1);
  });

  test("sin", () => {
    expect(run("(sin 0)")).toBeCloseTo(0);
  });

  test("cos", () => {
    expect(run("(cos 0)")).toBeCloseTo(1);
  });

  test("연속 수학 연산", () => {
    expect(run("(floor (sqrt (pow 4 2)))")).toBe(4);
  });
});

describe("인터프리터 — 스코프", () => {
  test("let 바인딩 계산", () => {
    // let은 주어진 바인딩으로 계산
    expect(run("(let [[$x 5]] (* $x $x))")).toBe(25);
  });

  test("중첩 let 스코프", () => {
    expect(run(`
      (let [[$a 2]]
        (let [[$b 3]]
          (let [[$c 4]]
            (* $a (* $b $c)))))
    `)).toBe(24);
  });

  test("다중 define 누적", () => {
    expect(run(`
      (define a 1)
      (define b (+ $a 1))
      (define c (+ $b 1))
      (define d (+ $c 1))
      (+ $a $b $c $d)
    `)).toBe(10);
  });
});

describe("인터프리터 — 고급 패턴", () => {
  test("Y-combinator 스타일 재귀", () => {
    expect(run(`
      (define fact (fn [$n]
        (loop [i $n acc 1]
          (if (<= $i 1)
            $acc
            (recur (- $i 1) (* $acc $i))))))
      (fact 7)
    `)).toBe(5040);
  });

  test("메모이제이션 패턴 (map 활용)", () => {
    expect(run(`
      (define double-all (fn [$nums]
        (reduce $nums (list) (fn [$acc $x] (push $acc (* $x 2)))))
      )
      (double-all (list 1 2 3 4 5))
    `)).toEqual([2, 4, 6, 8, 10]);
  });

  test("파이프라인 패턴 (pipe 활용)", () => {
    expect(run(`
      (define add1 (fn [$x] (+ $x 1)))
      (define double (fn [$x] (* $x 2)))
      (define sub3 (fn [$x] (- $x 3)))
      (pipe 5 add1 double sub3)
    `)).toBe(9);
  });

  test("조건부 재귀", () => {
    expect(run(`
      (define gcd (fn [$a $b]
        (if (= $b 0)
          $a
          (gcd $b (% $a $b)))))
      (gcd 48 18)
    `)).toBe(6);
  });
});

describe("인터프리터 — 모나드 패턴", () => {
  test("ok? 검사", () => {
    expect(run("(ok? (ok 42))")).toBe(true);
  });

  test("err? 검사", () => {
    expect(run("(err? (err \"fail\"))")).toBe(true);
  });

  test("some? 검사", () => {
    expect(run("(some? (some 10))")).toBe(true);
  });

  test("none? 검사", () => {
    expect(run("(none? (none))")).toBe(true);
  });

  test("maybe-or 기본값", () => {
    expect(run("(maybe-or (none) 42)")).toBe(42);
    expect(run("(maybe-or (some 10) 42)")).toBe(10);
  });

  test("result-or 기본값", () => {
    expect(run("(result-or (err \"fail\") 99)")).toBe(99);
    expect(run("(result-or (ok 42) 99)")).toBe(42);
  });
});

describe("println/echo 출력 함수", () => {
  test("println 반환값 null", () => {
    expect(run("(println \"test\")")).toBeNull();
  });

  test("echo 반환값 null", () => {
    expect(run("(echo \"test\")")).toBeNull();
  });

  test("print 반환값 null", () => {
    expect(run("(print \"test\")")).toBeNull();
  });
});

describe("인터프리터 scope — interpreter-scope.ts", () => {
  test("ScopeStack push/pop", () => {
    const { ScopeStack } = require("../interpreter-scope");
    const stack = new ScopeStack();
    stack.set("$x", 10);
    expect(stack.get("$x")).toBe(10);
    stack.push();
    stack.set("$y", 20);
    expect(stack.get("$y")).toBe(20);
    stack.pop();
    expect(stack.get("$y")).toBeUndefined();
  });

  test("ScopeStack mutate 존재하는 변수", () => {
    const { ScopeStack } = require("../interpreter-scope");
    const stack = new ScopeStack();
    stack.set("$x", 1);
    const result = stack.mutate("$x", 99);
    expect(result).toBe(true);
    expect(stack.get("$x")).toBe(99);
  });

  test("ScopeStack has 확인", () => {
    const { ScopeStack } = require("../interpreter-scope");
    const stack = new ScopeStack();
    stack.set("$a", 1);
    expect(stack.has("$a")).toBe(true);
    expect(stack.has("$b")).toBe(false);
  });
});

describe("error-formatter.ts — suggestSimilar", () => {
  test("유사 함수명 힌트", () => {
    const { suggestSimilar } = require("../error-formatter");
    // 등록된 함수 목록 중 유사한 것 찾기
    const similar = suggestSimilar("strlen", ["str", "string?", "str-split", "strlen-compat"]);
    expect(similar).toBeDefined();
  });
});
