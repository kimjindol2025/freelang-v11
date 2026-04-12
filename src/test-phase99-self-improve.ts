// Phase 99: SELF-IMPROVE 테스트 — 25개 케이스
import { SelfImprover, createSelfImprover, SelfImproveState } from './self-improve';

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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertClose(a: number, b: number, eps = 0.0001, msg = '') {
  if (Math.abs(a - b) > eps) throw new Error(`${msg} expected ~${b}, got ${a}`);
}

console.log('\n=== Phase 99: SELF-IMPROVE Tests ===\n');

// 1. 기본 생성 (target, evaluate, improve)
test('1. 기본 생성', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.1, improvement: '+0.1' })
  });
  assert(s.getState().iteration === 0, 'iteration should be 0');
  assert(s.getState().done === false, 'should not be done');
});

// 2. step() 1번 호출 → iteration 증가
test('2. step() 호출 시 iteration 증가', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.1, improvement: '+0.1' })
  });
  s.step();
  assert(s.getState().iteration === 1, 'iteration should be 1 after one step');
});

// 3. run() → 완료 (done=true)
test('3. run() 후 done=true', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.5, improvement: '+0.5' }),
    maxIterations: 3
  });
  const result = s.run();
  assert(result.done === true, 'should be done after run()');
});

// 4. maxIterations 도달 → done, reason
test('4. maxIterations 도달 시 종료', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.5, improvement: '+0.5' }),
    maxIterations: 2
  });
  const result = s.run();
  assert(result.done === true, 'should be done');
  assert(result.reason === 'max iterations reached', `reason should be max iterations, got: ${result.reason}`);
  assert(result.iteration === 2, 'iteration should be 2');
});

// 5. stopWhen 조건 → 조기 종료
test('5. stopWhen 조건 충족 시 조기 종료', () => {
  const s = new SelfImprover({
    target: 0.0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.5, improvement: '+0.5' }),
    maxIterations: 10,
    stopWhen: (score: number) => score >= 0.5
  });
  const result = s.run();
  assert(result.done === true, 'should be done');
  assert(result.reason === 'stop-when condition met', `got: ${result.reason}`);
  assert(result.iteration < 10, 'should stop before maxIterations');
});

// 6. minImprovement 미달 → 종료
test('6. minImprovement 미달 시 종료', () => {
  const s = new SelfImprover({
    target: 0.5,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.001, improvement: 'tiny' }),
    minImprovement: 0.01,
    maxIterations: 10
  });
  const result = s.run();
  assert(result.done === true, 'should be done');
  assert(result.reason === 'improvement below threshold', `got: ${result.reason}`);
});

// 7. 점수 개선 시 current 업데이트
test('7. 점수 개선 시 current 업데이트', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.3, improvement: '+0.3' }),
    maxIterations: 1
  });
  s.step();
  assertClose(s.getState().current as number, 0.3, 0.0001, 'current');
});

// 8. 점수 하락 시 current 유지
test('8. 점수 하락 시 current 유지', () => {
  const s = new SelfImprover({
    target: 0.8,
    evaluate: (v: number) => v,
    improve: (_v: number) => ({ value: 0.5, improvement: 'worse' }),
    maxIterations: 1
  });
  s.step();
  assertClose(s.getState().current as number, 0.8, 0.0001, 'current should stay 0.8');
});

// 9. history 기록 확인
test('9. history에 각 iteration 기록됨', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.2, improvement: '+0.2' }),
    maxIterations: 3
  });
  s.run();
  // history[0] = initial, history[1..3] = steps
  assert(s.getState().history.length >= 2, 'history should have entries');
});

// 10. toMarkdown() 출력 확인
test('10. toMarkdown() 출력 형식 확인', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.5, improvement: '+0.5' }),
    maxIterations: 2
  });
  s.run();
  const md = s.toMarkdown();
  assert(md.includes('## SELF-IMPROVE'), 'should include header');
  assert(md.includes('**Final score**'), 'should include final score');
  assert(md.includes('Iteration'), 'should include iteration sections');
});

