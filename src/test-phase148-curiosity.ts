// test-phase148-curiosity.ts — FreeLang v9 Phase 148 테스트
// CURIOSITY: AI 호기심 기반 탐색 시스템

import { CuriosityEngine, globalCuriosity, KnowledgeGap, ExplorationResult, CuriosityState } from "./curiosity";
import { Interpreter } from "./interpreter";
import { evalCuriosity } from "./eval-builtins";

let pass = 0;
let fail = 0;

function test(name: string, fn: () => boolean): void {
  try {
    const result = fn();
    if (result) {
      console.log(`  ✅ PASS: ${name}`);
      pass++;
    } else {
      console.log(`  ❌ FAIL: ${name}`);
      fail++;
    }
  } catch (e: any) {
    console.log(`  ❌ FAIL: ${name} — ${e.message}`);
    fail++;
  }
}

console.log("\n=== Phase 148: CURIOSITY 호기심 기반 탐색 ===\n");

// 1. CuriosityEngine 기본 생성
const engine = new CuriosityEngine();
test("1. CuriosityEngine 기본 생성", () => engine instanceof CuriosityEngine);

// 2. CuriosityEngine 초기 주제로 생성
const engineWithTopics = new CuriosityEngine(["양자컴퓨팅", "머신러닝", "블록체인"]);
const initialState = engineWithTopics.getState();
test("2. CuriosityEngine 초기 주제로 생성", () =>
  initialState.frontier.length === 3 &&
  initialState.frontier.includes("양자컴퓨팅")
);

// 3. computeCuriosity: 알려진 것 많으면 낮은 점수
const lowScore = engine.computeCuriosity("양자컴퓨팅", ["큐비트", "중첩", "얽힘", "게이트", "회로", "노이즈", "오류정정"]);
test("3. computeCuriosity 알려진 것 많으면 낮은 점수", () => lowScore < 0.5);

// 4. computeCuriosity: 알려진 것 없으면 높은 점수
const highScore = engine.computeCuriosity("우주론", []);
test("4. computeCuriosity 알려진 것 없으면 높은 점수", () => highScore > 0.8);

// 5. selectNextTopic: 탐색 대상 선택
const nextTopic = engineWithTopics.selectNextTopic();
test("5. selectNextTopic 탐색 대상 선택", () =>
  nextTopic !== null && typeof nextTopic === "string"
);

// 6. explore: 탐색 수행
const exploreEngine = new CuriosityEngine(["딥러닝"]);
const result: ExplorationResult = exploreEngine.explore("딥러닝", (topic) => ({
  facts: [`${topic}는 신경망이다`, `${topic}는 GPU를 쓴다`, `${topic}는 역전파를 쓴다`],
  questions: ["트랜스포머란?", "어텐션 메커니즘이란?", "BERT는 무엇인가?"],
}));
test("6. explore 탐색 수행 반환값 존재", () => result !== null && result !== undefined);

// 7. ExplorationResult 구조
test("7. ExplorationResult 구조 (topic, discovered, newQuestions, ...)", () =>
  typeof result.topic === "string" &&
  Array.isArray(result.discovered) &&
  Array.isArray(result.newQuestions) &&
  typeof result.informationGain === "number" &&
  typeof result.surpriseLevel === "number" &&
  Array.isArray(result.relatedTopics)
);

// 8. discovered 배열 (발견된 새 정보)
test("8. discovered 배열 존재", () => result.discovered.length > 0);

// 9. newQuestions 생성
test("9. newQuestions 생성", () => result.newQuestions.length >= 1);

// 10. informationGain > 0
test("10. informationGain > 0", () => result.informationGain > 0);

// 11. surpriseLevel 0~1
test("11. surpriseLevel 0~1 범위", () =>
  result.surpriseLevel >= 0 && result.surpriseLevel <= 1
);

// 12. relatedTopics 생성
test("12. relatedTopics 생성", () => Array.isArray(result.relatedTopics));

// 13. identifyGaps: 지식 공백 식별
const gapEngine = new CuriosityEngine();
const gaps: KnowledgeGap[] = gapEngine.identifyGaps(
  ["양자컴퓨팅", "머신러닝"],
  ["양자컴퓨팅", "머신러닝", "블록체인", "메타버스", "자율주행"]
);
test("13. identifyGaps 지식 공백 반환", () => gaps.length === 3);

// 14. KnowledgeGap 구조 검증
const gap0 = gaps[0];
test("14. KnowledgeGap 구조 (topic, unknownAspects, priority, explorationCost, expectedGain)", () =>
  typeof gap0.topic === "string" &&
  Array.isArray(gap0.unknownAspects) &&
  typeof gap0.priority === "number" &&
  typeof gap0.explorationCost === "number" &&
  typeof gap0.expectedGain === "number"
);

// 15. generateQuestions: 질문 생성
const questions = gapEngine.generateQuestions("블록체인", ["암호화폐", "스마트컨트랙트"]);
test("15. generateQuestions 질문 생성", () =>
  Array.isArray(questions) && questions.length >= 4
);

// 16. prioritize: UCB1 정렬
const prioritizeEngine = new CuriosityEngine(["A", "B", "C"]);
const prioritized = prioritizeEngine.prioritize(["A", "B", "C"]);
test("16. prioritize UCB1 정렬 반환", () =>
  Array.isArray(prioritized) && prioritized.length === 3
);

