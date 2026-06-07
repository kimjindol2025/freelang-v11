// test-phase117-analogy.ts — FreeLang v9 Phase 117: ANALOGY 유사 패턴 추론 블록

import { AnalogyStore, globalAnalogy, similarity, Pattern } from "./analogy";
import { Interpreter } from "./interpreter";

let pass = 0;
let fail = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`  PASS  ${name}`);
      pass++;
    } else {
      console.log(`  FAIL  ${name}`);
      fail++;
    }
  } catch (e: any) {
    console.log(`  FAIL  ${name} — ${e.message}`);
    fail++;
  }
}

// ─── AnalogyStore 단위 테스트 ─────────────────────────────────────────────────

console.log("\n=== Phase 117: AnalogyStore ===");

// 1. AnalogyStore 생성
test("1. AnalogyStore 생성", () => {
  const store = new AnalogyStore();
  return store instanceof AnalogyStore;
});

// 2. store() 패턴 저장
test("2. store() 패턴 저장", () => {
  const store = new AnalogyStore();
  const p = store.store("retry on timeout", "exponential backoff", ["retry", "timeout"]);
  return p.id !== undefined && p.description === "retry on timeout";
});

// 3. size() 증가
test("3. size() 증가", () => {
  const store = new AnalogyStore();
  store.store("sort a list", "quicksort", ["sort"]);
  store.store("find duplicates", "use a Set", ["set"]);
  return store.size() === 2;
});

// 4. find() 유사 패턴 반환
test("4. find() 유사 패턴 반환", () => {
  const store = new AnalogyStore();
  store.store("retry on timeout error", "exponential backoff", []);
  const results = store.find("retry timeout");
  return results.length > 0;
});

// 5. find() 매칭 없음 → []
test("5. find() 매칭 없음 → []", () => {
  const store = new AnalogyStore();
  store.store("sort a list", "quicksort", []);
  const results = store.find("completely unrelated xyz");
  return results.length === 0;
});

// 6. find() topK 제한
test("6. find() topK 제한", () => {
  const store = new AnalogyStore();
  store.store("sort list of numbers", "quicksort", []);
  store.store("sort list alphabetically", "merge sort", []);
  store.store("sort list by key", "timsort", []);
  store.store("sort list descending", "heapsort", []);
  const results = store.find("sort list", 2);
  return results.length <= 2;
});

// 7. find() 점수 기준 정렬 (더 유사한 것이 앞)
test("7. find() 점수 기준 정렬", () => {
  const store = new AnalogyStore();
  store.store("cache frequent database queries", "LRU cache", []);
  store.store("retry failed network requests", "exponential backoff", []);
  const results = store.find("cache queries in database");
  if (results.length === 0) return false;
  // 첫 번째가 cache 관련이어야 함
  return results[0].description.includes("cache");
});

// 8. best() 최고 유사 패턴
test("8. best() 최고 유사 패턴", () => {
  const store = new AnalogyStore();
  store.store("validate user input form", "schema validation", []);
  const p = store.best("validate input form data");
  return p !== null && p.solution === "schema validation";
});

// 9. best() 없음 → null
test("9. best() 없음 → null", () => {
  const store = new AnalogyStore();
  store.store("handle user login", "JWT token", []);
  const p = store.best("completely different xyz abc");
  return p === null;
});

// 10. best() useCount 증가
test("10. best() useCount 증가", () => {
  const store = new AnalogyStore();
  store.store("parse JSON data stream", "streaming parser", []);
  store.best("parse JSON stream");
  store.best("parse JSON stream");
  const patterns = store.all();
  // 해당 패턴의 useCount가 증가했어야 함
  return patterns.some(p => p.useCount >= 1);
});

// 11. byTag() 태그 검색
test("11. byTag() 태그 검색", () => {
  const store = new AnalogyStore();
  store.store("retry on failure", "exponential backoff", ["retry", "reliability"]);
  store.store("cache results", "LRU cache", ["cache", "performance"]);
  const results = store.byTag("retry");
  return results.length === 1 && results[0].description === "retry on failure";
});

// 12. byTag() 없는 태그 → []
test("12. byTag() 없는 태그 → []", () => {
  const store = new AnalogyStore();
  store.store("test pattern", "solution", ["tag1"]);
  return store.byTag("nonexistent-tag").length === 0;
});

// 13. popular() 자주 쓰인 것
test("13. popular() 자주 쓰인 것", () => {
  const store = new AnalogyStore();
  store.store("sort list items", "quicksort", []);
  store.store("find in list", "binary search", []);
  // best()로 find 패턴 useCount 올리기
  store.best("find item in sorted list");
  store.best("find element in list");
  const popular = store.popular(1);
  return popular.length === 1;
});

// 14. all() 전체
test("14. all() 전체", () => {
  const store = new AnalogyStore();
  store.store("pattern A", "sol A", []);
  store.store("pattern B", "sol B", []);
  store.store("pattern C", "sol C", []);
  return store.all().length === 3;
});

// ─── similarity 함수 ───────────────────────────────────────────────────────────

console.log("\n=== similarity 함수 ===");

// 15. similarity 텍스트 겹침
test("15. similarity 텍스트 겹침", () => {
  const score = similarity("retry on timeout", "retry timeout handling");
  return score > 0;
});

// 16. similarity 동일 문자열 → 최대
test("16. similarity 동일 문자열 → 1.0", () => {
  const score = similarity("sort a list", "sort a list");
  return score === 1.0;
});

// 17. similarity 완전 다른 텍스트 → 0
test("17. similarity 완전 다른 텍스트 → 0", () => {
  const score = similarity("apple orange banana", "retry network timeout");
  return score === 0;
});

// ─── tags 가중치 ───────────────────────────────────────────────────────────────

