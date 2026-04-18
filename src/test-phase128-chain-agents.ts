// test-phase128-chain-agents.ts — FreeLang v9 Phase 128: CHAIN-AGENTS
// 에이전트 체인 파이프라인 블록 테스트
// 최소 25개 PASS 목표

import { AgentChain, ChainAgent, ChainLink, ChainResult, globalChain } from "./chain-agents";
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

console.log("\n=== Phase 128: CHAIN-AGENTS — 에이전트 체인 파이프라인 ===\n");

// ─── 1. AgentChain 생성 ──────────────────────────────────────────────────────

test("1. AgentChain 생성", () => {
  const chain = new AgentChain();
  assertDefined(chain, "AgentChain 인스턴스 없음");
});

test("2. add() 에이전트 추가", () => {
  const chain = new AgentChain();
  const agent: ChainAgent = { id: "a1", transform: (x: any) => x + 1 };
  const ret = chain.add(agent);
  assert(ret === chain, "add()는 this를 반환해야 함");
});

test("3. length() 확인", () => {
  const chain = new AgentChain();
  assertEq(chain.length(), 0, "초기 length는 0");
  chain.add({ id: "a1", transform: (x: any) => x });
  chain.add({ id: "a2", transform: (x: any) => x });
  assertEq(chain.length(), 2, "2개 추가 후 length는 2");
});

test("4. run() 단일 에이전트", () => {
  const chain = new AgentChain();
  chain.add({ id: "inc", transform: (x: number) => x + 1 });
  const result = chain.run(10);
  assertEq(result.finalOutput, 11, "단일 에이전트 변환: 10+1=11");
});

test("5. run() 여러 에이전트 체인", () => {
  const chain = AgentChain.from([
    { id: "add1", transform: (x: number) => x + 1 },
    { id: "mul2", transform: (x: number) => x * 2 },
    { id: "sub3", transform: (x: number) => x - 3 },
  ]);
  const result = chain.run(5); // (5+1)*2-3 = 9
  assertEq(result.finalOutput, 9, "(5+1)*2-3 = 9");
});

test("6. 이전 출력이 다음 입력", () => {
  const inputs: number[] = [];
  const chain = AgentChain.from([
    { id: "a1", transform: (x: number) => { inputs.push(x); return x + 10; } },
    { id: "a2", transform: (x: number) => { inputs.push(x); return x + 20; } },
  ]);
  chain.run(5);
  assertEq(inputs[0], 5, "첫 에이전트 입력은 초기값");
  assertEq(inputs[1], 15, "두 번째 에이전트 입력은 첫 번째 출력");
});

test("7. finalOutput 마지막 출력", () => {
  const chain = AgentChain.from([
    { id: "double", transform: (x: number) => x * 2 },
    { id: "square", transform: (x: number) => x * x },
  ]);
  const result = chain.run(3); // 3*2=6, 6*6=36
  assertEq(result.finalOutput, 36, "최종 출력: 36");
});

test("8. links 배열", () => {
  const chain = AgentChain.from([
    { id: "step1", transform: (x: number) => x + 1 },
    { id: "step2", transform: (x: number) => x * 2 },
  ]);
  const result = chain.run(4);
  assertEq(result.links.length, 2, "links 길이 2");
  assertEq(result.links[0].agentId, "step1", "첫 link agentId");
  assertEq(result.links[1].agentId, "step2", "두 번째 link agentId");
});

test("9. stepsCompleted 카운트", () => {
  const chain = AgentChain.from([
    { id: "a", transform: (x: number) => x + 1 },
    { id: "b", transform: (x: number) => x + 2 },
    { id: "c", transform: (x: number) => x + 3 },
  ]);
  const result = chain.run(0);
  assertEq(result.stepsCompleted, 3, "3단계 모두 완료");
});

test("10. success=true 정상", () => {
  const chain = AgentChain.from([
    { id: "ok", transform: (x: any) => x },
  ]);
  const result = chain.run(42);
  assert(result.success === true, "정상 실행 시 success=true");
});

