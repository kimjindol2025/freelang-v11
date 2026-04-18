// Phase 67: 동시성 — 채널 + parallel/race/with-timeout 테스트
// TC-1: chan 생성, send, recv
// TC-2: chan-size, chan-empty?
// TC-3: parallel — 여러 값 병렬 계산
// TC-4: race — 첫 번째 결과
// TC-5: with-timeout
// TC-6: 빈 채널 recv → null
// TC-7: Phase 56 regression 14/14

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL  ${name}: ${String(e.message ?? e).slice(0, 150)}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ?? "assertEqual"}: expected ${e}, got ${a}`);
}

function run(src: string): any {
  const interp = new Interpreter();
  const ctx = interp.interpret(parse(lex(src)));
  return ctx.lastValue;
}

function runCtx(src: string): { interp: Interpreter; val: any } {
  const interp = new Interpreter();
  const ctx = interp.interpret(parse(lex(src)));
  return { interp, val: ctx.lastValue };
}

console.log("\n=== Phase 67: 동시성 — 채널 + parallel/race 테스트 ===\n");

// ── TC-1: 채널 생성, send, recv ────────────────────────────────────
console.log("[TC-1] 채널 생성 + send/recv");

test("TC-1a: chan 생성 후 ID 반환 (문자열)", () => {
  const val = run(`(chan)`);
  assert(typeof val === "string", `chan은 string ID를 반환해야 함, got: ${typeof val}`);
  assert(val.startsWith("ch_"), `ID가 ch_로 시작해야 함, got: ${val}`);
});

test("TC-1b: chan-send 후 chan-recv로 값 수신", () => {
  const val = run(`
    (define ch (chan))
    (chan-send ch "hello")
    (chan-recv ch)
  `);
  assertEqual(val, "hello", "chan-recv 결과");
});

test("TC-1c: 여러 값 send → FIFO 순서로 recv", () => {
  const val = run(`
    (define ch (chan))
    (chan-send ch 10)
    (chan-send ch 20)
    (chan-send ch 30)
    (chan-recv ch)
  `);
  assertEqual(val, 10, "첫 번째 recv는 10이어야 함 (FIFO)");
});

test("TC-1d: 두 번 recv → 두 번째 값", () => {
  const val = run(`
    (define ch (chan))
    (chan-send ch 10)
    (chan-send ch 20)
    (chan-recv ch)
    (chan-recv ch)
  `);
  assertEqual(val, 20, "두 번째 recv는 20이어야 함");
});

// ── TC-2: chan-size, chan-empty? ───────────────────────────────────
console.log("\n[TC-2] chan-size + chan-empty?");

test("TC-2a: 초기 상태 chan-empty? → true", () => {
  const val = run(`
    (define ch (chan))
    (chan-empty? ch)
  `);
  assertEqual(val, true, "빈 채널은 empty");
});

test("TC-2b: send 1개 후 chan-size → 1", () => {
  const val = run(`
    (define ch (chan))
    (chan-send ch 42)
    (chan-size ch)
  `);
  assertEqual(val, 1, "chan-size=1");
});

test("TC-2c: send 3개 후 chan-size → 3", () => {
  const val = run(`
    (define ch (chan))
    (chan-send ch "a")
    (chan-send ch "b")
    (chan-send ch "c")
    (chan-size ch)
  `);
  assertEqual(val, 3, "chan-size=3");
});

test("TC-2d: send 2 → recv 1 → chan-size → 1", () => {
  const val = run(`
    (define ch (chan))
    (chan-send ch 1)
    (chan-send ch 2)
    (chan-recv ch)
    (chan-size ch)
  `);
  assertEqual(val, 1, "send2 recv1 → size=1");
});

test("TC-2e: send 1 → recv 1 → chan-empty? → true", () => {
  const val = run(`
    (define ch (chan))
    (chan-send ch 99)
    (chan-recv ch)
    (chan-empty? ch)
  `);
  assertEqual(val, true, "모두 수신하면 empty");
});

// ── TC-3: parallel ─────────────────────────────────────────────────
console.log("\n[TC-3] parallel — 여러 값 병렬 계산");

test("TC-3a: parallel 빈 인자 → 빈 배열", () => {
  const val = run(`(parallel)`);
  assertEqual(val, [], "parallel 빈 인자");
});

test("TC-3b: parallel 단일 값", () => {
  const val = run(`(parallel (+ 1 2))`);
  assertEqual(val, [3], "parallel single");
});

test("TC-3c: parallel 여러 연산 — 배열 반환", () => {
  const val = run(`(parallel (+ 1 1) (* 3 4) (- 10 3))`);
  assertEqual(val, [2, 12, 7], "parallel multiple results");
});

test("TC-3d: parallel 문자열 포함", () => {
  const val = run(`(parallel "hello" "world" 42)`);
  assertEqual(val, ["hello", "world", 42], "parallel mixed types");
});

test("TC-3e: parallel define된 값 사용", () => {
  const val = run(`
    (define x 10)
    (define y 20)
    (parallel (* $x 2) (+ $y 5) $x)
  `);
  assertEqual(val, [20, 25, 10], "parallel with variables");
});

// ── TC-4: race ─────────────────────────────────────────────────────
console.log("\n[TC-4] race — 첫 번째 완료 결과");

test("TC-4a: race 빈 인자 → null", () => {
  const val = run(`(race)`);
  assertEqual(val, null, "race 빈 인자");
});

test("TC-4b: race 단일 값 반환", () => {
  const val = run(`(race 42)`);
  assertEqual(val, 42, "race single");
});

test("TC-4c: race 여러 값 — 첫 번째 non-null 반환", () => {
  const val = run(`(race (+ 1 2) (* 3 4) (- 10 3))`);
  assertEqual(val, 3, "race returns first non-null");
});

test("TC-4d: race 첫 값이 null이면 두 번째 반환", () => {
  // null을 직접 반환하는 연산: (chan-recv 빈채널)
  const val = run(`
    (define empty-ch (chan))
    (race (chan-recv empty-ch) "second" "third")
  `);
  assertEqual(val, "second", "race skips null");
});

// ── TC-5: with-timeout ─────────────────────────────────────────────
console.log("\n[TC-5] with-timeout");

test("TC-5a: with-timeout 정상 실행", () => {
  const val = run(`(with-timeout 1000 (+ 1 2))`);
  assertEqual(val, 3, "with-timeout 결과");
});

test("TC-5b: with-timeout 표현식 평가", () => {
  const val = run(`
    (define x 5)
    (with-timeout 500 (* $x $x))
  `);
  assertEqual(val, 25, "with-timeout with variable");
});

test("TC-5c: with-timeout 인자 부족 → null", () => {
  const val = run(`(with-timeout 1000)`);
  assertEqual(val, null, "with-timeout arg부족 → null");
});

test("TC-5d: race + with-timeout 조합", () => {
  const val = run(`
    (race
      (with-timeout 1000 "fast")
      (with-timeout 5000 "slow"))
  `);
  assertEqual(val, "fast", "race + with-timeout");
});

// ── TC-6: 빈 채널 recv → null ─────────────────────────────────────
console.log("\n[TC-6] 빈 채널 recv → null");

test("TC-6a: 빈 채널 recv → null", () => {
  const val = run(`
    (define ch (chan))
    (chan-recv ch)
  `);
  assertEqual(val, null, "빈 채널 recv는 null");
});

test("TC-6b: 존재하지 않는 채널 ID → null", () => {
  const val = run(`(chan-recv "ch_invalid_999")`);
  assertEqual(val, null, "없는 채널 recv는 null");
});

test("TC-6c: 존재하지 않는 채널 send → false", () => {
  const val = run(`(chan-send "ch_invalid_999" "data")`);
  assertEqual(val, false, "없는 채널 send는 false");
});

test("TC-6d: 존재하지 않는 채널 empty? → true", () => {
  const val = run(`(chan-empty? "ch_invalid_999")`);
  assertEqual(val, true, "없는 채널 empty?는 true");
});

// ── TC-7: Phase 56 regression ─────────────────────────────────────
console.log("\n[TC-7] Phase 56 regression");

const path = require("path");
const fs = require("fs");

function runFile(filePath: string): Interpreter {
  const src = fs.readFileSync(filePath, "utf-8");
  const interp = new Interpreter();
  (interp as any).currentFilePath = filePath;
  interp.interpret(parse(lex(src)));
  return interp;
}

function evalIn(interp: Interpreter, src: string): any {
  const ctx = interp.interpret(parse(lex(src)));
  return ctx.lastValue;
}

function getVar(interp: Interpreter, name: string): any {
  return (interp as any).context.variables.get("$" + name);
}

test("TC-7a: 함수 내 define 격리 (전역 오염 없음)", () => {
  const interp = new Interpreter();
  interp.interpret(parse(lex(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
  `)));
  const x = getVar(interp, "x");
  if (x !== 10) throw new Error(`전역 $x가 ${x}로 변경됨 (10이어야 함)`);
});

