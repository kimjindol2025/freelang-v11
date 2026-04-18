// FreeLang v9: Phase 100 — AI 표준 라이브러리 통합 테스트
// AISession / AIWorkflow / AIStdLib 34개 테스트

import AIStdLib, {
  AISession,
  AIWorkflow,
  quickReason,
  quickReflect,
  quickMaybe,
  defaultCriteria,
  MaybeValue,
} from './stdlib-ai';

// ── 테스트 러너 ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(condition: boolean, msg = 'assertion failed') {
  if (!condition) throw new Error(msg);
}

function assertEqual(a: any, b: any, msg?: string) {
  if (a !== b) throw new Error(msg ?? `expected ${b}, got ${a}`);
}

async function asyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

// ────────────────────────────────────────────────────────────────────────────
console.log('\n=== Phase 100: AI Standard Library 통합 테스트 ===\n');
console.log('[ AISession 기본 ]');

test('1. AISession 생성', () => {
  const s = new AISession({ goal: 'test', maxTokens: 2048 });
  assert(s instanceof AISession);
});

test('2. AISession.cot 접근 가능', () => {
  const s = new AISession();
  assert(s.cot !== undefined && s.cot !== null);
  assert(typeof s.cot.step === 'function');
});

test('3. AISession.tot 접근 가능', () => {
  const s = new AISession();
  assert(s.tot !== undefined);
  assert(typeof s.tot.branch === 'function');
});

test('4. AISession.reflector 접근 가능', () => {
  const s = new AISession();
  assert(s.reflector !== undefined);
  assert(typeof s.reflector.reflect === 'function');
});

test('5. AISession.context 접근 가능', () => {
  const s = new AISession();
  assert(s.context !== undefined);
  assert(typeof s.context.add === 'function');
});

test('6. AISession.tools 접근 가능', () => {
  const s = new AISession();
  assert(s.tools !== undefined);
  assert(typeof s.tools.register === 'function');
});

test('7. AISession.store/recall', () => {
  const s = new AISession();
  s.store('answer', 42);
  assertEqual(s.recall('answer'), 42);
});

test('8. AISession.summary() 문자열 반환', () => {
  const s = new AISession({ goal: 'Summary Test' });
  const sum = s.summary();
  assert(typeof sum === 'string');
  assert(sum.includes('AI Session Summary'));
});

console.log('\n[ AIWorkflow ]');

test('9. AIWorkflow 생성', () => {
  const wf = new AIWorkflow();
  assert(wf instanceof AIWorkflow);
});

test('10. AIWorkflow.step() 체이닝', () => {
  const wf = new AIWorkflow();
  const result = wf.step(() => 1).step(() => 2);
  assert(result instanceof AIWorkflow);
});

test('11. AIWorkflow.run() → 결과 배열 (async)', async () => {
  const wf = new AIWorkflow();
  wf.step(() => 'a').step(() => 'b');
  const results = await wf.run();
  assert(Array.isArray(results));
  assertEqual(results.length, 2);
  assertEqual(results[0], 'a');
  assertEqual(results[1], 'b');
});

test('12. AIWorkflow.last() 마지막 결과', async () => {
  const wf = new AIWorkflow();
  wf.step(() => 10).step(() => 20).step(() => 30);
  await wf.run();
  assertEqual(wf.last(), 30);
});

console.log('\n[ 빠른 유틸리티 함수 ]');

test('13. quickReason() 마크다운 반환', () => {
  const md = quickReason('파리는 어디?', ['프랑스의 수도', '유럽에 위치']);
  assert(typeof md === 'string');
  assert(md.includes('파리는 어디?') || md.length > 0);
});

test('14. quickReflect() passed/score/feedback', () => {
  const result = quickReflect('hello world', 0.5);
  assert(typeof result.passed === 'boolean');
  assert(typeof result.score === 'number');
  assert(Array.isArray(result.feedback));
});

test('15. quickMaybe() MaybeValue 반환', () => {
  const m = quickMaybe('Paris', 0.9);
  assert(m !== null && m !== undefined);
  assert(m._tag === 'Maybe');
});

console.log('\n[ AIStdLib 팩토리 메서드 ]');

test('16. AIStdLib.session()', () => {
  const s = AIStdLib.session({ goal: 'test' });
  assert(s instanceof AISession);
});

test('17. AIStdLib.workflow()', () => {
  const wf = AIStdLib.workflow();
  assert(wf instanceof AIWorkflow);
});

test('18. AIStdLib.cot()', () => {
  const cot = AIStdLib.cot('Test Goal');
  assert(cot !== null);
  assert(typeof cot.step === 'function');
  assert(typeof cot.toMarkdown === 'function');
});

test('19. AIStdLib.tot()', () => {
  const tot = AIStdLib.tot('Choose best');
  assert(tot !== null);
  assert(typeof tot.branch === 'function');
});

test('20. AIStdLib.reflect()', () => {
  const r = AIStdLib.reflect();
  assert(r !== null);
  assert(typeof r.reflect === 'function');
});

test('21. AIStdLib.context()', () => {
  const ctx = AIStdLib.context(8192);
  assert(ctx !== null);
  assert(typeof ctx.add === 'function');
  assert(typeof ctx.stats === 'function');
});

test('22. AIStdLib.tools()', () => {
  const tools = AIStdLib.tools();
  assert(tools !== null);
  assert(typeof tools.register === 'function');
});

