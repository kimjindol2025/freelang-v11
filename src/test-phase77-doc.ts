// FreeLang v9: Phase 77 — 문서 생성기 테스트
// npx ts-node src/test-phase77-doc.ts

import { extractDocs, DocEntry } from "./doc-extractor";
import { renderMarkdown, renderSummary } from "./doc-renderer";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 160)}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${msg ?? "assertEqual 실패"}\n    actual  : ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`
    );
  }
}

function assertContains(haystack: string, needle: string, msg?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${msg ?? "assertContains 실패"}: "${needle}" not found in output (len=${haystack.length})`
    );
  }
}

function assertLength(arr: any[], n: number, msg?: string): void {
  if (arr.length !== n) {
    throw new Error(
      `${msg ?? "assertLength 실패"}: expected length ${n}, got ${arr.length}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// TC-1: 주석 없는 FUNC 추출 (name, params 확인)
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-1] 주석 없는 FUNC 추출");
test("TC-1-1: name 확인", () => {
  const src = `[FUNC square :params [$x] :body (* $x $x)]`;
  const entries = extractDocs(src);
  assertLength(entries, 1, "엔트리 1개");
  assertEqual(entries[0].name, "square");
});

test("TC-1-2: params 확인", () => {
  const src = `[FUNC square :params [$x] :body (* $x $x)]`;
  const entries = extractDocs(src);
  assertLength(entries[0].params, 1, "파라미터 1개");
  assertEqual(entries[0].params[0], "x");
});

test("TC-1-3: kind = function", () => {
  const src = `[FUNC square :params [$x] :body (* $x $x)]`;
  const entries = extractDocs(src);
  assertEqual(entries[0].kind, "function");
});

// ─────────────────────────────────────────────────────────────
// TC-2: ;;; 주석이 doc으로 연결
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-2] ;;; 주석 연결");
test("TC-2-1: doc 추출", () => {
  const src = `;;; x를 제곱합니다.\n[FUNC square :params [$x] :body (* $x $x)]`;
  const entries = extractDocs(src);
  assertEqual(entries[0].doc, "x를 제곱합니다.");
});

test("TC-2-2: 여러 줄 ;;; 주석", () => {
  const src = `;;; 첫 번째 줄\n;;; 두 번째 줄\n[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  assertContains(entries[0].doc, "첫 번째 줄");
  assertContains(entries[0].doc, "두 번째 줄");
});

// ─────────────────────────────────────────────────────────────
// TC-3: ;;; @example 파싱
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-3] @example 파싱");
test("TC-3-1: 예제 추출", () => {
  const src = `;;; 두 수를 더합니다.\n;;; @example (add 1 2) ; => 3\n[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  assertLength(entries[0].examples, 1, "예제 1개");
  assertContains(entries[0].examples[0], "(add 1 2)");
});

test("TC-3-2: doc에는 @example 이후 내용 미포함", () => {
  const src = `;;; 두 수를 더합니다.\n;;; @example (add 1 2)\n[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  assertEqual(entries[0].doc, "두 수를 더합니다.");
});

// ─────────────────────────────────────────────────────────────
// TC-4: 여러 함수 추출
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-4] 여러 함수 추출");
test("TC-4-1: 2개 함수 추출", () => {
  const src = `[FUNC square :params [$x] :body (* $x $x)]\n[FUNC cube :params [$x] :body (* $x $x $x)]`;
  const entries = extractDocs(src);
  assertLength(entries, 2, "2개 엔트리");
});

test("TC-4-2: 각 이름 확인", () => {
  const src = `[FUNC square :params [$x] :body (* $x $x)]\n[FUNC cube :params [$x] :body (* $x $x $x)]`;
  const entries = extractDocs(src);
  assertEqual(entries[0].name, "square");
  assertEqual(entries[1].name, "cube");
});

// ─────────────────────────────────────────────────────────────
// TC-5: defmacro 추출
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-5] defmacro 추출");
test("TC-5-1: defmacro name", () => {
  const src = `;;; when 매크로\n(defmacro when [$cond $body] (if $cond $body nil))`;
  const entries = extractDocs(src);
  assertLength(entries, 1, "1개 엔트리");
  assertEqual(entries[0].name, "when");
});

test("TC-5-2: defmacro kind", () => {
  const src = `(defmacro when [$cond $body] (if $cond $body nil))`;
  const entries = extractDocs(src);
  assertEqual(entries[0].kind, "macro");
});

test("TC-5-3: defmacro params", () => {
  const src = `(defmacro when [$cond $body] (if $cond $body nil))`;
  const entries = extractDocs(src);
  assertEqual(entries[0].params.join(","), "cond,body");
});

