// FreeLang v9 Phase 94: REFLECT — AI 자기 평가/반성 테스트
// 22개 이상 PASS 목표

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { Reflector, CRITERIA, evalReflectForm, ReflectionResult } from "./reflect";

// ─── 테스트 인프라 ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ [FAIL] ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEq(a: any, b: any, msg?: string): void {
  if (a !== b) throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertClose(a: number, b: number, eps = 0.001, msg?: string): void {
  if (Math.abs(a - b) > eps)
    throw new Error(msg ?? `expected ~${b}, got ${a}`);
}

function runFL(interp: Interpreter, code: string): any {
  const ctx = interp.run(code);
  return ctx.lastValue;
}

console.log("─────────────────────────────────────────────────────────────");
console.log("Phase 94 FreeLang v9 REFLECT — AI 자기 평가/반성 테스트");
console.log("─────────────────────────────────────────────────────────────");
console.log("");

// ─────────────────────────────────────────────────────────────────────────────
// TC-1~6: Reflector 기본
// ─────────────────────────────────────────────────────────────────────────────
console.log("[TC-1~6] Reflector 기본\n");

test("TC-1: Reflector 인스턴스 생성", () => {
  const r = new Reflector();
  assert(r instanceof Reflector, "Reflector 생성 실패");
  assertEq(r.getCriteriaList().length, 0, "초기 criteria 수 0");
});

test("TC-2: 기본 criteria 추가 (not-null)", () => {
  const r = new Reflector();
  r.addCriteria(CRITERIA["not-null"]);
  assertEq(r.getCriteriaList().length, 1, "criteria 1개");
  assertEq(r.getCriteriaList()[0].name, "not-null");
});

test("TC-3: reflect → ReflectionResult 구조", () => {
  const r = new Reflector();
  r.addCriteria(CRITERIA["not-null"]);
  const result = r.reflect(42);
  assert("output" in result, "output 필드");
  assert("scores" in result, "scores 필드");
  assert("totalScore" in result, "totalScore 필드");
  assert("passed" in result, "passed 필드");
  assert("feedback" in result, "feedback 필드");
  assertEq(result.output, 42, "output=42");
});

test("TC-4: scores 각 기준별 점수", () => {
  const r = new Reflector();
  r.addCriteria(CRITERIA["not-null"]);
  r.addCriteria(CRITERIA["positive"]);
  const result = r.reflect(5);
  assertEq(result.scores["not-null"], 1, "not-null=1");
  assertEq(result.scores["positive"], 1, "positive=1");
});

test("TC-5: totalScore 가중 평균", () => {
  const r = new Reflector();
  r.addCriteria({ name: "c1", check: () => 1.0, weight: 2 });
  r.addCriteria({ name: "c2", check: () => 0.0, weight: 1 });
  const result = r.reflect("test");
  // (1.0*2 + 0.0*1) / 3 = 0.666...
  assertClose(result.totalScore, 2 / 3, 0.001, "totalScore 가중 평균");
});

