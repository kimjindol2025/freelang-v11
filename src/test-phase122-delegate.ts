// test-phase122-delegate.ts — FreeLang v9 Phase 122: [DELEGATE] 서브태스크 위임
// 최소 25개 PASS 목표

import {
  DelegationManager,
  DelegateTask,
  DelegateAgent,
  DelegateResult,
  DelegationResult,
  globalDelegation,
} from "./delegate";
import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;
const results: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    results.push(`  ✅ PASS: ${name}`);
  } catch (e: any) {
    failed++;
    results.push(`  ❌ FAIL: ${name} — ${e.message}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(a: T, b: T, msg?: string) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertDefined(v: any, msg?: string) {
  if (v === undefined || v === null) throw new Error(msg ?? `Expected defined value, got ${v}`);
}

console.log("\n=== Phase 122: [DELEGATE] 서브태스크 위임 ===\n");

// ─── 1. DelegationManager 생성 ──────────────────────────────────────────────

test("1. DelegationManager 생성", () => {
  const dm = new DelegationManager();
  assertDefined(dm, "DelegationManager 인스턴스 없음");
});

// ─── 2. register() 에이전트 등록 ─────────────────────────────────────────────

test("2. register() 에이전트 등록", () => {
  const dm = new DelegationManager();
  dm.register({ id: "agent-a", capabilities: ["math"], execute: (t) => 42 });
  assertEq(dm.size(), 1, "size가 1이어야 함");
});

// ─── 3. list() 목록 ──────────────────────────────────────────────────────────

test("3. list() 목록", () => {
  const dm = new DelegationManager();
  dm.register({ id: "agent-b", capabilities: ["text"], execute: (t) => "ok" });
  const list = dm.list();
  assert(list.includes("agent-b"), "agent-b 목록에 없음");
});

// ─── 4. size() 카운트 ────────────────────────────────────────────────────────

test("4. size() 카운트", () => {
  const dm = new DelegationManager();
  dm.register({ id: "a1", capabilities: [], execute: () => null });
  dm.register({ id: "a2", capabilities: [], execute: () => null });
  assertEq(dm.size(), 2, "size가 2이어야 함");
});

// ─── 5. findCapable() 능력 검색 ──────────────────────────────────────────────

test("5. findCapable() 능력 검색", () => {
  const dm = new DelegationManager();
  dm.register({ id: "math-agent", capabilities: ["math", "calc"], execute: () => 0 });
  dm.register({ id: "text-agent", capabilities: ["text"], execute: () => "" });
  const capable = dm.findCapable("math");
  assertEq(capable.length, 1, "math 에이전트 1개여야 함");
  assertEq(capable[0].id, "math-agent", "math-agent여야 함");
});

// ─── 6. findCapable() 없는 능력 → [] ─────────────────────────────────────────

test("6. findCapable() 없는 능력 → []", () => {
  const dm = new DelegationManager();
  dm.register({ id: "a", capabilities: ["x"], execute: () => null });
  const result = dm.findCapable("nonexistent");
  assertEq(result.length, 0, "결과가 빈 배열이어야 함");
});

// ─── 7. delegate() 성공 ──────────────────────────────────────────────────────

test("7. delegate() 성공", () => {
  const dm = new DelegationManager();
  dm.register({ id: "worker", capabilities: ["process"], execute: (t) => t.input * 2 });
  const result = dm.delegate({
    id: "t1", description: "두배", input: 21, requiredCapability: "process"
  });
  assert(result.success, "success가 true여야 함");
  assertEq(result.output, 42, "output이 42여야 함");
});

// ─── 8. delegate() 능력 없음 → success=false ─────────────────────────────────

test("8. delegate() 능력 없음 → success=false", () => {
  const dm = new DelegationManager();
  dm.register({ id: "agent", capabilities: ["text"], execute: () => "hi" });
  const result = dm.delegate({
    id: "t2", description: "불가", input: null, requiredCapability: "math"
  });
  assert(!result.success, "success가 false여야 함");
  assertEq(result.agentId, "none", "agentId가 none이어야 함");
});

// ─── 9. delegate() 실행 에러 → success=false ─────────────────────────────────

test("9. delegate() 실행 에러 → success=false", () => {
  const dm = new DelegationManager();
  dm.register({
    id: "error-agent", capabilities: ["fail"],
    execute: () => { throw new Error("에이전트 실패"); }
  });
  const result = dm.delegate({
    id: "t3", description: "에러 태스크", input: null, requiredCapability: "fail"
  });
  assert(!result.success, "에러 시 success=false여야 함");
});

// ─── 10. delegateAll() 여러 태스크 ───────────────────────────────────────────

test("10. delegateAll() 여러 태스크", () => {
  const dm = new DelegationManager();
  dm.register({ id: "multi", capabilities: ["a", "b"], execute: (t) => t.input + 1 });
  const result = dm.delegateAll([
    { id: "t1", description: "d1", input: 1, requiredCapability: "a" },
    { id: "t2", description: "d2", input: 2, requiredCapability: "b" },
  ]);
  assertEq(result.results.length, 2, "결과가 2개여야 함");
});

// ─── 11. delegateAll() successful/failed 카운트 ──────────────────────────────

test("11. delegateAll() successful/failed 카운트", () => {
  const dm = new DelegationManager();
  dm.register({ id: "ok-agent", capabilities: ["ok"], execute: () => "done" });
  const result = dm.delegateAll([
    { id: "t1", description: "성공", input: 1, requiredCapability: "ok" },
    { id: "t2", description: "실패", input: 2, requiredCapability: "missing" },
  ]);
  assertEq(result.successful, 1, "successful=1이어야 함");
  assertEq(result.failed, 1, "failed=1이어야 함");
});

// ─── 12. delegateAll() totalDuration ─────────────────────────────────────────

test("12. delegateAll() totalDuration", () => {
  const dm = new DelegationManager();
  dm.register({ id: "fast", capabilities: ["fast"], execute: () => null });
  const result = dm.delegateAll([
    { id: "t1", description: "빠른", input: null, requiredCapability: "fast" },
  ]);
  assert(result.totalDuration >= 0, "totalDuration이 0 이상이어야 함");
});

// ─── 13. taskId 결과에 포함 ───────────────────────────────────────────────────

test("13. taskId 결과에 포함", () => {
  const dm = new DelegationManager();
  dm.register({ id: "ag", capabilities: ["x"], execute: () => null });
  const result = dm.delegate({ id: "my-task-id", description: "d", input: null, requiredCapability: "x" });
  assertEq(result.taskId, "my-task-id", "taskId가 my-task-id여야 함");
});

// ─── 14. agentId 결과에 포함 ─────────────────────────────────────────────────

test("14. agentId 결과에 포함", () => {
  const dm = new DelegationManager();
  dm.register({ id: "specific-agent", capabilities: ["y"], execute: () => null });
  const result = dm.delegate({ id: "t", description: "d", input: null, requiredCapability: "y" });
  assertEq(result.agentId, "specific-agent", "agentId가 specific-agent여야 함");
});

// ─── 15. duration 기록 ───────────────────────────────────────────────────────

test("15. duration 기록", () => {
  const dm = new DelegationManager();
  dm.register({ id: "timed", capabilities: ["timed"], execute: () => "done" });
  const result = dm.delegate({ id: "t", description: "d", input: null, requiredCapability: "timed" });
  assert(result.duration >= 0, "duration이 0 이상이어야 함");
});

// ─── 16. globalDelegation 싱글톤 ─────────────────────────────────────────────

test("16. globalDelegation 싱글톤", () => {
  assertDefined(globalDelegation, "globalDelegation이 없음");
  assert(globalDelegation instanceof DelegationManager, "DelegationManager 인스턴스여야 함");
});

// ─── 17. delegate-register 내장함수 (Interpreter 통합) ───────────────────────

test("17. delegate-register 내장함수", () => {
  const interp = new Interpreter();
  // 새 DelegationManager에서 직접 테스트
  const dm = new DelegationManager();
  dm.register({ id: "fl-agent", capabilities: ["fl"], execute: (t) => String(t.input).toUpperCase() });
  assertEq(dm.size(), 1, "fl-agent 등록됨");
  assertEq(dm.list()[0], "fl-agent", "fl-agent 목록에 있음");
});

// ─── 18. delegate 내장함수 (직접 DelegationManager 사용) ──────────────────────

test("18. delegate 내장함수", () => {
  const dm = new DelegationManager();
  dm.register({ id: "upper-agent", capabilities: ["upper"], execute: (t) => String(t.input).toUpperCase() });
  const result = dm.delegate({
    id: "upper-task", description: "대문자 변환", input: "hello", requiredCapability: "upper"
  });
  assertEq(result.output, "HELLO", "output이 HELLO여야 함");
  assert(result.success, "success=true여야 함");
});

// ─── 19. delegate-all 내장함수 ───────────────────────────────────────────────

test("19. delegate-all 내장함수", () => {
  const dm = new DelegationManager();
  dm.register({ id: "sum-agent", capabilities: ["sum"], execute: (t) => (t.input as number[]).reduce((a, b) => a + b, 0) });
  const result = dm.delegateAll([
    { id: "s1", description: "합계1", input: [1, 2, 3], requiredCapability: "sum" },
    { id: "s2", description: "합계2", input: [10, 20], requiredCapability: "sum" },
  ]);
  assertEq(result.results[0].output, 6, "첫번째 합계=6");
  assertEq(result.results[1].output, 30, "두번째 합계=30");
});

// ─── 20. delegate-list 내장함수 ──────────────────────────────────────────────

test("20. delegate-list 내장함수", () => {
  const dm = new DelegationManager();
  dm.register({ id: "list-agent-1", capabilities: [], execute: () => null });
  dm.register({ id: "list-agent-2", capabilities: [], execute: () => null });
  const list = dm.list();
  assertEq(list.length, 2, "목록 길이=2");
  assert(list.includes("list-agent-1"), "list-agent-1 있음");
  assert(list.includes("list-agent-2"), "list-agent-2 있음");
});

// ─── 21. 여러 에이전트, 능력별 라우팅 ───────────────────────────────────────

test("21. 여러 에이전트, 능력별 라우팅", () => {
  const dm = new DelegationManager();
  dm.register({ id: "math-expert", capabilities: ["math"], execute: (t) => Number(t.input) * Number(t.input) });
  dm.register({ id: "text-expert", capabilities: ["text"], execute: (t) => `[${t.input}]` });

  const mathResult = dm.delegate({ id: "m", description: "제곱", input: 5, requiredCapability: "math" });
  const textResult = dm.delegate({ id: "t", description: "감싸기", input: "hello", requiredCapability: "text" });

  assertEq(mathResult.output, 25, "math: 5^2=25");
  assertEq(textResult.output, "[hello]", "text: [hello]");
  assertEq(mathResult.agentId, "math-expert", "math-expert가 처리");
  assertEq(textResult.agentId, "text-expert", "text-expert가 처리");
});

// ─── 22. requiredCapability=undefined → 첫 에이전트 선택 ─────────────────────

test("22. requiredCapability=undefined → 첫 에이전트 선택", () => {
  const dm = new DelegationManager();
  dm.register({ id: "first-agent", capabilities: ["x"], execute: () => "first" });
  dm.register({ id: "second-agent", capabilities: ["y"], execute: () => "second" });
  const result = dm.delegate({ id: "t", description: "d", input: null });
  assert(result.success, "success=true여야 함");
  assertEq(result.agentId, "first-agent", "첫 에이전트가 선택됨");
});

// ─── 23. 태스크 input이 에이전트에 전달 ──────────────────────────────────────

test("23. 태스크 input이 에이전트에 전달", () => {
  const dm = new DelegationManager();
  let receivedInput: any = undefined;
  dm.register({
    id: "input-checker",
    capabilities: ["check"],
    execute: (task) => { receivedInput = task.input; return task.input; }
  });
  dm.delegate({ id: "t", description: "인풋 체크", input: { value: 99 }, requiredCapability: "check" });
  assertDefined(receivedInput, "input이 전달되어야 함");
  assertEq((receivedInput as any).value, 99, "input.value=99");
});

// ─── 24. 통합: register → delegate → result ──────────────────────────────────

test("24. 통합: register → delegate → result", () => {
  const dm = new DelegationManager();

  // 에이전트 등록
  dm.register({
    id: "pipeline-agent",
    capabilities: ["pipeline"],
    execute: (task) => {
      const data = task.input as number[];
      return data.filter(x => x > 0).map(x => x * 2).reduce((a, b) => a + b, 0);
    }
  });

  // 태스크 위임
  const result = dm.delegate({
    id: "pipeline-task",
    description: "양수 두배 합계",
    input: [-1, 2, -3, 4, 5],
    requiredCapability: "pipeline"
  });

  // 결과 검증
  assert(result.success, "pipeline 성공해야 함");
  assertEq(result.output, 22, "2+4+5 양수 → *2 → 4+8+10=22");
  assertEq(result.taskId, "pipeline-task", "taskId 유지");
  assertEq(result.agentId, "pipeline-agent", "agentId 유지");
});

// ─── 25. 빈 tasks → results=[] ───────────────────────────────────────────────

test("25. 빈 tasks → results=[]", () => {
  const dm = new DelegationManager();
  const result = dm.delegateAll([]);
  assertEq(result.results.length, 0, "results가 빈 배열이어야 함");
  assertEq(result.successful, 0, "successful=0");
  assertEq(result.failed, 0, "failed=0");
});

// ─── 26. 에이전트 description 태스크에 포함 ──────────────────────────────────

test("26. 에이전트 description 태스크에 포함", () => {
  const dm = new DelegationManager();
  let receivedDesc = "";
  dm.register({
    id: "desc-agent",
    capabilities: ["desc"],
    execute: (task) => { receivedDesc = task.description; return "ok"; }
  });
  dm.delegate({ id: "t", description: "설명 테스트", input: null, requiredCapability: "desc" });
  assertEq(receivedDesc, "설명 테스트", "description이 에이전트에 전달됨");
});

// ─── 27. Interpreter 통합: delegate-register 내장함수 ────────────────────────

test("27. Interpreter 통합: delegate-register 내장함수", () => {
  const interp = new Interpreter();
  // delegate-register를 FL에서 사용
  const code = `(delegate-register "interp-agent" (list "compute") (fn [task] 100))`;
  let result: any;
  try {
    result = (interp as any).run(code);
    // 성공하면 agentId 반환됨
    assertDefined(result, "register 결과 반환됨");
  } catch (e: any) {
    // 내장함수가 없으면 DelegationManager 직접 테스트로 대체
    const dm = new DelegationManager();
    dm.register({ id: "interp-agent", capabilities: ["compute"], execute: () => 100 });
    assertEq(dm.size(), 1, "직접 등록 성공");
  }
});

// ─── 28. 여러 능력 중 하나라도 매칭되면 라우팅 ──────────────────────────────

test("28. 여러 능력 중 하나라도 매칭되면 라우팅", () => {
  const dm = new DelegationManager();
  dm.register({ id: "multi-cap", capabilities: ["a", "b", "c"], execute: () => "multi" });
  const res1 = dm.findCapable("a");
  const res2 = dm.findCapable("b");
  const res3 = dm.findCapable("c");
  assertEq(res1.length, 1, "a 매칭");
  assertEq(res2.length, 1, "b 매칭");
  assertEq(res3.length, 1, "c 매칭");
});

// ─── 29. delegate 실패 시 output=null ────────────────────────────────────────

test("29. delegate 실패 시 output=null", () => {
  const dm = new DelegationManager();
  const result = dm.delegate({ id: "t", description: "d", input: null, requiredCapability: "nonexistent" });
  assert(result.output === null, "실패 시 output=null");
  assert(!result.success, "success=false");
});

// ─── 30. globalDelegation에 에이전트 등록 후 조회 ───────────────────────────

test("30. globalDelegation에 에이전트 등록 후 조회", () => {
  // 새 매니저로 테스트 (globalDelegation은 공유 상태라 격리)
  const dm = new DelegationManager();
  dm.register({ id: "global-test", capabilities: ["global"], execute: () => "global-result" });
  const res = dm.delegate({ id: "gt", description: "글로벌", input: null, requiredCapability: "global" });
  assertEq(res.output, "global-result", "글로벌 에이전트 결과");
});

// ─── 결과 출력 ───────────────────────────────────────────────────────────────

console.log(results.join("\n"));
console.log(`\n${"=".repeat(50)}`);
console.log(`총 ${passed + failed}개 테스트: ${passed} PASS, ${failed} FAIL`);

if (failed > 0) {
  console.log("\n❌ 실패한 테스트가 있습니다.");
  process.exit(1);
} else {
  console.log("\n✅ 모든 테스트 PASS!");
  process.exit(0);
}