// ─────────────────────────────────────────────────────────────
// TC-6: defstruct 추출
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-6] defstruct 추출");
test("TC-6-1: defstruct name", () => {
  const src = `;;; 2D 좌표\n(defstruct Point [:x :float :y :float])`;
  const entries = extractDocs(src);
  assertEqual(entries[0].name, "Point");
});

test("TC-6-2: defstruct kind", () => {
  const src = `(defstruct Point [:x :float :y :float])`;
  const entries = extractDocs(src);
  assertEqual(entries[0].kind, "struct");
});

test("TC-6-3: defstruct fields as params", () => {
  const src = `(defstruct Point [:x :float :y :float])`;
  const entries = extractDocs(src);
  assertEqual(entries[0].params.join(","), "x,float,y,float");
});

// ─────────────────────────────────────────────────────────────
// TC-7: defprotocol 추출
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-7] defprotocol 추출");
test("TC-7-1: defprotocol name", () => {
  const src = `;;; 직렬화 프로토콜\n(defprotocol Serializable\n  (serialize [$self])\n  (deserialize [$data]))`;
  const entries = extractDocs(src);
  assertEqual(entries[0].name, "Serializable");
});

test("TC-7-2: defprotocol kind", () => {
  const src = `(defprotocol Serializable\n  (serialize [$self]))`;
  const entries = extractDocs(src);
  assertEqual(entries[0].kind, "protocol");
});