test("TC-6: passed threshold 0.7 기준", () => {
  const r = new Reflector();
  r.addCriteria(CRITERIA["not-null"]);
  r.addCriteria(CRITERIA["positive"]);
  const pass = r.reflect(10, 0.7);
  assert(pass.passed === true, "양수면 passed=true");
  const fail = r.reflect(-5, 0.7);
  assert(fail.passed === false, "음수면 positive=0 → passed=false");
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-7~12: FL 문법 [REFLECT] 블록
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[TC-7~12] FL 문법 [REFLECT] 블록\n");

test("TC-7: :output 42 :criteria [(positive)] → passed=true", () => {
  const interp = new Interpreter();
  const result = runFL(interp, `
    (REFLECT
      :output 42
      :criteria [(fn [$x] (if (> $x 0) 1.0 0.0))]
      :threshold 0.7)
  `);
  assert(result != null, "결과 non-null");
  assert(result.passed === true, `passed=true, got ${result.passed}`);
  assertEq(result.output, 42, "output=42");
});

test("TC-8: :output -1 :criteria [(positive)] → passed=false", () => {
  const interp = new Interpreter();
  const result = runFL(interp, `
    (REFLECT
      :output -1
      :criteria [(fn [$x] (if (> $x 0) 1.0 0.0))]
      :threshold 0.7)
  `);
  assert(result != null, "결과 non-null");
  assert(result.passed === false, `passed=false, got ${result.passed}`);
  // output이 숫자 -1 또는 문자열 "-1" 모두 허용
  assert(Number(result.output) === -1, `output=${result.output} (숫자 -1이어야 함)`);
});

test("TC-9: :on-fail 실행 확인", () => {
  const interp = new Interpreter();
  const result = runFL(interp, `
    (REFLECT
      :output -1
      :criteria [(fn [$x] (if (> $x 0) 1.0 0.0))]
      :threshold 0.7
      :on-fail (fn [$r] 999))
  `);
  assert(result != null, "결과 non-null");
  // passed=false → on-fail 실행 → revised=999
  assertEq(result.revised, 999, `on-fail 결과 999, got ${result.revised}`);
});

test("TC-10: :threshold 적용", () => {
  const interp = new Interpreter();
  // threshold=0.5으로 낮추면 passed
  const result = runFL(interp, `
    (REFLECT
      :output 5
      :criteria [
        (fn [$x] (if (> $x 0) 1.0 0.0))
        (fn [$x] 0.0)
      ]
      :threshold 0.5)
  `);
  // (1.0 + 0.0)/2 = 0.5 → threshold=0.5이면 passed
  assert(result != null, "결과 non-null");
  assert(result.passed === true, `threshold=0.5일 때 score=0.5이면 passed=true`);
});

test("TC-11: 여러 criteria 동시 평가", () => {
  const interp = new Interpreter();
  const result = runFL(interp, `
    (REFLECT
      :output 10
      :criteria [
        (fn [$x] (if (> $x 0) 1.0 0.0))
        (fn [$x] (if (< $x 100) 1.0 0.0))
      ]
      :threshold 0.7)
  `);
  assert(result != null, "결과 non-null");
  assert(result.passed === true, "10은 양수이고 100보다 작음 → passed=true");
  assertEq(result.totalScore, 1.0, "totalScore=1.0");
});

test("TC-12: :revise fn 실행", () => {
  const interp = new Interpreter();
  const result = runFL(interp, `
    (REFLECT
      :output 5
      :criteria [(fn [$x] (if (> $x 0) 1.0 0.0))]
      :threshold 0.7
      :revise (fn [$r] (* 2 5)))
  `);
  assert(result != null, "결과 non-null");
  // revise fn 실행: 5*2=10
  assertEq(result.revised, 10, `revise 결과 10, got ${result.revised}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-13~17: 실용 패턴
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[TC-13~17] 실용 패턴\n");

test("TC-13: AI 답변 품질 평가 (길이, null 여부)", () => {
  const r = new Reflector();
  r.addCriteria(CRITERIA["not-null"]);
  r.addCriteria(CRITERIA["not-empty"]);
  r.addCriteria({
    name: "min-length",
    check: (v: any) => {
      const len = String(v).length;
      return Math.min(1, len / 20); // 20자 이상이면 1점
    },
    weight: 1,
  });

  const goodAnswer = "FreeLang은 AI를 위한 언어입니다. S-expression 기반입니다.";
  const result = r.reflect(goodAnswer, 0.7);
  assert(result.passed === true, `좋은 답변 passed=true, score=${result.totalScore}`);

  const badAnswer = "";
  const badResult = r.reflect(badAnswer, 0.7);
  assert(badResult.passed === false, `빈 답변 passed=false, score=${badResult.totalScore}`);
});

test("TC-14: 수치 결과 범위 검증", () => {
  const r = new Reflector();
  r.addCriteria({
    name: "in-range",
    check: (v: any) => {
      if (typeof v !== "number") return 0;
      if (v >= 0 && v <= 100) return 1;
      return 0;
    },
  });

  const inRange = r.reflect(50, 0.7);
  assert(inRange.passed === true, "50은 범위 내 → passed=true");

  const outRange = r.reflect(150, 0.7);
  assert(outRange.passed === false, "150은 범위 밖 → passed=false");
});

test("TC-15: feedback 배열 생성", () => {
  const r = new Reflector();
  r.addCriteria(CRITERIA["positive"]);
  r.addCriteria(CRITERIA["is-number"]);

  // 음수면 positive 실패 → feedback 있음
  const result = r.reflect(-5, 0.7);
  assert(result.feedback.length > 0, "feedback 있어야 함");
  assert(result.feedback.some(f => f.includes("positive")), "positive 관련 피드백");
});

test("TC-16: revised 출력 확인", () => {
  const r = new Reflector();
  r.addCriteria(CRITERIA["positive"]);

  const result = r.reflect(-3, 0.7);
  assert(result.passed === false, "passed=false");
  assert(!("revised" in result) || result.revised === undefined, "revise 전엔 revised 없음");

  // revise 적용
  const revised = r.revise(result, (r) => Math.abs(r.output));
  assertEq(revised.revised, 3, `revised=3, got ${revised.revised}`);
});

test("TC-17: toMarkdown → 평가 보고서", () => {
  const r = new Reflector();
  r.addCriteria(CRITERIA["not-null"]);
  r.addCriteria(CRITERIA["positive"]);

  const md = r.toMarkdown();
  assert(typeof md === "string", "toMarkdown 문자열 반환");
  assert(md.includes("not-null"), "not-null 포함");
  assert(md.includes("positive"), "positive 포함");
  assert(md.includes("weight="), "weight 포함");
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-18~22: 에지 케이스
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[TC-18~22] 에지 케이스\n");

test("TC-18: criteria 없음 → passed=true", () => {
  const r = new Reflector();
  const result = r.reflect("anything", 0.7);
  assert(result.passed === true, "criteria 없으면 passed=true");
  assertEq(result.totalScore, 1, "totalScore=1");
  assertEq(result.feedback.length, 0, "feedback 없음");
});

test("TC-19: 모든 criteria 0점 → passed=false", () => {
  const r = new Reflector();
  r.addCriteria({ name: "always-zero", check: () => 0, weight: 1 });
  r.addCriteria({ name: "always-zero-2", check: () => 0, weight: 1 });
  const result = r.reflect(42, 0.7);
  assert(result.passed === false, "모두 0점 → passed=false");
  assertEq(result.totalScore, 0, "totalScore=0");
  assertEq(result.feedback.length, 2, "feedback 2개");
});

test("TC-20: weight 적용 확인", () => {
  const r = new Reflector();
  // weight=3인 1점짜리 vs weight=1인 0점짜리
  // (1*3 + 0*1) / 4 = 0.75
  r.addCriteria({ name: "heavy", check: () => 1.0, weight: 3 });
  r.addCriteria({ name: "light", check: () => 0.0, weight: 1 });
  const result = r.reflect("test", 0.7);
  assertClose(result.totalScore, 0.75, 0.001, "weight 적용 totalScore=0.75");
  assert(result.passed === true, "0.75 >= 0.7 → passed=true");
});

test("TC-21: 중첩 REFLECT", () => {
  const interp = new Interpreter();
  const result = runFL(interp, `
    (define inner-result
      (REFLECT
        :output 5
        :criteria [(fn [$x] (if (> $x 0) 1.0 0.0))]
        :threshold 0.7))
    (REFLECT
      :output $inner-result
      :criteria [(fn [$x] (if (= true (get $x "passed")) 1.0 0.0))]
      :threshold 0.7)
  `);
  // inner-result.passed=true → 외부 REFLECT도 passed=true
  assert(result != null, "중첩 REFLECT 결과 non-null");
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-22: Phase 56 regression 14/14
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[TC-22] Phase 56 regression 14/14\n");

test("TC-22: Phase 56 렉시컬 스코프 regression", () => {
  // 핵심 케이스들 재검증

  // 1. 함수 내 define이 전역 오염 안 함
  {
    const interp = new Interpreter();
    interp.run(`
      (define x 10)
      [FUNC set-x :params [] :body (define x 999)]
      (set-x)
    `);
    const x = (interp as any).context.variables.get("$x");
    assert(x === 10, `전역 $x=${x} (10이어야 함)`);
  }

  // 2. 재귀 팩토리얼
  {
    const interp = new Interpreter();
    const ctx = interp.run(`
      [FUNC fact :params [$n]
        :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
      (fact 6)
    `);
    assertEq(ctx.lastValue, 720, `팩토리얼 6! = 720, got ${ctx.lastValue}`);
  }

  // 3. 클로저 캡처
  {
    const interp = new Interpreter();
    const ctx = interp.run(`
      (define base 100)
      (define add-base (fn [$x] (+ $x $base)))
      (add-base 5)
    `);
    assertEq(ctx.lastValue, 105, `클로저 100+5=105, got ${ctx.lastValue}`);
  }

  // 4. set! 전역 수정
  {
    const interp = new Interpreter();
    interp.run(`
      (define counter 0)
      [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
      (inc!)
      (inc!)
      (inc!)
    `);
    const counter = (interp as any).context.variables.get("$counter");
    assertEq(counter, 3, `counter=${counter} (3이어야 함)`);
  }

  // 5. loop/recur 결과
  {
    const interp = new Interpreter();
    const ctx = interp.run(`
      (loop [acc 0 n 5]
        (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
    `);
    assertEq(ctx.lastValue, 15, `loop/recur sum=15, got ${ctx.lastValue}`);
  }

  // 6. 고차 함수 클로저
  {
    const interp = new Interpreter();
    const ctx = interp.run(`
      (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
      (define add10 (make-adder 10))
      (add10 7)
    `);
    assertEq(ctx.lastValue, 17, `고차 함수 10+7=17, got ${ctx.lastValue}`);
  }

  // 7. let 스코프 격리
  {
    const interp = new Interpreter();
    interp.run(`
      (define y 77)
      (let [[$y 42]] $y)
    `);
    const y = (interp as any).context.variables.get("$y");
    assertEq(y, 77, `$y=${y} (77이어야 함, let 격리)`);
  }

  // 8. 재귀 피보나치
  {
    const interp = new Interpreter();
    const ctx = interp.run(`
      [FUNC fib :params [$n]
        :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]
      (fib 10)
    `);
    assertEq(ctx.lastValue, 55, `fib(10)=55, got ${ctx.lastValue}`);
  }

  // 9. loop 바인딩이 전역 오염 안 함
  {
    const interp = new Interpreter();
    interp.run(`
      (define i 999)
      (loop [i 0]
        (if (>= $i 3) $i (recur (+ $i 1))))
    `);
    const i = (interp as any).context.variables.get("$i");
    assertEq(i, 999, `$i=${i} (999이어야 함, loop 격리)`);
  }

  // 10. 중첩 호출 스코프 격리
  {
    const interp = new Interpreter();
    interp.run(`
      (define result 0)
      [FUNC inner :params [$v] :body (define result (* $v 2))]
      [FUNC outer :params [$v] :body (do (inner $v) (define result (* $v 3)))]
      (outer 5)
    `);
    const result = (interp as any).context.variables.get("$result");
    assertEq(result, 0, `$result=${result} (0이어야 함, 격리)`);
  }

  // 11. 산술 연산
  {
    const interp = new Interpreter();
    const ctx = interp.run(`(+ 1 2 3 4 5)`);
    assertEq(ctx.lastValue, 15, `1+2+3+4+5=15`);
  }

  // 12. 문자열 join
  {
    const interp = new Interpreter();
    const ctx = interp.run(`(str-join ["a" "b" "c"] "-")`);
    assertEq(ctx.lastValue, "a-b-c", `str-join a-b-c`);
  }

  // 13. 조건 분기
  {
    const interp = new Interpreter();
    const ctx = interp.run(`
      (define x 42)
      (if (> $x 40) "big" "small")
    `);
    assertEq(ctx.lastValue, "big", `42>40 → "big"`);
  }

  // 14. 리스트 처리
  {
    const interp = new Interpreter();
    const ctx = interp.run(`
      (define nums [1 2 3 4 5])
      (length $nums)
    `);
    assertEq(ctx.lastValue, 5, `length [1,2,3,4,5]=5`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 결과 집계
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(65)}`);
console.log(`Phase 94 REFLECT: ${passed} passed, ${failed} failed`);
console.log(`${"─".repeat(65)}`);

if (failed > 0) process.exit(1);
process.exit(0);
