// Phase 65: 향상된 패턴 매칭 테스트
// 가드(when), as 바인딩, 중첩 패턴, 범위 패턴

import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg || "assertEqual"}: expected ${e}, got ${a}`);
  }
}

function run(code: string): any {
  const interp = new Interpreter();
  const ctx = interp.run(code);
  return ctx.lastValue;
}

// ─── TC-1: 기본 match (기존 동작 유지) ──────────────────────────────────
console.log("\n[TC-1] 기본 match 동작 확인");

test("TC-1a: 리터럴 매칭", () => {
  assertEqual(run(`
    (match 42
      (1 "one")
      (42 "forty-two")
      (_ "other"))
  `), "forty-two", "literal match");
});

test("TC-1b: 변수 바인딩 패턴", () => {
  assertEqual(run(`
    (match 7
      ($n (+ $n 10)))
  `), 17, "variable binding");
});

test("TC-1c: 와일드카드", () => {
  assertEqual(run(`
    (match "hello"
      (1 "number")
      (_ "wildcard"))
  `), "wildcard", "wildcard");
});

test("TC-1d: define + match", () => {
  assertEqual(run(`
    (define score 42)
    (match score
      (1 "one")
      (42 "forty-two")
      (_ "other"))
  `), "forty-two", "define+match");
});

// ─── TC-2: 가드 (when) — 조건부 매칭 ───────────────────────────────────
console.log("\n[TC-2] 가드 (when) 조건부 매칭");

test("TC-2a: when 가드 — 점수 95 → A", () => {
  assertEqual(run(`
    (define score 95)
    (match score
      ($x (when (>= $x 90)) "A")
      ($x (when (>= $x 80)) "B")
      ($x (when (>= $x 70)) "C")
      (_ "F"))
  `), "A", "score 95 -> A");
});

test("TC-2b: when 가드 — 점수 85 → B", () => {
  assertEqual(run(`
    (define score 85)
    (match score
      ($x (when (>= $x 90)) "A")
      ($x (when (>= $x 80)) "B")
      ($x (when (>= $x 70)) "C")
      (_ "F"))
  `), "B", "score 85 -> B");
});

test("TC-2c: when 가드 — 점수 55 → F", () => {
  assertEqual(run(`
    (define score 55)
    (match score
      ($x (when (>= $x 90)) "A")
      ($x (when (>= $x 80)) "B")
      ($x (when (>= $x 70)) "C")
      (_ "F"))
  `), "F", "score 55 -> F");
});

test("TC-2d: when 가드 inline (변수 없이)", () => {
  assertEqual(run(`
    (match 95
      ($x (when (>= $x 90)) "A")
      (_ "F"))
  `), "A", "inline guard A");
});

// ─── TC-3: as 바인딩 — 전체 매칭값을 변수에 바인딩 ──────────────────────
console.log("\n[TC-3] as 바인딩");

test("TC-3a: struct :as $p 바인딩 (inside braces)", () => {
  assertEqual(run(`
    (define point {:x 3 :y 4})
    (match point
      ({:x $x :y $y :as $p} (str "Point " $x "," $y))
      (_ "unknown"))
  `), "Point 3,4", "as binding inside braces");
});

test("TC-3b: as 바인딩으로 원본 객체 접근 (outside braces)", () => {
  assertEqual(run(`
    (define obj {:name "kim" :age 30})
    (match obj
      ({:name $n} :as $o (str $n " age=" (get $o :age)))
      (_ "no"))
  `), "kim age=30", "as binding get field");
});

// ─── TC-4: 중첩 객체 패턴 ────────────────────────────────────────────────
console.log("\n[TC-4] 중첩/struct 객체 패턴");

test("TC-4a: 단순 struct 패턴 매칭", () => {
  assertEqual(run(`
    (define user {:name "alice" :age 25})
    (match user
      ({:name $name :age $age} (str $name " is " $age))
      (_ "unknown"))
  `), "alice is 25", "struct pattern alice");
});

test("TC-4b: struct 패턴 with guard — adult 판별", () => {
  assertEqual(run(`
    (define user {:name "bob" :age 17})
    (match user
      ({:name $name :age $age} (when (>= $age 18)) (str $name " is adult"))
      ({:name $name :age $age} (str $name " is minor"))
      (_ "unknown"))
  `), "bob is minor", "struct guard minor");
});

test("TC-4c: struct 패턴 — adult 판별 성공", () => {
  assertEqual(run(`
    (define user {:name "carol" :age 25})
    (match user
      ({:name $name :age $age} (when (>= $age 18)) (str $name " is adult"))
      ({:name $name :age $age} (str $name " is minor"))
      (_ "unknown"))
  `), "carol is adult", "struct guard adult");
});

// ─── TC-5: 범위 패턴 (range) ─────────────────────────────────────────────
console.log("\n[TC-5] 범위 패턴 (range)");

test("TC-5a: 범위 패턴 — small (5)", () => {
  assertEqual(run(`
    (match 5
      ((range 1 10) "small")
      ((range 10 100) "medium")
      (_ "large"))
  `), "small", "range small 5");
});

test("TC-5b: 범위 패턴 — medium (50)", () => {
  assertEqual(run(`
    (match 50
      ((range 1 10) "small")
      ((range 10 100) "medium")
      (_ "large"))
  `), "medium", "range medium 50");
});

test("TC-5c: 범위 패턴 — large (200)", () => {
  assertEqual(run(`
    (match 200
      ((range 1 10) "small")
      ((range 10 100) "medium")
      (_ "large"))
  `), "large", "range large 200");
});

test("TC-5d: 범위 패턴 — 경계값 10은 medium", () => {
  assertEqual(run(`
    (match 10
      ((range 1 10) "small")
      ((range 10 100) "medium")
      (_ "large"))
  `), "medium", "range boundary 10");
});

// ─── TC-6: 가드 실패 시 fallthrough ──────────────────────────────────────
console.log("\n[TC-6] 가드 실패 시 fallthrough");

test("TC-6a: guard 실패 → 다음 케이스로 (5 → medium)", () => {
  assertEqual(run(`
    (match 5
      ($x (when (> $x 10)) "big")
      ($x (when (> $x 3))  "medium")
      (_ "small"))
  `), "medium", "fallthrough to medium");
});

test("TC-6b: 모든 guard 실패 → default (1 → small)", () => {
  assertEqual(run(`
    (match 1
      ($x (when (> $x 10)) "big")
      ($x (when (> $x 3))  "medium")
      (_ "small"))
  `), "small", "fallthrough to default");
});

test("TC-6c: 첫 guard 성공 — 2번째로 내려가지 않음 (15 → big)", () => {
  assertEqual(run(`
    (match 15
      ($x (when (> $x 10)) "big")
      ($x (when (> $x 3))  "medium")
      (_ "small"))
  `), "big", "first guard wins");
});

// ─── TC-7: Phase 56 regression 14/14 ─────────────────────────────────────
console.log("\n[TC-7] Phase 56 regression");

test("TC-7a: define + 재귀 함수 (factorial)", () => {
  assertEqual(run(`
    [FUNC factorial :params [$n]
      :body (if (< $n 2) 1 (* $n (factorial (- $n 1))))]
    (factorial 5)
  `), 120, "factorial 5 = 120");
});

test("TC-7b: 클로저 렉시컬 스코프", () => {
  // define x → 10, define f → closure capturing x=10, redefine x → 20, call f → 10
  assertEqual(run(`
    (define x 10)
    [FUNC make-adder :params [$n] :body (fn [$m] (+ $m $n))]
    (define add5 (make-adder 5))
    (add5 3)
  `), 8, "closure add5 3 = 8");
});

test("TC-7c: 패턴 매칭 + define 결합", () => {
  assertEqual(run(`
    [FUNC classify :params [$x]
      :body (match $x
        ($n (when (> $n 0)) "positive")
        ($n (when (< $n 0)) "negative")
        (_ "zero"))]
    (str (classify 5) "-" (classify -3) "-" (classify 0))
  `), "positive-negative-zero", "classify pattern");
});

test("TC-7d: struct 패턴 + guard 결합", () => {
  assertEqual(run(`
    [FUNC check-user :params [$u]
      :body (match $u
        ({:name $name :age $age} (when (>= $age 18)) (str $name " OK"))
        ({:name $name} (str $name " MINOR"))
        (_ "unknown"))]
    (check-user {:name "alice" :age 25})
  `), "alice OK", "struct guard in function");
});

test("TC-7e: range 패턴 + define 결합", () => {
  assertEqual(run(`
    [FUNC categorize :params [$n]
      :body (match $n
        ((range 1 10) "small")
        ((range 10 100) "medium")
        (_ "large"))]
    (str (categorize 5) "-" (categorize 50) "-" (categorize 500))
  `), "small-medium-large", "range in function");
});

// ─── 결과 ─────────────────────────────────────────────────────────────────
console.log("\n──────────────────────────────────────────────────");
console.log(`Phase 65 향상된 패턴 매칭: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