test("11. 에러 시 success=false", () => {
  const chain = AgentChain.from([
    { id: "boom", transform: (_: any) => { throw new Error("폭발!"); } },
  ]);
  const result = chain.run(1);
  assert(result.success === false, "에러 발생 시 success=false");
});

test("12. validate 통과 → output 사용", () => {
  const chain = AgentChain.from([
    {
      id: "pos-only",
      transform: (x: number) => x + 10,
      validate: (out: number) => out > 0,
    },
  ]);
  const result = chain.run(5); // 5+10=15, validate 통과
  assertEq(result.finalOutput, 15, "validate 통과 시 output 사용");
  assert(result.links[0].skipped === false, "skipped=false");
});

test("13. validate 실패 → 이전 값 유지", () => {
  const chain = AgentChain.from([
    {
      id: "neg-reject",
      transform: (x: number) => x - 100,  // 5-100=-95
      validate: (out: number) => out > 0,   // -95 < 0 → 실패
    },
  ]);
  const result = chain.run(5);
  assertEq(result.finalOutput, 5, "validate 실패 시 이전 값 유지");
});

test("14. skipped 플래그", () => {
  const chain = AgentChain.from([
    {
      id: "always-fail-validate",
      transform: (x: number) => x * -1,
      validate: (out: number) => out > 0,
    },
  ]);
  const result = chain.run(10);
  assertEq(result.links[0].skipped, true, "validate 실패 → skipped=true");
});

test("15. duration 기록", () => {
  const chain = AgentChain.from([
    { id: "timed", transform: (x: any) => x },
  ]);
  const result = chain.run(0);
  assert(typeof result.links[0].duration === "number", "duration은 숫자");
  assert(result.links[0].duration >= 0, "duration >= 0");
});

test("16. AgentChain.from() 팩토리", () => {
  const agents: ChainAgent[] = [
    { id: "x", transform: (n: number) => n + 5 },
    { id: "y", transform: (n: number) => n * 3 },
  ];
  const chain = AgentChain.from(agents);
  assertEq(chain.length(), 2, "from()으로 2개 에이전트 체인 생성");
  const result = chain.run(2); // (2+5)*3=21
  assertEq(result.finalOutput, 21, "(2+5)*3=21");
});

test("17. 빈 체인 → input 그대로", () => {
  const chain = new AgentChain();
  const result = chain.run(42);
  assertEq(result.finalOutput, 42, "빈 체인은 input을 그대로 반환");
  assertEq(result.links.length, 0, "빈 체인은 links가 비어있음");
  assertEq(result.stepsCompleted, 0, "빈 체인은 stepsCompleted=0");
  assert(result.success === true, "빈 체인도 success=true");
});

// ─── 내장 함수 테스트 ──────────────────────────────────────────────────────────

const interp = new Interpreter();

function run(code: string): any {
  return (interp as any).run(code).lastValue;
}

test("18. chain-agents 내장함수 — 기본 동작", () => {
  const result = run(`
    (define agents (list
      (list "add1" (fn [$x] (+ $x 1)))
      (list "mul2" (fn [$x] (* $x 2)))
    ))
    (chain-agents $agents 10)
  `);
  assertEq(result, 22, "chain-agents: (10+1)*2=22");
});

test("19. chain-links 내장함수", () => {
  const result = run(`
    (define agents (list
      (list "step-a" (fn [$x] (+ $x 1)))
      (list "step-b" (fn [$x] (+ $x 2)))
    ))
    (chain-links $agents 0)
  `);
  assert(Array.isArray(result), "chain-links 결과는 배열");
  assertEq(result.length, 2, "완료된 링크 2개");
  assertEq(result[0], "step-a", "첫 번째 완료 agentId");
  assertEq(result[1], "step-b", "두 번째 완료 agentId");
});

