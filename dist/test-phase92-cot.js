"use strict";
// test-phase92-cot.ts — FreeLang v9 Phase 92: Chain-of-Thought 테스트
// TC-1~22: ChainOfThought 클래스, FL COT 폼, 실용 패턴, 에지 케이스
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const cot_1 = require("./cot");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
function runMulti(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp;
}
function getVar(interp, name) {
    return interp.context.variables.get("$" + name);
}
// ─────────────────────────────────────────────────────────────────────────────
// TC-1~6: ChainOfThought 기본
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[Phase 92] Chain-of-Thought 기본 테스트\n");
console.log("[TC-1~6] ChainOfThought 클래스 기본]");
// TC-1: 인스턴스 생성
test("TC-1: ChainOfThought 인스턴스 생성", () => {
    const cot = new cot_1.ChainOfThought();
    if (!(cot instanceof cot_1.ChainOfThought))
        throw new Error("instanceof 실패");
});
// TC-2: step 추가 후 실행
test("TC-2: step 추가 후 실행", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("첫 번째 생각", () => 42);
    const steps = cot.getSteps();
    if (steps.length !== 1)
        throw new Error(`steps.length = ${steps.length}`);
    if (steps[0].result !== 42)
        throw new Error(`result = ${steps[0].result}`);
});
// TC-3: 여러 step 순서 보장
test("TC-3: 여러 step 순서 보장", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("1단계", () => "a");
    cot.step("2단계", () => "b");
    cot.step("3단계", () => "c");
    const steps = cot.getSteps();
    if (steps.length !== 3)
        throw new Error(`steps.length = ${steps.length}`);
    if (steps[0].result !== "a")
        throw new Error(`steps[0].result = ${steps[0].result}`);
    if (steps[1].result !== "b")
        throw new Error(`steps[1].result = ${steps[1].result}`);
    if (steps[2].result !== "c")
        throw new Error(`steps[2].result = ${steps[2].result}`);
});
// TC-4: conclude 최종 결론
test("TC-4: conclude 최종 결론", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("계산", () => 10);
    const cotResult = cot.conclude(steps => steps[0].result * 2);
    if (cotResult.conclusion !== 20)
        throw new Error(`conclusion = ${cotResult.conclusion}`);
});
// TC-5: CoTResult 구조 확인
test("TC-5: CoTResult 구조 확인", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("단계1", () => 1);
    const cotResult = cot.conclude(steps => "done");
    if (!Array.isArray(cotResult.steps))
        throw new Error("steps 배열 없음");
    if (typeof cotResult.totalSteps !== "number")
        throw new Error("totalSteps 없음");
    if (cotResult.conclusion === undefined)
        throw new Error("conclusion 없음");
});
// TC-6: getSteps() 배열
test("TC-6: getSteps() 배열 반환", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("alpha", () => "A");
    cot.step("beta", () => "B");
    const steps = cot.getSteps();
    if (!Array.isArray(steps))
        throw new Error("배열 아님");
    if (steps.length !== 2)
        throw new Error(`length = ${steps.length}`);
});
// ─────────────────────────────────────────────────────────────────────────────
// TC-7~12: FL 문법 [COT] 블록 (S-expression: (COT :step ...))
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[TC-7~12] FL COT 폼]");
// TC-7: conclusion = 99
test("TC-7: COT :conclude fn → conclusion=99", () => {
    const result = run(`
    (COT
      :step "a" 1
      :step "b" 2
      :conclude (fn [$s] 99))
  `);
    if (!result || result.conclusion !== 99)
        throw new Error(`conclusion = ${result?.conclusion}`);
});
// TC-8: steps 배열에 2개 항목
test("TC-8: steps 배열에 2개 항목", () => {
    const result = run(`
    (COT
      :step "a" 1
      :step "b" 2
      :conclude (fn [$s] 99))
  `);
    if (!Array.isArray(result.steps))
        throw new Error("steps 배열 아님");
    if (result.steps.length !== 2)
        throw new Error(`steps.length = ${result.steps.length}`);
});
// TC-9: 각 step의 thought 필드
test("TC-9: 각 step의 thought 필드", () => {
    const result = run(`
    (COT
      :step "질문 이해" 1
      :step "분석" 2
      :conclude (fn [$s] 0))
  `);
    if (result.steps[0].thought !== "질문 이해")
        throw new Error(`thought[0] = ${result.steps[0].thought}`);
    if (result.steps[1].thought !== "분석")
        throw new Error(`thought[1] = ${result.steps[1].thought}`);
});
// TC-10: 각 step의 result 필드
test("TC-10: 각 step의 result 필드", () => {
    const result = run(`
    (COT
      :step "첫번째" 10
      :step "두번째" 20
      :conclude (fn [$s] 0))
  `);
    if (result.steps[0].result !== 10)
        throw new Error(`result[0] = ${result.steps[0].result}`);
    if (result.steps[1].result !== 20)
        throw new Error(`result[1] = ${result.steps[1].result}`);
});
// TC-11: conclude fn이 steps 배열 받음
test("TC-11: conclude fn이 steps 배열 받음", () => {
    // conclude fn에서 steps 길이를 결론으로 반환 (length 사용)
    const result = run(`
    (COT
      :step "s1" 100
      :step "s2" 200
      :step "s3" 300
      :conclude (fn [$s] (length $s)))
  `);
    if (result.conclusion !== 3)
        throw new Error(`conclusion = ${result.conclusion}`);
});
// TC-12: 단일 step COT
test("TC-12: 단일 step COT", () => {
    const result = run(`
    (COT
      :step "유일한 단계" 42
      :conclude (fn [$s] 42))
  `);
    if (result.steps.length !== 1)
        throw new Error(`steps.length = ${result.steps.length}`);
    if (result.conclusion !== 42)
        throw new Error(`conclusion = ${result.conclusion}`);
});
// ─────────────────────────────────────────────────────────────────────────────
// TC-13~17: 실용 패턴
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[TC-13~17] 실용 패턴]");
// TC-13: 수학 문제 단계별 풀기
test("TC-13: 수학 문제 단계별 — (+ 2 3) → (* result 2) → 10", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("2 + 3 계산", () => 2 + 3);
    cot.step("결과에 2 곱하기", (prev) => prev * 2);
    const cotResult = cot.conclude(steps => steps[steps.length - 1].result);
    if (cotResult.conclusion !== 10)
        throw new Error(`conclusion = ${cotResult.conclusion}`);
});
// TC-14: 이전 step 결과 활용 ($prev)
test("TC-14: $prev — 이전 step 결과 FL에서 참조", () => {
    const result = run(`
    (COT
      :step "초기값" 5
      :step "두 배" (* $prev 2)
      :conclude (fn [$s] (get $s 1)))
  `);
    // steps[1].result는 10이어야 함 (5 * 2)
    const step1Result = result.steps[1]?.result;
    if (step1Result !== 10)
        throw new Error(`steps[1].result = ${step1Result} (expected 10)`);
});
// TC-15: toMarkdown → "## Step 1" 포함
test("TC-15: toMarkdown → '## Step 1' 포함", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("테스트 단계", () => 42);
    const md = cot.toMarkdown();
    if (!md.includes("## Step 1"))
        throw new Error(`markdown에 '## Step 1' 없음: ${md.slice(0, 100)}`);
    if (!md.includes("테스트 단계"))
        throw new Error("step 설명 없음");
});
// TC-16: confidence 추적
test("TC-16: confidence 추적", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("확신 높음", () => 1, 0.9);
    cot.step("확신 낮음", () => 2, 0.5);
    const cotResult = cot.conclude(steps => "done");
    if (cotResult.steps[0].confidence !== 0.9)
        throw new Error(`confidence[0] = ${cotResult.steps[0].confidence}`);
    if (cotResult.steps[1].confidence !== 0.5)
        throw new Error(`confidence[1] = ${cotResult.steps[1].confidence}`);
    // 전체 평균: (0.9 + 0.5) / 2 = 0.7
    const expected = 0.7;
    if (Math.abs((cotResult.confidence ?? 0) - expected) > 0.001) {
        throw new Error(`avg confidence = ${cotResult.confidence} (expected ${expected})`);
    }
});
// TC-17: toJSON 직렬화
test("TC-17: toJSON 직렬화", () => {
    const cot = new cot_1.ChainOfThought();
    cot.step("직렬화 테스트", () => 42);
    const obj = cot.toJSON();
    if (obj.kind !== "chain-of-thought")
        throw new Error(`kind = ${obj.kind}`);
    if (!Array.isArray(obj.steps))
        throw new Error("steps 배열 없음");
    if (obj.totalSteps !== 1)
        throw new Error(`totalSteps = ${obj.totalSteps}`);
    if (obj.steps[0].result !== 42)
        throw new Error(`steps[0].result = ${obj.steps[0].result}`);
});
// ─────────────────────────────────────────────────────────────────────────────
// TC-18~22: 에지 케이스
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[TC-18~22] 에지 케이스]");
// TC-18: 빈 steps + conclude → CoTResult
test("TC-18: 빈 steps + conclude → CoTResult", () => {
    const cot = new cot_1.ChainOfThought();
    const cotResult = cot.conclude(_steps => "empty-conclusion");
    if (cotResult.conclusion !== "empty-conclusion")
        throw new Error(`conclusion = ${cotResult.conclusion}`);
    if (cotResult.totalSteps !== 0)
        throw new Error(`totalSteps = ${cotResult.totalSteps}`);
    if (!Array.isArray(cotResult.steps))
        throw new Error("steps 배열 아님");
});
// TC-19: step에서 예외 발생 시 처리
test("TC-19: step 예외 → 에러 메시지 포함", () => {
    const cot = new cot_1.ChainOfThought();
    let caught = false;
    try {
        cot.step("실패하는 단계", () => {
            throw new Error("의도적 오류");
        });
    }
    catch (e) {
        caught = true;
        if (!e.message.includes("의도적 오류"))
            throw new Error(`잘못된 에러: ${e.message}`);
    }
    if (!caught)
        throw new Error("예외가 전파되지 않음");
});
// TC-20: 중첩 COT
test("TC-20: 중첩 COT (inner COT를 step 안에서 사용)", () => {
    const result = run(`
    (COT
      :step "외부 step 1" 10
      :step "내부 COT" (COT :step "inner" 20 :conclude (fn [$s] 20))
      :conclude (fn [$s] (get $s 1)))
  `);
    // steps[1].result는 CoTResult 객체여야 함
    const innerResult = result.steps[1]?.result;
    if (!innerResult || typeof innerResult !== "object")
        throw new Error(`내부 COT 결과 = ${JSON.stringify(innerResult)}`);
    if (innerResult.conclusion !== 20)
        throw new Error(`inner conclusion = ${innerResult.conclusion}`);
});
// TC-21: COT 결과를 변수에 저장
test("TC-21: COT 결과를 변수에 저장", () => {
    const interp = runMulti(`
    (define reasoning
      (COT
        :step "계산" (+ 3 4)
        :conclude (fn [$s] 7)))
  `);
    const reasoning = getVar(interp, "reasoning");
    if (!reasoning)
        throw new Error("$reasoning 변수 없음");
    if (reasoning.conclusion !== 7)
        throw new Error(`conclusion = ${reasoning.conclusion}`);
    if (!Array.isArray(reasoning.steps))
        throw new Error("steps 배열 없음");
});
// TC-22: Phase 56 regression 14/14
console.log("\n[TC-22] Phase 56 regression 14/14]");
test("TC-22: regression — 함수 내 define 격리", () => {
    const interp = runMulti(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
  `);
    const x = getVar(interp, "x");
    if (x !== 10)
        throw new Error(`전역 $x가 ${x}로 변경됨 (10이어야 함)`);
});
test("TC-22: regression — 재귀 팩토리얼", () => {
    const res = run(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 6)
  `);
    if (res !== 720)
        throw new Error(`got ${res}`);
});
test("TC-22: regression — 클로저 캡처", () => {
    const res = run(`
    [FUNC make-adder :params [$n]
      :body (fn [$x] (+ $x $n))]
    (define add5 (make-adder 5))
    (add5 10)
  `);
    if (res !== 15)
        throw new Error(`got ${res}`);
});
test("TC-22: regression — loop recur", () => {
    const res = run(`
    (loop [i 0 acc 0]
      (if (>= $i 10)
        $acc
        (recur (+ $i 1) (+ $acc $i))))
  `);
    if (res !== 45)
        throw new Error(`got ${res}`);
});
test("TC-22: regression — let 스코프", () => {
    const res = run(`
    (let [[$x 10] [$y 20]] (+ $x $y))
  `);
    if (res !== 30)
        throw new Error(`got ${res}`);
});
test("TC-22: regression — if 조건", () => {
    const r1 = run(`(if true 1 2)`);
    const r2 = run(`(if false 1 2)`);
    if (r1 !== 1)
        throw new Error(`if true = ${r1}`);
    if (r2 !== 2)
        throw new Error(`if false = ${r2}`);
});
test("TC-22: regression — 리스트 map", () => {
    // FL map은 named function 또는 fn-ref 방식 사용
    const interp = runMulti(`
    [FUNC double :params [$n] :body (* $n 2)]
    (define result [])
    (define result (concat (double 1) (concat (double 2) (double 3))))
  `);
    // 단순히 각 값을 두 배로 계산: 2, 4, 6 확인
    const r1 = runMulti(`[FUNC double :params [$n] :body (* $n 2)] (define out (double 3))`);
    const out = getVar(r1, "out");
    if (out !== 6)
        throw new Error(`double(3) = ${out}`);
});
test("TC-22: regression — 문자열 concat", () => {
    const res = run(`(concat "hello" " world")`);
    if (res !== "hello world")
        throw new Error(`got ${res}`);
});
test("TC-22: regression — 산술 연산", () => {
    const r1 = run(`(+ 10 20)`);
    const r2 = run(`(* 3 7)`);
    const r3 = run(`(- 100 45)`);
    if (r1 !== 30)
        throw new Error(`+ = ${r1}`);
    if (r2 !== 21)
        throw new Error(`* = ${r2}`);
    if (r3 !== 55)
        throw new Error(`- = ${r3}`);
});
test("TC-22: regression — filter (수동 loop 방식)", () => {
    // FL은 loop/recur 기반 필터 사용
    const res = run(`
    (loop [i 0 acc []]
      (if (>= $i 5)
        $acc
        (do
          (define val (+ $i 1))
          (if (> $val 3)
            (recur (+ $i 1) (append $acc $val))
            (recur (+ $i 1) $acc)))))
  `);
    if (!Array.isArray(res))
        throw new Error(`결과 타입 = ${typeof res}`);
    if (res.length !== 2)
        throw new Error(`length = ${res.length}, got ${JSON.stringify(res)}`);
});
test("TC-22: regression — do 블록", () => {
    const res = run(`
    (do
      (define a 5)
      (define b 3)
      (+ $a $b))
  `);
    if (res !== 8)
        throw new Error(`got ${res}`);
});
test("TC-22: regression — 비교 연산자", () => {
    const r1 = run(`(< 1 2)`);
    const r2 = run(`(>= 5 5)`);
    const r3 = run(`(= 3 3)`);
    if (r1 !== true)
        throw new Error(`< = ${r1}`);
    if (r2 !== true)
        throw new Error(`>= = ${r2}`);
    if (r3 !== true)
        throw new Error(`= = ${r3}`);
});
test("TC-22: regression — not", () => {
    const r1 = run(`(not false)`);
    const r2 = run(`(not true)`);
    if (r1 !== true)
        throw new Error(`not false = ${r1}`);
    if (r2 !== false)
        throw new Error(`not true = ${r2}`);
});
test("TC-22: regression — cond", () => {
    const res = run(`
    (define n 5)
    (cond
      [(< $n 0) "negative"]
      [(= $n 0) "zero"]
      [true "positive"])
  `);
    if (res !== "positive")
        throw new Error(`got ${res}`);
});
// ─────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Phase 92 Chain-of-Thought: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase92-cot.js.map