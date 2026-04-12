"use strict";
// test-phase146-align.ts — Phase 146: [ALIGN] 목표 정렬 시스템 테스트
// 최소 25 PASS
Object.defineProperty(exports, "__esModule", { value: true });
const align_1 = require("./align");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
// ── 테스트 유틸 ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ FAIL: ${name} — ${e.message ?? e}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function assertEqual(a, b, msg) {
    if (a !== b)
        throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertGte(a, b, msg) {
    if (a < b)
        throw new Error(msg ?? `Expected ${a} >= ${b}`);
}
function assertLte(a, b, msg) {
    if (a > b)
        throw new Error(msg ?? `Expected ${a} <= ${b}`);
}
function assertBetween(a, lo, hi, msg) {
    if (a < lo || a > hi)
        throw new Error(msg ?? `Expected ${a} in [${lo}, ${hi}]`);
}
// ── FL 실행 헬퍼 ──────────────────────────────────────────────────────────────
function run(code) {
    const interp = new interpreter_1.Interpreter();
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    let result;
    for (const node of ast) {
        result = interp.eval(node);
    }
    return result;
}
// ── 테스트용 AlignmentSystem 인스턴스 ────────────────────────────────────────
function makeSystem() {
    const sys = new align_1.AlignmentSystem();
    sys.addGoal({
        id: "user-satisfaction",
        description: "사용자 만족도 향상",
        priority: 9,
        measurable: true,
        metric: "NPS",
        target: 80,
    });
    sys.addGoal({
        id: "efficiency",
        description: "작업 효율 극대화",
        priority: 7,
        measurable: true,
        metric: "time_saved",
        target: 50,
    });
    sys.addGoal({
        id: "safety",
        description: "안전성 확보",
        priority: 10,
        measurable: false,
    });
    sys.addValue({
        id: "honesty",
        name: "정직",
        description: "거짓말 안 함",
        weight: 0.9,
    });
    sys.addValue({
        id: "helpfulness",
        name: "도움",
        description: "사용자에게 도움이 됨",
        weight: 0.8,
    });
    return sys;
}
function makeGoodAction() {
    return {
        id: "action-good",
        description: "사용자 피드백 수집 및 반영",
        expectedOutcomes: {
            "user-satisfaction": 0.8,
            "efficiency": 0.4,
            "safety": 0.6,
        },
        risks: [],
    };
}
function makeBadAction() {
    return {
        id: "action-bad",
        description: "속임수를 써서 수치 부풀리기",
        expectedOutcomes: {
            "user-satisfaction": -0.5,
            "efficiency": -0.8,
            "safety": -0.9,
        },
        risks: ["거짓 데이터 사용", "사용자 신뢰 훼손", "harm to system", "속임"],
    };
}
// ── 1. AlignmentSystem 생성 ───────────────────────────────────────────────────
console.log("\n=== Phase 146: ALIGN 목표 정렬 시스템 테스트 ===\n");
test("1. AlignmentSystem 생성", () => {
    const sys = new align_1.AlignmentSystem();
    assert(sys !== null && sys !== undefined, "AlignmentSystem 생성 실패");
});
// ── 2. addGoal ────────────────────────────────────────────────────────────────
test("2. addGoal 목표 추가", () => {
    const sys = new align_1.AlignmentSystem();
    sys.addGoal({
        id: "g1",
        description: "사용자 만족",
        priority: 9,
        measurable: true,
    });
    const goals = sys.prioritizeGoals();
    assert(goals.length === 1, "목표 1개 추가 실패");
    assertEqual(goals[0].id, "g1");
});
// ── 3. addValue ───────────────────────────────────────────────────────────────
test("3. addValue 가치 추가", () => {
    const sys = new align_1.AlignmentSystem();
    sys.addValue({
        id: "v1",
        name: "정직",
        description: "거짓말 안 함",
        weight: 0.9,
    });
    const goals = sys.prioritizeGoals();
    assert(goals.length === 0, "goal은 없어야 함");
});
// ── 4. score 정렬도 계산 ──────────────────────────────────────────────────────
test("4. score 정렬도 계산", () => {
    const sys = makeSystem();
    const action = makeGoodAction();
    const result = sys.score(action);
    assert(result !== null, "score 결과 없음");
    assert(typeof result.overallScore === "number", "overallScore가 숫자여야 함");
});
// ── 5. AlignmentScore 구조 ────────────────────────────────────────────────────
test("5. AlignmentScore 구조 확인", () => {
    const sys = makeSystem();
    const result = sys.score(makeGoodAction());
    assert("action" in result, "action 필드 없음");
    assert("goalAlignment" in result, "goalAlignment 필드 없음");
    assert("valueAlignment" in result, "valueAlignment 필드 없음");
    assert("overallScore" in result, "overallScore 필드 없음");
    assert("conflicts" in result, "conflicts 필드 없음");
    assert("recommendation" in result, "recommendation 필드 없음");
    assert("reasons" in result, "reasons 필드 없음");
});
// ── 6. overallScore 0~1 ───────────────────────────────────────────────────────
test("6. overallScore 0~1 범위", () => {
    const sys = makeSystem();
    const result = sys.score(makeGoodAction());
    assertBetween(result.overallScore, 0, 1, `overallScore=${result.overallScore} 범위 초과`);
});
// ── 7. goalAlignment 계산 ─────────────────────────────────────────────────────
test("7. goalAlignment 계산", () => {
    const sys = makeSystem();
    const result = sys.score(makeGoodAction());
    assert(typeof result.goalAlignment["user-satisfaction"] === "number", "user-satisfaction alignment 없음");
    assertBetween(result.goalAlignment["user-satisfaction"], 0, 1, "alignment 범위 초과");
});
// ── 8. valueAlignment 계산 ───────────────────────────────────────────────────
test("8. valueAlignment 계산", () => {
    const sys = makeSystem();
    const result = sys.score(makeGoodAction());
    assert("honesty" in result.valueAlignment, "honesty value alignment 없음");
    assertBetween(result.valueAlignment["honesty"], 0, 1, "value alignment 범위 초과");
});
// ── 9. conflicts 감지 ─────────────────────────────────────────────────────────
test("9. conflicts 감지 - 충돌 있는 행동", () => {
    const sys = makeSystem();
    const conflictAction = {
        id: "conflict",
        description: "갈등 행동",
        expectedOutcomes: {
            "user-satisfaction": 0.9, // 매우 좋음
            "safety": -0.9, // 매우 나쁨
        },
        risks: [],
    };
    const result = sys.score(conflictAction);
    assert(Array.isArray(result.conflicts), "conflicts가 배열이어야 함");
    assert(result.conflicts.length > 0, "충돌이 감지되어야 함");
});
// ── 10. recommendation 값 ────────────────────────────────────────────────────
test("10. recommendation 'proceed' - 좋은 행동", () => {
    const sys = makeSystem();
    const result = sys.score(makeGoodAction());
    const valid = ["proceed", "caution", "reject"];
    assert(valid.includes(result.recommendation), `유효하지 않은 recommendation: ${result.recommendation}`);
});
// ── 11. selectBestAligned ─────────────────────────────────────────────────────
test("11. selectBestAligned 최적 선택", () => {
    const sys = makeSystem();
    const actions = [makeGoodAction(), makeBadAction()];
    const best = sys.selectBestAligned(actions);
    assertEqual(best.id, "action-good", "좋은 행동이 선택되어야 함");
});
// ── 12. detectConflicts ───────────────────────────────────────────────────────
test("12. detectConflicts 목표 충돌", () => {
    const sys = new align_1.AlignmentSystem();
    sys.addGoal({ id: "g1", description: "수익 극대화", priority: 10, measurable: true });
    sys.addGoal({ id: "g2", description: "환경 보호", priority: 3, measurable: false });
    const conflicts = sys.detectConflicts();
    assert(Array.isArray(conflicts), "conflicts 배열이어야 함");
    assert(conflicts.length > 0, "우선순위 차이 7인 충돌이 감지되어야 함");
});
// ── 13. evaluatePlan ──────────────────────────────────────────────────────────
test("13. evaluatePlan 계획 평가", () => {
    const sys = makeSystem();
    const result = sys.evaluatePlan([makeGoodAction(), makeBadAction()]);
    assert("overallAlignment" in result, "overallAlignment 없음");
    assert("weakLinks" in result, "weakLinks 없음");
    assert("summary" in result, "summary 없음");
    assertBetween(result.overallAlignment, 0, 1, "overallAlignment 범위 초과");
});
// ── 14. weakLinks 식별 ───────────────────────────────────────────────────────
test("14. weakLinks 식별", () => {
    const sys = makeSystem();
    const result = sys.evaluatePlan([makeGoodAction(), makeBadAction()]);
    assert(Array.isArray(result.weakLinks), "weakLinks가 배열이어야 함");
    assert(result.weakLinks.length > 0, "나쁜 행동이 weakLink로 감지되어야 함");
});
// ── 15. suggestImprovements ───────────────────────────────────────────────────
test("15. suggestImprovements 개선 제안", () => {
    const sys = makeSystem();
    const suggestions = sys.suggestImprovements(makeBadAction());
    assert(Array.isArray(suggestions), "suggestions가 배열이어야 함");
    assert(suggestions.length > 0, "개선 제안이 있어야 함");
});
// ── 16. prioritizeGoals ───────────────────────────────────────────────────────
test("16. prioritizeGoals 우선순위 정렬", () => {
    const sys = makeSystem();
    const goals = sys.prioritizeGoals();
    assert(goals.length === 3, "3개 목표가 있어야 함");
    assertEqual(goals[0].id, "safety", "safety(priority=10)가 첫번째여야 함");
    assertEqual(goals[1].id, "user-satisfaction", "user-satisfaction(priority=9)이 두번째여야 함");
});
// ── 17. align-add-goal 빌트인 ─────────────────────────────────────────────────
test("17. align-add-goal 빌트인", () => {
    const result = run(`(align-add-goal :id "test-goal-1" :desc "테스트 목표" :priority 8 :measurable true)`);
    assert(result instanceof Map, "Map이 반환되어야 함");
    assertEqual(result.get("id"), "test-goal-1");
    assertEqual(result.get("priority"), 8);
});
// ── 18. align-add-value 빌트인 ────────────────────────────────────────────────
test("18. align-add-value 빌트인", () => {
    const result = run(`(align-add-value :id "test-val-1" :name "투명성" :desc "모든 것을 공개" :weight 0.85)`);
    assert(result instanceof Map, "Map이 반환되어야 함");
    assertEqual(result.get("id"), "test-val-1");
    assertEqual(result.get("name"), "투명성");
});
// ── 19. align-score 빌트인 ───────────────────────────────────────────────────
test("19. align-score 빌트인", () => {
    // 먼저 globalAlignment에 목표/가치 추가
    align_1.globalAlignment.addGoal({ id: "g-builtin", description: "빌트인 목표", priority: 7, measurable: true });
    align_1.globalAlignment.addValue({ id: "v-builtin", name: "신뢰", description: "신뢰 구축", weight: 0.8 });
    const result = run(`
    (let $action (map "id" "a1" "description" "테스트 행동" "expectedOutcomes" (map "g-builtin" 0.8) "risks" (list)))
    (align-score $action)
  `);
    assert(result instanceof Map, "Map이 반환되어야 함");
    assert(result.has("overallScore"), "overallScore 없음");
    assert(result.has("recommendation"), "recommendation 없음");
});
// ── 20. align-best 빌트인 ────────────────────────────────────────────────────
test("20. align-best 빌트인", () => {
    // FL의 map은 배열 매핑 함수이므로, JavaScript에서 직접 Action 배열을 만들어 align-best에 전달
    const interp = new (require("./interpreter").Interpreter)();
    const a1 = new Map([
        ["id", "best-1"], ["description", "좋은 행동"],
        ["expectedOutcomes", new Map([["g-builtin", 0.9]])],
        ["risks", []],
    ]);
    const a2 = new Map([
        ["id", "best-2"], ["description", "나쁜 행동"],
        ["expectedOutcomes", new Map([["g-builtin", 0.1]])],
        ["risks", ["harm"]],
    ]);
    const { evalAlign } = require("./eval-builtins");
    const result = evalAlign("align-best", [[a1, a2]]);
    assert(result instanceof Map, "Map이 반환되어야 함");
    assertEqual(result.get("id"), "best-1", "좋은 행동이 선택되어야 함");
});
// ── 21. align-conflicts 빌트인 ───────────────────────────────────────────────
test("21. align-conflicts 빌트인", () => {
    // globalAlignment에 충돌하는 목표 추가
    align_1.globalAlignment.addGoal({ id: "gc1", description: "빠른 성장", priority: 10, measurable: true });
    align_1.globalAlignment.addGoal({ id: "gc2", description: "안정적 유지", priority: 2, measurable: false });
    const result = run(`(align-conflicts)`);
    assert(Array.isArray(result), "배열이 반환되어야 함");
});
// ── 22. align-plan 빌트인 ────────────────────────────────────────────────────
test("22. align-plan 빌트인", () => {
    const result = run(`
    (let $a1 (map "id" "p1" "description" "계획 1" "expectedOutcomes" (map "g-builtin" 0.7) "risks" (list)))
    (align-plan (list $a1))
  `);
    assert(result instanceof Map, "Map이 반환되어야 함");
    assert(result.has("overallAlignment"), "overallAlignment 없음");
    assert(result.has("summary"), "summary 없음");
});
// ── 23. align-improve 빌트인 ─────────────────────────────────────────────────
test("23. align-improve 빌트인", () => {
    const result = run(`
    (let $a (map "id" "imp1" "description" "개선 대상 행동" "expectedOutcomes" (map "g-builtin" 0.1) "risks" (list "harm" "위험" "거짓")))
    (align-improve $a)
  `);
    assert(Array.isArray(result), "배열이 반환되어야 함");
    assert(result.length > 0, "개선 제안이 있어야 함");
});
// ── 24. align-goals 빌트인 ───────────────────────────────────────────────────
test("24. align-goals 빌트인", () => {
    const result = run(`(align-goals)`);
    assert(Array.isArray(result), "배열이 반환되어야 함");
    assert(result.length > 0, "목표 목록이 있어야 함");
    // 첫번째 요소 확인
    const first = result[0];
    assert(first instanceof Map, "각 목표가 Map이어야 함");
    assert(first.has("id"), "id 필드 없음");
    assert(first.has("priority"), "priority 필드 없음");
});
// ── 25. 고충돌 행동 → 'reject' ───────────────────────────────────────────────
test("25. 고충돌 행동 → 'reject' 권고", () => {
    const sys = makeSystem();
    const veryBadAction = {
        id: "terrible",
        description: "매우 나쁜 행동",
        expectedOutcomes: {
            "user-satisfaction": -1.0,
            "efficiency": -1.0,
            "safety": -1.0,
        },
        risks: ["harm", "거짓", "속임", "위험", "신뢰 파괴"],
    };
    const result = sys.score(veryBadAction);
    assertEqual(result.recommendation, "reject", "매우 나쁜 행동은 reject여야 함");
});
// ── 결과 출력 ─────────────────────────────────────────────────────────────────
console.log(`\n=== 결과: ${passed} PASS / ${failed} FAIL ===`);
if (passed < 25) {
    console.log(`❌ 최소 25 PASS 미달 (현재 ${passed})`);
    process.exit(1);
}
else {
    console.log(`✅ Phase 146 [ALIGN] 완성 — ${passed}/25 PASS`);
}
//# sourceMappingURL=test-phase146-align.js.map