test("TC-7b: 재귀 팩토리얼", () => {
  const val = run(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 6)
  `);
  assertEqual(val, 720, "팩토리얼 6=720");
});

test("TC-7c: 클로저 캡처", () => {
  const val = run(`
    (define base 100)
    [FUNC adder :params [$x] :body (+ $base $x)]
    (adder 5)
  `);
  assertEqual(val, 105, "클로저 캡처");
});

test("TC-7d: parallel + define 조합", () => {
  const val = run(`
    (define a 3)
    (define b 4)
    (parallel (* $a $a) (* $b $b))
  `);
  assertEqual(val, [9, 16], "parallel a^2 b^2");
});

test("TC-7e: chan + parallel 조합", () => {
  // 채널에 여러 값을 넣고 parallel로 꺼내기
  const val = run(`
    (define ch (chan))
    (chan-send ch 1)
    (chan-send ch 2)
    (chan-send ch 3)
    (parallel (chan-recv ch) (chan-recv ch) (chan-recv ch))
  `);
  assertEqual(val, [1, 2, 3], "채널 + parallel 조합");
});

test("TC-7f: 이전 Phase 66 defstruct 작동 확인", () => {
  const val = run(`
    (defstruct Point [:x :float :y :float])
    (define p (Point 3.0 4.0))
    (Point? p)
  `);
  assertEqual(val, true, "defstruct + Point? 정상");
});

// ── 결과 요약 ──────────────────────────────────────────────────────
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`결과: ${passed} PASS / ${failed} FAIL`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (failed > 0) {
  process.exit(1);
}
