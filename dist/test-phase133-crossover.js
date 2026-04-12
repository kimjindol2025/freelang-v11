"use strict";
// test-phase133-crossover.ts — Phase 133 [CROSSOVER] 테스트
// 목표: 25 PASS
Object.defineProperty(exports, "__esModule", { value: true });
const crossover_1 = require("./crossover");
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
function assert(cond, msg = "assertion failed") {
    if (!cond)
        throw new Error(msg);
}
function assertEqual(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
    }
}
// 인터프리터 헬퍼
function run(interp, code) {
    const ctx = interp.run(code);
    return ctx.lastValue;
}
console.log("\n=== Phase 133: CROSSOVER 테스트 ===\n");
// ── 1. Crossover 생성 ──
test("1. Crossover 생성", () => {
    const c = new crossover_1.Crossover();
    assert(c !== null && c !== undefined, "Crossover 객체 생성 실패");
});
// ── 2. singlePoint 단일점 교배 ──
test("2. singlePoint 단일점 교배", () => {
    const c = new crossover_1.Crossover();
    const a = [1, 2, 3, 4];
    const b = [5, 6, 7, 8];
    const res = c.singlePoint(a, b);
    assert(res.type === "single-point", "type이 single-point여야 함");
    assert(Array.isArray(res.child1), "child1이 배열이어야 함");
    assert(Array.isArray(res.child2), "child2가 배열이어야 함");
    assert(res.child1.length === 4, "child1 길이가 4여야 함");
});
// ── 3. twoPoint 두점 교배 ──
test("3. twoPoint 두점 교배", () => {
    const c = new crossover_1.Crossover();
    const a = [1, 2, 3, 4, 5, 6];
    const b = [7, 8, 9, 10, 11, 12];
    const res = c.twoPoint(a, b);
    assert(res.type === "two-point", "type이 two-point여야 함");
    assert(res.crossoverPoints !== undefined, "crossoverPoints가 있어야 함");
});
// ── 4. uniform 균등 교배 ──
test("4. uniform 균등 교배", () => {
    const c = new crossover_1.Crossover();
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const res = c.uniform(a, b);
    assert(res.type === "uniform", "type이 uniform이어야 함");
    assert(res.child1.length === 3, "child1 길이 보존");
    assert(res.child2.length === 3, "child2 길이 보존");
});
// ── 5. arithmetic alpha=0.5 ──
test("5. arithmetic 산술 교배 alpha=0.5", () => {
    const c = new crossover_1.Crossover();
    const a = [2.0, 4.0];
    const b = [6.0, 8.0];
    const res = c.arithmetic(a, b, 0.5);
    assert(Math.abs(res.child1[0] - 4.0) < 0.001, `child1[0]이 4.0이어야 함, got ${res.child1[0]}`);
    assert(Math.abs(res.child1[1] - 6.0) < 0.001, `child1[1]이 6.0이어야 함`);
});
// ── 6. arithmetic alpha=0 → child=b ──
test("6. arithmetic alpha=0 → child1=b", () => {
    const c = new crossover_1.Crossover();
    const a = [1.0, 2.0];
    const b = [10.0, 20.0];
    const res = c.arithmetic(a, b, 0);
    assert(Math.abs(res.child1[0] - 10.0) < 0.001, `alpha=0이면 child1=b, got ${res.child1[0]}`);
    assert(Math.abs(res.child1[1] - 20.0) < 0.001);
});
// ── 7. arithmetic alpha=1 → child=a ──
test("7. arithmetic alpha=1 → child1=a", () => {
    const c = new crossover_1.Crossover();
    const a = [3.0, 7.0];
    const b = [10.0, 20.0];
    const res = c.arithmetic(a, b, 1.0);
    assert(Math.abs(res.child1[0] - 3.0) < 0.001, `alpha=1이면 child1=a, got ${res.child1[0]}`);
    assert(Math.abs(res.child1[1] - 7.0) < 0.001);
});
// ── 8. crossoverStrings 문자열 교배 ──
test("8. crossoverStrings 문자열 교배", () => {
    const c = new crossover_1.Crossover();
    const res = c.crossoverStrings("hello", "world");
    assert(typeof res.child1 === "string", "child1이 문자열이어야 함");
    assert(typeof res.child2 === "string", "child2가 문자열이어야 함");
    assert(res.child1.length === 5, `child1 길이가 5여야 함, got ${res.child1.length}`);
    assert(res.child2.length === 5, `child2 길이가 5여야 함`);
});
// ── 9. crossoverObjects 객체 교배 ──
test("9. crossoverObjects 객체 교배", () => {
    const c = new crossover_1.Crossover();
    const a = { x: 1, y: 2 };
    const b = { x: 10, y: 20 };
    const res = c.crossoverObjects(a, b);
    assert("x" in res.child1 && "y" in res.child1, "child1에 모든 키가 있어야 함");
    assert("x" in res.child2 && "y" in res.child2, "child2에 모든 키가 있어야 함");
});
// ── 10. CrossoverResult 구조 검증 ──
test("10. CrossoverResult 구조 (parent1/parent2/child1/child2/type)", () => {
    const c = new crossover_1.Crossover();
    const res = c.singlePoint([1, 2, 3], [4, 5, 6]);
    assert("parent1" in res, "parent1 필드 있어야 함");
    assert("parent2" in res, "parent2 필드 있어야 함");
    assert("child1" in res, "child1 필드 있어야 함");
    assert("child2" in res, "child2 필드 있어야 함");
    assert("type" in res, "type 필드 있어야 함");
});
// ── 11. 길이 보존 ──
test("11. 길이 보존 (child 길이 = parent 길이)", () => {
    const c = new crossover_1.Crossover();
    const a = [1, 2, 3, 4, 5];
    const b = [6, 7, 8, 9, 10];
    const res = c.singlePoint(a, b);
    assert(res.child1.length === a.length, `child1 길이 보존: ${res.child1.length} !== ${a.length}`);
    assert(res.child2.length === b.length, `child2 길이 보존`);
});
// ── 12~19: 빌트인 테스트 ──
const interp = new interpreter_1.Interpreter();
test("12. crossover-single 빌트인", () => {
    const result = run(interp, `(crossover-single [1 2 3 4] [5 6 7 8])`);
    assert(result instanceof Map, "Map 반환이어야 함");
    assert(result.get("type") === "single-point", `type이 single-point여야 함`);
    assert(Array.isArray(result.get("child1")), "child1이 배열이어야 함");
});
test("13. crossover-two 빌트인", () => {
    const result = run(interp, `(crossover-two [1 2 3 4 5 6] [7 8 9 10 11 12])`);
    assert(result instanceof Map, "Map 반환");
    assert(result.get("type") === "two-point", `type이 two-point여야 함`);
    const pts = result.get("crossoverPoints");
    assert(Array.isArray(pts) && pts.length === 2, "crossoverPoints가 있어야 함");
});
test("14. crossover-uniform 빌트인", () => {
    const result = run(interp, `(crossover-uniform [1 2 3] [4 5 6])`);
    assert(result instanceof Map, "Map 반환");
    assert(result.get("type") === "uniform", "type이 uniform이어야 함");
    assert(result.get("child1").length === 3, "child1 길이 3");
});
test("15. crossover-arithmetic 빌트인", () => {
    const result = run(interp, `(crossover-arithmetic [2.0 4.0] [6.0 8.0] :alpha 0.5)`);
    assert(result instanceof Map, "Map 반환");
    const child1 = result.get("child1");
    assert(Math.abs(child1[0] - 4.0) < 0.001, `child1[0]이 4.0이어야 함, got ${child1[0]}`);
});
test("16. crossover-strings 빌트인", () => {
    const result = run(interp, `(crossover-strings "hello" "world")`);
    assert(result instanceof Map, "Map 반환");
    assert(typeof result.get("child1") === "string", "child1이 문자열");
    assert(result.get("child1").length === 5, "child1 길이 5");
});
test("17. crossover-objects 빌트인", () => {
    const result = run(interp, `(crossover-objects {:x 1 :y 2} {:x 10 :y 20})`);
    assert(result instanceof Map, "Map 반환");
    const child1 = result.get("child1");
    assert(child1 instanceof Map, "child1이 Map이어야 함");
    assert(child1.has("x") && child1.has("y"), "child1에 x, y 키가 있어야 함");
});
test("18. crossover-children 빌트인", () => {
    interp.run(`(define crossover-r18 (crossover-single [1 2 3] [4 5 6]))`);
    const result = run(interp, `(crossover-children crossover-r18)`);
    assert(Array.isArray(result), "배열 반환이어야 함");
    assert(result.length === 2, `child1, child2 두 개 (got ${result.length})`);
});
test("19. blend 빌트인", () => {
    const result = run(interp, `(blend [2.0 4.0] [6.0 8.0] :alpha 0.5)`);
    assert(Array.isArray(result), "배열 반환이어야 함");
    assert(Math.abs(result[0] - 4.0) < 0.001, `blend[0]이 4.0이어야 함, got ${result[0]}`);
});
// ── 20. 부모 불변 ──
test("20. 부모 불변 (원본 변경 없음)", () => {
    const c = new crossover_1.Crossover();
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const aCopy = [...a];
    const bCopy = [...b];
    c.singlePoint(a, b);
    assert(JSON.stringify(a) === JSON.stringify(aCopy), "a가 변경되면 안 됨");
    assert(JSON.stringify(b) === JSON.stringify(bCopy), "b가 변경되면 안 됨");
});
// ── 21. crossoverPoint 범위 유효 ──
test("21. crossoverPoint 범위 유효", () => {
    const c = new crossover_1.Crossover();
    const a = [1, 2, 3, 4, 5];
    const b = [6, 7, 8, 9, 10];
    const res = c.singlePoint(a, b);
    assert(res.crossoverPoint !== undefined, "crossoverPoint 있어야 함");
    assert(res.crossoverPoint >= 0 && res.crossoverPoint <= a.length, `crossoverPoint 범위 벗어남: ${res.crossoverPoint}`);
});
// ── 22. two-point: point1 < point2 ──
test("22. two-point: point1 < point2", () => {
    const c = new crossover_1.Crossover();
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    const b = [9, 10, 11, 12, 13, 14, 15, 16];
    // 여러 번 시도해서 두 점 검증
    let valid = true;
    for (let i = 0; i < 10; i++) {
        const res = c.twoPoint(a, b);
        if (res.crossoverPoints) {
            const [p1, p2] = res.crossoverPoints;
            if (p1 >= p2) {
                valid = false;
                break;
            }
        }
    }
    assert(valid, "two-point: point1이 항상 point2보다 작아야 함");
});
// ── 23. uniform: 두 부모 요소만 사용 ──
test("23. uniform: 두 부모 요소만 사용", () => {
    const c = new crossover_1.Crossover();
    const a = [1, 2, 3, 4];
    const b = [5, 6, 7, 8];
    const allVals = new Set([...a, ...b]);
    let valid = true;
    for (let i = 0; i < 20; i++) {
        const res = c.uniform(a, b);
        for (const v of res.child1) {
            if (!allVals.has(v)) {
                valid = false;
                break;
            }
        }
    }
    assert(valid, "uniform child는 부모 요소만 포함해야 함");
});
// ── 24. 객체 교배: 모든 키 포함 ──
test("24. 객체 교배: 모든 키 포함", () => {
    const c = new crossover_1.Crossover();
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 10, y: 20, w: 40 };
    const res = c.crossoverObjects(a, b);
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of allKeys) {
        assert(k in res.child1, `child1에 키 '${k}' 누락`);
    }
});
// ── 25. cross() 자동 타입 감지 ──
test("25. cross() 자동 타입 감지", () => {
    const c = new crossover_1.Crossover();
    const a = [1.0, 2.0, 3.0];
    const b = [4.0, 5.0, 6.0];
    const res = c.cross(a, b);
    assert("child1" in res && "child2" in res, "cross()가 CrossoverResult를 반환해야 함");
    assert(res.type !== undefined, "type이 설정되어야 함");
});
// ── 결과 출력 ──
console.log(`\n총 ${passed + failed}개 중 ${passed} PASS, ${failed} FAIL\n`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase133-crossover.js.map