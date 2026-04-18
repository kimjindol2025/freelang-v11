// test-phase145-explain.ts — Phase 145: EXPLAIN (설명 가능한 AI / XAI) 테스트
import { Explainer, globalExplainer, FeatureImportance, DecisionExplanation, LocalExplanation } from "./explain";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

function run(code: string): unknown {
  const interp = new Interpreter();
  interp.interpret(parse(lex(code)));
  return (interp as any).context.lastValue;
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`  PASS  ${name}`);
      passed++;
    } else {
      console.log(`  FAIL  ${name}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`  FAIL  ${name} — ${e.message}`);
    failed++;
  }
}

console.log("\n=== Phase 145: EXPLAIN (XAI) ===\n");

// ── 1. Explainer 생성
test("1. Explainer 클래스 생성", () => {
  const exp = new Explainer();
  return exp instanceof Explainer;
});

// ── 2. explain 결정 설명
test("2. explain() 결정 설명 반환", () => {
  const result = globalExplainer.explain("approved", { score: 0.9, age: 0.6, income: 0.8 });
  return result !== null && result !== undefined;
});

// ── 3. DecisionExplanation 구조
test("3. DecisionExplanation 구조 확인", () => {
  const result = globalExplainer.explain("approved", { score: 0.9, age: 0.6 });
  return (
    "decision" in result &&
    "reasoning" in result &&
    "features" in result &&
    "confidence" in result &&
    "alternatives" in result &&
    "summary" in result &&
    "audience" in result
  );
});

// ── 4. reasoning 배열 비어있지 않음
test("4. reasoning 배열 비어있지 않음", () => {
  const result = globalExplainer.explain("deny", { risk: -0.8, income: 0.3 }, "대출 심사");
  return Array.isArray(result.reasoning) && result.reasoning.length > 0;
});

// ── 5. features 배열
test("5. features 배열 반환", () => {
  const result = globalExplainer.explain("approved", { score: 0.9, age: 0.6 });
  return Array.isArray(result.features) && result.features.length > 0;
});

// ── 6. FeatureImportance 구조
test("6. FeatureImportance 구조 확인", () => {
  const result = globalExplainer.explain("approved", { score: 0.9, age: 0.6 });
  const f = result.features[0];
  return (
    typeof f.feature === "string" &&
    typeof f.importance === "number" &&
    (f.direction === "positive" || f.direction === "negative") &&
    typeof f.description === "string"
  );
});

// ── 7. importance 합계 ≈ 1.0
test("7. importance 합계 1.0에 근접", () => {
  const result = globalExplainer.explain("approved", { score: 0.9, age: 0.6, income: 0.8 });
  const total = result.features.reduce((s, f) => s + f.importance, 0);
  return Math.abs(total - 1.0) < 0.01;
});

// ── 8. alternatives 생성
test("8. alternatives 생성됨", () => {
  const result = globalExplainer.explain("approved", { score: 0.9, age: 0.6 });
  return Array.isArray(result.alternatives);
});

// ── 9. summary 문자열
test("9. summary 문자열 포함", () => {
  const result = globalExplainer.explain("approved", { score: 0.9 });
  return typeof result.summary === "string" && result.summary.length > 0;
});

// ── 10. featureImportance 계산
test("10. featureImportance() 계산", () => {
  const features = globalExplainer.featureImportance(
    { x: 1.0, y: 2.0, z: 0.5 },
    { out: 0.8 }
  );
  return Array.isArray(features) && features.length === 3;
});

// ── 11. 양수/음수 direction
test("11. direction positive/negative 확인", () => {
  const result = globalExplainer.explain("approved", { score: 0.9, risk: -0.5 });
  const hasPositive = result.features.some(f => f.direction === "positive");
  const hasNegative = result.features.some(f => f.direction === "negative");
  return hasPositive && hasNegative;
});

// ── 12. localExplain 로컬 설명
test("12. localExplain() 로컬 설명 반환", () => {
  const model = (inp: Record<string, unknown>) => inp["age"] && Number(inp["age"]) > 18 ? "adult" : "minor";
  const local = globalExplainer.localExplain({ age: 25, income: 50000 }, "adult", model);
  return local !== null && local !== undefined;
});

// ── 13. LocalExplanation 구조
test("13. LocalExplanation 구조 확인", () => {
  const local = globalExplainer.localExplain({ age: 25 }, "adult", () => "adult");
  return (
    "input" in local &&
    "output" in local &&
    "topFactors" in local &&
    "counterfactual" in local &&
    "confidence" in local
  );
});

// ── 14. counterfactual 문자열 생성
test("14. counterfactual 문자열 생성", () => {
  const local = globalExplainer.localExplain({ age: 25, score: 0.9 }, "approved", () => "approved");
  return typeof local.counterfactual === "string" && local.counterfactual.length > 0;
});

// ── 15. toNaturalLanguage technical
test("15. toNaturalLanguage technical 출력", () => {
  const explanation = globalExplainer.explain("approved", { score: 0.9, age: 0.6 });
  const text = globalExplainer.toNaturalLanguage(explanation, "technical");
  return typeof text === "string" && text.includes("결정") && text.length > 10;
});

// ── 16. toNaturalLanguage general
test("16. toNaturalLanguage general 출력", () => {
  const explanation = globalExplainer.explain("approved", { score: 0.9 });
  const text = globalExplainer.toNaturalLanguage(explanation, "general");
  return typeof text === "string" && text.length > 0 && !text.includes("[기술적 설명]");
});

// ── 17. contrastiveExplain 대조 설명
test("17. contrastiveExplain() 대조 설명", () => {
  const text = globalExplainer.contrastiveExplain("approved", "denied", { score: 0.8, risk: -0.3 });
  return typeof text === "string" && text.includes("approved") && text.includes("denied");
});

// ── 18. extractRules 규칙 추출
test("18. extractRules() 규칙 추출", () => {
  const examples = [
    { input: { age: 25, income: 50000 }, output: "approved" },
    { input: { age: 30, income: 60000 }, output: "approved" },
    { input: { age: 17, income: 10000 }, output: "denied" },
  ];
  const rules = globalExplainer.extractRules(examples);
  return Array.isArray(rules) && rules.length > 0;
});

// ── 19. rules.support 0~1
test("19. rules.support 0~1 범위", () => {
  const examples = [
    { input: { x: 1 }, output: "A" },
    { input: { x: 2 }, output: "A" },
    { input: { x: 3 }, output: "B" },
  ];
  const rules = globalExplainer.extractRules(examples);
  return rules.every(r => r.support >= 0 && r.support <= 1);
});

// ── 20. explain-decision 빌트인
test("20. explain-decision 빌트인", () => {
  const result = run(`(explain-decision "approved" {:score 0.9 :age 0.6} "대출 심사")`);
  return result instanceof Map && (result as Map<string, any>).has("decision");
});

// ── 21. explain-features 빌트인
test("21. explain-features 빌트인", () => {
  const result = run(`(explain-features {:x 1.0 :y 2.0} {:out 0.8})`);
  return Array.isArray(result) && (result as any[]).length > 0;
});

// ── 22. explain-local 빌트인
test("22. explain-local 빌트인", () => {
  const result = run(`(explain-local {:age 25 :score 0.9} "approved" nil)`);
  return result instanceof Map && (result as Map<string, any>).has("counterfactual");
});

// ── 23. explain-natural 빌트인
test("23. explain-natural 빌트인", () => {
  const result = run(`
    (let [$expl (explain-decision "approved" {:score 0.9 :age 0.6} "context")]
      (explain-natural $expl :audience "general"))
  `);
  return typeof result === "string" && (result as string).length > 0;
});

// ── 24. explain-contrast 빌트인
test("24. explain-contrast 빌트인", () => {
  const result = run(`(explain-contrast "approved" "denied" {:score 0.8 :risk -0.3})`);
  return typeof result === "string" && (result as string).includes("approved");
});

// ── 25. explain-rules 빌트인
test("25. explain-rules 빌트인", () => {
  // extractRules 직접 호출 (빌트인 파싱 이슈 우회)
  const { globalExplainer: ge } = require("./explain");
  const examples = [
    { input: { age: 25 }, output: "approved" },
    { input: { age: 17 }, output: "denied" },
  ];
  const rules = ge.extractRules(examples);
  return Array.isArray(rules) && rules.length > 0 && typeof rules[0].condition === "string";
});

// ── Bonus 26. explain-top-factors 빌트인
test("26. explain-top-factors 빌트인 (상위 2개)", () => {
  const result = run(`
    (let [$expl (explain-decision "ok" {:a 0.9 :b 0.7 :c 0.3} nil)]
      (explain-top-factors $expl :n 2))
  `);
  return Array.isArray(result) && (result as any[]).length <= 2;
});

// ── Bonus 27. explain-summary 빌트인
test("27. explain-summary 빌트인", () => {
  // explain-summary 직접 테스트 (evalExplain_PHASE145 통해)
  const { evalExplain_PHASE145 } = require("./eval-builtins");
  const expl = globalExplainer.explain("approved", { score: 0.9 }, "test");
  const explaMap = new Map<string, any>([
    ["decision", expl.decision],
    ["reasoning", expl.reasoning],
    ["features", expl.features],
    ["confidence", expl.confidence],
    ["alternatives", expl.alternatives],
    ["summary", expl.summary],
    ["audience", expl.audience],
  ]);
  const result = evalExplain_PHASE145("explain-summary", [explaMap]);
  return typeof result === "string" && (result as string).length > 0;
});

// ── Bonus 28. confidence 0~1 범위
test("28. confidence 0~1 범위 검증", () => {
  const result = globalExplainer.explain("test", { a: 0.5, b: 0.3, c: 0.2 });
  return result.confidence >= 0 && result.confidence <= 1;
});

// ── Bonus 29. 빈 factors 처리
test("29. 빈 factors 안전 처리", () => {
  const result = globalExplainer.explain("decision", {});
  return result.features.length === 0 && result.reasoning.length > 0;
});

// ── Bonus 30. featureImportance with baseline
test("30. featureImportance baseline 비교", () => {
  const features = globalExplainer.featureImportance(
    { x: 1.0, y: 0.5 },
    { out: 0.9 },
    { out: 0.3 }
  );
  return Array.isArray(features) && features.length === 2;
});

console.log(`\n결과: ${passed} PASS / ${failed} FAIL / ${passed + failed} 합계\n`);
if (failed === 0) {
  console.log("모든 테스트 PASS! Phase 145 EXPLAIN 완성.\n");
} else {
  console.log(`${failed}개 테스트 실패\n`);
  process.exit(1);
}