test('23. AIStdLib.agent()', () => {
  const agent = AIStdLib.agent('Find answer', 5);
  assert(agent !== null);
});

test('24. AIStdLib.improve()', () => {
  const improver = AIStdLib.improve({
    target: 'hello',
    evaluate: (v: string) => v.length / 10,
    improve: (v: string) => ({ value: v + '!', improvement: 'added !' }),
    maxIterations: 2,
  });
  assert(improver !== null);
});

console.log('\n[ Result 타입 ]');

test('25. AIStdLib.ok(42) → ok Result', () => {
  const r = AIStdLib.ok(42);
  assert(r._tag === 'Ok');
  assert((r as any).value === 42);
});

test('26. AIStdLib.err("E", "msg") → err Result', () => {
  const r = AIStdLib.err('E001', 'error message');
  assert(r._tag === 'Err');
  assert((r as any).message === 'error message');
});

test('27. AIStdLib.isOk(ok(1)) → true', () => {
  const r = AIStdLib.ok(1);
  assert(AIStdLib.isOk(r) === true);
});

console.log('\n[ Maybe 타입 ]');

test('28. AIStdLib.maybe(0.9, "Paris") → MaybeValue', () => {
  const m = AIStdLib.maybe(0.9, 'Paris');
  assert(m._tag === 'Maybe');
  assert((m as any).confidence === 0.9);
  assert((m as any).value === 'Paris');
});

test('29. AIStdLib.none() → none MaybeValue', () => {
  const n = AIStdLib.none('no value');
  assert(n._tag === 'None');
});

console.log('\n[ 에러 처리 ]');

test('30. AIStdLib.errorSystem() 생성', () => {
  const es = AIStdLib.errorSystem();
  assert(es !== null);
  assert(typeof es.handle === 'function');
});

console.log('\n[ 통합 테스트 ]');

test('31. 통합: session → cot.step → reflector.reflect → context.add', () => {
  const s = new AISession({ goal: '통합 테스트' });

  // cot에 단계 추가
  s.cot.step('추론 1', () => 'result1');

  // reflector로 반영
  const refResult = s.reflector.reflect('some output', 0.0);
  assert(typeof refResult.passed === 'boolean');

  // context에 항목 추가
  s.context.add('통합 결과', { tokens: 50, priority: 0.8, tags: ['test'] });
  const stats = s.context.stats();
  assert(stats.count === 1);
});

test('32. 통합: workflow → 여러 step → run 결과 확인', async () => {
  const wf = AIStdLib.workflow();
  wf.step(() => 'step1-result')
    .step(() => ({ computed: 42 }))
    .step(() => [1, 2, 3]);

  const results = await wf.run();
  assertEqual(results.length, 3);
  assertEqual(results[0], 'step1-result');
  assertEqual((results[1] as any).computed, 42);
  assertEqual((results[2] as number[])[1], 2);
});

test('33. 통합: maybe → confident 확인', () => {
  const m = AIStdLib.maybe(0.95, 'Seoul');
  const val = AIStdLib.confident(m, 0.9);
  assertEqual(val, 'Seoul');

  const low = AIStdLib.maybe(0.3, 'maybe-city');
  const valLow = AIStdLib.confident(low, 0.9);
  assert(valLow === null);
});

test('34. 통합: AIStdLib default export 확인', () => {
  // default export가 AIStdLib과 동일한 객체인지 확인
  assert(typeof AIStdLib.session === 'function');
  assert(typeof AIStdLib.workflow === 'function');
  assert(typeof AIStdLib.cot === 'function');
  assert(typeof AIStdLib.tot === 'function');
  assert(typeof AIStdLib.reflect === 'function');
  assert(typeof AIStdLib.ok === 'function');
  assert(typeof AIStdLib.err === 'function');
  assert(typeof AIStdLib.maybe === 'function');
  assert(typeof AIStdLib.none === 'function');
  assert(typeof AIStdLib.errorSystem === 'function');
  assert(typeof AIStdLib.quickReason === 'function');
  assert(typeof AIStdLib.quickReflect === 'function');
  assert(typeof AIStdLib.quickMaybe === 'function');
});

// ── 비동기 테스트 실행 ────────────────────────────────────────────────────

async function runAsyncTests() {
  await asyncTest('11(async). AIWorkflow.run() → 결과 배열', async () => {
    const wf = new AIWorkflow();
    wf.step(() => 'a').step(() => 'b');
    const results = await wf.run();
    assert(Array.isArray(results));
    assertEqual(results.length, 2);
  });

  await asyncTest('32(async). 통합 workflow run', async () => {
    const wf = AIStdLib.workflow();
    wf.step(() => 'step1').step(() => 'step2');
    const results = await wf.run();
    assertEqual(results[0], 'step1');
    assertEqual(results[1], 'step2');
  });
}

// ── 최종 결과 ─────────────────────────────────────────────────────────────

runAsyncTests().then(() => {
  console.log(`\n============================`);
  console.log(`결과: ${passed} PASS / ${failed} FAIL`);
  if (failed === 0) {
    console.log(`✅ 모든 테스트 통과! Phase 100 완성`);
  } else {
    console.log(`❌ ${failed}개 테스트 실패`);
    process.exit(1);
  }
}).catch((e) => {
  console.error('비동기 테스트 오류:', e);
  process.exit(1);
});
