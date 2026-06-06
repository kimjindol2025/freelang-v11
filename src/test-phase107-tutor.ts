// FreeLang v9: Phase 107 — FL 자기 교육 시스템 테스트
// FLTutor + fl-learn / fl-examples / fl-example-count / fl-concepts

import { FLTutor, FL_EXAMPLES, globalTutor, type FLExample } from "./fl-tutor";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg ?? "assertion failed");
}

function assertEqual(a: any, b: any, msg?: string) {
  if (a !== b) throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function run(interp: Interpreter, code: string): any {
  const tokens = lex(code);
  const ast = parse(tokens);
  let result: any;
  for (const node of ast) {
    result = (interp as any).eval(node);
  }
  return result;
}

console.log("\n=== Phase 107: FL 자기 교육 시스템 ===\n");

// ─── 1. FLTutor 생성 ───────────────────────────────────
test("1. FLTutor 생성", () => {
  const tutor = new FLTutor();
  assert(tutor instanceof FLTutor, "FLTutor 인스턴스여야 함");
});

// ─── 2. FL_EXAMPLES 내장 예제 15개 이상 ─────────────────
test("2. FL_EXAMPLES 내장 예제 15개 이상", () => {
  assert(FL_EXAMPLES.length >= 15, `예제 수: ${FL_EXAMPLES.length}`);
});

// ─── 3. findByConcept() hit ──────────────────────────────
test("3. findByConcept() hit", () => {
  const tutor = new FLTutor();
  const result = tutor.findByConcept("define");
  assert(result.length > 0, "define 개념 찾아야 함");
  assertEqual(result[0].concept, "define");
});

// ─── 4. findByConcept() miss → [] ───────────────────────
test("4. findByConcept() miss → []", () => {
  const tutor = new FLTutor();
  const result = tutor.findByConcept("xyznotexists");
  assert(Array.isArray(result), "배열이어야 함");
  assertEqual(result.length, 0, "없는 개념은 빈 배열");
});

// ─── 5. findByTag('ai') → AI 예제들 ────────────────────
test("5. findByTag('ai') → AI 예제들", () => {
  const tutor = new FLTutor();
  const result = tutor.findByTag("ai");
  assert(result.length > 0, "ai 태그 예제 있어야 함");
  assert(result.every(e => e.tags.includes("ai")), "모든 결과에 ai 태그 있어야 함");
});

// ─── 6. findByDifficulty('beginner') ────────────────────
test("6. findByDifficulty('beginner')", () => {
  const tutor = new FLTutor();
  const result = tutor.findByDifficulty("beginner");
  assert(result.length > 0, "beginner 예제 있어야 함");
  assert(result.every(e => e.difficulty === "beginner"), "모두 beginner여야 함");
});

// ─── 7. findByDifficulty('advanced') ────────────────────
test("7. findByDifficulty('advanced')", () => {
  const tutor = new FLTutor();
  const result = tutor.findByDifficulty("advanced");
  assert(result.length > 0, "advanced 예제 있어야 함");
  assert(result.every(e => e.difficulty === "advanced"), "모두 advanced여야 함");
});

// ─── 8. lesson() concept 있음 ───────────────────────────
test("8. lesson() concept 있음", () => {
  const tutor = new FLTutor();
  const result = tutor.lesson("define");
  assertEqual(result.concept, "define", "concept 필드 일치해야 함");
});

// ─── 9. lesson() examples 포함 ──────────────────────────
test("9. lesson() examples 포함", () => {
  const tutor = new FLTutor();
  const result = tutor.lesson("define");
  assert(result.examples.length > 0, "examples 배열 비어있으면 안 됨");
});

// ─── 10. lesson() explanation 문자열 ────────────────────
test("10. lesson() explanation 문자열", () => {
  const tutor = new FLTutor();
  const result = tutor.lesson("lambda");
  assert(typeof result.explanation === "string", "explanation은 문자열");
  assert(result.explanation.length > 0, "explanation 비어있으면 안 됨");
});

// ─── 11. lesson() exercise 포함 ─────────────────────────
test("11. lesson() exercise 포함", () => {
  const tutor = new FLTutor();
  const result = tutor.lesson("let");
  assert(typeof result.exercise === "string", "exercise는 문자열");
  assert(result.exercise.length > 0, "exercise 비어있으면 안 됨");
});

// ─── 12. lesson() concept 없음 → 빈 examples ────────────
test("12. lesson() concept 없음 → 빈 examples", () => {
  const tutor = new FLTutor();
  const result = tutor.lesson("xyznotexists");
  assert(Array.isArray(result.examples), "examples는 배열");
  assertEqual(result.examples.length, 0, "없는 개념은 빈 examples");
});

// ─── 13. random() 예제 반환 ─────────────────────────────
test("13. random() 예제 반환", () => {
  const tutor = new FLTutor();
  const ex = tutor.random();
  assert(ex !== null && ex !== undefined, "random()은 null이면 안 됨");
  assert(typeof ex.concept === "string", "concept은 문자열");
  assert(typeof ex.code === "string", "code는 문자열");
});

// ─── 14. concepts() 중복 없음 ───────────────────────────
test("14. concepts() 중복 없음", () => {
  const tutor = new FLTutor();
  const concepts = tutor.concepts();
  const unique = new Set(concepts);
  assertEqual(concepts.length, unique.size, "중복 개념 없어야 함");
});

// ─── 15. concepts() 배열 반환 ───────────────────────────
test("15. concepts() 배열 반환", () => {
  const tutor = new FLTutor();
  const concepts = tutor.concepts();
  assert(Array.isArray(concepts), "concepts()는 배열");
  assert(concepts.length > 0, "개념 목록 비어있으면 안 됨");
});

// ─── 16. addExample() 추가 ───────────────────────────────
test("16. addExample() 추가", () => {
  const tutor = new FLTutor();
  const before = tutor.size();
  tutor.addExample({
    concept: "test-new",
    code: '(test-new "hello")',
    description: "테스트용 예제",
    difficulty: "beginner",
    tags: ["test"],
  });
  assertEqual(tutor.size(), before + 1, "size가 1 증가해야 함");
});

// ─── 17. size() 증가 확인 ───────────────────────────────
test("17. size() 증가 확인", () => {
  const tutor = new FLTutor();
  const s1 = tutor.size();
  tutor.addExample({
    concept: "size-test",
    code: "(size-test)",
    description: "크기 테스트",
    difficulty: "intermediate",
    tags: ["test"],
  });
  const s2 = tutor.size();
  assert(s2 > s1, "addExample 후 size가 증가해야 함");
});

// ─── 18. 'maybe' 예제 존재 ──────────────────────────────
test("18. 'maybe' 예제 존재", () => {
  const tutor = new FLTutor();
  const result = tutor.findByConcept("maybe");
  assert(result.length > 0, "maybe 예제 있어야 함");
  assert(result[0].code.includes("maybe"), "코드에 maybe 포함");
});

// ─── 19. 'COT' 예제 존재 ────────────────────────────────
test("19. 'COT' 예제 존재", () => {
  const tutor = new FLTutor();
  const result = tutor.findByConcept("COT");
  assert(result.length > 0, "COT 예제 있어야 함");
  assert(result[0].difficulty === "advanced", "COT는 advanced 난이도");
});

// ─── 20. 'AGENT' 예제 존재 ──────────────────────────────
test("20. 'AGENT' 예제 존재", () => {
  const tutor = new FLTutor();
  const result = tutor.findByConcept("AGENT");
  assert(result.length > 0, "AGENT 예제 있어야 함");
  assert(result[0].tags.includes("ai"), "AGENT는 ai 태그 포함");
});

// ─── 21. fl-learn 내장함수 ──────────────────────────────
test("21. fl-learn 내장함수", () => {
  const interp = new Interpreter();
  const result = run(interp, '(fl-learn "define")');
  assert(typeof result === "string", "fl-learn은 문자열 반환");
  assert(result.includes("define"), "결과에 'define' 포함");
});

// ─── 22. fl-examples 내장함수 ───────────────────────────
test("22. fl-examples 내장함수", () => {
  const interp = new Interpreter();
  const result = run(interp, '(fl-examples "ai")');
  assert(typeof result === "string", "fl-examples는 문자열 반환");
  assert(result.length > 0, "결과가 비어있으면 안 됨");
});

// ─── 23. fl-example-count 내장함수 ─────────────────────
test("23. fl-example-count 내장함수", () => {
  const interp = new Interpreter();
  const result = run(interp, "(fl-example-count)");
  assert(typeof result === "number", "fl-example-count는 숫자 반환");
  assert(result >= 15, `예제 수 15 이상이어야 함: ${result}`);
});

// ─── 24. fl-concepts 내장함수 ───────────────────────────
test("24. fl-concepts 내장함수", () => {
  const interp = new Interpreter();
  const result = run(interp, "(fl-concepts)");
  assert(typeof result === "string", "fl-concepts는 문자열 반환");
  assert(result.includes("define"), "결과에 'define' 포함");
  assert(result.includes("lambda"), "결과에 'lambda' 포함");
});

// ─── 25. 통합: findByTag → lesson → exercise ────────────
test("25. 통합: findByTag → lesson → exercise", () => {
  const tutor = new FLTutor();
  // function 태그로 찾기 ($변수가 있는 예제를 찾음)
  const fnExamples = tutor.findByTag("function");
  assert(fnExamples.length > 0, "function 태그 예제 있어야 함");
  // lambda 개념의 code에는 $x, $y 변수가 있으므로 ??? 치환이 됨
  const lambdaEx = fnExamples.find(e => e.concept === "lambda");
  assert(lambdaEx !== undefined, "lambda 예제 있어야 함");
  const lessonResult = tutor.lesson("lambda");
  assert(lessonResult.concept === "lambda", "레슨 concept 일치해야 함");
  assert(lessonResult.exercise.length > 0, "exercise 비어있으면 안 됨");
  assert(lessonResult.examples.length > 0, "examples 비어있으면 안 됨");
  // exercise에 '???' 포함 (변수 $x, $y → ???)
  assert(lessonResult.exercise.includes("???"), "exercise에 ??? 플레이스홀더 포함");
});

// ─── 보너스: globalTutor 싱글톤 ─────────────────────────
test("26. globalTutor 싱글톤 검증", () => {
  assert(globalTutor instanceof FLTutor, "globalTutor는 FLTutor 인스턴스");
  assert(globalTutor.size() >= 15, "globalTutor에 15개 이상 예제");
});

// ─── 보너스: lessonMarkdown ──────────────────────────────
test("27. lessonMarkdown() 마크다운 형식", () => {
  const tutor = new FLTutor();
  const md = tutor.lessonMarkdown("lambda");
  assert(md.includes("# FreeLang 레슨"), "마크다운 헤더 포함");
  assert(md.includes("```"), "코드 블록 포함");
});

// ─── 보너스: findByDifficulty('intermediate') ───────────
test("28. findByDifficulty('intermediate')", () => {
  const tutor = new FLTutor();
  const result = tutor.findByDifficulty("intermediate");
  assert(result.length > 0, "intermediate 예제 있어야 함");
  assert(result.every(e => e.difficulty === "intermediate"), "모두 intermediate여야 함");
});

// ─── 보너스: 'REFLECT' 예제 존재 ────────────────────────
test("29. 'REFLECT' 예제 존재", () => {
  const tutor = new FLTutor();
  const result = tutor.findByConcept("REFLECT");
  assert(result.length > 0, "REFLECT 예제 있어야 함");
  assert(result[0].tags.includes("reflect"), "reflect 태그 포함");
});

// ─── 보너스: fl-learn 마크다운 헤더 ────────────────────
test("30. fl-learn 마크다운 헤더 포함", () => {
  const interp = new Interpreter();
  const result = run(interp, '(fl-learn "COT")');
  assert(typeof result === "string", "문자열 반환");
  assert(result.includes("COT"), "COT 내용 포함");
});

// ─── 결과 ───────────────────────────────────────────────
console.log(`\n=== 결과: ${passed}/${passed + failed} PASS ===`);
if (failed > 0) {
  console.log(`❌ ${failed}개 실패`);
  process.exit(1);
} else {
  console.log("✅ 모든 테스트 통과!");
}
