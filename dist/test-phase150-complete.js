"use strict";
// test-phase150-complete.ts — Phase 150: FreeLang v9 완전체 테스트
// 최소 40 PASS 목표
Object.defineProperty(exports, "__esModule", { value: true });
const freelang_v9_complete_1 = require("./freelang-v9-complete");
const eval_phase150_1 = require("./eval-phase150");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const ok = fn();
        if (ok) {
            console.log(`  PASS  ${name}`);
            passed++;
        }
        else {
            console.log(`  FAIL  ${name}`);
            failed++;
        }
    }
    catch (e) {
        console.log(`  FAIL  ${name} — ${e.message}`);
        failed++;
    }
}
console.log("\n=== Phase 150: FreeLang v9 완전체 테스트 ===\n");
// ────────────────────────────────────────────────────
// 섹션 1: FreeLangV9 클래스 기본 생성
// ────────────────────────────────────────────────────
console.log("-- 1. FreeLangV9 클래스 생성 --");
test("1. FreeLangV9 기본 생성", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    return fl instanceof freelang_v9_complete_1.FreeLangV9;
});
test("2. FreeLangV9 커스텀 설정 생성", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9({
        enableEthics: true,
        enableWisdom: true,
        enableWorldModel: false,
        maxTokens: 4096,
    });
    return fl instanceof freelang_v9_complete_1.FreeLangV9;
});
test("3. FreeLangV9 최소 설정 생성", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9({ enableEthics: false, enableWisdom: false });
    return fl instanceof freelang_v9_complete_1.FreeLangV9;
});
// ────────────────────────────────────────────────────
// 섹션 2: process 처리
// ────────────────────────────────────────────────────
console.log("\n-- 2. process() 테스트 --");
test("4. process 기본 처리", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("AI가 코드를 생성한다");
    return r !== null && r !== undefined;
});
test("5. FreeLangV9Response 구조 — input 필드", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("테스트 입력");
    return r.input === "테스트 입력";
});
test("6. FreeLangV9Response 구조 — output 필드", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("테스트");
    return r.output !== null && r.output !== undefined;
});
test("7. FreeLangV9Response 구조 — executionMs > 0", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("처리 시간 테스트");
    return typeof r.executionMs === "number" && r.executionMs >= 0;
});
test("8. process — reasoning 배열 존재", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("추론 테스트");
    return Array.isArray(r.reasoning) && (r.reasoning?.length ?? 0) > 0;
});
test("9. process — confidence 0~1 범위", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("신뢰도 테스트");
    return typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1;
});
test("10. process — ethicsCheck 포함", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9({ enableEthics: true });
    const r = fl.process("윤리 검사 테스트");
    return r.ethicsCheck !== undefined &&
        typeof r.ethicsCheck?.passed === "boolean" &&
        typeof r.ethicsCheck?.score === "number";
});
test("11. process — aligned boolean 포함", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9({ enableAlignment: true });
    const r = fl.process("정렬 테스트");
    return typeof r.aligned === "boolean";
});
test("12. process — wisdom 문자열 포함", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9({ enableWisdom: true });
    const r = fl.process("지혜 테스트");
    return typeof r.wisdom === "string" && (r.wisdom?.length ?? 0) > 0;
});
test("13. process — context 파라미터 적용", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("컨텍스트 테스트", { domain: "AI", priority: "high" });
    return r !== null;
});
test("14. 빈 입력 처리", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("");
    return r.input === "" && r.executionMs >= 0;
});
// ────────────────────────────────────────────────────
// 섹션 3: status()
// ────────────────────────────────────────────────────
console.log("\n-- 3. status() 테스트 --");
test("15. status() 조회", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const s = fl.status();
    return s !== null && s !== undefined;
});
test("16. FreeLangV9Status — version '9.0.0'", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const s = fl.status();
    return s.version === "9.0.0";
});
test("17. FreeLangV9Status — phases = 150", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const s = fl.status();
    return s.phases === 150;
});
test("18. FreeLangV9Status — tiers 10개", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const s = fl.status();
    return Object.keys(s.tiers).length === 10;
});
test("19. FreeLangV9Status — 모든 tiers true", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const s = fl.status();
    return Object.values(s.tiers).every(v => v === true);
});
test("20. FreeLangV9Status — features 비어있지 않음", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const s = fl.status();
    return Array.isArray(s.features) && s.features.length > 0;
});
test("21. FreeLangV9Status — uptime > 0", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const s = fl.status();
    return typeof s.uptime === "number" && s.uptime >= 0;
});
// ────────────────────────────────────────────────────
// 섹션 4: thinkCheckAlignRespond()
// ────────────────────────────────────────────────────
console.log("\n-- 4. thinkCheckAlignRespond() 테스트 --");
test("22. thinkCheckAlignRespond 완전 사이클", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.thinkCheckAlignRespond("최적 알고리즘을 설계하라");
    return r !== null && r.executionMs >= 0;
});
test("23. thinkCheckAlignRespond — reasoning 배열", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.thinkCheckAlignRespond("문제 해결", ["안전", "효율"]);
    return Array.isArray(r.reasoning) && (r.reasoning?.length ?? 0) > 0;
});
test("24. thinkCheckAlignRespond — 제약 조건 적용", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.thinkCheckAlignRespond("설계", ["성능 우선", "안전 필수"]);
    const hasConstraintReasoning = r.reasoning?.some(s => s.includes("제약") || s.includes("THINK")) ?? false;
    return hasConstraintReasoning;
});
test("25. thinkCheckAlignRespond — ethicsCheck 포함", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9({ enableEthics: true });
    const r = fl.thinkCheckAlignRespond("AI 결정 시스템");
    return r.ethicsCheck !== undefined;
});
// ────────────────────────────────────────────────────
// 섹션 5: selfDiagnose()
// ────────────────────────────────────────────────────
console.log("\n-- 5. selfDiagnose() 테스트 --");
test("26. selfDiagnose 자기 진단", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const d = fl.selfDiagnose();
    return d !== null && d !== undefined;
});
test("27. selfDiagnose — healthy 필드", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const d = fl.selfDiagnose();
    return typeof d.healthy === "boolean";
});
test("28. selfDiagnose — healthy=true (기본 설정)", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9(); // 모두 활성화 기본값
    const d = fl.selfDiagnose();
    return d.healthy === true;
});
test("29. selfDiagnose — score 0~1 범위", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const d = fl.selfDiagnose();
    return d.score >= 0 && d.score <= 1;
});
test("30. selfDiagnose — issues 배열", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const d = fl.selfDiagnose();
    return Array.isArray(d.issues);
});
test("31. selfDiagnose — recommendations 배열", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const d = fl.selfDiagnose();
    return Array.isArray(d.recommendations) && d.recommendations.length > 0;
});
test("32. selfDiagnose — 비활성화 시 issues 발생", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9({ enableEthics: false, enableWisdom: false });
    const d = fl.selfDiagnose();
    return d.issues.length > 0 && d.healthy === false;
});
// ────────────────────────────────────────────────────
// 섹션 6: getVersion / getFeatures / enable / disable
// ────────────────────────────────────────────────────
console.log("\n-- 6. getVersion/getFeatures/enable/disable 테스트 --");
test("33. getVersion() '9.0.0'", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    return fl.getVersion() === "9.0.0";
});
test("34. getFeatures() 기능 목록", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const f = fl.getFeatures();
    return Array.isArray(f) && f.length > 0;
});
test("35. getFeatures() 50개 이상", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    return fl.getFeatures().length >= 50;
});
test("36. enable/disable 기능 전환", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    fl.disable("wisdom");
    const beforeCount = fl.getFeatures().length;
    fl.enable("wisdom");
    const afterCount = fl.getFeatures().length;
    return afterCount > beforeCount;
});
test("37. enable 없는 기능 — 무시", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    fl.enable("nonexistent-feature-xyz"); // 에러 없이 무시
    return true;
});
// ────────────────────────────────────────────────────
// 섹션 7: FREELANG_V9_MANIFEST
// ────────────────────────────────────────────────────
console.log("\n-- 7. FREELANG_V9_MANIFEST 테스트 --");
test("38. FREELANG_V9_MANIFEST 존재", () => {
    return freelang_v9_complete_1.FREELANG_V9_MANIFEST !== null && freelang_v9_complete_1.FREELANG_V9_MANIFEST !== undefined;
});
test("39. MANIFEST.phases = 150", () => {
    return freelang_v9_complete_1.FREELANG_V9_MANIFEST.phases === 150;
});
test("40. MANIFEST.tiers = 10", () => {
    return freelang_v9_complete_1.FREELANG_V9_MANIFEST.tiers === 10;
});
test("41. MANIFEST.features 50개 이상", () => {
    return Array.isArray(freelang_v9_complete_1.FREELANG_V9_MANIFEST.features) &&
        freelang_v9_complete_1.FREELANG_V9_MANIFEST.features.length >= 50;
});
test("42. MANIFEST.version '9.0.0'", () => {
    return freelang_v9_complete_1.FREELANG_V9_MANIFEST.version === "9.0.0";
});
test("43. MANIFEST.description 존재", () => {
    return typeof freelang_v9_complete_1.FREELANG_V9_MANIFEST.description === "string" &&
        freelang_v9_complete_1.FREELANG_V9_MANIFEST.description.length > 0;
});
test("44. MANIFEST.philosophy 배열", () => {
    return Array.isArray(freelang_v9_complete_1.FREELANG_V9_MANIFEST.philosophy) &&
        freelang_v9_complete_1.FREELANG_V9_MANIFEST.philosophy.length > 0;
});
test("45. MANIFEST.tiers_detail 10개", () => {
    return Object.keys(freelang_v9_complete_1.FREELANG_V9_MANIFEST.tiers_detail).length === 10;
});
// ────────────────────────────────────────────────────
// 섹션 8: evalPhase150Complete 빌트인 함수
// ────────────────────────────────────────────────────
console.log("\n-- 8. evalPhase150Complete 빌트인 함수 테스트 --");
test("46. fl-v9-process 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-process", ["AI 테스트"]);
    return r instanceof Map && r.has("input") && r.has("executionMs");
});
test("47. fl-v9-status 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-status", []);
    return r instanceof Map && r.get("version") === "9.0.0";
});
test("48. fl-v9-think 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-think", ["AI 결정", ["안전"]]);
    return r instanceof Map && r.has("reasoning");
});
test("49. fl-v9-diagnose 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-diagnose", []);
    return r instanceof Map && r.has("healthy") && r.has("score");
});
test("50. fl-v9-features 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-features", []);
    return Array.isArray(r) && r.length > 0;
});
test("51. fl-v9-version 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-version", []);
    return r === "9.0.0";
});
test("52. fl-v9-enable 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-enable", ["ethics-check"]);
    return r === null;
});
test("53. fl-v9-disable 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-disable", ["wisdom"]);
    return r === null;
});
test("54. fl-v9-manifest 빌트인", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-manifest", []);
    return r instanceof Map &&
        r.get("phases") === 150 &&
        r.get("version") === "9.0.0";
});
test("55. fl-v9-manifest features 50개 이상", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-manifest", []);
    const features = r.get("features");
    return Array.isArray(features) && features.length >= 50;
});
// ────────────────────────────────────────────────────
// 섹션 9: 전역 인스턴스 및 통합
// ────────────────────────────────────────────────────
console.log("\n-- 9. 전역 인스턴스 및 Tier 통합 테스트 --");
test("56. freelangV9 전역 인스턴스 존재", () => {
    return freelang_v9_complete_1.freelangV9 instanceof freelang_v9_complete_1.FreeLangV9;
});
test("57. 전역 인스턴스 version '9.0.0'", () => {
    return freelang_v9_complete_1.freelangV9.getVersion() === "9.0.0";
});
test("58. fl-v9-status tiers 10개 (빌트인)", () => {
    const s = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-status", []);
    const tiers = s.get("tiers");
    return tiers instanceof Map && tiers.size === 10;
});
test("59. fl-v9-status phases=150 (빌트인)", () => {
    const s = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-status", []);
    return s.get("phases") === 150;
});
test("60. Tier 1~10 통합 확인 — MANIFEST features 포함 검증", () => {
    const tier10Features = ["world-model", "causal", "counterfactual", "predict", "explain", "align", "ethics-check", "curiosity", "wisdom"];
    const manifest = freelang_v9_complete_1.FREELANG_V9_MANIFEST.features;
    return tier10Features.every(f => manifest.includes(f));
});
test("61. Tier 5 features 포함 검증", () => {
    const tier5 = ["maybe-type", "chain-of-thought", "tree-of-thought", "agent"];
    return tier5.every(f => freelang_v9_complete_1.FREELANG_V9_MANIFEST.features.includes(f));
});
test("62. Tier 8 features 포함 검증", () => {
    const tier8 = ["consensus", "delegate", "vote", "swarm", "orchestrate"];
    return tier8.every(f => freelang_v9_complete_1.FREELANG_V9_MANIFEST.features.includes(f));
});
test("63. Tier 9 features 포함 검증", () => {
    const tier9 = ["evolve", "mutate", "crossover", "fitness", "generation"];
    return tier9.every(f => freelang_v9_complete_1.FREELANG_V9_MANIFEST.features.includes(f));
});
test("64. process ethicsCheck score 0~1", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9({ enableEthics: true });
    const r = fl.process("윤리 검사");
    return r.ethicsCheck !== undefined &&
        r.ethicsCheck.score >= 0 &&
        r.ethicsCheck.score <= 1;
});
test("65. process response aligned boolean", () => {
    const fl = new freelang_v9_complete_1.FreeLangV9();
    const r = fl.process("정렬 확인");
    return typeof r.aligned === "boolean";
});
test("66. unknown 빌트인 → null", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("unknown-op-xyz", []);
    return r === null;
});
test("67. fl-v9-think executionMs 타입 체크", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-think", ["문제"]);
    return typeof r.get("executionMs") === "number";
});
test("68. fl-v9-diagnose healthy 타입", () => {
    const r = (0, eval_phase150_1.evalPhase150Complete)("fl-v9-diagnose", []);
    return typeof r.get("healthy") === "boolean";
});
// ────────────────────────────────────────────────────
// 최종 결과
// ────────────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log(`FreeLang v9 Phase 150 완전체 테스트 결과`);
console.log(`  PASS: ${passed} / ${passed + failed}`);
console.log(`  FAIL: ${failed}`);
console.log("=".repeat(50));
if (failed > 0) {
    console.log("\n실패한 테스트가 있습니다.");
    process.exit(1);
}
else {
    console.log("\n🎉 FreeLang v9 완전체 — 모든 테스트 통과!");
    console.log(`Phase 150 완성: ${passed}/68 PASS`);
}
//# sourceMappingURL=test-phase150-complete.js.map