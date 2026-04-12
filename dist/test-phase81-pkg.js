"use strict";
/**
 * FreeLang v9: Phase 81 — 패키지 매니저 테스트
 * src/package-manager.ts 검증 (목표: 20 PASS 이상)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const package_manager_1 = require("./package-manager");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg ?? 'assertion failed');
}
function assertEqual(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        throw new Error(msg ?? `expected ${JSON.stringify(b)} but got ${JSON.stringify(a)}`);
    }
}
function assertThrows(fn, containing) {
    try {
        fn();
        throw new Error('예외가 발생해야 했지만 발생하지 않음');
    }
    catch (e) {
        if (containing && !String(e?.message ?? e).includes(containing)) {
            throw new Error(`예외 메시지에 "${containing}"가 없음: ${e?.message ?? e}`);
        }
    }
}
// ---------------------------------------------------------------------------
// TC-1: PackageRegistry 생성
// ---------------------------------------------------------------------------
test('TC-1: PackageRegistry 생성', () => {
    const registry = new package_manager_1.PackageRegistry();
    assert(registry instanceof package_manager_1.PackageRegistry, 'instanceof PackageRegistry');
    assertEqual(registry.listAll().length, 0, '초기 목록은 비어있어야 함');
});
// ---------------------------------------------------------------------------
// TC-2: register + resolve
// ---------------------------------------------------------------------------
test('TC-2: register + resolve', () => {
    const registry = new package_manager_1.PackageRegistry();
    const pkg = {
        name: 'core-utils',
        version: '1.0.0',
        description: '핵심 유틸리티',
        flDeps: {},
        exports: ['add', 'sub'],
    };
    registry.register(pkg);
    const resolved = registry.resolve('core-utils');
    assert(resolved !== undefined, 'resolved 는 undefined 아님');
    assertEqual(resolved.name, 'core-utils');
    assertEqual(resolved.version, '1.0.0');
});
// ---------------------------------------------------------------------------
// TC-3: listAll
// ---------------------------------------------------------------------------
test('TC-3: listAll', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({ name: 'pkg-a', version: '1.0.0', flDeps: {}, exports: [] });
    registry.register({ name: 'pkg-b', version: '2.0.0', flDeps: {}, exports: [] });
    const all = registry.listAll();
    assertEqual(all.length, 2, 'listAll 은 2개를 반환해야 함');
    const names = all.map((m) => m.name).sort();
    assertEqual(names, ['pkg-a', 'pkg-b']);
});
// ---------------------------------------------------------------------------
// TC-4: resolve — 없는 패키지 → undefined
// ---------------------------------------------------------------------------
test('TC-4: resolve 없는 패키지 → undefined', () => {
    const registry = new package_manager_1.PackageRegistry();
    const result = registry.resolve('does-not-exist');
    assertEqual(result, undefined);
});
// ---------------------------------------------------------------------------
// TC-5: checkConflicts — 충돌 없음
// ---------------------------------------------------------------------------
test('TC-5: checkConflicts — 충돌 없음', () => {
    const registry = new package_manager_1.PackageRegistry();
    const manifests = [
        { name: 'alpha', version: '1.0.0', flDeps: {}, exports: [] },
        { name: 'beta', version: '2.0.0', flDeps: {}, exports: [] },
    ];
    const conflicts = registry.checkConflicts(manifests);
    assertEqual(conflicts.length, 0, '충돌 없음');
});
// ---------------------------------------------------------------------------
// TC-6: checkConflicts — 같은 이름, 다른 버전 → 충돌
// ---------------------------------------------------------------------------
test('TC-6: checkConflicts — 같은 이름 다른 버전 충돌', () => {
    const registry = new package_manager_1.PackageRegistry();
    const manifests = [
        { name: 'alpha', version: '1.0.0', flDeps: {}, exports: [] },
        { name: 'alpha', version: '2.0.0', flDeps: {}, exports: [] },
    ];
    const conflicts = registry.checkConflicts(manifests);
    assert(conflicts.length > 0, '충돌이 1개 이상 있어야 함');
    assert(conflicts[0].includes('alpha'), '충돌 항목에 alpha 포함');
});
// ---------------------------------------------------------------------------
// TC-7: parseManifest — 기본 필드
// ---------------------------------------------------------------------------
test('TC-7: parseManifest — 기본 필드', () => {
    const src = '[PKG my-pkg :version "1.2.3" :desc "테스트 패키지" :deps {} :exports []]';
    const m = (0, package_manager_1.parseManifest)(src);
    assertEqual(m.name, 'my-pkg');
    assertEqual(m.version, '1.2.3');
    assertEqual(m.description, '테스트 패키지');
});
// ---------------------------------------------------------------------------
// TC-8: parseManifest — :deps 파싱
// ---------------------------------------------------------------------------
test('TC-8: parseManifest — :deps 파싱', () => {
    const src = '[PKG dep-test :version "1.0.0" :deps {lodash "^4.0.0" moment "^2.29.0"} :exports []]';
    const m = (0, package_manager_1.parseManifest)(src);
    assertEqual(m.flDeps['lodash'], '^4.0.0');
    assertEqual(m.flDeps['moment'], '^2.29.0');
});
// ---------------------------------------------------------------------------
// TC-9: parseManifest — :exports 파싱
// ---------------------------------------------------------------------------
test('TC-9: parseManifest — :exports 파싱', () => {
    const src = '[PKG export-test :version "1.0.0" :deps {} :exports [fn1 fn2 fn3]]';
    const m = (0, package_manager_1.parseManifest)(src);
    assertEqual(m.exports, ['fn1', 'fn2', 'fn3']);
});
// ---------------------------------------------------------------------------
// TC-10: resolveTree — 단일 패키지 (deps 없음)
// ---------------------------------------------------------------------------
test('TC-10: resolveTree — 단일 패키지', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({ name: 'standalone', version: '1.0.0', flDeps: {}, exports: ['run'] });
    const tree = (0, package_manager_1.resolveTree)('standalone', registry);
    assertEqual(tree.length, 1);
    assertEqual(tree[0].name, 'standalone');
});
// ---------------------------------------------------------------------------
// TC-11: resolveTree — 의존성 1단계
// ---------------------------------------------------------------------------
test('TC-11: resolveTree — 의존성 1단계', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({ name: 'base-lib', version: '1.0.0', flDeps: {}, exports: ['helper'] });
    registry.register({
        name: 'app',
        version: '1.0.0',
        flDeps: { 'base-lib': '1.0.0' },
        exports: ['main'],
    });
    const tree = (0, package_manager_1.resolveTree)('app', registry);
    assertEqual(tree.length, 2, '2개 패키지 (base-lib + app)');
    // 의존성이 먼저 와야 함
    assertEqual(tree[0].name, 'base-lib');
    assertEqual(tree[1].name, 'app');
});
// ---------------------------------------------------------------------------
// TC-12: resolveTree — 의존성 없음 (빈 deps)
// ---------------------------------------------------------------------------
test('TC-12: resolveTree — 의존성 없음', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({ name: 'empty-deps', version: '2.0.0', flDeps: {}, exports: [] });
    const tree = (0, package_manager_1.resolveTree)('empty-deps', registry);
    assertEqual(tree.length, 1);
    assertEqual(tree[0].version, '2.0.0');
});
// ---------------------------------------------------------------------------
// TC-13: resolveTree — 존재하지 않는 dep → 에러
// ---------------------------------------------------------------------------
test('TC-13: resolveTree — 없는 dep → 에러', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({
        name: 'broken-app',
        version: '1.0.0',
        flDeps: { 'ghost-lib': '1.0.0' },
        exports: [],
    });
    assertThrows(() => (0, package_manager_1.resolveTree)('broken-app', registry), '찾을 수 없습니다');
});
// ---------------------------------------------------------------------------
// TC-14: PackageManifest 타입 확인
// ---------------------------------------------------------------------------
test('TC-14: PackageManifest 타입 확인', () => {
    const m = {
        name: 'type-check',
        version: '0.1.0',
        description: '타입 확인용',
        flDeps: { dep: '^1.0' },
        exports: ['a', 'b'],
    };
    assert(typeof m.name === 'string');
    assert(typeof m.version === 'string');
    assert(typeof m.flDeps === 'object');
    assert(Array.isArray(m.exports));
});
// ---------------------------------------------------------------------------
// TC-15: version 비교 (semver 간단 구현)
// ---------------------------------------------------------------------------
test('TC-15: semver 비교', () => {
    assert((0, package_manager_1.compareSemVer)('2.0.0', '1.0.0') > 0, '2.0.0 > 1.0.0');
    assert((0, package_manager_1.compareSemVer)('1.0.0', '2.0.0') < 0, '1.0.0 < 2.0.0');
    assert((0, package_manager_1.compareSemVer)('1.0.0', '1.0.0') === 0, '1.0.0 == 1.0.0');
    assert((0, package_manager_1.compareSemVer)('1.1.0', '1.0.9') > 0, '1.1.0 > 1.0.9');
    assert((0, package_manager_1.compareSemVer)('1.0.1', '1.0.0') > 0, '1.0.1 > 1.0.0');
});
// ---------------------------------------------------------------------------
// TC-16: 빈 deps 패키지 등록
// ---------------------------------------------------------------------------
test('TC-16: 빈 deps 패키지', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({ name: 'no-deps', version: '1.0.0', flDeps: {}, exports: [] });
    const m = registry.resolve('no-deps');
    assert(m !== undefined);
    assertEqual(Object.keys(m.flDeps).length, 0);
    assertEqual(m.exports.length, 0);
});
// ---------------------------------------------------------------------------
// TC-17: 중복 register — 다른 버전은 모두 보관
// ---------------------------------------------------------------------------
test('TC-17: 중복 register — 다른 버전 모두 보관', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({ name: 'multi-ver', version: '1.0.0', flDeps: {}, exports: [] });
    registry.register({ name: 'multi-ver', version: '2.0.0', flDeps: {}, exports: [] });
    registry.register({ name: 'multi-ver', version: '3.0.0', flDeps: {}, exports: [] });
    const all = registry.listAll();
    const versions = all.filter((m) => m.name === 'multi-ver').map((m) => m.version);
    assertEqual(versions.length, 3, '3개 버전 모두 보관');
    // 버전 미지정 → 최신
    const latest = registry.resolve('multi-ver');
    assertEqual(latest.version, '3.0.0', '최신 버전은 3.0.0');
});
// ---------------------------------------------------------------------------
// TC-18: 순환 의존성 방지
// ---------------------------------------------------------------------------
test('TC-18: 순환 의존성 방지', () => {
    const registry = new package_manager_1.PackageRegistry();
    // a → b → a (순환)
    registry.register({
        name: 'cycle-a',
        version: '1.0.0',
        flDeps: { 'cycle-b': '1.0.0' },
        exports: [],
    });
    registry.register({
        name: 'cycle-b',
        version: '1.0.0',
        flDeps: { 'cycle-a': '1.0.0' },
        exports: [],
    });
    assertThrows(() => (0, package_manager_1.resolveTree)('cycle-a', registry), '순환 의존성');
});
// ---------------------------------------------------------------------------
// TC-19: satisfiesVersion — ^ 범위
// ---------------------------------------------------------------------------
test('TC-19: satisfiesVersion — ^ 범위', () => {
    assert((0, package_manager_1.satisfiesVersion)('1.2.3', '^1.0.0'), '1.2.3 satisfies ^1.0.0');
    assert((0, package_manager_1.satisfiesVersion)('1.9.9', '^1.0.0'), '1.9.9 satisfies ^1.0.0');
    assert(!(0, package_manager_1.satisfiesVersion)('2.0.0', '^1.0.0'), '2.0.0 does not satisfy ^1.0.0');
    assert(!(0, package_manager_1.satisfiesVersion)('0.9.9', '^1.0.0'), '0.9.9 does not satisfy ^1.0.0');
});
// ---------------------------------------------------------------------------
// TC-20: parseManifest — :description 키워드
// ---------------------------------------------------------------------------
test('TC-20: parseManifest — :description 키워드 (별칭)', () => {
    const src = '[PKG alt-desc :version "1.0.0" :description "긴 설명" :deps {} :exports [x]]';
    const m = (0, package_manager_1.parseManifest)(src);
    assertEqual(m.description, '긴 설명');
    assertEqual(m.exports, ['x']);
});
// ---------------------------------------------------------------------------
// TC-21: parseSemVer — 유효하지 않은 버전 → null
// ---------------------------------------------------------------------------
test('TC-21: parseSemVer — 유효하지 않은 버전', () => {
    const r = (0, package_manager_1.parseSemVer)('not-a-version');
    assertEqual(r, null);
});
// ---------------------------------------------------------------------------
// TC-22: resolve — 버전 지정 탐색
// ---------------------------------------------------------------------------
test('TC-22: resolve — 버전 지정 탐색', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({ name: 'versioned', version: '1.0.0', flDeps: {}, exports: ['v1'] });
    registry.register({ name: 'versioned', version: '2.0.0', flDeps: {}, exports: ['v2'] });
    const v1 = registry.resolve('versioned', '1.0.0');
    assertEqual(v1.exports, ['v1'], '1.0.0 exports v1');
    const v2 = registry.resolve('versioned', '2.0.0');
    assertEqual(v2.exports, ['v2'], '2.0.0 exports v2');
});
// ---------------------------------------------------------------------------
// TC-23: resolveTree — 2단계 의존성
// ---------------------------------------------------------------------------
test('TC-23: resolveTree — 2단계 의존성', () => {
    const registry = new package_manager_1.PackageRegistry();
    registry.register({ name: 'level-0', version: '1.0.0', flDeps: {}, exports: [] });
    registry.register({
        name: 'level-1',
        version: '1.0.0',
        flDeps: { 'level-0': '1.0.0' },
        exports: [],
    });
    registry.register({
        name: 'level-2',
        version: '1.0.0',
        flDeps: { 'level-1': '1.0.0' },
        exports: [],
    });
    const tree = (0, package_manager_1.resolveTree)('level-2', registry);
    assertEqual(tree.length, 3, '3개 패키지');
    assertEqual(tree[0].name, 'level-0');
    assertEqual(tree[1].name, 'level-1');
    assertEqual(tree[2].name, 'level-2');
});
// ---------------------------------------------------------------------------
// TC-24: parseManifest — PKG 블록 없음 → 에러
// ---------------------------------------------------------------------------
test('TC-24: parseManifest — PKG 블록 없음 → 에러', () => {
    assertThrows(() => (0, package_manager_1.parseManifest)('no pkg block here'), '[PKG');
});
// ---------------------------------------------------------------------------
// 최종 결과
// ---------------------------------------------------------------------------
console.log('');
console.log('='.repeat(50));
console.log(`Phase 81 패키지 매니저 테스트 결과`);
console.log(`  PASS: ${passed}`);
console.log(`  FAIL: ${failed}`);
console.log(`  TOTAL: ${passed + failed}`);
console.log('='.repeat(50));
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase81-pkg.js.map