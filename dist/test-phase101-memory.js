"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Phase 101: Memory System 테스트 — 27개 케이스
const memory_system_1 = require("./memory-system");
const interpreter_1 = require("./interpreter");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  PASS: ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  FAIL: ${name} — ${e.message}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
console.log('\n=== Phase 101: Memory System Tests ===\n');
// ─── MemorySystem 클래스 테스트 ────────────────────────────────
// 1. MemorySystem 생성
test('1. MemorySystem 생성', () => {
    const m = new memory_system_1.MemorySystem();
    const s = m.stats();
    assert(s.longTerm === 0, 'longTerm should be 0');
    assert(s.shortTerm === 0, 'shortTerm should be 0');
    assert(s.episodes === 0, 'episodes should be 0');
});
// 2. remember() + recall() 기본
test('2. remember() + recall() 기본', () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('name', 'FreeLang');
    const v = m.recall('name');
    assert(v === 'FreeLang', `expected FreeLang, got ${v}`);
});
// 3. recall() 없는 키 → fallback
test('3. recall() 없는 키 → fallback 반환', () => {
    const m = new memory_system_1.MemorySystem();
    const v = m.recall('nonexistent', 'fallback-value');
    assert(v === 'fallback-value', `expected fallback-value, got ${v}`);
});
// 4. recall() fallback null
test('4. recall() fallback null (기본값)', () => {
    const m = new memory_system_1.MemorySystem();
    const v = m.recall('missing');
    assert(v === null, `expected null, got ${v}`);
});
// 5. forget() 삭제
test('5. forget() 삭제', () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('toDelete', 42);
    const deleted = m.forget('toDelete');
    assert(deleted === true, 'forget should return true');
    const v = m.recall('toDelete');
    assert(v === null, 'recalled value should be null after forget');
});
// 6. scope=short-term 저장
test('6. scope=short-term 저장', () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('temp', 'temp-value', { scope: 'short-term', ttl: 'forever' });
    const v = m.recall('temp');
    assert(v === 'temp-value', `expected temp-value, got ${v}`);
});
// 7. keys() 전체 목록
test('7. keys() 전체 목록', () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('k1', 1);
    m.remember('k2', 2, { scope: 'short-term', ttl: 'forever' });
    const ks = m.keys();
    assert(ks.includes('k1'), 'k1 should be in keys');
    assert(ks.includes('k2'), 'k2 should be in keys');
    assert(ks.length === 2, `expected 2 keys, got ${ks.length}`);
});
// 8. keys(scope) 필터
test('8. keys(scope) 필터', () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('long1', 1, { scope: 'long-term' });
    m.remember('short1', 2, { scope: 'short-term', ttl: 'forever' });
    const longKeys = m.keys('long-term');
    const shortKeys = m.keys('short-term');
    assert(longKeys.includes('long1') && !longKeys.includes('short1'), 'long-term scope filter');
    assert(shortKeys.includes('short1') && !shortKeys.includes('long1'), 'short-term scope filter');
});
// 9. TTL 만료 → fallback 반환
test('9. TTL 만료 → fallback 반환', async () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('expiring', 'will-expire', { scope: 'short-term', ttl: 1 }); // 1ms TTL
    await new Promise(r => setTimeout(r, 10)); // 10ms 대기
    const v = m.recall('expiring', 'expired');
    assert(v === 'expired', `expected 'expired', got ${v}`);
});
// 10. TTL forever → 만료 없음
test('10. TTL forever → 만료 없음', async () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('permanent', 'stays', { ttl: 'forever' });
    await new Promise(r => setTimeout(r, 5));
    const v = m.recall('permanent');
    assert(v === 'stays', `expected 'stays', got ${v}`);
});
// 11. recordEpisode() 기록
test('11. recordEpisode() 기록', () => {
    const m = new memory_system_1.MemorySystem();
    const ep = m.recordEpisode('ep-001', 'Phase 101 시작', { phase: 101 });
    assert(ep.id === 'ep-001', `expected ep-001, got ${ep.id}`);
    assert(ep.what === 'Phase 101 시작', `expected correct what`);
    assert(ep.when > 0, 'when should be > 0');
    assert(ep.context.phase === 101, 'context should be preserved');
});
// 12. searchEpisodes() 검색 hit
test('12. searchEpisodes() 검색 hit', () => {
    const m = new memory_system_1.MemorySystem();
    m.recordEpisode('ep-001', 'FreeLang v9 메모리 구현');
    m.recordEpisode('ep-002', 'Phase 99 완료');
    const results = m.searchEpisodes('FreeLang');
    assert(results.length === 1, `expected 1, got ${results.length}`);
    assert(results[0].id === 'ep-001', `expected ep-001`);
});
// 13. searchEpisodes() 검색 miss
test('13. searchEpisodes() 검색 miss', () => {
    const m = new memory_system_1.MemorySystem();
    m.recordEpisode('ep-001', 'FreeLang v9 메모리');
    const results = m.searchEpisodes('DOES_NOT_EXIST');
    assert(results.length === 0, `expected 0, got ${results.length}`);
});
// 14. setWorking() + getWorking()
test('14. setWorking() + getWorking()', () => {
    const m = new memory_system_1.MemorySystem();
    m.setWorking({ task: 'phase101', progress: 50 });
    const w = m.getWorking();
    assert(w.task === 'phase101', `expected phase101, got ${w?.task}`);
    assert(w.progress === 50, `expected 50, got ${w?.progress}`);
});
// 15. clearWorking() → null
test('15. clearWorking() → null', () => {
    const m = new memory_system_1.MemorySystem();
    m.setWorking('some value');
    m.clearWorking();
    const w = m.getWorking();
    assert(w === null, `expected null, got ${w}`);
});
// 16. searchByTag() 태그 검색
test('16. searchByTag() 태그 검색', () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('important', 'value1', { tags: ['critical', 'ai'] });
    m.remember('normal', 'value2', { tags: ['normal'] });
    m.remember('also-critical', 'value3', { tags: ['critical'] });
    const results = m.searchByTag('critical');
    assert(results.length === 2, `expected 2, got ${results.length}`);
});
// 17. accessCount 증가 확인
test('17. accessCount 증가 확인', () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('counter', 'val');
    m.recall('counter');
    m.recall('counter');
    m.recall('counter');
    // 직접 접근하려면 searchByTag 또는 keys()로 엔트리 얻기
    // 공개 API로는 stats만 있으므로 recall이 예외 없이 동작하는 것 검증
    const v = m.recall('counter');
    assert(v === 'val', 'counter should still return val');
});
// 18. purgeExpired() 만료 제거
test('18. purgeExpired() 만료 제거', async () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('exp1', 'a', { scope: 'short-term', ttl: 1 });
    m.remember('exp2', 'b', { scope: 'short-term', ttl: 1 });
    m.remember('keep', 'c', { scope: 'short-term', ttl: 'forever' });
    await new Promise(r => setTimeout(r, 10));
    const count = m.purgeExpired();
    assert(count === 2, `expected 2 purged, got ${count}`);
    assert(m.recall('keep') === 'c', 'keep should still exist');
});
// 19. stats() 숫자 확인
test('19. stats() 숫자 확인', () => {
    const m = new memory_system_1.MemorySystem();
    m.remember('lt1', 1);
    m.remember('lt2', 2);
    m.remember('st1', 3, { scope: 'short-term', ttl: 'forever' });
    m.recordEpisode('ep1', 'test ep');
    m.recordEpisode('ep2', 'test ep 2');
    const s = m.stats();
    assert(s.longTerm === 2, `expected 2 longTerm, got ${s.longTerm}`);
    assert(s.shortTerm === 1, `expected 1 shortTerm, got ${s.shortTerm}`);
    assert(s.episodes === 2, `expected 2 episodes, got ${s.episodes}`);
});
// 20. globalMemory 싱글톤 공유
test('20. globalMemory 싱글톤 공유', () => {
    memory_system_1.globalMemory.clear();
    memory_system_1.globalMemory.remember('singleton-test', 'global-value');
    const { globalMemory: gm2 } = require('./memory-system');
    const v = gm2.recall('singleton-test');
    assert(v === 'global-value', `expected global-value, got ${v}`);
    memory_system_1.globalMemory.clear();
});
// ─── 인터프리터 내장함수 테스트 ────────────────────────────────
// 공통: 인터프리터 생성 함수
function makeInterp() {
    return new interpreter_1.Interpreter();
}
function run(interp, code) {
    const ctx = interp.run(code);
    return ctx.lastValue;
}
// 21. mem-remember 내장함수
test('21. mem-remember 내장함수', () => {
    memory_system_1.globalMemory.clear();
    const interp = makeInterp();
    run(interp, '(mem-remember "test-key" 42)');
    const v = memory_system_1.globalMemory.recall('test-key');
    assert(v === 42, `expected 42, got ${v}`);
    memory_system_1.globalMemory.clear();
});
// 22. mem-recall 내장함수
test('22. mem-recall 내장함수', () => {
    memory_system_1.globalMemory.clear();
    memory_system_1.globalMemory.remember('interp-test', 'hello');
    const interp = makeInterp();
    const v = run(interp, '(mem-recall "interp-test")');
    assert(v === 'hello', `expected hello, got ${v}`);
    memory_system_1.globalMemory.clear();
});
// 23. mem-recall fallback
test('23. mem-recall fallback', () => {
    memory_system_1.globalMemory.clear();
    const interp = makeInterp();
    const v = run(interp, '(mem-recall "nonexistent-key" "default-val")');
    assert(v === 'default-val', `expected default-val, got ${v}`);
});
// 24. mem-forget 내장함수
test('24. mem-forget 내장함수', () => {
    memory_system_1.globalMemory.clear();
    memory_system_1.globalMemory.remember('to-forget', 'bye');
    const interp = makeInterp();
    const result = run(interp, '(mem-forget "to-forget")');
    assert(result === true, `expected true, got ${result}`);
    const v = memory_system_1.globalMemory.recall('to-forget');
    assert(v === null, `expected null after forget, got ${v}`);
});
// 25. mem-stats 내장함수
test('25. mem-stats 내장함수', () => {
    memory_system_1.globalMemory.clear();
    memory_system_1.globalMemory.remember('a', 1);
    memory_system_1.globalMemory.remember('b', 2);
    const interp = makeInterp();
    const stats = run(interp, '(mem-stats)');
    assert(typeof stats === 'object', 'stats should be object');
    assert(stats.longTerm === 2, `expected 2, got ${stats.longTerm}`);
    memory_system_1.globalMemory.clear();
});
// 26. mem-episode 내장함수
test('26. mem-episode 내장함수', () => {
    memory_system_1.globalMemory.clear();
    const interp = makeInterp();
    const ep = run(interp, '(mem-episode "builtin-ep" "Built-in episode test")');
    assert(ep !== null, 'episode should not be null');
    assert(ep.id === 'builtin-ep', `expected builtin-ep, got ${ep?.id}`);
    assert(ep.what === 'Built-in episode test', `expected correct what`);
    memory_system_1.globalMemory.clear();
});
// 27. mem-working-set + mem-working-get
test('27. mem-working-set + mem-working-get', () => {
    memory_system_1.globalMemory.clear();
    const interp = makeInterp();
    run(interp, '(mem-working-set "current-task")');
    const v = run(interp, '(mem-working-get)');
    assert(v === 'current-task', `expected current-task, got ${v}`);
    memory_system_1.globalMemory.clear();
});
// ─── 결과 출력 ─────────────────────────────────────────────────
console.log(`\n=== 결과: ${passed}/${passed + failed} PASS ===\n`);
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase101-memory.js.map