// 11. 숫자 목표 최적화 (점진적 개선)
test('11. 숫자 목표 최적화 시뮬레이션', () => {
  let step = 0;
  const improvements = [0.3, 0.5, 0.8];
  const s = new SelfImprover({
    target: 0.0,
    evaluate: (v: number) => v,
    improve: (_v: number, _score: number) => {
      const val = improvements[step] ?? 1.0;
      step++;
      return { value: val, improvement: `step-${step}` };
    },
    maxIterations: 3
  });
  const result = s.run();
  assert(result.score > 0, 'score should have improved');
});

// 12. 문자열 개선 시뮬레이션
test('12. 문자열 개선 시뮬레이션', () => {
  const versions = ['bad code', 'ok code', 'good code', 'great code'];
  let idx = 0;
  const s = new SelfImprover<string>({
    target: versions[0],
    evaluate: (v: string) => v.length / 10,
    improve: (_v: string) => {
      idx++;
      return { value: versions[Math.min(idx, versions.length - 1)], improvement: `v${idx}` };
    },
    maxIterations: 3
  });
  const result = s.run();
  assert(typeof result.current === 'string', 'current should be string');
});

// 13. stopWhen=score>0.9 → 0.95면 종료
test('13. stopWhen score>0.9 조건', () => {
  let val = 0.0;
  const s = new SelfImprover({
    target: 0.0,
    evaluate: (v: number) => v,
    improve: (_v: number) => {
      val += 0.35;
      return { value: Math.min(val, 1.0), improvement: `+0.35` };
    },
    maxIterations: 10,
    stopWhen: (score: number) => score > 0.9
  });
  const result = s.run();
  assert(result.score > 0.9, `score should be >0.9, got ${result.score}`);
  assert(result.reason === 'stop-when condition met', `got: ${result.reason}`);
});

// 14. 완료 후 step() 호출 → state 불변
test('14. done 후 step() 호출해도 state 변화 없음', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.5, improvement: 'x' }),
    maxIterations: 1
  });
  s.run();
  const iterBefore = s.getState().iteration;
  s.step();
  s.step();
  assert(s.getState().iteration === iterBefore, 'iteration should not change after done');
});

// 15. history[0] = initial 확인
test('15. history[0]는 initial 항목', () => {
  const s = new SelfImprover({
    target: 42,
    evaluate: (_v: number) => 0.5,
    improve: (v: number) => ({ value: v + 1, improvement: '+1' })
  });
  const h0 = s.getState().history[0];
  assert(h0.iteration === 0, 'first history iteration should be 0');
  assert(h0.improvement === 'initial', 'first improvement should be "initial"');
  assert(h0.value === 42, 'first value should be target');
});

// 16. reason 문자열 확인
test('16. reason 문자열 정확히 설정됨', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: () => 0.5,
    improve: (v: number) => ({ value: v + 0.001, improvement: 'tiny' }),
    minImprovement: 0.01,
    maxIterations: 10
  });
  const result = s.run();
  const validReasons = ['max iterations reached', 'stop-when condition met', 'improvement below threshold'];
  assert(validReasons.includes(result.reason), `unexpected reason: ${result.reason}`);
});

// 17. getState() 동작
test('17. getState() 현재 상태 반환', () => {
  const s = new SelfImprover({
    target: 100,
    evaluate: (v: number) => v / 100,
    improve: (v: number) => ({ value: v + 10, improvement: '+10' }),
    maxIterations: 2
  });
  s.step();
  const state = s.getState();
  assert(state.iteration === 1, 'should be iteration 1');
  assert(typeof state.score === 'number', 'score should be number');
  assert(Array.isArray(state.history), 'history should be array');
});

// 18. createSelfImprover() 팩토리 함수
test('18. createSelfImprover() 팩토리 함수', () => {
  const s = createSelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.5, improvement: '+0.5' }),
    maxIterations: 2
  });
  assert(s instanceof SelfImprover, 'should return SelfImprover instance');
  const result = s.run();
  assert(result.done === true, 'should complete');
});

