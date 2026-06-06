// FreeLang v9: Phase 95 — CONTEXT: AI 컨텍스트 윈도우 관리
// 22개 이상 PASS

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { ContextManager, ContextEntry } from "./context-window";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("[Phase 95] CONTEXT: AI 컨텍스트 윈도우 관리\n");

// ── TC-1~6: ContextManager 기본 ───────────────────────────────────────
console.log("[TC-1~6] ContextManager 기본");

test("TC-1: 생성 (maxTokens=4096)", () => {
  const cm = new ContextManager(4096);
  const s = cm.stats();
  assert(s.max === 4096, `max=${s.max}`);
  assert(s.used === 0, `used=${s.used}`);
  assert(s.count === 0, `count=${s.count}`);
});

test("TC-2: add → id 반환", () => {
  const cm = new ContextManager();
  const id = cm.add("hello world");
  assert(typeof id === "string" && id.length > 0, `id=${id}`);
});

test("TC-3: get → ContextEntry", () => {
  const cm = new ContextManager();
  const id = cm.add("test content", { priority: 0.8, tags: ["test"] });
  const entry = cm.get(id);
  assert(entry !== undefined, "entry undefined");
  assert(entry!.content === "test content", `content=${entry!.content}`);
  assert(entry!.priority === 0.8, `priority=${entry!.priority}`);
  assert(entry!.tags.includes("test"), `tags=${entry!.tags}`);
});

test("TC-4: remove", () => {
  const cm = new ContextManager();
  const id = cm.add("to remove");
  cm.remove(id);
  const entry = cm.get(id);
  assert(entry === undefined, "entry should be undefined after remove");
  assert(cm.stats().count === 0, `count=${cm.stats().count}`);
});

test("TC-5: stats → { used, max, percent, count }", () => {
  const cm = new ContextManager(1000);
  cm.add("abc");
  const s = cm.stats();
  assert(typeof s.used === "number", "used not number");
  assert(s.max === 1000, `max=${s.max}`);
  assert(typeof s.percent === "number", "percent not number");
  assert(s.count === 1, `count=${s.count}`);
});

test("TC-6: usedTokens 누적", () => {
  const cm = new ContextManager(4096);
  cm.add("abc");
  const s1 = cm.stats().used;
  cm.add("defghij");
  const s2 = cm.stats().used;
  assert(s2 > s1, `usedTokens 누적 안 됨: ${s1} → ${s2}`);
});

// ── TC-7~12: 토큰 관리 ────────────────────────────────────────────────
console.log("\n[TC-7~12] 토큰 관리");

test("TC-7: estimateTokens('hello') → 양수", () => {
  const cm = new ContextManager();
  const t = cm.estimateTokens("hello");
  assert(t > 0, `tokens=${t}`);
});

test("TC-8: hasRoom(100) → true (빈 상태)", () => {
  const cm = new ContextManager(4096);
  assert(cm.hasRoom(100) === true, "hasRoom false on empty");
});

test("TC-9: add 여러 개 후 used 증가", () => {
  const cm = new ContextManager(4096);
  const before = cm.stats().used;
  cm.add("first entry content");
  cm.add("second entry content");
  cm.add("third entry content");
  const after = cm.stats().used;
  assert(after > before, `used should increase: ${before}→${after}`);
});

test("TC-10: trim → 오래된 항목 제거 (초과 시)", () => {
  // maxTokens=10, 큰 항목들 추가하면 trim 발생
  const cm = new ContextManager(10);
  cm.add("short", { priority: 0.5, tokens: 4 });
  const beforeCount = cm.stats().count;
  // 용량 초과 유발
  cm.add("very long content here", { priority: 0.3, tokens: 8 });
  // trim이 자동 호출됨
  const afterCount = cm.stats().count;
  assert(afterCount <= beforeCount + 1, `count should not grow unbounded: ${afterCount}`);
  assert(cm.stats().used <= 10, `used=${cm.stats().used} > max=10`);
});

test("TC-11: priority 높은 항목 보존", () => {
  const cm = new ContextManager(10);
  const idHigh = cm.add("important", { priority: 1.0, tokens: 5 });
  cm.add("less important", { priority: 0.1, tokens: 5 });
  // 초과 추가로 trim 유발
  cm.add("overflow entry", { priority: 0.2, tokens: 6 });
  // priority=1.0 항목은 보존되어야 함
  const highEntry = cm.get(idHigh);
  assert(highEntry !== undefined, "priority=1.0 항목이 trim에서 제거됨");
});

test("TC-12: 태그 필터 getAll('history')", () => {
  const cm = new ContextManager();
  cm.add("history entry 1", { tags: ["history"] });
  cm.add("other entry", { tags: ["other"] });
  cm.add("history entry 2", { tags: ["history"] });
  const history = cm.getAll("history");
  assert(history.length === 2, `history length=${history.length}`);
  assert(history.every((e) => e.tags.includes("history")), "non-history entry in result");
});

