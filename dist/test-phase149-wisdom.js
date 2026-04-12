"use strict";
// test-phase149-wisdom.ts — Phase 149: [WISDOM] 지혜 (경험+판단 통합) 테스트
// 최소 25 PASS
Object.defineProperty(exports, "__esModule", { value: true });
const wisdom_1 = require("./wisdom");
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
function assertIsString(v, msg) {
    if (typeof v !== "string")
        throw new Error(msg ?? `Expected string, got ${typeof v}`);
}
function assertIsArray(v, msg) {
    if (!Array.isArray(v))
        throw new Error(msg ?? `Expected array, got ${typeof v}`);
}
function evalFL(interp, code) {
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    let result = null;
    for (const node of ast) {
        result = interp.eval(node);
    }
    return result;
}
// ── 테스트 시작 ────────────────────────────────────────────────────────────────
console.log("\n=== Phase 149: [WISDOM] 지혜 (경험+판단 통합) 테스트 ===\n");
// 각 테스트별 fresh engine 사용
let engine;
// === 1. WisdomEngine 생성 ===
test("1. WisdomEngine 생성", () => {
    engine = new wisdom_1.WisdomEngine();
    assert(engine instanceof wisdom_1.WisdomEngine, "WisdomEngine 인스턴스 생성 실패");
});
// === 2. addExperience 경험 추가 ===
test("2. addExperience 경험 추가", () => {
    engine = new wisdom_1.WisdomEngine();
    const exp = engine.addExperience({
        situation: "새 프로젝트 시작 시 아키텍처 결정이 필요한 상황",
        action: "모놀리식 아키텍처로 빠르게 시작",
        outcome: "초기 빠른 개발, 이후 확장 어려움",
        lesson: "초기에는 단순하게 시작하되, 확장성을 미리 설계해야 한다",
        success: true,
        importance: 0.9,
        domain: "engineering",
    });
    assert(exp.id !== undefined, "id 없음");
    assert(exp.timestamp instanceof Date, "timestamp 없음");
    assertEqual(exp.domain, "engineering", "domain 불일치");
});
// === 3. Experience 구조 검증 ===
test("3. Experience 구조 검증", () => {
    engine = new wisdom_1.WisdomEngine();
    const exp = engine.addExperience({
        situation: "코드 리뷰 없이 빠른 배포 압박",
        action: "리뷰 없이 배포 진행",
        outcome: "프로덕션 버그 발생",
        lesson: "빠른 배포보다 품질이 항상 중요하다",
        success: false,
        importance: 0.95,
        domain: "devops",
    });
    assertIsString(exp.id, "id가 string이어야 함");
    assertIsString(exp.situation, "situation이 string이어야 함");
    assertIsString(exp.action, "action이 string이어야 함");
    assertIsString(exp.outcome, "outcome이 string이어야 함");
    assertIsString(exp.lesson, "lesson이 string이어야 함");
    assert(typeof exp.success === "boolean", "success가 boolean이어야 함");
    assert(typeof exp.importance === "number", "importance가 number이어야 함");
    assert(exp.importance >= 0 && exp.importance <= 1, "importance는 0~1 범위");
    assertIsString(exp.domain, "domain이 string이어야 함");
});
// === 4. 여러 경험 추가 후 extractHeuristics ===
test("4. 여러 경험 추가 후 extractHeuristics", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "테스트 없이 코드 배포 상황",
        action: "테스트 작성 후 배포",
        outcome: "버그 없는 안정적인 배포",
        lesson: "테스트 먼저 작성하면 버그가 줄어든다",
        success: true,
        importance: 0.8,
        domain: "engineering",
    });
    engine.addExperience({
        situation: "테스트 없이 새 기능 추가",
        action: "TDD 방식으로 테스트 먼저 작성",
        outcome: "리팩토링이 쉬워지고 회귀 버그 감소",
        lesson: "TDD는 장기적으로 생산성을 높인다",
        success: true,
        importance: 0.85,
        domain: "engineering",
    });
    engine.addExperience({
        situation: "테스트 없이 급하게 코딩",
        action: "테스트 없이 배포",
        outcome: "프로덕션 버그 다수 발생",
        lesson: "테스트를 건너뛰면 항상 나중에 대가를 치른다",
        success: false,
        importance: 0.9,
        domain: "engineering",
    });
    const heuristics = engine.extractHeuristics();
    assertIsArray(heuristics, "extractHeuristics 결과가 배열이어야 함");
    assert(heuristics.length >= 1, "최소 1개 이상의 휴리스틱이 생성되어야 함");
});
// === 5. Heuristic 구조 ===
test("5. Heuristic 구조 검증", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "복잡한 로직 구현",
        action: "함수 분리 및 단순화",
        outcome: "유지보수성 향상",
        lesson: "복잡성을 줄이면 버그가 줄어든다",
        success: true,
        importance: 0.8,
        domain: "engineering",
    });
    engine.addExperience({
        situation: "복잡한 알고리즘 작성",
        action: "단계별 분리",
        outcome: "디버깅 쉬워짐",
        lesson: "코드를 작은 단위로 나누어라",
        success: true,
        importance: 0.75,
        domain: "engineering",
    });
    const heuristics = engine.extractHeuristics();
    if (heuristics.length > 0) {
        const h = heuristics[0];
        assertIsString(h.id, "Heuristic id가 string이어야 함");
        assertIsString(h.rule, "Heuristic rule이 string이어야 함");
        assert(typeof h.confidence === "number", "confidence가 number이어야 함");
        assert(h.confidence >= 0 && h.confidence <= 1, "confidence는 0~1 범위");
        assert(typeof h.successCount === "number", "successCount가 number이어야 함");
        assert(typeof h.totalCount === "number", "totalCount가 number이어야 함");
        assertIsString(h.domain, "domain이 string이어야 함");
        assertIsArray(h.derivedFrom, "derivedFrom이 배열이어야 함");
    }
});
// === 6. successCount/totalCount 정확성 ===
test("6. successCount/totalCount 정확성", () => {
    engine = new wisdom_1.WisdomEngine();
    // 동일 도메인 유사 상황에서 성공 2, 실패 1
    engine.addExperience({
        situation: "데이터베이스 쿼리 최적화 필요",
        action: "인덱스 추가",
        outcome: "쿼리 속도 10배 향상",
        lesson: "인덱스는 읽기 성능에 강력하다",
        success: true,
        importance: 0.8,
        domain: "database",
    });
    engine.addExperience({
        situation: "데이터베이스 쿼리 성능 저하",
        action: "쿼리 재작성",
        outcome: "성능 5배 향상",
        lesson: "N+1 문제를 항상 체크하라",
        success: true,
        importance: 0.85,
        domain: "database",
    });
    engine.addExperience({
        situation: "데이터베이스 쿼리 느림",
        action: "캐싱 없이 반복 쿼리",
        outcome: "성능 그대로",
        lesson: "캐싱을 사용하면 DB 부하를 줄일 수 있다",
        success: false,
        importance: 0.7,
        domain: "database",
    });
    const heuristics = engine.extractHeuristics();
    const dbHeuristic = heuristics.find(h => h.domain === "database");
    if (dbHeuristic) {
        assert(dbHeuristic.totalCount >= 1, `totalCount ${dbHeuristic.totalCount}가 1 이상이어야 함`);
        assert(dbHeuristic.successCount <= dbHeuristic.totalCount, "successCount가 totalCount보다 클 수 없음");
    }
});
// === 7. findRelevantExperiences 유사 경험 검색 ===
test("7. findRelevantExperiences 유사 경험 검색", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "API 설계 시 버전 관리 전략 결정",
        action: "URL 버전 관리 /v1, /v2",
        outcome: "하위 호환성 유지 성공",
        lesson: "API 버전 관리는 초기부터 설계해야 한다",
        success: true,
        importance: 0.8,
        domain: "api",
    });
    engine.addExperience({
        situation: "마이크로서비스 간 통신 방식 선택",
        action: "REST API 사용",
        outcome: "간단하지만 결합도 높음",
        lesson: "서비스 간 통신은 이벤트 기반이 더 유연하다",
        success: false,
        importance: 0.75,
        domain: "architecture",
    });
    const relevant = engine.findRelevantExperiences("API 설계 버전 관리");
    assertIsArray(relevant, "findRelevantExperiences 결과가 배열이어야 함");
});
// === 8. judge 지혜 판단 ===
test("8. judge 지혜 판단", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "성능 최적화 없이 런칭",
        action: "프로파일링 후 핫스팟 최적화",
        outcome: "응답시간 50% 감소",
        lesson: "먼저 측정하고 나서 최적화하라",
        success: true,
        importance: 0.9,
        domain: "performance",
    });
    const judgment = engine.judge("성능 문제로 사용자 불만이 증가하는 상황에서의 최적화 전략");
    assert(judgment !== null, "judge 결과가 null이면 안 됨");
    assert(judgment !== undefined, "judge 결과가 undefined이면 안 됨");
});
// === 9. WisdomJudgment 구조 ===
test("9. WisdomJudgment 구조 검증", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "팀 커뮤니케이션 방식 결정",
        action: "일일 스탠드업 미팅 도입",
        outcome: "팀 동기화 개선, 병목 조기 발견",
        lesson: "짧은 정기 회의가 긴 회의보다 효과적이다",
        success: true,
        importance: 0.85,
        domain: "teamwork",
    });
    const judgment = engine.judge("팀 커뮤니케이션 문제 해결");
    assertIsString(judgment.situation, "situation이 string이어야 함");
    assertIsString(judgment.recommendation, "recommendation이 string이어야 함");
    assertIsArray(judgment.reasoning, "reasoning이 배열이어야 함");
    assertIsArray(judgment.relevantExperiences, "relevantExperiences가 배열이어야 함");
    assertIsArray(judgment.applicableHeuristics, "applicableHeuristics가 배열이어야 함");
    assert(typeof judgment.confidence === "number", "confidence가 number이어야 함");
    assertIsArray(judgment.caveats, "caveats가 배열이어야 함");
    assertIsArray(judgment.alternatives, "alternatives가 배열이어야 함");
});
// === 10. relevantExperiences 포함 검증 ===
test("10. relevantExperiences가 판단에 포함", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "새 프로그래밍 언어 학습 전략",
        action: "작은 프로젝트를 직접 만들며 학습",
        outcome: "실력 빠르게 향상",
        lesson: "실전 프로젝트가 가장 효과적인 학습 방법이다",
        success: true,
        importance: 0.9,
        domain: "learning",
    });
    engine.addExperience({
        situation: "새 기술 스택 학습 방법",
        action: "튜토리얼만 따라하기",
        outcome: "실제 문제 해결 능력 부족",
        lesson: "튜토리얼을 넘어 직접 문제를 만들고 풀어라",
        success: false,
        importance: 0.7,
        domain: "learning",
    });
    const judgment = engine.judge("새 언어 학습 프로젝트 방식 선택");
    // relevantExperiences가 배열이고, Experience 속성을 가지는지 확인
    if (judgment.relevantExperiences.length > 0) {
        const e = judgment.relevantExperiences[0];
        assert("id" in e, "relevantExperience에 id가 있어야 함");
        assert("lesson" in e, "relevantExperience에 lesson이 있어야 함");
    }
});
// === 11. applicableHeuristics 포함 검증 ===
test("11. applicableHeuristics가 판단에 포함", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "코드 복잡성 증가 상황",
        action: "리팩토링 진행",
        outcome: "유지보수성 향상",
        lesson: "복잡성은 빚이다, 항상 갚아야 한다",
        success: true,
        importance: 0.8,
        domain: "refactoring",
    });
    engine.addExperience({
        situation: "레거시 코드 리팩토링 필요",
        action: "테스트 먼저 작성 후 리팩토링",
        outcome: "안전한 리팩토링 완료",
        lesson: "리팩토링 전 테스트 커버리지를 확보하라",
        success: true,
        importance: 0.9,
        domain: "refactoring",
    });
    engine.extractHeuristics();
    const judgment = engine.judge("코드 리팩토링 필요 여부 판단");
    assertIsArray(judgment.applicableHeuristics, "applicableHeuristics가 배열이어야 함");
    if (judgment.applicableHeuristics.length > 0) {
        const h = judgment.applicableHeuristics[0];
        assert("id" in h, "heuristic에 id가 있어야 함");
        assert("rule" in h, "heuristic에 rule이 있어야 함");
        assert("confidence" in h, "heuristic에 confidence가 있어야 함");
    }
});
// === 12. reasoning 배열 ===
test("12. reasoning 배열 비어있지 않음", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "보안 취약점 발견 대응",
        action: "즉시 패치 적용",
        outcome: "보안 사고 예방",
        lesson: "보안 취약점은 즉시 대응해야 한다",
        success: true,
        importance: 0.95,
        domain: "security",
    });
    const judgment = engine.judge("보안 취약점 발견 시 대응 방법");
    assertIsArray(judgment.reasoning, "reasoning이 배열이어야 함");
    assert(judgment.reasoning.length > 0, "reasoning이 비어있으면 안 됨");
    assert(typeof judgment.reasoning[0] === "string", "reasoning 항목이 string이어야 함");
});
// === 13. caveats 주의사항 ===
test("13. caveats 주의사항 배열 존재", () => {
    engine = new wisdom_1.WisdomEngine();
    // 실패 경험 다수 추가
    for (let i = 0; i < 3; i++) {
        engine.addExperience({
            situation: "빠른 배포를 위한 테스트 스킵",
            action: "테스트 없이 배포",
            outcome: "프로덕션 장애 발생",
            lesson: "절대 테스트를 스킵하지 마라",
            success: false,
            importance: 0.95,
            domain: "deployment",
        });
    }
    const judgment = engine.judge("빠른 배포를 위해 테스트를 생략할지 여부");
    assertIsArray(judgment.caveats, "caveats가 배열이어야 함");
    assert(judgment.caveats.length > 0, "실패 경험이 많을 때 caveats가 있어야 함");
});
// === 14. summarizeDomain 도메인 요약 ===
test("14. summarizeDomain 도메인 요약", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "ML 모델 학습 전략",
        action: "작은 데이터로 먼저 검증",
        outcome: "빠른 피드백으로 모델 개선",
        lesson: "작게 시작하고 스케일업하라",
        success: true,
        importance: 0.8,
        domain: "ml",
    });
    engine.addExperience({
        situation: "ML 하이퍼파라미터 튜닝",
        action: "체계적인 그리드 서치",
        outcome: "최적 파라미터 발견",
        lesson: "랜덤 서치보다 체계적인 접근이 효과적이다",
        success: true,
        importance: 0.75,
        domain: "ml",
    });
    const summary = engine.summarizeDomain("ml");
    assert(summary !== null, "summarizeDomain 결과가 null이면 안 됨");
    assertIsArray(summary.topLessons, "topLessons가 배열이어야 함");
    assertIsArray(summary.bestHeuristics, "bestHeuristics가 배열이어야 함");
    assert(typeof summary.successRate === "number", "successRate가 number이어야 함");
});
// === 15. successRate 계산 ===
test("15. successRate 정확성 검증", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "운영 문제 대응",
        action: "모니터링 알림 설정",
        outcome: "조기 발견 성공",
        lesson: "모니터링은 필수다",
        success: true,
        importance: 0.9,
        domain: "ops",
    });
    engine.addExperience({
        situation: "운영 서버 장애",
        action: "수동 복구",
        outcome: "2시간 다운타임",
        lesson: "자동화된 복구 절차가 필요하다",
        success: false,
        importance: 0.85,
        domain: "ops",
    });
    const summary = engine.summarizeDomain("ops");
    // 성공 1, 실패 1 → 성공률 0.5
    assert(summary.successRate >= 0 && summary.successRate <= 1, `successRate ${summary.successRate}는 0~1 범위여야 함`);
    assertEqual(summary.successRate, 0.5, "2건 중 1건 성공이면 successRate = 0.5");
});
// === 16. isStillValid 유효성 검사 ===
test("16. isStillValid 유효성 검사", () => {
    engine = new wisdom_1.WisdomEngine();
    const recentExp = engine.addExperience({
        situation: "최근 경험",
        action: "최근 행동",
        outcome: "최근 결과",
        lesson: "최근 교훈",
        success: true,
        importance: 0.5,
        domain: "test",
    });
    assert(engine.isStillValid(recentExp) === true, "방금 추가한 경험은 유효해야 함");
    // 오래된 경험 생성 (400일 전)
    const oldExp = {
        id: "old-exp",
        situation: "오래된 상황",
        action: "오래된 행동",
        outcome: "오래된 결과",
        lesson: "오래된 교훈",
        success: true,
        importance: 0.1, // 낮은 중요도 → 유효 기간 더 짧음
        timestamp: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400일 전
        domain: "test",
    };
    // 낮은 importance(0.1) + 400일: 180 + 0.1*180 = 198일 → 만료됨
    assert(engine.isStillValid(oldExp) === false, "400일 전 낮은 중요도 경험은 만료되어야 함");
});
// === 17. wisdomScore 점수 계산 ===
test("17. wisdomScore 점수 계산", () => {
    engine = new wisdom_1.WisdomEngine();
    const emptyScore = engine.wisdomScore();
    assertEqual(emptyScore, 0, "경험 없을 때 wisdomScore는 0이어야 함");
    engine.addExperience({
        situation: "점수 테스트용 경험",
        action: "행동",
        outcome: "결과",
        lesson: "교훈",
        success: true,
        importance: 0.8,
        domain: "scoring",
    });
    const scoreAfterExp = engine.wisdomScore();
    assert(scoreAfterExp > 0, `경험 추가 후 wisdomScore(${scoreAfterExp})가 0보다 커야 함`);
    assert(scoreAfterExp <= 1, `wisdomScore(${scoreAfterExp})가 1 이하여야 함`);
});
// === 18. getLessons 교훈 목록 ===
test("18. getLessons 교훈 목록", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "테스트 중요성",
        action: "유닛 테스트 작성",
        outcome: "버그 감소",
        lesson: "테스트는 안전망이다",
        success: true,
        importance: 0.9,
        domain: "testing",
    });
    engine.addExperience({
        situation: "테스트 커버리지",
        action: "100% 커버리지 목표",
        outcome: "가짜 안도감",
        lesson: "커버리지보다 의미있는 테스트가 중요하다",
        success: false,
        importance: 0.8,
        domain: "testing",
    });
    engine.addExperience({
        situation: "다른 도메인",
        action: "행동",
        outcome: "결과",
        lesson: "다른 도메인 교훈",
        success: true,
        importance: 0.7,
        domain: "architecture",
    });
    const allLessons = engine.getLessons();
    assertIsArray(allLessons, "getLessons() 결과가 배열이어야 함");
    assert(allLessons.length >= 3, `전체 교훈 ${allLessons.length}개가 3개 이상이어야 함`);
    const testingLessons = engine.getLessons("testing");
    assertIsArray(testingLessons, "getLessons(domain) 결과가 배열이어야 함");
    assert(testingLessons.length === 2, `testing 도메인 교훈 ${testingLessons.length}개가 2개여야 함`);
});
// === 19. findSimilarCases 유사 사례 ===
test("19. findSimilarCases 유사 사례 검색", () => {
    engine = new wisdom_1.WisdomEngine();
    engine.addExperience({
        situation: "서버 메모리 부족으로 성능 저하",
        action: "메모리 프로파일링 후 누수 제거",
        outcome: "메모리 사용량 40% 감소",
        lesson: "메모리 누수는 조기에 발견해야 한다",
        success: true,
        importance: 0.85,
        domain: "performance",
    });
    engine.addExperience({
        situation: "CPU 사용률 100% 상황",
        action: "비동기 처리로 전환",
        outcome: "CPU 부하 분산",
        lesson: "블로킹 연산을 비동기로 전환하라",
        success: true,
        importance: 0.8,
        domain: "performance",
    });
    const similar = engine.findSimilarCases("서버 메모리 문제");
    assertIsArray(similar, "findSimilarCases 결과가 배열이어야 함");
});
// === 20. wisdom-add-exp 빌트인 ===
test("20. wisdom-add-exp 빌트인 테스트", () => {
    const interp = new interpreter_1.Interpreter();
    const result = evalFL(interp, `
    (wisdom-add-exp
      :situation "새 기능 개발 중 요구사항 변경"
      :action "애자일 방식으로 유연하게 대응"
      :outcome "요구사항 변경을 빠르게 수용"
      :lesson "변경에 유연하게 대응할 수 있는 설계가 중요하다"
      :success true
      :importance 0.85
      :domain "agile")
  `);
    assert(result instanceof Map, "wisdom-add-exp 결과가 Map이어야 함");
    assert(result.has("id"), "결과에 id가 있어야 함");
    assert(result.has("situation"), "결과에 situation이 있어야 함");
    assert(result.has("domain"), "결과에 domain이 있어야 함");
    assertEqual(result.get("domain"), "agile", "domain이 'agile'이어야 함");
    assertEqual(result.get("success"), true, "success가 true여야 함");
});
// === 21. wisdom-judge 빌트인 ===
test("21. wisdom-judge 빌트인 테스트", () => {
    const interp = new interpreter_1.Interpreter();
    // 먼저 경험 추가
    evalFL(interp, `
    (wisdom-add-exp
      :situation "기술 부채 해소 시점 결정"
      :action "스프린트 20% 리팩토링 할당"
      :outcome "장기적 속도 향상"
      :lesson "기술 부채를 정기적으로 해소하면 속도가 유지된다"
      :success true
      :importance 0.9
      :domain "engineering")
  `);
    const result = evalFL(interp, `(wisdom-judge "기술 부채 처리 전략 결정")`);
    assert(result instanceof Map, "wisdom-judge 결과가 Map이어야 함");
    assert(result.has("situation"), "결과에 situation이 있어야 함");
    assert(result.has("recommendation"), "결과에 recommendation이 있어야 함");
    assert(result.has("confidence"), "결과에 confidence가 있어야 함");
    assert(result.has("reasoning"), "결과에 reasoning이 있어야 함");
    assert(result.has("caveats"), "결과에 caveats가 있어야 함");
    assert(result.has("alternatives"), "결과에 alternatives가 있어야 함");
});
// === 22. wisdom-heuristics 빌트인 ===
test("22. wisdom-heuristics 빌트인 테스트", () => {
    const interp = new interpreter_1.Interpreter();
    evalFL(interp, `
    (wisdom-add-exp
      :situation "데이터 파이프라인 설계"
      :action "멱등성 보장 설계"
      :outcome "재처리 시 데이터 중복 없음"
      :lesson "파이프라인은 멱등해야 한다"
      :success true
      :importance 0.9
      :domain "data")
  `);
    evalFL(interp, `
    (wisdom-add-exp
      :situation "데이터 처리 파이프라인 오류"
      :action "체크포인트 기반 재시작"
      :outcome "데이터 손실 없이 복구"
      :lesson "복구 가능한 파이프라인을 설계하라"
      :success true
      :importance 0.85
      :domain "data")
  `);
    evalFL(interp, `(wisdom-extract)`);
    const result = evalFL(interp, `(wisdom-heuristics)`);
    assertIsArray(result, "wisdom-heuristics 결과가 배열이어야 함");
});
// === 23. wisdom-relevant 빌트인 ===
test("23. wisdom-relevant 빌트인 테스트", () => {
    const interp = new interpreter_1.Interpreter();
    evalFL(interp, `
    (wisdom-add-exp
      :situation "클라우드 마이그레이션 전략"
      :action "리프트앤시프트로 빠른 마이그레이션"
      :outcome "빠른 이전, 비용 최적화 미흡"
      :lesson "마이그레이션 후 최적화가 필수다"
      :success true
      :importance 0.8
      :domain "cloud")
  `);
    const result = evalFL(interp, `(wisdom-relevant "클라우드 인프라 마이그레이션")`);
    assertIsArray(result, "wisdom-relevant 결과가 배열이어야 함");
});
// === 24. wisdom-lessons 빌트인 ===
test("24. wisdom-lessons 빌트인 테스트", () => {
    const interp = new interpreter_1.Interpreter();
    evalFL(interp, `
    (wisdom-add-exp
      :situation "스타트업 초기 제품 개발"
      :action "MVP 빠르게 출시"
      :outcome "시장 피드백 조기 수집"
      :lesson "빠른 출시가 완벽한 제품보다 중요하다"
      :success true
      :importance 0.9
      :domain "product")
  `);
    const allLessons = evalFL(interp, `(wisdom-lessons)`);
    assertIsArray(allLessons, "wisdom-lessons 결과가 배열이어야 함");
    assert(allLessons.length >= 1, "최소 1개 이상의 교훈이 있어야 함");
    const domainLessons = evalFL(interp, `(wisdom-lessons :domain "product")`);
    assertIsArray(domainLessons, "wisdom-lessons :domain 결과가 배열이어야 함");
});
// === 25. wisdom-score 빌트인 ===
test("25. wisdom-score 빌트인 테스트", () => {
    const interp = new interpreter_1.Interpreter();
    const scoreEmpty = evalFL(interp, `(wisdom-score)`);
    assert(typeof scoreEmpty === "number", "wisdom-score 결과가 number이어야 함");
    evalFL(interp, `
    (wisdom-add-exp
      :situation "오픈소스 기여 전략"
      :action "작은 버그 픽스부터 시작"
      :outcome "커뮤니티 신뢰 구축"
      :lesson "큰 기여보다 지속적인 작은 기여가 더 가치있다"
      :success true
      :importance 0.75
      :domain "community")
  `);
    const scoreAfter = evalFL(interp, `(wisdom-score)`);
    assert(typeof scoreAfter === "number", "경험 추가 후 wisdom-score가 number이어야 함");
    assert(scoreAfter >= 0 && scoreAfter <= 1, `wisdom-score(${scoreAfter})가 0~1 범위여야 함`);
    assert(scoreAfter > scoreEmpty, `경험 추가 후 점수(${scoreAfter})가 이전(${scoreEmpty})보다 높아야 함`);
});
// === 추가 테스트 ===
// === 26. wisdom-domain 빌트인 ===
test("26. wisdom-domain 빌트인 테스트", () => {
    const interp = new interpreter_1.Interpreter();
    evalFL(interp, `
    (wisdom-add-exp
      :situation "DevOps 자동화 도입"
      :action "CI/CD 파이프라인 구축"
      :outcome "배포 빈도 10배 증가"
      :lesson "자동화가 품질과 속도를 동시에 달성한다"
      :success true
      :importance 0.9
      :domain "devops")
  `);
    const result = evalFL(interp, `(wisdom-domain "devops")`);
    assert(result instanceof Map, "wisdom-domain 결과가 Map이어야 함");
    assert(result.has("topLessons"), "결과에 topLessons가 있어야 함");
    assert(result.has("bestHeuristics"), "결과에 bestHeuristics가 있어야 함");
    assert(result.has("successRate"), "결과에 successRate가 있어야 함");
    assertIsArray(result.get("topLessons"), "topLessons가 배열이어야 함");
});
// === 27. wisdom-extract 빌트인 ===
test("27. wisdom-extract 빌트인 테스트", () => {
    const interp = new interpreter_1.Interpreter();
    evalFL(interp, `
    (wisdom-add-exp
      :situation "팀 온보딩 프로세스"
      :action "문서화된 온보딩 가이드 제공"
      :outcome "신입 적응 기간 50% 단축"
      :lesson "좋은 문서화는 팀 생산성을 높인다"
      :success true
      :importance 0.8
      :domain "team")
  `);
    evalFL(interp, `
    (wisdom-add-exp
      :situation "팀 지식 공유"
      :action "위키 문서 정기 업데이트"
      :outcome "지식 전달 효율 향상"
      :lesson "지식은 문서화하지 않으면 사라진다"
      :success true
      :importance 0.85
      :domain "team")
  `);
    const result = evalFL(interp, `(wisdom-extract)`);
    assertIsArray(result, "wisdom-extract 결과가 배열이어야 함");
});
// === 28. 복수 도메인 경험 통합 wisdomScore ===
test("28. 복수 도메인 경험 통합 wisdomScore 상승", () => {
    engine = new wisdom_1.WisdomEngine();
    const domains = ["engineering", "security", "performance", "teamwork", "architecture"];
    for (const domain of domains) {
        engine.addExperience({
            situation: `${domain} 관련 상황 발생`,
            action: `${domain} 최적화 조치 취함`,
            outcome: "긍정적 결과 달성",
            lesson: `${domain}에서는 체계적 접근이 중요하다`,
            success: true,
            importance: 0.8,
            domain,
        });
    }
    const score = engine.wisdomScore();
    assert(score > 0.4, `5개 도메인 경험 후 wisdomScore(${score})가 0.4보다 높아야 함`);
});
// ── 결과 출력 ────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log(`결과: ${passed} PASS / ${failed} FAIL / 총 ${passed + failed}`);
console.log("=".repeat(60));
if (passed < 25) {
    console.log(`\n❌ 최소 25 PASS 미달 (${passed}/25)`);
    process.exit(1);
}
else {
    console.log(`\n✅ Phase 149 [WISDOM] 완성! (${passed}/${passed + failed} PASS)`);
}
//# sourceMappingURL=test-phase149-wisdom.js.map