test("20. chain-steps 내장함수", () => {
  const result = run(`
    (define agents (list
      (list "a" (fn [$x] (+ $x 1)))
      (list "b" (fn [$x] (+ $x 1)))
      (list "c" (fn [$x] (+ $x 1)))
    ))
    (chain-steps $agents 0)
  `);
  assertEq(result, 3, "chain-steps: 3단계 완료");
});

// ─── 추가 테스트 ──────────────────────────────────────────────────────────────

test("21. 3단계 변환 (숫자 +1, *2, -3)", () => {
  const chain = AgentChain.from([
    { id: "add1", transform: (x: number) => x + 1 },
    { id: "mul2", transform: (x: number) => x * 2 },
    { id: "sub3", transform: (x: number) => x - 3 },
  ]);
  const result = chain.run(10); // (10+1)*2-3 = 19
  assertEq(result.finalOutput, 19, "(10+1)*2-3=19");
  assertEq(result.stepsCompleted, 3, "3단계 완료");
});

test("22. 문자열 변환 체인", () => {
  const chain = AgentChain.from([
    { id: "upper", transform: (s: string) => s.toUpperCase() },
    { id: "trim",  transform: (s: string) => s.trim() },
    { id: "wrap",  transform: (s: string) => `[${s}]` },
  ]);
  const result = chain.run("  hello  ");
  // upper → "  HELLO  ", trim → "HELLO", wrap → "[HELLO]"
  assertEq(result.finalOutput, "[HELLO]", "문자열 변환 체인");
});

test("23. validate=undefined → 항상 통과", () => {
  const chain = AgentChain.from([
    { id: "no-validate", transform: (x: number) => x + 99 },
  ]);
  const result = chain.run(1);
  assertEq(result.links[0].skipped, false, "validate 없으면 항상 통과");
  assertEq(result.finalOutput, 100, "1+99=100");
});

test("24. 중간 에러 후 중단", () => {
  const chain = AgentChain.from([
    { id: "step1", transform: (x: number) => x + 1 },
    { id: "err",   transform: (_: any) => { throw new Error("중간 에러"); } },
    { id: "step3", transform: (x: number) => x * 10 },
  ]);
  const result = chain.run(5);
  assert(result.success === false, "에러 후 success=false");
  assertEq(result.links.length, 2, "에러 지점까지만 links 기록");
  assertEq(result.finalOutput, 6, "에러 전 마지막 성공값 유지 (5+1=6)");
});

test("25. 통합: 4단계 파이프라인", () => {
  const chain = AgentChain.from([
    { id: "parse",   transform: (s: string) => parseInt(s, 10) },
    { id: "double",  transform: (x: number) => x * 2 },
    { id: "clamp",   transform: (x: number) => Math.min(x, 100), validate: (o: number) => o <= 100 },
    { id: "format",  transform: (x: number) => `result:${x}` },
  ]);
  const result = chain.run("25"); // parseInt("25")=25, 25*2=50, min(50,100)=50, "result:50"
  assertEq(result.finalOutput, "result:50", "4단계 파이프라인 통합");
  assertEq(result.stepsCompleted, 4, "4단계 모두 완료");
  assert(result.success === true, "success=true");
});

// ─── links 상세 검증 ──────────────────────────────────────────────────────────

test("26. link.input/output 값 확인", () => {
  const chain = AgentChain.from([
    { id: "x2", transform: (n: number) => n * 2 },
  ]);
  const result = chain.run(7);
  assertEq(result.links[0].input, 7, "link.input=7");
  assertEq(result.links[0].output, 14, "link.output=14");
});

test("27. 에러 시 link.output=null", () => {
  const chain = AgentChain.from([
    { id: "fail", transform: (_: any) => { throw new Error("fail"); } },
  ]);
  const result = chain.run(1);
  assert(result.links[0].output === null, "에러 시 link.output=null");
  assert(result.links[0].skipped === true, "에러 시 link.skipped=true");
});

test("28. globalChain 인스턴스 존재", () => {
  assertDefined(globalChain, "globalChain이 export되어 있어야 함");
  assert(globalChain instanceof AgentChain, "globalChain은 AgentChain 인스턴스");
});