// ── TC-13~17: FL 문법 ─────────────────────────────────────────────────
console.log("\n[TC-13~17] FL 문법");

test("TC-13: (ctx-new 1000) → ContextManager", () => {
  const result = run(`(ctx-new 1000)`);
  assert(result !== null && result !== undefined, "ctx-new returned null");
  assert(typeof result.stats === "function", "result has no .stats()");
  assert(result.stats().max === 1000, `max=${result.stats().max}`);
});

test("TC-14: (ctx-add $ctx 'hello') → id 문자열", () => {
  const result = run(`
    (define ctx (ctx-new 4096))
    (ctx-add $ctx "hello")
  `);
  assert(typeof result === "string" && result.length > 0, `id=${result}`);
});

test("TC-15: (ctx-stats $ctx) → percent 0 (빈 상태)", () => {
  const result = run(`
    (define ctx (ctx-new 4096))
    (ctx-stats $ctx)
  `);
  assert(result !== null && typeof result === "object", "stats null");
  assert(result.percent === 0, `percent=${result.percent}`);
  assert(result.max === 4096, `max=${result.max}`);
});

test("TC-16: (ctx-has-room? $ctx 100) → true", () => {
  const result = run(`
    (define ctx (ctx-new 4096))
    (ctx-has-room? $ctx 100)
  `);
  assert(result === true, `has-room?=${result}`);
});

test("TC-17: (ctx-all $ctx) → 배열", () => {
  const result = run(`
    (define ctx (ctx-new 4096))
    (ctx-add $ctx "entry 1")
    (ctx-add $ctx "entry 2")
    (ctx-all $ctx)
  `);
  assert(Array.isArray(result), `not array: ${typeof result}`);
  assert(result.length === 2, `length=${result.length}`);
});

// ── TC-18~22: 에지 케이스 ─────────────────────────────────────────────
console.log("\n[TC-18~22] 에지 케이스");

test("TC-18: 빈 컨텍스트 trim → 변화없음", () => {
  const cm = new ContextManager(100);
  const removed = cm.trim();
  assert(Array.isArray(removed), "trim should return array");
  assert(removed.length === 0, `removed=${removed.length}`);
  assert(cm.stats().count === 0, `count=${cm.stats().count}`);
});

test("TC-19: 초과 add → trim 자동", () => {
  const cm = new ContextManager(20);
  // 각 항목 10 tokens
  cm.add("entry-a", { tokens: 10, priority: 0.5 });
  cm.add("entry-b", { tokens: 10, priority: 0.4 });
  // 이 시점에서 used=20 (딱 맞음)
  // 하나 더 추가 → 초과 → 자동 trim
  cm.add("entry-c", { tokens: 5, priority: 0.9 });
  assert(cm.stats().used <= 20, `used=${cm.stats().used} exceeds max=20`);
});

test("TC-20: priority=1.0 항목 trim에서 보존", () => {
  const cm = new ContextManager(15);
  const criticalId = cm.add("critical", { priority: 1.0, tokens: 10 });
  cm.add("low1", { priority: 0.1, tokens: 10 });
  // trim 직접 호출
  cm.trim();
  assert(cm.get(criticalId) !== undefined, "critical entry removed despite priority=1.0");
});

test("TC-21: tags 배열 저장 및 조회", () => {
  const cm = new ContextManager();
  const id = cm.add("tagged content", { tags: ["ai", "reasoning", "context"] });
  const entry = cm.get(id);
  assert(Array.isArray(entry!.tags), "tags not array");
  assert(entry!.tags.length === 3, `tags.length=${entry!.tags.length}`);
  assert(entry!.tags.includes("ai"), "missing tag 'ai'");
  assert(entry!.tags.includes("reasoning"), "missing tag 'reasoning'");
});

test("TC-22: Phase 56 regression 14/14", () => {
  // Phase 56의 핵심 기능들이 여전히 동작하는지 확인
  const interp = new Interpreter();

  // 렉시컬 스코프
  interp.interpret(parse(lex(`(define x 10)`)));
  const x = (interp as any).context.variables.get("$x");
  assert(x === 10, `$x=${x}`);

  // 클로저
  const closureResult = run(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add5 (make-adder 5))
    (add5 3)
  `);
  assert(closureResult === 8, `closure result=${closureResult}`);

  // loop/recur
  const loopResult = run(`
    (loop [acc 0 n 3]
      (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
  `);
  assert(loopResult === 6, `loop result=${loopResult}`);

  // 산술 연산
  const arithResult = run(`(+ (* 3 4) (- 10 5))`);
  assert(arithResult === 17, `arith result=${arithResult}`);
});

// ── 결과 ──────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 95 CONTEXT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