// 19. maxIterations=1 → 1회 후 종료
test('19. maxIterations=1이면 1회 후 종료', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.5, improvement: '+0.5' }),
    maxIterations: 1
  });
  const result = s.run();
  assert(result.iteration === 1, `iteration should be 1, got ${result.iteration}`);
  assert(result.done === true, 'should be done');
});

// 20. evaluate 함수가 매번 호출됨
test('20. evaluate 함수가 매 step 호출됨', () => {
  let evalCount = 0;
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => { evalCount++; return v; },
    improve: (v: number) => ({ value: v + 0.2, improvement: '+0.2' }),
    maxIterations: 3
  });
  s.run();
  // 초기 1번 + 각 step마다 1번 = 1 + 3 = 4
  assert(evalCount >= 4, `evalCount should be >=4, got ${evalCount}`);
});

// 21. improve 함수에 history 전달됨
test('21. improve 함수에 history 전달됨', () => {
  let receivedHistory: any[] | null = null;
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number, _score: number, history: any[]) => {
      receivedHistory = history;
      return { value: v + 0.5, improvement: '+0.5' };
    },
    maxIterations: 1
  });
  s.step();
  assert(receivedHistory !== null, 'history should be passed to improve');
  assert(Array.isArray(receivedHistory), 'history should be an array');
  assert((receivedHistory as unknown as any[]).length >= 1, 'history should have at least 1 entry');
});

// 22. improvement 문자열이 history에 기록됨
test('22. improvement 문자열이 history에 기록됨', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.3, improvement: 'custom-improvement-tag' }),
    maxIterations: 2
  });
  s.step();
  const lastH = s.getState().history[s.getState().history.length - 1];
  assert(lastH.improvement === 'custom-improvement-tag', 'improvement string should match');
});

// 23. 최종 score = 최고 채택 점수
test('23. 최종 score는 최고 채택 점수', () => {
  // 개선 후 하락 시도 — current와 score는 최고점 유지
  let call = 0;
  const s = new SelfImprover({
    target: 0.5,
    evaluate: (v: number) => v,
    improve: (_v: number) => {
      call++;
      return { value: call === 1 ? 0.9 : 0.3, improvement: `call-${call}` };
    },
    maxIterations: 2
  });
  s.run();
  assertClose(s.getState().score, 0.9, 0.0001, 'score should be best adopted');
});

// 24. minImprovement=0 → 개선 없으면 즉시 종료
test('24. minImprovement=0이면 개선 없을 때 즉시 종료', () => {
  const s = new SelfImprover({
    target: 0.5,
    evaluate: (_v: number) => 0.5, // 항상 동일 점수
    improve: (v: number) => ({ value: v, improvement: 'no-change' }),
    minImprovement: 0,
    maxIterations: 10
  });
  const result = s.run();
  assert(result.done === true, 'should be done');
  assert(result.reason === 'improvement below threshold', `got: ${result.reason}`);
  assert(result.iteration === 1, `should stop at iteration 1, got ${result.iteration}`);
});

// 25. run() 여러 번 호출해도 안전
test('25. run() 여러 번 호출해도 안전', () => {
  const s = new SelfImprover({
    target: 0,
    evaluate: (v: number) => v,
    improve: (v: number) => ({ value: v + 0.5, improvement: '+0.5' }),
    maxIterations: 2
  });
  const r1 = s.run();
  const r2 = s.run();
  const r3 = s.run();
  assert(r1.done === true, 'should be done');
  assert(r2.done === true, 'second run still done');
  assert(r3.done === true, 'third run still done');
  assert(r1.iteration === r2.iteration, 'iteration should not change on repeated run()');
});

// 결과 출력
console.log('\n==============================');
console.log(`결과: ${passed} PASS / ${failed} FAIL (총 ${passed + failed}개)`);
console.log('==============================\n');

if (failed > 0) {
  process.exit(1);
}