console.log("\n=== Tags 가중치 ===");

// 18. tags 가중치 적용 (태그 포함 시 점수 추가)
test("18. tags 가중치 적용", () => {
  const store = new AnalogyStore();
  // 태그 없는 패턴
  store.store("handle errors gracefully", "try-catch", []);
  // 태그 있는 패턴 (problem에 'error' 포함 시 가중치)
  store.store("log system events", "structured logging", ["error", "log"]);
  const results = store.find("error handling in system");
  // 두 번째 패턴이 태그 'error'로 점수 추가되어야 함
  return results.length > 0;
});

// ─── globalAnalogy 싱글톤 ─────────────────────────────────────────────────────

console.log("\n=== globalAnalogy 싱글톤 ===");

// 19. globalAnalogy 싱글톤
test("19. globalAnalogy 싱글톤", () => {
  const sizeBefore = globalAnalogy.size();
  globalAnalogy.store("singleton test pattern", "singleton solution", []);
  return globalAnalogy.size() === sizeBefore + 1;
});

// ─── 내장 함수 (Interpreter) ──────────────────────────────────────────────────

console.log("\n=== 내장 함수 테스트 ===");

function evalStr(interp: Interpreter, code: string): any {
  const ctx = interp.run(code);
  return ctx.lastValue;
}

const interp = new Interpreter();

// 20. analogy-store 내장함수
test("20. analogy-store 내장함수", () => {
  const id = evalStr(interp, `(analogy-store "cache database results" "LRU cache")`);
  return typeof id === "string" && id.startsWith("pattern-");
});

// 21. analogy-find 내장함수
test("21. analogy-find 내장함수", () => {
  evalStr(interp, `(analogy-store "sort array of numbers" "quicksort")`);
  const results = evalStr(interp, `(analogy-find "sort numbers array" 5)`);
  return Array.isArray(results) && results.length > 0;
});

// 22. analogy-best 내장함수
test("22. analogy-best 내장함수", () => {
  evalStr(interp, `(analogy-store "validate user input schema" "schema validation")`);
  const sol = evalStr(interp, `(analogy-best "validate user input")`);
  return sol !== null && typeof sol === "string";
});

// 23. analogy-by-tag 내장함수
test("23. analogy-by-tag 내장함수", () => {
  evalStr(interp, `(analogy-store "retry failed requests" "backoff" (list "retry-tag-unique"))`);
  const results = evalStr(interp, `(analogy-by-tag "retry-tag-unique")`);
  return Array.isArray(results) && results.length >= 1;
});

// 24. analogy-popular 내장함수
test("24. analogy-popular 내장함수", () => {
  evalStr(interp, `(analogy-store "popular pattern test" "solution-pop")`);
  const results = evalStr(interp, `(analogy-popular 5)`);
  return Array.isArray(results);
});

// ─── id 자동 생성 / 중복 저장 ─────────────────────────────────────────────────

console.log("\n=== id 자동 생성 / 중복 저장 ===");

// 25. id 자동 생성 (패턴마다 고유 id)
test("25. id 자동 생성 (고유 id)", () => {
  const store = new AnalogyStore();
  const p1 = store.store("pattern one", "sol1", []);
  const p2 = store.store("pattern two", "sol2", []);
  return p1.id !== p2.id;
});

// 26. 동일 패턴 중복 저장 가능
test("26. 동일 패턴 중복 저장 가능", () => {
  const store = new AnalogyStore();
  store.store("same description", "sol1", []);
  store.store("same description", "sol2", []);
  return store.size() === 2;
});

// ─── 통합 시나리오 ────────────────────────────────────────────────────────────

console.log("\n=== 통합 시나리오 ===");

// 27. 통합: store → find → best → popular
test("27. 통합: store → find → best → popular", () => {
  const store = new AnalogyStore();
  store.store("handle network timeout error", "retry with backoff", ["retry", "network"]);
  store.store("cache expensive computation result", "memoization", ["cache", "performance"]);
  store.store("validate incoming request data", "schema validation", ["validate"]);

  const found = store.find("network timeout retry");
  if (found.length === 0) return false;

  const best = store.best("network timeout retry");
  if (!best) return false;

  const pop = store.popular(2);
  return pop.length <= 2 && best.description.includes("network");
});

// 28. find() 여러 패턴 정렬 정확도
test("28. find() 여러 패턴 정렬 정확도", () => {
  const store = new AnalogyStore();
  store.store("sort list ascending order", "mergesort", []);
  store.store("cache frequent lookup results", "LRU", []);
  store.store("sort list of items by value", "quicksort", []);
  const results = store.find("sort list", 3);
  // 결과가 있고, sort 관련 패턴들이 앞에 와야 함
  return results.length >= 1 && results[0].description.includes("sort");
});

// 29. best() 없는 경우 null 안전
test("29. best() 없는 경우 null 안전", () => {
  const store = new AnalogyStore();
  // 저장 없이 best() 호출
  const result = store.best("some problem");
  return result === null;
});

// 30. 복합 tags 검색
test("30. 복합 tags 검색", () => {
  const store = new AnalogyStore();
  store.store("rate limit API requests", "token bucket", ["rate-limit", "api", "throttle"]);
  store.store("queue background jobs", "priority queue", ["queue", "async"]);
  const byRL = store.byTag("rate-limit");
  const byQ = store.byTag("queue");
  return byRL.length === 1 && byQ.length === 1 && byRL[0].description !== byQ[0].description;
});

// ─── 결과 요약 ───────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 117 결과: ${pass} PASS / ${fail} FAIL`);
if (fail === 0) {
  console.log("모든 테스트 통과!");
} else {
  console.log(`${fail}개 실패`);
  process.exit(1);
}
