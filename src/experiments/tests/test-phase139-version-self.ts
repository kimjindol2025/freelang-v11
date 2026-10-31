// test-phase139-version-self.ts — Phase 139 [VERSION-SELF] 테스트
// 목표: 25 PASS

import { SelfVersioning, globalVersioning, Snapshot, RollbackResult } from "./version-self";
import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg = "assertion failed") {
  if (!cond) throw new Error(msg);
}

function assertEqual<T>(a: T, b: T, msg?: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

// 인터프리터 헬퍼
function run(interp: Interpreter, code: string): any {
  const ctx = interp.run(code);
  return ctx.lastValue;
}

console.log("\n=== Phase 139: VERSION-SELF 테스트 ===\n");

// ── 1. SelfVersioning 생성 ──
test("1. SelfVersioning 생성", () => {
  const sv = new SelfVersioning();
  assert(sv !== null && sv !== undefined, "SelfVersioning 객체 생성 실패");
});

// ── 2. snapshot 저장 ──
test("2. snapshot 저장", () => {
  const sv = new SelfVersioning();
  const snap = sv.snapshot({ value: 42 }, "초기 스냅샷");
  assert(snap !== null, "snapshot이 null이어선 안됨");
  assert(typeof snap.id === "string", "id는 문자열이어야 함");
});

// ── 3. Snapshot 구조 검증 ──
test("3. Snapshot 구조 검증", () => {
  const sv = new SelfVersioning();
  const snap = sv.snapshot({ x: 1 }, "구조 테스트", ["tag1", "stable"]);
  assert(typeof snap.id === "string", "id가 문자열이어야 함");
  assert(typeof snap.version === "string", "version이 문자열이어야 함");
  assert(snap.timestamp instanceof Date, "timestamp가 Date이어야 함");
  assert(snap.metadata.description === "구조 테스트", "description 불일치");
  assert(snap.metadata.tags.includes("tag1"), "tags가 포함되어야 함");
});

// ── 4. 두 번째 snapshot → parentId 설정 ──
test("4. 두 번째 snapshot → parentId 설정", () => {
  const sv = new SelfVersioning();
  const snap1 = sv.snapshot({ a: 1 }, "첫 번째");
  const snap2 = sv.snapshot({ a: 2 }, "두 번째");
  assert(snap2.parentId === snap1.id, `parentId가 첫 번째 snap의 id여야 함, got: ${snap2.parentId}`);
});

// ── 5. latest() 최신 버전 ──
test("5. latest() 최신 버전", () => {
  const sv = new SelfVersioning();
  const snap1 = sv.snapshot({ v: 1 }, "첫 번째");
  const snap2 = sv.snapshot({ v: 2 }, "두 번째");
  const latest = sv.latest();
  assert(latest !== null, "latest가 null이어선 안됨");
  assert(latest!.id === snap2.id, "latest가 마지막 snapshot이어야 함");
});

// ── 6. getHistory() 히스토리 목록 ──
test("6. getHistory() 히스토리 목록", () => {
  const sv = new SelfVersioning();
  sv.snapshot({ n: 1 }, "A");
  sv.snapshot({ n: 2 }, "B");
  sv.snapshot({ n: 3 }, "C");
  const history = sv.getHistory();
  assert(history.length === 3, `히스토리가 3개여야 함, got ${history.length}`);
});

// ── 7. get(id) 특정 버전 조회 ──
test("7. get(id) 특정 버전 조회", () => {
  const sv = new SelfVersioning();
  const snap = sv.snapshot({ val: 99 }, "특정 버전");
  const found = sv.get(snap.id);
  assert(found !== null, "get이 null이어선 안됨");
  assert(found!.id === snap.id, "id가 일치해야 함");
});

// ── 8. get(없는 id) → null ──
test("8. get(없는id) → null", () => {
  const sv = new SelfVersioning();
  sv.snapshot({ x: 1 }, "테스트");
  const result = sv.get("nonexistent-uuid-1234");
  assert(result === null, "존재하지 않는 id는 null이어야 함");
});

// ── 9. rollback(id) 롤백 ──
test("9. rollback(id) 롤백", () => {
  const sv = new SelfVersioning();
  const snap1 = sv.snapshot({ state: "A" }, "상태 A");
  sv.snapshot({ state: "B" }, "상태 B");
  const result = sv.rollback(snap1.id);
  assert(result.success === true, "rollback이 성공해야 함");
  const current = sv.latest();
  assert(current!.id === snap1.id, "현재가 snap1으로 바뀌어야 함");
});

// ── 10. RollbackResult 구조 ──
test("10. RollbackResult 구조", () => {
  const sv = new SelfVersioning();
  const snap1 = sv.snapshot({ r: 1 }, "R1");
  sv.snapshot({ r: 2 }, "R2");
  const result = sv.rollback(snap1.id);
  assert(typeof result.success === "boolean", "success가 boolean이어야 함");
  assert(result.previous !== undefined, "previous가 있어야 함");
  assert(result.restored !== undefined, "restored가 있어야 함");
});

// ── 11. rollbackPrev() 이전 버전 ──
test("11. rollbackPrev() 이전 버전", () => {
  const sv = new SelfVersioning();
  const snap1 = sv.snapshot({ p: 1 }, "이전");
  const snap2 = sv.snapshot({ p: 2 }, "현재");
  const result = sv.rollbackPrev();
  assert(result.success === true, "rollbackPrev가 성공해야 함");
  assert(result.restored.id === snap1.id, "이전 버전으로 복원되어야 함");
});

// ── 12. 연속 snapshot 5개 → history 5개 ──
test("12. 연속 snapshot 5개 → history 5개", () => {
  const sv = new SelfVersioning();
  for (let i = 0; i < 5; i++) {
    sv.snapshot({ i }, `스냅샷 ${i}`);
  }
  const history = sv.getHistory();
  assert(history.length === 5, `히스토리가 5개여야 함, got ${history.length}`);
});

// ── 13. maxHistory 초과 시 오래된 것 삭제 ──
test("13. maxHistory 초과 시 오래된 것 삭제", () => {
  const sv = new SelfVersioning(3);
  for (let i = 0; i < 5; i++) {
    sv.snapshot({ i }, `스냅샷 ${i}`);
  }
  const history = sv.getHistory();
  // maxHistory=3, 5개 추가시 초과분 삭제
  assert(history.length <= 4, `maxHistory 초과 없어야 함, got ${history.length}`);
});

// ── 14. findByTag 태그 검색 ──
test("14. findByTag 태그 검색", () => {
  const sv = new SelfVersioning();
  sv.snapshot({ x: 1 }, "태그없음");
  sv.snapshot({ x: 2 }, "stable 태그", ["stable", "v1"]);
  sv.snapshot({ x: 3 }, "v1 태그", ["v1"]);
  const stableSnaps = sv.findByTag("stable");
  assert(stableSnaps.length === 1, `stable 태그가 1개여야 함, got ${stableSnaps.length}`);
  const v1Snaps = sv.findByTag("v1");
  assert(v1Snaps.length === 2, `v1 태그가 2개여야 함, got ${v1Snaps.length}`);
});

// ── 15. branch 브랜치 생성 ──
test("15. branch 브랜치 생성", () => {
  const sv = new SelfVersioning();
  const snap = sv.snapshot({ b: 1 }, "브랜치 기준");
  const branchId = sv.branch("feature-x");
  assert(typeof branchId === "string", "branchId가 문자열이어야 함");
  assert(branchId === snap.id, "브랜치가 현재 snapshot을 가리켜야 함");
});

// ── 16. checkout 브랜치 체크아웃 ──
test("16. checkout 브랜치 체크아웃", () => {
  const sv = new SelfVersioning();
  const snap1 = sv.snapshot({ c: 1 }, "브랜치 기준");
  sv.branch("dev", snap1.id);
  sv.snapshot({ c: 2 }, "이후 작업");
  const checked = sv.checkout("dev");
  assert(checked !== null, "checkout이 null이어선 안됨");
  assert(checked!.id === snap1.id, "브랜치 체크아웃 후 snap1이어야 함");
});

// ── 17. nextVersion 'patch' → 1.0.1 ──
test("17. nextVersion 'patch' → 1.0.1", () => {
  const sv = new SelfVersioning();
  sv.snapshot({ v: 1 }, "v1.0.0");
  const next = sv.nextVersion("patch");
  assert(next === "1.0.1", `patch version이 1.0.1이어야 함, got ${next}`);
});

// ── 18. nextVersion 'minor' → 1.1.0 ──
test("18. nextVersion 'minor' → 1.1.0", () => {
  const sv = new SelfVersioning();
  sv.snapshot({ v: 1 }, "v1.0.0");
  const next = sv.nextVersion("minor");
  assert(next === "1.1.0", `minor version이 1.1.0이어야 함, got ${next}`);
});

// ── 19. bestPerforming 최고 성능 버전 ──
test("19. bestPerforming 최고 성능 버전", () => {
  const sv = new SelfVersioning();
  sv.snapshot({ p: 1 }, "낮은 성능", [], 0.5);
  const best = sv.snapshot({ p: 2 }, "최고 성능", [], 0.95);
  sv.snapshot({ p: 3 }, "중간 성능", [], 0.7);
  const bestSnap = sv.bestPerforming();
  assert(bestSnap !== null, "bestPerforming이 null이어선 안됨");
  assert(bestSnap!.id === best.id, `최고 성능 snapshot이 best여야 함`);
});

// ── 인터프리터 테스트 ──
const interp = new Interpreter();

// ── 20. version-snapshot 빌트인 ──
test("20. version-snapshot 빌트인", () => {
  const result = run(interp, `(version-snapshot "my-state" "초기 버전")`);
  assert(result instanceof Map, "version-snapshot이 Map을 반환해야 함");
  assert(result.has("id"), "id가 있어야 함");
  assert(result.has("version"), "version이 있어야 함");
  assert(typeof result.get("id") === "string", "id가 문자열이어야 함");
});

// ── 21. version-rollback 빌트인 ──
test("21. version-rollback 빌트인", () => {
  const snap1 = run(interp, `(version-snapshot "state-A" "상태 A")`);
  run(interp, `(version-snapshot "state-B" "상태 B")`);
  const id1 = snap1.get("id");
  const result = run(interp, `(version-rollback "${id1}")`);
  assert(result instanceof Map, "version-rollback이 Map을 반환해야 함");
  assert(result.has("success"), "success가 있어야 함");
});

// ── 22. version-diff 빌트인 ──
test("22. version-diff 빌트인", () => {
  const s1 = run(interp, `(version-snapshot "alpha" "diff 테스트 A")`);
  const s2 = run(interp, `(version-snapshot "beta" "diff 테스트 B")`);
  const id1 = s1.get("id");
  const id2 = s2.get("id");
  const diff = run(interp, `(version-diff "${id1}" "${id2}")`);
  assert(typeof diff === "string", "version-diff가 문자열을 반환해야 함");
});

// ── 23. version-latest 빌트인 ──
test("23. version-latest 빌트인", () => {
  run(interp, `(version-snapshot "latest-test" "최신 버전 테스트")`);
  const result = run(interp, `(version-latest)`);
  assert(result instanceof Map, "version-latest가 Map을 반환해야 함");
  assert(result.has("id"), "id가 있어야 함");
  assert(result.has("version"), "version이 있어야 함");
});

// ── 24. version-history 빌트인 ──
test("24. version-history 빌트인", () => {
  const result = run(interp, `(version-history)`);
  assert(Array.isArray(result), "version-history가 배열을 반환해야 함");
  assert(result.length > 0, "히스토리가 비어있으면 안됨");
});

// ── 25. version-branch 빌트인 ──
test("25. version-branch 빌트인", () => {
  run(interp, `(version-snapshot "branch-base" "브랜치 기준")`);
  const branchId = run(interp, `(version-branch "feature-test")`);
  assert(typeof branchId === "string", "version-branch가 문자열(ID)을 반환해야 함");
});

// 결과 출력
console.log(`\n=== 결과: ${passed} PASS, ${failed} FAIL ===\n`);
if (failed > 0) process.exit(1);
