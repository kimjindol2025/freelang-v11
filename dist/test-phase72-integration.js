"use strict";
// FreeLang v9: Phase 72 — Tier 2 통합 검증
// Phase 63-71 기능이 함께 잘 동작하는지 통합 테스트
// TC-1: defstruct + defprotocol + impl 연동 (todo-app 패턴)
// TC-2: -> 파이프라인 + push/map 조합
// TC-3: defmacro when + unless 동작
// TC-4: iterate (lazy) + take + filter-lazy
// TC-5: parallel + channel 연동
// TC-6: 전체 회귀: Phase 56 14/14 + Phase 61 TCO + Phase 62
// TC-7: AI 네이티브 mock 동작
// TC-8: 이뮤터블 맵 + 프로토콜 연동
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  PASS  ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  FAIL  ${name}: ${String(e.message ?? e).slice(0, 160)}`);
        failed++;
    }
}
function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(`${msg ?? "assertEqual"}: expected ${e}, got ${a}`);
}
function assertContains(actual, substr, msg) {
    if (!actual.includes(substr))
        throw new Error(`${msg ?? "assertContains"}: "${actual}" does not contain "${substr}"`);
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    const ctx = interp.run(src);
    interp.destroy();
    return ctx.lastValue;
}
function runInterp(src) {
    const interp = new interpreter_1.Interpreter();
    interp.run(src);
    return interp;
}
function getVar(interp, name) {
    // FreeLang define은 "$" + name으로 저장됨
    const withDollar = "$" + name;
    const val = interp.context.variables.get(withDollar);
    if (val !== undefined)
        return val;
    // fallback: 함수 레지스트리에서도 확인
    return interp.context.functions.get(name)?.capturedValue
        ?? interp.context.variables.get(name);
}
// ══════════════════════════════════════════════════════════════════════
console.log("\n=== Phase 72: Tier 2 통합 검증 ===\n");
// ── TC-1: defstruct + defprotocol + impl 연동 ─────────────────────────
console.log("[TC-1] defstruct + defprotocol + impl 연동 (todo-app 패턴)");
test("TC-1a: defstruct Todo 생성 + get 필드 접근", () => {
    const result = run(`
    (defstruct Todo [:id :int :title :string :done :bool])
    (define t (Todo 1 "FreeLang 완성" false))
    (get t :title)
  `);
    assertEqual(result, "FreeLang 완성", "Todo 타이틀 접근");
});
test("TC-1b: defprotocol + impl — display 메서드", () => {
    const result = run(`
    (defstruct Todo [:id :int :title :string :done :bool])
    (defprotocol Displayable
      [display [$self] :string])
    (impl Displayable Todo
      [display [$self]
        (str (if (get $self :done) "✓" "○") " " (get $self :title))])
    (define t (Todo 0 "Phase 72 완성" false))
    (display t)
  `);
    assertEqual(result, "○ Phase 72 완성", "display 메서드 동작");
});
test("TC-1c: defprotocol + impl — toggle 후 display", () => {
    const result = run(`
    (defstruct Todo [:id :int :title :string :done :bool])
    (defprotocol Displayable
      [display [$self] :string])
    (defprotocol Toggleable
      [toggle [$self] :any])
    (impl Displayable Todo
      [display [$self]
        (str (if (get $self :done) "✓" "○") " " (get $self :title))])
    (impl Toggleable Todo
      [toggle [$self]
        (Todo (get $self :id) (get $self :title) true)])
    (define t (Todo 1 "테스트" false))
    (define t2 (toggle t))
    (display t2)
  `);
    assertEqual(result, "✓ 테스트", "toggle 후 display");
});
test("TC-1d: 다형성 — 여러 구조체에 같은 프로토콜", () => {
    const result = run(`
    (defstruct Dog [:name :string])
    (defstruct Cat [:name :string])
    (defprotocol Greet
      [greet [$self] :string])
    (impl Greet Dog
      [greet [$self] (str "멍멍! 나는 " (get $self :name))])
    (impl Greet Cat
      [greet [$self] (str "야옹~ 나는 " (get $self :name))])
    (define d (Dog "바둑이"))
    (define c (Cat "야옹이"))
    (str (greet d) " / " (greet c))
  `);
    assertEqual(result, "멍멍! 나는 바둑이 / 야옹~ 나는 야옹이", "다형성 dispatch");
});
// ── TC-2: -> 파이프라인 + push/map 조합 ───────────────────────────────
console.log("\n[TC-2] 파이프라인 + 컬렉션 조합");
test("TC-2a: -> 산술 파이프라인", () => {
    const result = run(`
    (-> 10
      (+ 5)
      (* 2)
      (- 3))
  `);
    // (10+5)=15 (*2)=30 (-3)=27
    assertEqual(result, 27, "-> 산술 파이프라인");
});
test("TC-2b: ->> 마지막 인자 삽입", () => {
    const result = run(`
    (->> 5
      (* 4)
      (+ 100))
  `);
    // (* 4 5)=20, (+ 100 20)=120
    assertEqual(result, 120, "->> 파이프라인");
});
test("TC-2c: |> 파이프 (pipe 별칭)", () => {
    const result = run(`
    (define double (fn [$x] (* $x 2)))
    (define inc (fn [$x] (+ $x 1)))
    (|> 7 double inc)
  `);
    // double(7)=14, inc(14)=15
    assertEqual(result, 15, "|> 파이프");
});
test("TC-2d: -> + map 3-arg 조합", () => {
    const interp = runInterp(`
    (define nums [1 2 3 4 5])
    (define result
      (-> (+ 1 1)
        (+ 3)))
    (define mapped (map nums [$x] (* $x result)))
  `);
    // result = 5, mapped = [5, 10, 15, 20, 25]
    const mapped = getVar(interp, "mapped");
    const result = getVar(interp, "result");
    interp.destroy();
    assertEqual(result, 5, "-> 결과 = 5");
    assertEqual(mapped, [5, 10, 15, 20, 25], "-> + map 조합");
});
// ── TC-3: defmacro when + unless ─────────────────────────────────────
console.log("\n[TC-3] 매크로 when + unless 동작");
test("TC-3a: when — 조건이 true일 때 실행", () => {
    const result = run(`
    (defmacro when [$cond $body]
      (if $cond $body nil))
    (when true "실행됨")
  `);
    assertEqual(result, "실행됨", "when true");
});
test("TC-3b: when — 조건이 false일 때 nil", () => {
    const result = run(`
    (defmacro when [$cond $body]
      (if $cond $body nil))
    (when false "실행됨")
  `);
    // FreeLang nil → JS null 또는 "nil" 문자열 (구현에 따라)
    assert(result === null || result === undefined || result === "nil", `when false → nil/null (got ${JSON.stringify(result)})`);
});
test("TC-3c: unless — 조건이 false일 때 실행", () => {
    const result = run(`
    (defmacro unless [$cond $body]
      (if $cond nil $body))
    (unless false "unless 실행됨")
  `);
    assertEqual(result, "unless 실행됨", "unless false");
});
test("TC-3d: 매크로 조합 — with-logging DSL", () => {
    const result = run(`
    (defmacro with-logging [$name $body]
      (do
        (println (str "시작: " $name))
        (define _result $body)
        (println (str "완료: " $name))
        _result))
    (with-logging "계산" (* 6 7))
  `);
    assertEqual(result, 42, "with-logging 반환값");
});
test("TC-3e: 매크로 + 구조체 조합", () => {
    const result = run(`
    (defmacro when [$cond $body]
      (if $cond $body nil))
    (defstruct Point [:x :float :y :float])
    (define p (Point 3.0 4.0))
    (define x (get p :x))
    (when (> x 0) "양수 x")
  `);
    assertEqual(result, "양수 x", "매크로 + 구조체 조합");
});
// ── TC-4: iterate (lazy) + take + filter-lazy ────────────────────────
console.log("\n[TC-4] 레이지 시퀀스");
test("TC-4a: iterate + take 5 자연수", () => {
    const result = run(`
    (define naturals (iterate (fn [$n] (+ $n 1)) 1))
    (take 5 naturals)
  `);
    assertEqual(result, [1, 2, 3, 4, 5], "iterate 자연수 5개");
});
test("TC-4b: filter-lazy 짝수 + take 4", () => {
    const result = run(`
    (define naturals (iterate (fn [$n] (+ $n 1)) 1))
    (define evens (filter-lazy (fn [$x] (even? $x)) naturals))
    (take 4 evens)
  `);
    assertEqual(result, [2, 4, 6, 8], "레이지 짝수 4개");
});
test("TC-4c: map-lazy 제곱 + take 4", () => {
    const result = run(`
    (define naturals (iterate (fn [$n] (+ $n 1)) 1))
    (define squares (map-lazy (fn [$x] (* $x $x)) naturals))
    (take 4 squares)
  `);
    assertEqual(result, [1, 4, 9, 16], "레이지 제곱 4개");
});
test("TC-4d: drop + take 조합", () => {
    const result = run(`
    (define naturals (iterate (fn [$n] (+ $n 1)) 0))
    (define d (drop 5 naturals))
    (take 3 d)
  `);
    assertEqual(result, [5, 6, 7], "drop 5 then take 3");
});
test("TC-4e: range + filter-lazy 조합", () => {
    const result = run(`
    (define r (range 20))
    (define odds (filter-lazy (fn [$x] (odd? $x)) r))
    (take 5 odds)
  `);
    assertEqual(result, [1, 3, 5, 7, 9], "range 홀수 5개");
});
// ── TC-5: parallel + channel 연동 ────────────────────────────────────
console.log("\n[TC-5] parallel + channel 연동");
test("TC-5a: parallel — 기본 동작", async () => {
    const result = run(`
    (parallel
      (+ 1 2)
      (* 3 4)
      (str "hello"))
  `);
    // parallel은 배열 반환
    assert(Array.isArray(result), "parallel은 배열 반환");
    assertEqual(result[0], 3, "parallel[0] = 3");
    assertEqual(result[1], 12, "parallel[1] = 12");
    assertEqual(result[2], "hello", "parallel[2] = hello");
});
test("TC-5b: channel — send/recv", () => {
    const result = run(`
    (define ch (chan))
    (chan-send ch 42)
    (chan-recv ch)
  `);
    assertEqual(result, 42, "channel send/recv = 42");
});
test("TC-5c: channel — 여러 값", () => {
    const result = run(`
    (define ch (chan))
    (chan-send ch "A")
    (chan-send ch "B")
    (chan-send ch "C")
    (define v1 (chan-recv ch))
    (define v2 (chan-recv ch))
    (str v1 v2)
  `);
    assertEqual(result, "AB", "channel FIFO");
});
test("TC-5d: parallel + channel 조합", () => {
    const result = run(`
    (define ch (chan))
    (parallel
      (chan-send ch 10)
      (chan-send ch 20))
    (define v1 (chan-recv ch))
    (define v2 (chan-recv ch))
    (+ v1 v2)
  `);
    assertEqual(result, 30, "parallel 채널 합산");
});
// ── TC-6: 전체 회귀 — Phase 56 + Phase 61 TCO ────────────────────────
console.log("\n[TC-6] 전체 회귀");
test("TC-6a: [Phase 56] 클로저 캡처", () => {
    const result = run(`
    (define make-adder (fn [$x]
      (fn [$y] (+ $x $y))))
    (define add5 (make-adder 5))
    (add5 10)
  `);
    assertEqual(result, 15, "클로저 캡처 15");
});
test("TC-6b: [Phase 56] let 바인딩", () => {
    const result = run(`
    (let [[$x 10] [$y 20]]
      (+ $x $y))
  `);
    assertEqual(result, 30, "let 바인딩 30");
});
test("TC-6c: [Phase 56] 재귀 함수", () => {
    const result = run(`
    (define fib (fn [$n]
      (if (< $n 2)
        $n
        (+ (fib (- $n 1)) (fib (- $n 2))))))
    (fib 10)
  `);
    assertEqual(result, 55, "fib(10) = 55");
});
test("TC-6d: [Phase 61] TCO — callUserFunctionTCO 50만 재귀", () => {
    const { callUserFunctionTCO } = require("./eval-call-function");
    const interp = new interpreter_1.Interpreter();
    interp.run(`
    (define count-down (fn [$n]
      (if (= $n 0)
        0
        (count-down (- $n 1)))))
  `);
    const start = Date.now();
    const result = callUserFunctionTCO(interp, "count-down", [500000]);
    const elapsed = Date.now() - start;
    interp.destroy();
    assertEqual(result, 0, "TCO count-down 500000 → 0");
    assert(elapsed < 5000, `TCO 50만 재귀가 5초 이내여야 함 (${elapsed}ms)`);
});
test("TC-6e: [Phase 63] 표준 매크로 when — 등록 확인", () => {
    // 매크로가 등록되어 있는지 확인
    const interp = new interpreter_1.Interpreter();
    const expander = interp.context?.macroExpander;
    const hasWhen = expander?.has("when") ?? false;
    interp.destroy();
    assert(hasWhen, "when 매크로가 표준 라이브러리에 등록됨");
});
test("TC-6f: [Phase 64] 프로토콜 다형성", () => {
    const result = run(`
    (defprotocol Summable
      [sum-val [$self] :number])
    (impl Summable IntBox
      [sum-val [$self] (get $self :val)])
    (define b {:val 42 :__type "IntBox"})
    (sum-val b)
  `);
    assertEqual(result, 42, "프로토콜 sum-val 42");
});
test("TC-6g: [Phase 66] defstruct 생성자 + 타입 검사", () => {
    const result = run(`
    (defstruct Circle [:radius :float])
    (define c (Circle 5.0))
    (Circle? c)
  `);
    assertEqual(result, true, "Circle? true");
});
test("TC-6h: [Phase 68] -> 파이프라인 다단계", () => {
    const result = run(`
    (define square (fn [$x] (* $x $x)))
    (define inc (fn [$x] (+ $x 1)))
    (-> 3 square inc square)
  `);
    // square(3)=9, inc(9)=10, square(10)=100
    assertEqual(result, 100, "-> 다단계 100");
});
// ── TC-7: AI 네이티브 mock 동작 ───────────────────────────────────────
console.log("\n[TC-7] AI 네이티브 블록");
test("TC-7a: prompt-template 변수 치환", () => {
    const result = run(`
    (prompt-template "안녕 {name}! 나이는 {age}" {:name "FreeLang" :age "9"})
  `);
    assertEqual(result, "안녕 FreeLang! 나이는 9", "prompt-template 치환");
});
test("TC-7b: rag-search — mock 결과 3개", () => {
    const result = run(`
    (define results (rag-search "FreeLang" {:limit 3}))
    (length results)
  `);
    assertEqual(result, 3, "rag-search limit 3");
});
test("TC-7c: rag-search — content/score 키 확인", () => {
    const result = run(`
    (define results (rag-search "테스트 쿼리" {:limit 1}))
    (define r (get results 0))
    (get r :score)
  `);
    assert(typeof result === "number" && result > 0, `score > 0 (got ${result})`);
});
test("TC-7d: chunk-text — 청크 배열 반환", () => {
    const result = run(`
    (define chunks (chunk-text "ABCDEFGHIJ" 3))
    (length chunks)
  `);
    assert(typeof result === "number" && result > 0, "chunk-text 결과 > 0");
});
test("TC-7e: embed — mock 호출 (async, TS 레벨)", async () => {
    // embed는 async이므로 TS 레벨에서 직접 검증
    const { createAINativeModule } = require("./stdlib-ai-native");
    const mod = createAINativeModule();
    const v = await mod["embed"]("FreeLang v9");
    assert(Array.isArray(v), "embed → 배열 반환");
    assert(v.length > 0, "embed 벡터 차원 > 0");
});
// ── TC-8: 이뮤터블 맵 + 프로토콜 연동 ───────────────────────────────
console.log("\n[TC-8] 이뮤터블 + 프로토콜 연동");
test("TC-8a: imm-map 생성 + imm-get", () => {
    const result = run(`
    (define m (imm-map {:name "FreeLang" :version 9}))
    (imm-get m :name)
  `);
    assertEqual(result, "FreeLang", "imm-map + imm-get");
});
test("TC-8b: imm-vec 생성 + imm-nth", () => {
    const result = run(`
    (define v (imm-vec [10 20 30 40 50]))
    (imm-nth v 2)
  `);
    assertEqual(result, 30, "imm-vec + imm-nth");
});
test("TC-8c: imm? — 동결 여부 확인", () => {
    const result = run(`
    (define m (imm-map {:x 1}))
    (imm? m)
  `);
    assertEqual(result, true, "imm? true");
});
test("TC-8d: imm-merge — 두 맵 병합", () => {
    const result = run(`
    (define m1 (imm-map {:a 1 :b 2}))
    (define m2 (imm-map {:b 99 :c 3}))
    (define m3 (imm-merge m1 m2))
    (imm-get m3 :b)
  `);
    assertEqual(result, 99, "imm-merge :b = 99 (m2가 우선)");
});
test("TC-8e: imm-map + defprotocol 조합", () => {
    const result = run(`
    (defprotocol Named
      [get-name [$self] :string])
    (impl Named ImmEntity
      [get-name [$self] (imm-get $self :name)])
    (define entity (imm-map {:name "FreeLang" :__type "ImmEntity"}))
    (get-name entity)
  `);
    assertEqual(result, "FreeLang", "imm-map + protocol 연동");
});
// ─────────────────────────────────────────────────────────────────────
console.log(`
─────────────────────────────────────────────
결과: ${passed} PASS / ${failed} FAIL
─────────────────────────────────────────────`);
if (failed > 0) {
    console.log("❌ 일부 테스트 실패");
    process.exit(1);
}
else {
    console.log("✅ Phase 72 Tier 2 통합 — 전체 PASS");
}
//# sourceMappingURL=test-phase72-integration.js.map