// ─── regression: Phase 56 Lexical Scope ──────────────────────────────────────

console.log("\n=== Regression: Phase 56 Lexical Scope ===\n");

function runReg(code: string): any {
  const interpReg = new Interpreter();
  return (interpReg as any).run(code).lastValue;
}

function testReg(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    results.push(`  ✅ PASS (reg): ${name}`);
  } catch (e: any) {
    failed++;
    results.push(`  ❌ FAIL (reg): ${name} — ${e.message}`);
  }
}

testReg("reg-1. 기본 define/eval", () => {
  const r = runReg(`(define x 10) (+ x 0)`);
  assertEq(r, 10, "define x=10");
});

testReg("reg-2. closure 캡처", () => {
  const r = runReg(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add5 (make-adder 5))
    (add5 10)
  `);
  assertEq(r, 15, "closure 15");
});

testReg("reg-3. let 스코프", () => {
  const r = runReg(`
    (do (define a 3) (define b 4) (+ a b))
  `);
  assertEq(r, 7, "let 3+4=7");
});

testReg("reg-4. 재귀", () => {
  const r = runReg(`
    (define fact (fn [$n]
      (if (<= $n 1) 1 (* $n (fact (- $n 1))))))
    (fact 5)
  `);
  assertEq(r, 120, "fact(5)=120");
});

testReg("reg-5. 고차함수 map", () => {
  const r = runReg(`
    (map (fn [$x] (* $x 2)) (list 1 2 3))
  `);
  assert(Array.isArray(r) && r[0] === 2 && r[1] === 4 && r[2] === 6, "map *2");
});

testReg("reg-6. 리스트 filter", () => {
  const r = runReg(`
    (filter (list 1 2 3 4 5) (fn [$x] (> $x 3)))
  `);
  assert(Array.isArray(r) && r.length === 2 && r[0] === 4 && r[1] === 5, "filter >3");
});

testReg("reg-7. reduce/fold", () => {
  const r = runReg(`
    (reduce (fn [$acc $x] (+ $acc $x)) 0 (list 1 2 3 4 5))
  `);
  assertEq(r, 15, "reduce sum=15");
});

testReg("reg-8. string 연산", () => {
  const r = runReg(`(length "hello")`);
  assertEq(r, 5, "length=5");
});

testReg("reg-9. 조건문 if-else", () => {
  const r = runReg(`(if (> 5 3) "yes" "no")`);
  assertEq(r, "yes", "if-else yes");
});

testReg("reg-10. do 블록", () => {
  const r = runReg(`
    (do
      (define a 1)
      (define b 2)
      (+ $a $b))
  `);
  assertEq(r, 3, "do block 1+2=3");
});

testReg("reg-11. 중첩 closure", () => {
  const r = runReg(`
    (define outer (fn [$x]
      (do
        (define inner (fn [$y] (+ $x $y)))
        (inner 10))))
    (outer 5)
  `);
  assertEq(r, 15, "중첩 closure 15");
});

testReg("reg-12. list head/tail", () => {
  const r = runReg(`
    (define lst (list 10 20 30))
    (get $lst 0)
  `);
  assertEq(r, 10, "get[0]=10");
});

testReg("reg-13. and/or 논리", () => {
  const r1 = runReg(`(and true true)`);
  const r2 = runReg(`(or false true)`);
  assert(r1 === true && r2 === true, "and/or 논리");
});

testReg("reg-14. 수치 계산", () => {
  const r = runReg(`(* 6 7)`);
  assertEq(r, 42, "6*7=42");
});

// ─── 결과 출력 ────────────────────────────────────────────────────────────────

console.log(results.join("\n"));
console.log(`\n${"─".repeat(60)}`);
console.log(`Phase 128 CHAIN-AGENTS: ${passed} passed, ${failed} failed`);
console.log(`총계: ${passed + failed}개 테스트`);

if (failed > 0) process.exit(1);
process.exit(0);
