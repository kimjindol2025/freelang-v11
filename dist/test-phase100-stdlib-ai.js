"use strict";
// FreeLang v9: Phase 100 — AI 표준 라이브러리 통합 테스트
// AISession / AIWorkflow / AIStdLib 34개 테스트
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const stdlib_ai_1 = __importStar(require("./stdlib-ai"));
// ── 테스트 러너 ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ FAIL: ${name} — ${e.message}`);
        failed++;
    }
}
function assert(condition, msg = 'assertion failed') {
    if (!condition)
        throw new Error(msg);
}
function assertEqual(a, b, msg) {
    if (a !== b)
        throw new Error(msg ?? `expected ${b}, got ${a}`);
}
async function asyncTest(name, fn) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ FAIL: ${name} — ${e.message}`);
        failed++;
    }
}
// ────────────────────────────────────────────────────────────────────────────
console.log('\n=== Phase 100: AI Standard Library 통합 테스트 ===\n');
console.log('[ AISession 기본 ]');
test('1. AISession 생성', () => {
    const s = new stdlib_ai_1.AISession({ goal: 'test', maxTokens: 2048 });
    assert(s instanceof stdlib_ai_1.AISession);
});
test('2. AISession.cot 접근 가능', () => {
    const s = new stdlib_ai_1.AISession();
    assert(s.cot !== undefined && s.cot !== null);
    assert(typeof s.cot.step === 'function');
});
test('3. AISession.tot 접근 가능', () => {
    const s = new stdlib_ai_1.AISession();
    assert(s.tot !== undefined);
    assert(typeof s.tot.branch === 'function');
});
test('4. AISession.reflector 접근 가능', () => {
    const s = new stdlib_ai_1.AISession();
    assert(s.reflector !== undefined);
    assert(typeof s.reflector.reflect === 'function');
});
test('5. AISession.context 접근 가능', () => {
    const s = new stdlib_ai_1.AISession();
    assert(s.context !== undefined);
    assert(typeof s.context.add === 'function');
});
test('6. AISession.tools 접근 가능', () => {
    const s = new stdlib_ai_1.AISession();
    assert(s.tools !== undefined);
    assert(typeof s.tools.register === 'function');
});
test('7. AISession.store/recall', () => {
    const s = new stdlib_ai_1.AISession();
    s.store('answer', 42);
    assertEqual(s.recall('answer'), 42);
});
test('8. AISession.summary() 문자열 반환', () => {
    const s = new stdlib_ai_1.AISession({ goal: 'Summary Test' });
    const sum = s.summary();
    assert(typeof sum === 'string');
    assert(sum.includes('AI Session Summary'));
});
console.log('\n[ AIWorkflow ]');
test('9. AIWorkflow 생성', () => {
    const wf = new stdlib_ai_1.AIWorkflow();
    assert(wf instanceof stdlib_ai_1.AIWorkflow);
});
test('10. AIWorkflow.step() 체이닝', () => {
    const wf = new stdlib_ai_1.AIWorkflow();
    const result = wf.step(() => 1).step(() => 2);
    assert(result instanceof stdlib_ai_1.AIWorkflow);
});
test('11. AIWorkflow.run() → 결과 배열 (async)', async () => {
    const wf = new stdlib_ai_1.AIWorkflow();
    wf.step(() => 'a').step(() => 'b');
    const results = await wf.run();
    assert(Array.isArray(results));
    assertEqual(results.length, 2);
    assertEqual(results[0], 'a');
    assertEqual(results[1], 'b');
});
test('12. AIWorkflow.last() 마지막 결과', async () => {
    const wf = new stdlib_ai_1.AIWorkflow();
    wf.step(() => 10).step(() => 20).step(() => 30);
    await wf.run();
    assertEqual(wf.last(), 30);
});
console.log('\n[ 빠른 유틸리티 함수 ]');
test('13. quickReason() 마크다운 반환', () => {
    const md = (0, stdlib_ai_1.quickReason)('파리는 어디?', ['프랑스의 수도', '유럽에 위치']);
    assert(typeof md === 'string');
    assert(md.includes('파리는 어디?') || md.length > 0);
});
test('14. quickReflect() passed/score/feedback', () => {
    const result = (0, stdlib_ai_1.quickReflect)('hello world', 0.5);
    assert(typeof result.passed === 'boolean');
    assert(typeof result.score === 'number');
    assert(Array.isArray(result.feedback));
});
test('15. quickMaybe() MaybeValue 반환', () => {
    const m = (0, stdlib_ai_1.quickMaybe)('Paris', 0.9);
    assert(m !== null && m !== undefined);
    assert(m._tag === 'Maybe');
});
console.log('\n[ AIStdLib 팩토리 메서드 ]');
test('16. AIStdLib.session()', () => {
    const s = stdlib_ai_1.default.session({ goal: 'test' });
    assert(s instanceof stdlib_ai_1.AISession);
});
test('17. AIStdLib.workflow()', () => {
    const wf = stdlib_ai_1.default.workflow();
    assert(wf instanceof stdlib_ai_1.AIWorkflow);
});
test('18. AIStdLib.cot()', () => {
    const cot = stdlib_ai_1.default.cot('Test Goal');
    assert(cot !== null);
    assert(typeof cot.step === 'function');
    assert(typeof cot.toMarkdown === 'function');
});
test('19. AIStdLib.tot()', () => {
    const tot = stdlib_ai_1.default.tot('Choose best');
    assert(tot !== null);
    assert(typeof tot.branch === 'function');
});
test('20. AIStdLib.reflect()', () => {
    const r = stdlib_ai_1.default.reflect();
    assert(r !== null);
    assert(typeof r.reflect === 'function');
});
test('21. AIStdLib.context()', () => {
    const ctx = stdlib_ai_1.default.context(8192);
    assert(ctx !== null);
    assert(typeof ctx.add === 'function');
    assert(typeof ctx.stats === 'function');
});
test('22. AIStdLib.tools()', () => {
    const tools = stdlib_ai_1.default.tools();
    assert(tools !== null);
    assert(typeof tools.register === 'function');
});
test('23. AIStdLib.agent()', () => {
    const agent = stdlib_ai_1.default.agent('Find answer', 5);
    assert(agent !== null);
});
test('24. AIStdLib.improve()', () => {
    const improver = stdlib_ai_1.default.improve({
        target: 'hello',
        evaluate: (v) => v.length / 10,
        improve: (v) => ({ value: v + '!', improvement: 'added !' }),
        maxIterations: 2,
    });
    assert(improver !== null);
});
console.log('\n[ Result 타입 ]');
test('25. AIStdLib.ok(42) → ok Result', () => {
    const r = stdlib_ai_1.default.ok(42);
    assert(r._tag === 'Ok');
    assert(r.value === 42);
});
test('26. AIStdLib.err("E", "msg") → err Result', () => {
    const r = stdlib_ai_1.default.err('E001', 'error message');
    assert(r._tag === 'Err');
    assert(r.message === 'error message');
});
test('27. AIStdLib.isOk(ok(1)) → true', () => {
    const r = stdlib_ai_1.default.ok(1);
    assert(stdlib_ai_1.default.isOk(r) === true);
});
console.log('\n[ Maybe 타입 ]');
test('28. AIStdLib.maybe(0.9, "Paris") → MaybeValue', () => {
    const m = stdlib_ai_1.default.maybe(0.9, 'Paris');
    assert(m._tag === 'Maybe');
    assert(m.confidence === 0.9);
    assert(m.value === 'Paris');
});
test('29. AIStdLib.none() → none MaybeValue', () => {
    const n = stdlib_ai_1.default.none('no value');
    assert(n._tag === 'None');
});
console.log('\n[ 에러 처리 ]');
test('30. AIStdLib.errorSystem() 생성', () => {
    const es = stdlib_ai_1.default.errorSystem();
    assert(es !== null);
    assert(typeof es.handle === 'function');
});
console.log('\n[ 통합 테스트 ]');
test('31. 통합: session → cot.step → reflector.reflect → context.add', () => {
    const s = new stdlib_ai_1.AISession({ goal: '통합 테스트' });
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
    const wf = stdlib_ai_1.default.workflow();
    wf.step(() => 'step1-result')
        .step(() => ({ computed: 42 }))
        .step(() => [1, 2, 3]);
    const results = await wf.run();
    assertEqual(results.length, 3);
    assertEqual(results[0], 'step1-result');
    assertEqual(results[1].computed, 42);
    assertEqual(results[2][1], 2);
});
test('33. 통합: maybe → confident 확인', () => {
    const m = stdlib_ai_1.default.maybe(0.95, 'Seoul');
    const val = stdlib_ai_1.default.confident(m, 0.9);
    assertEqual(val, 'Seoul');
    const low = stdlib_ai_1.default.maybe(0.3, 'maybe-city');
    const valLow = stdlib_ai_1.default.confident(low, 0.9);
    assert(valLow === null);
});
test('34. 통합: AIStdLib default export 확인', () => {
    // default export가 AIStdLib과 동일한 객체인지 확인
    assert(typeof stdlib_ai_1.default.session === 'function');
    assert(typeof stdlib_ai_1.default.workflow === 'function');
    assert(typeof stdlib_ai_1.default.cot === 'function');
    assert(typeof stdlib_ai_1.default.tot === 'function');
    assert(typeof stdlib_ai_1.default.reflect === 'function');
    assert(typeof stdlib_ai_1.default.ok === 'function');
    assert(typeof stdlib_ai_1.default.err === 'function');
    assert(typeof stdlib_ai_1.default.maybe === 'function');
    assert(typeof stdlib_ai_1.default.none === 'function');
    assert(typeof stdlib_ai_1.default.errorSystem === 'function');
    assert(typeof stdlib_ai_1.default.quickReason === 'function');
    assert(typeof stdlib_ai_1.default.quickReflect === 'function');
    assert(typeof stdlib_ai_1.default.quickMaybe === 'function');
});
// ── 비동기 테스트 실행 ────────────────────────────────────────────────────
async function runAsyncTests() {
    await asyncTest('11(async). AIWorkflow.run() → 결과 배열', async () => {
        const wf = new stdlib_ai_1.AIWorkflow();
        wf.step(() => 'a').step(() => 'b');
        const results = await wf.run();
        assert(Array.isArray(results));
        assertEqual(results.length, 2);
    });
    await asyncTest('32(async). 통합 workflow run', async () => {
        const wf = stdlib_ai_1.default.workflow();
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
    }
    else {
        console.log(`❌ ${failed}개 테스트 실패`);
        process.exit(1);
    }
}).catch((e) => {
    console.error('비동기 테스트 오류:', e);
    process.exit(1);
});
//# sourceMappingURL=test-phase100-stdlib-ai.js.map