// 17. analyzeExplorationHistory: 이력 분석
const histEngine = new CuriosityEngine(["수학", "물리", "화학"]);
histEngine.explore("수학", (t) => ({
  facts: [`${t}는 논리다`, `${t}는 추상이다`],
  questions: ["미적분이란?", "선형대수란?"],
}));
const analysis = histEngine.analyzeExplorationHistory();
test("17. analyzeExplorationHistory 분석 반환", () =>
  typeof analysis.totalExplored === "number" &&
  typeof analysis.avgInfoGain === "number" &&
  typeof analysis.mostSurprising === "string" &&
  Array.isArray(analysis.recommendations)
);

// 18. 탐색 후 frontier 업데이트 확인
const frontierEngine = new CuriosityEngine(["주제A"]);
frontierEngine.explore("주제A", (t) => ({
  facts: [`${t} 사실1`],
  questions: ["새질문B?", "새질문C?"],
}));
const afterState = frontierEngine.getState();
test("18. 탐색 후 explored에 추가됨", () => afterState.explored.has("주제A"));

// ===== 빌트인 테스트 =====
// 빌트인 함수를 직접 evalCuriosity로 테스트
// 별도 globalCuriosity 인스턴스 사용 (상태 초기화)
const bc = new CuriosityEngine(["바이오테크", "나노기술", "핵융합"]);
// globalCuriosity 대신 별도 함수를 만들어 테스트 (evalCuriosity는 globalCuriosity 사용)

// 19. curiosity-score 빌트인
const scoreResult = evalCuriosity("curiosity-score", ["새주제", []], (_fn: any, _a: any[]) => null);
test("19. curiosity-score 빌트인", () =>
  typeof scoreResult === "number" && scoreResult >= 0 && scoreResult <= 1
);

// 20. curiosity-next 빌트인 (globalCuriosity에 frontier가 없을 수도 있어 null 허용)
const nextResult = evalCuriosity("curiosity-next", [], (_fn: any, _a: any[]) => null);
test("20. curiosity-next 빌트인 (null or string)", () =>
  nextResult === null || typeof nextResult === "string"
);

// 21. curiosity-explore 빌트인
const exploreBuiltinResult = evalCuriosity(
  "curiosity-explore",
  [
    "인공지능",
    (t: string) => new Map<string, any>([
      ["facts", [`${t}는 머신러닝 기반`, `${t}는 데이터가 필요`]],
      ["questions", ["딥러닝이란?", "강화학습이란?"]],
    ]),
  ],
  (fn: any, a: any[]) => fn(a[0]) // 간단 callFn
);
test("21. curiosity-explore 빌트인 반환", () =>
  exploreBuiltinResult instanceof Map &&
  exploreBuiltinResult.has("topic") &&
  exploreBuiltinResult.has("informationGain")
);

// 22. curiosity-gaps 빌트인
const gapsResult = evalCuriosity(
  "curiosity-gaps",
  [["A", "B"], ["A", "B", "C", "D"]],
  (_fn: any, _a: any[]) => null
);
test("22. curiosity-gaps 빌트인", () =>
  Array.isArray(gapsResult) && gapsResult.length === 2
);

// 23. curiosity-questions 빌트인
const questionsResult = evalCuriosity(
  "curiosity-questions",
  ["메타버스", ["VR", "AR"]],
  (_fn: any, _a: any[]) => null
);
test("23. curiosity-questions 빌트인", () =>
  Array.isArray(questionsResult) && questionsResult.length >= 4
);

// 24. curiosity-prioritize 빌트인
const prioritizeResult = evalCuriosity(
  "curiosity-prioritize",
  [["X", "Y", "Z"]],
  (_fn: any, _a: any[]) => null
);
test("24. curiosity-prioritize 빌트인", () =>
  Array.isArray(prioritizeResult) && prioritizeResult.length === 3
);

// 25. curiosity-analyze 빌트인
const analyzeResult = evalCuriosity("curiosity-analyze", [], (_fn: any, _a: any[]) => null);
test("25. curiosity-analyze 빌트인", () =>
  analyzeResult instanceof Map &&
  analyzeResult.has("totalExplored") &&
  analyzeResult.has("avgInfoGain") &&
  analyzeResult.has("mostSurprising") &&
  analyzeResult.has("recommendations")
);

// 26. curiosity-state 빌트인
const stateResult = evalCuriosity("curiosity-state", [], (_fn: any, _a: any[]) => null);
test("26. curiosity-state 빌트인", () =>
  stateResult instanceof Map &&
  stateResult.has("explored") &&
  stateResult.has("frontier") &&
  stateResult.has("curiosityScore")
);

// 27. computeCuriosity 0~1 범위 보장
const scoreA = engine.computeCuriosity("X", []);
const scoreB = engine.computeCuriosity("X", ["a", "b", "c", "d", "e", "f", "g", "h"]);
test("27. computeCuriosity 0~1 범위 항상 보장", () =>
  scoreA >= 0 && scoreA <= 1 && scoreB >= 0 && scoreB <= 1
);

// 28. gaps priority 내림차순 정렬
const sortedGaps = gapEngine.identifyGaps([], ["토픽1", "토픽2", "토픽3"]);
test("28. gaps priority 내림차순 정렬", () =>
  sortedGaps.length >= 2 &&
  sortedGaps[0].priority >= sortedGaps[sortedGaps.length - 1].priority
);

// 결과 출력
console.log(`\n총 결과: ${pass} PASS / ${fail} FAIL\n`);
if (fail > 0) {
  process.exit(1);
}