// ─────────────────────────────────────────────────────────────
// TC-8: renderMarkdown 출력 확인
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-8] renderMarkdown 출력");
test("TC-8-1: ## 제목 포함", () => {
  const src = `;;; 두 수를 더합니다.\n[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  const md = renderMarkdown(entries, "테스트 API");
  assertContains(md, "# 테스트 API");
});

test("TC-8-2: 목차 포함", () => {
  const src = `[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  const md = renderMarkdown(entries);
  assertContains(md, "## 목차");
});

test("TC-8-3: 함수 섹션 포함", () => {
  const src = `[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  const md = renderMarkdown(entries);
  assertContains(md, "## add");
});

// ─────────────────────────────────────────────────────────────
// TC-9: 파라미터 테이블 렌더링
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-9] 파라미터 테이블");
test("TC-9-1: 파라미터 테이블 헤더", () => {
  const src = `[FUNC clamp :params [$x $lo $hi] :body $x]`;
  const entries = extractDocs(src);
  const md = renderMarkdown(entries);
  assertContains(md, "| 이름 | 설명 |");
});

test("TC-9-2: 파라미터 항목", () => {
  const src = `[FUNC clamp :params [$x $lo $hi] :body $x]`;
  const entries = extractDocs(src);
  const md = renderMarkdown(entries);
  assertContains(md, "| `x` |");
  assertContains(md, "| `lo` |");
  assertContains(md, "| `hi` |");
});

// ─────────────────────────────────────────────────────────────
// TC-10: 예제 코드 블록 렌더링
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-10] 예제 코드 블록");
test("TC-10-1: 코드 블록 포함", () => {
  const src = `;;; @example (add 1 2)\n[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  const md = renderMarkdown(entries);
  assertContains(md, "```freelang");
  assertContains(md, "(add 1 2)");
});

// ─────────────────────────────────────────────────────────────
// TC-11: renderSummary 한 줄 목록
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-11] renderSummary");
test("TC-11-1: 함수 목록 한 줄", () => {
  const src = `;;; 더하기\n[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  const summary = renderSummary(entries);
  assertContains(summary, "**add**");
  assertContains(summary, "더하기");
});

test("TC-11-2: 빈 목록 처리", () => {
  const summary = renderSummary([]);
  assertContains(summary, "항목 없음");
});

// ─────────────────────────────────────────────────────────────
// TC-12: 빈 소스 처리
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-12] 빈 소스");
test("TC-12-1: 빈 소스 → 빈 배열", () => {
  const entries = extractDocs("");
  assertLength(entries, 0, "빈 배열");
});

test("TC-12-2: 주석만 있는 소스 → 빈 배열", () => {
  const entries = extractDocs("; 일반 주석\n;;; doc 주석");
  assertLength(entries, 0, "빈 배열");
});

// ─────────────────────────────────────────────────────────────
// TC-13: MODULE 블록 내 함수 추출
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-13] MODULE 내 함수");
test("TC-13-1: MODULE 내 FUNC 추출", () => {
  const src = `[MODULE math :exports [square cube] :body [\n  [FUNC square :params [$x] :body (* $x $x)]\n  [FUNC cube :params [$x] :body (* $x $x $x)]\n]]`;
  const entries = extractDocs(src);
  const names = entries.map((e) => e.name);
  // square, cube 둘 다 포함
  if (!names.includes("square") && !names.includes("cube")) {
    throw new Error(`MODULE 내 함수 추출 실패: ${JSON.stringify(names)}`);
  }
});

// ─────────────────────────────────────────────────────────────
// TC-14: 파라미터 없는 함수
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-14] 파라미터 없는 함수");
test("TC-14-1: 파라미터 없는 FUNC", () => {
  const src = `[FUNC get-pi :params [] :body 3.14159]`;
  const entries = extractDocs(src);
  assertLength(entries[0].params, 0, "파라미터 0개");
});

test("TC-14-2: 파라미터 없는 함수 renderMarkdown", () => {
  const src = `[FUNC get-pi :params [] :body 3.14159]`;
  const entries = extractDocs(src);
  const md = renderMarkdown(entries);
  assertContains(md, "파라미터 없음");
});

// ─────────────────────────────────────────────────────────────
// TC-15: 긴 주석 처리
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-15] 긴 주석");
test("TC-15-1: 5줄 주석", () => {
  const lines = [
    ";;; 이 함수는 두 수를 더합니다.",
    ";;; 정수와 실수 모두 지원합니다.",
    ";;; 오버플로우에 주의하세요.",
    ";;; 음수도 처리합니다.",
    ";;; 결과는 항상 숫자입니다.",
    "[FUNC add :params [$a $b] :body (+ $a $b)]",
  ];
  const entries = extractDocs(lines.join("\n"));
  const doc = entries[0].doc;
  assertContains(doc, "두 수를 더합니다");
  assertContains(doc, "결과는 항상 숫자입니다");
});

// ─────────────────────────────────────────────────────────────
// TC-16: 여러 @example
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-16] 여러 @example");
test("TC-16-1: @example 2개", () => {
  const src = [
    ";;; 두 수를 더합니다.",
    ";;; @example (add 1 2) ; => 3",
    ";;; @example (add -1 1) ; => 0",
    "[FUNC add :params [$a $b] :body (+ $a $b)]",
  ].join("\n");
  const entries = extractDocs(src);
  assertLength(entries[0].examples, 2, "예제 2개");
});

// ─────────────────────────────────────────────────────────────
// TC-17: source 필드 확인
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-17] source 스니펫");
test("TC-17-1: source에 FUNC 포함", () => {
  const src = `[FUNC square :params [$x] :body (* $x $x)]`;
  const entries = extractDocs(src);
  assertContains(entries[0].source, "[FUNC square");
});

// ─────────────────────────────────────────────────────────────
// TC-18: renderMarkdown 소스 섹션
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-18] 소스 섹션");
test("TC-18-1: 소스 섹션 포함", () => {
  const src = `[FUNC add :params [$a $b] :body (+ $a $b)]`;
  const entries = extractDocs(src);
  const md = renderMarkdown(entries);
  assertContains(md, "### 소스");
  assertContains(md, "[FUNC add");
});

// ─────────────────────────────────────────────────────────────
// TC-19: 여러 종류 혼합 추출
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-19] 혼합 추출");
test("TC-19-1: FUNC + defmacro 혼합", () => {
  const src = [
    "[FUNC add :params [$a $b] :body (+ $a $b)]",
    "(defmacro when [$cond $body] (if $cond $body nil))",
  ].join("\n");
  const entries = extractDocs(src);
  const kinds = entries.map((e) => e.kind);
  if (!kinds.includes("function") || !kinds.includes("macro")) {
    throw new Error(`혼합 추출 실패: ${JSON.stringify(kinds)}`);
  }
});

// ─────────────────────────────────────────────────────────────
// TC-20: renderMarkdown 빈 입력
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-20] renderMarkdown 빈 입력");
test("TC-20-1: 빈 entries renderMarkdown", () => {
  const md = renderMarkdown([], "빈 문서");
  assertContains(md, "# 빈 문서");
  assertContains(md, "항목 없음");
});

// ─────────────────────────────────────────────────────────────
// TC-21: defstruct doc 연결
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-21] defstruct doc 연결");
test("TC-21-1: defstruct doc", () => {
  const src = `;;; 2D 벡터\n(defstruct Vec2 [:x :float :y :float])`;
  const entries = extractDocs(src);
  assertEqual(entries[0].doc, "2D 벡터");
});

// ─────────────────────────────────────────────────────────────
// TC-22: renderSummary 다중 항목
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-22] renderSummary 다중");
test("TC-22-1: 여러 함수 summary", () => {
  const src = [
    ";;; 더하기\n[FUNC add :params [$a $b] :body (+ $a $b)]",
    ";;; 빼기\n[FUNC sub :params [$a $b] :body (- $a $b)]",
  ].join("\n");
  const entries = extractDocs(src);
  const summary = renderSummary(entries);
  assertContains(summary, "**add**");
  assertContains(summary, "**sub**");
});

// ─────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`[Phase 77] 결과: ${passed} PASS, ${failed} FAIL (총 ${passed + failed}개)`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("✅ 모든 테스트 통과!");
}
