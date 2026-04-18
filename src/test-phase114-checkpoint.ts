// test-phase114-checkpoint.ts — FreeLang v9 Phase 114 CHECKPOINT 테스트
// AI 추론 세이브포인트 저장/복원 — 최소 25개 PASS

import { CheckpointManager, globalCheckpoint } from "./checkpoint";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | void) {
  try {
    const result = fn();
    if (result === false) {
      console.log(`  FAIL: ${name}`);
      failed++;
    } else {
      console.log(`  PASS: ${name}`);
      passed++;
    }
  } catch (e: any) {
    console.log(`  FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg ?? "assertion failed");
}

console.log("\n=== Phase 114: CHECKPOINT — AI 추론 세이브포인트 ===\n");

// ── CheckpointManager 유닛 테스트 ────────────────────────────────────────────

let cm: CheckpointManager;

// 1. 생성
test("1. CheckpointManager 생성", () => {
  cm = new CheckpointManager();
  assert(cm !== null && cm !== undefined);
  assert(cm.list().length === 0);
});

// 2. save() + restore() 기본
test("2. save() + restore() 기본", () => {
  cm = new CheckpointManager();
  cm.save("step1", { x: 10, y: 20 });
  const r = cm.restore("step1");
  assert(r !== null);
  assert(r.x === 10 && r.y === 20);
});

// 3. restore() 없는 이름 → null
test("3. restore() 없는 이름 → null", () => {
  cm = new CheckpointManager();
  const r = cm.restore("nonexistent");
  assert(r === null);
});

// 4. 여러 번 save() → 최신 반환
test("4. 여러 번 save() → 최신 반환", () => {
  cm = new CheckpointManager();
  cm.save("multi", { v: 1 });
  cm.save("multi", { v: 2 });
  cm.save("multi", { v: 3 });
  const r = cm.restore("multi");
  assert(r.v === 3);
});

// 5. restoreAt() 특정 버전
test("5. restoreAt() 특정 버전", () => {
  cm = new CheckpointManager();
  cm.save("ver", { v: "a" });
  cm.save("ver", { v: "b" });
  cm.save("ver", { v: "c" });
  assert(cm.restoreAt("ver", 0)?.v === "a");
  assert(cm.restoreAt("ver", 1)?.v === "b");
  assert(cm.restoreAt("ver", 2)?.v === "c");
});

// 6. restoreAt() 범위 초과 → null
test("6. restoreAt() 범위 초과 → null", () => {
  cm = new CheckpointManager();
  cm.save("x", { n: 1 });
  assert(cm.restoreAt("x", 99) === null);
  assert(cm.restoreAt("x", -1) === null);
});

// 7. branch() 성공 케이스
test("7. branch() 성공 케이스", () => {
  cm = new CheckpointManager();
  const res = cm.branch("try1", { val: 5 }, (s) => s.val * 2);
  assert(res.success === true);
  assert(res.result === 10);
});

// 8. branch() 실패 시 복원 (fn이 throw)
test("8. branch() 실패 시 복원 (fn throw)", () => {
  cm = new CheckpointManager();
  const state = { val: 42 };
  const res = cm.branch("try2", state, (_s) => {
    throw new Error("deliberate failure");
  });
  assert(res.success === false);
  assert(res.restored !== null);
  assert(res.restored.val === 42);
});

// 9. depth 추적
test("9. branch() depth 추적", () => {
  cm = new CheckpointManager();
  assert(cm.getDepth() === 0);
  let innerDepth = -1;
  cm.branch("d", {}, (s) => {
    innerDepth = cm.getDepth();
    return s;
  });
  assert(innerDepth === 1);
  assert(cm.getDepth() === 0); // branch 이후 복원
});

// 10. state 깊은 복사 (원본 변경 무관)
test("10. state 깊은 복사 (원본 변경 무관)", () => {
  cm = new CheckpointManager();
  const orig = { arr: [1, 2, 3], nested: { a: 1 } };
  cm.save("deep", orig);
  orig.arr.push(999);
  orig.nested.a = 999;
  const r = cm.restore("deep");
  assert(r.arr.length === 3);
  assert(r.nested.a === 1);
});

// 11. drop() 삭제
test("11. drop() 삭제", () => {
  cm = new CheckpointManager();
  cm.save("toDrop", { x: 1 });
  assert(cm.versions("toDrop") === 1);
  const ok = cm.drop("toDrop");
  assert(ok === true);
  assert(cm.restore("toDrop") === null);
});

// 12. list() 이름 목록
test("12. list() 이름 목록", () => {
  cm = new CheckpointManager();
  cm.save("alpha", 1);
  cm.save("beta", 2);
  cm.save("gamma", 3);
  const names = cm.list();
  assert(names.includes("alpha"));
  assert(names.includes("beta"));
  assert(names.includes("gamma"));
  assert(names.length === 3);
});

// 13. versions() 버전 수
test("13. versions() 버전 수", () => {
  cm = new CheckpointManager();
  assert(cm.versions("none") === 0);
  cm.save("v", 1);
  cm.save("v", 2);
  cm.save("v", 3);
  assert(cm.versions("v") === 3);
});

// 14. clear() 전체 초기화
test("14. clear() 전체 초기화", () => {
  cm = new CheckpointManager();
  cm.save("a", 1);
  cm.save("b", 2);
  cm.clear();
  assert(cm.list().length === 0);
  assert(cm.getDepth() === 0);
  assert(cm.restore("a") === null);
});

// 15. globalCheckpoint 싱글톤
test("15. globalCheckpoint 싱글톤", () => {
  globalCheckpoint.clear();
  globalCheckpoint.save("singleton-test", { hello: "world" });
  const r = globalCheckpoint.restore("singleton-test");
  assert(r?.hello === "world");
  globalCheckpoint.clear();
});

// ── 내장 함수 (Interpreter) 통합 테스트 ──────────────────────────────────────

function makeInterp(): Interpreter {
  return new Interpreter();
}

function run(code: string): any {
  const interp = makeInterp();
  interp.interpret(parse(lex(code)));
  return (interp as any).context.lastValue;
}

// globalCheckpoint 리셋
globalCheckpoint.clear();

// 16. cp-save 내장함수
test("16. cp-save 내장함수", () => {
  globalCheckpoint.clear();
  run(`(cp-save "s1" 100)`);
  const v = globalCheckpoint.restore("s1");
  assert(v === 100);
});

// 17. cp-restore 내장함수
test("17. cp-restore 내장함수", () => {
  globalCheckpoint.clear();
  run(`(cp-save "r1" 777)`);
  const result = run(`(cp-restore "r1")`);
  assert(result === 777);
});

// 18. cp-branch 내장함수 성공 (인라인 fn 사용 — fn은 function-value로 평가됨)
test("18. cp-branch 내장함수 성공", () => {
  globalCheckpoint.clear();
  // 인라인 (fn ...) → function-value로 직접 전달
  const result = run(`(cp-branch "b1" 10 (fn [$s] (+ $s 5)))`);
  assert(result === 15);
});

// 19. cp-branch 내장함수 실패 (복원)
test("19. cp-branch 내장함수 실패 (복원)", () => {
  globalCheckpoint.clear();
  // fn이 에러를 throw하면 저장한 state 복원
  const result = run(`
    (define state 42)
    (cp-branch "b2" state (fn [s] (error "deliberate")))
  `);
  // 실패 시 restored = state = 42
  assert(result === 42);
});

// 20. cp-drop 내장함수
test("20. cp-drop 내장함수", () => {
  globalCheckpoint.clear();
  run(`(cp-save "dropme" 999)`);
  assert(globalCheckpoint.versions("dropme") === 1);
  const ok = run(`(cp-drop "dropme")`);
  assert(ok === true);
  assert(globalCheckpoint.restore("dropme") === null);
});

// 21. cp-list 내장함수
test("21. cp-list 내장함수", () => {
  globalCheckpoint.clear();
  run(`(cp-save "listA" 1)`);
  run(`(cp-save "listB" 2)`);
  const names = run(`(cp-list)`);
  assert(Array.isArray(names));
  assert(names.includes("listA"));
  assert(names.includes("listB"));
});

// 22. cp-versions 내장함수
test("22. cp-versions 내장함수", () => {
  globalCheckpoint.clear();
  run(`(cp-save "vers" 1)`);
  run(`(cp-save "vers" 2)`);
  run(`(cp-save "vers" 3)`);
  const v = run(`(cp-versions "vers")`);
  assert(v === 3);
});

// 23. 중첩 branch (depth 2)
test("23. 중첩 branch (depth 2)", () => {
  cm = new CheckpointManager();
  let depths: number[] = [];
  cm.branch("outer", { n: 0 }, (s) => {
    depths.push(cm.getDepth()); // 1
    cm.branch("inner", { n: s.n + 1 }, (s2) => {
      depths.push(cm.getDepth()); // 2
      return s2;
    });
    depths.push(cm.getDepth()); // 1 again
    return s;
  });
  assert(depths[0] === 1);
  assert(depths[1] === 2);
  assert(depths[2] === 1);
  assert(cm.getDepth() === 0);
});

// 24. 동일 이름 여러 save — 각 버전 독립
test("24. 동일 이름 여러 save — 버전 독립", () => {
  cm = new CheckpointManager();
  cm.save("multi2", { v: 10 });
  cm.save("multi2", { v: 20 });
  cm.save("multi2", { v: 30 });
  assert(cm.restoreAt("multi2", 0)?.v === 10);
  assert(cm.restoreAt("multi2", 1)?.v === 20);
  assert(cm.restoreAt("multi2", 2)?.v === 30);
  assert(cm.versions("multi2") === 3);
});

// 25. timestamp 포함
test("25. timestamp 포함", () => {
  cm = new CheckpointManager();
  const before = Date.now();
  cm.save("ts", { x: 1 });
  const after = Date.now();
  const entries = cm.getEntries("ts");
  assert(entries.length === 1);
  assert(entries[0].timestamp >= before);
  assert(entries[0].timestamp <= after);
});

// 보너스 테스트 ──────────────────────────────────────────────────────────────

// 26. branch 실패 후 체크포인트 유지
test("26. branch 실패 후 체크포인트 유지", () => {
  cm = new CheckpointManager();
  cm.branch("persist", { v: 7 }, (_s) => { throw new Error("fail"); });
  // 체크포인트는 여전히 존재
  assert(cm.versions("persist") === 1);
  assert(cm.restore("persist")?.v === 7);
});

// 27. drop 없는 이름 → false
test("27. drop 없는 이름 → false", () => {
  cm = new CheckpointManager();
  assert(cm.drop("ghost") === false);
});

// 28. clear 후 depth도 0
test("28. clear 후 depth도 0", () => {
  cm = new CheckpointManager();
  // branch 도중 clear하면 depth 리셋
  cm.clear();
  assert(cm.getDepth() === 0);
  assert(cm.list().length === 0);
});

// ── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`PASS: ${passed}  FAIL: ${failed}  TOTAL: ${passed + failed}`);
if (failed === 0) {
  console.log("ALL TESTS PASSED ✓");
} else {
  console.log("SOME TESTS FAILED ✗");
  process.exit(1);
}
