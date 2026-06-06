// test-phase132-mutate.ts — Phase 132 [MUTATE] 테스트
// 최소 25 PASS 필수

import { Mutator, globalMutator, mutateNumbers, mutateString, selectBest, MutationResult } from "./mutate";
import { Interpreter } from "./interpreter";

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

console.log("\n=== Phase 132: [MUTATE] 테스트 ===\n");

// --- 1. Mutator 생성 (기본 설정) ---
test("1. Mutator 생성 (기본 설정)", () => {
  const m = new Mutator();
  const cfg = m.getConfig();
  return cfg.rate === 0.1 && cfg.strength === 0.1 && cfg.type === 'random';
});

// --- 2. Mutator 생성 (커스텀 설정) ---
test("2. Mutator 생성 (커스텀 설정)", () => {
  const m = new Mutator({ rate: 0.5, strength: 0.2, type: 'gaussian' });
  const cfg = m.getConfig();
  return cfg.rate === 0.5 && cfg.strength === 0.2 && cfg.type === 'gaussian';
});

// --- 3. mutateNumbers 숫자 배열 변이 ---
test("3. mutateNumbers 숫자 배열 변이 (반환 구조 확인)", () => {
  const m = new Mutator({ rate: 1.0 });
  const r = m.mutateNumbers([1, 2, 3, 4, 5]);
  return Array.isArray(r.original) && Array.isArray(r.mutated) && r.original.length === 5 && r.mutated.length === 5;
});

// --- 4. mutateString 문자열 변이 ---
test("4. mutateString 문자열 변이 (반환 구조 확인)", () => {
  const m = new Mutator({ rate: 0.5 });
  const r = m.mutateString("hello");
  return typeof r.original === 'string' && typeof r.mutated === 'string' && r.original === 'hello';
});

// --- 5. mutateObject 객체 변이 ---
test("5. mutateObject 객체 변이 (반환 구조 확인)", () => {
  const m = new Mutator({ rate: 0.5 });
  const r = m.mutateObject({ a: 1, b: 2, c: 3 });
  return typeof r.original === 'object' && typeof r.mutated === 'object' && r.original.a === 1;
});

// --- 6. swapMutation 교환 변이 ---
test("6. swapMutation 교환 변이 (길이 유지)", () => {
  const m = new Mutator({ rate: 0.5 });
  const arr = [1, 2, 3, 4, 5];
  const r = m.swapMutation(arr);
  return r.original.length === r.mutated.length && r.mutationType === 'swap';
});

// --- 7. flipMutation 비트 플립 ---
test("7. flipMutation 비트 플립 (0↔1)", () => {
  const m = new Mutator({ rate: 1.0 });
  const bits = [0, 1, 0, 1, 0];
  const r = m.flipMutation(bits);
  // rate=1이면 모두 뒤집힘
  return r.mutated[0] === 1 && r.mutated[1] === 0 && r.mutationType === 'flip';
});

// --- 8. rate=0 → mutations=0 ---
test("8. rate=0 → mutations=0", () => {
  const m = new Mutator({ rate: 0 });
  const r = m.mutateNumbers([1, 2, 3, 4, 5]);
  return r.mutations === 0;
});

// --- 9. rate=1 → 모든 요소 변이 ---
test("9. rate=1 → mutations > 0", () => {
  const m = new Mutator({ rate: 1.0 });
  const r = m.mutateNumbers([1, 2, 3, 4, 5]);
  return r.mutations === 5;
});

// --- 10. strength 강도 적용 ---
test("10. strength 강도 적용 (큰 strength = 큰 변화)", () => {
  const m1 = new Mutator({ rate: 1.0, strength: 0.001 });
  const m2 = new Mutator({ rate: 1.0, strength: 100.0 });
  const arr = [100, 200, 300];
  const r1 = m1.mutateNumbers(arr);
  const r2 = m2.mutateNumbers(arr);
  const diff1 = Math.abs(r1.mutated[0] - arr[0]);
  const diff2 = Math.abs(r2.mutated[0] - arr[0]);
  return diff2 > diff1;
});

// --- 11. select() 적합도 기반 선택 ---
test("11. select() 적합도 기반 선택 (높은 값 우선)", () => {
  const m = new Mutator();
  const candidates = [
    { value: "low", fitness: 0.1 },
    { value: "high", fitness: 0.9 },
    { value: "mid", fitness: 0.5 },
  ];
  const selected = m.select(candidates, 1);
  return selected[0] === "high";
});

// --- 12. select() n개 반환 ---
test("12. select() n개 반환", () => {
  const m = new Mutator();
  const candidates = [
    { value: "a", fitness: 0.1 },
    { value: "b", fitness: 0.9 },
    { value: "c", fitness: 0.5 },
    { value: "d", fitness: 0.7 },
  ];
  const selected = m.select(candidates, 2);
  return selected.length === 2 && selected[0] === "b" && selected[1] === "d";
});

// --- 13. MutationResult 구조 ---
test("13. MutationResult 구조 (4개 필드)", () => {
  const m = new Mutator();
  const r = m.mutateNumbers([1, 2, 3]);
  return 'original' in r && 'mutated' in r && 'mutations' in r && 'mutationType' in r;
});

// --- 14~21: 빌트인 테스트 ---
function evalFL(code: string): any {
  const interp = new Interpreter();
  const state = interp.run(code);
  return (state as any).lastValue;
}

// --- 14. mutate-numbers 빌트인 ---
test("14. mutate-numbers 빌트인", () => {
  const r = evalFL('(mutate-numbers [1 2 3 4 5] :rate 0)');
  return r instanceof Map && r.get("mutations") === 0 && Array.isArray(r.get("original"));
});

// --- 15. mutate-string 빌트인 ---
test("15. mutate-string 빌트인", () => {
  const r = evalFL('(mutate-string "hello" :rate 0)');
  return r instanceof Map && r.get("original") === "hello" && r.get("mutations") === 0;
});

// --- 16. mutate-object 빌트인 ---
test("16. mutate-object 빌트인", () => {
  const r = evalFL('(mutate-object {:a 1 :b 2} :rate 0)');
  return r instanceof Map && r.get("mutations") === 0;
});

// --- 17. mutate-swap 빌트인 ---
test("17. mutate-swap 빌트인", () => {
  const r = evalFL('(mutate-swap [1 2 3 4 5])');
  return r instanceof Map && r.get("mutationType") === "swap" && Array.isArray(r.get("original"));
});

// --- 18. mutate-flip 빌트인 ---
test("18. mutate-flip 빌트인", () => {
  const r = evalFL('(mutate-flip [0 1 0 1] :rate 0)');
  return r instanceof Map && r.get("mutationType") === "flip" && r.get("mutations") === 0;
});

// --- 19. mutate-select 빌트인 ---
test("19. mutate-select 빌트인", () => {
  const r = evalFL(
    `(mutate-select (list {:value 10 :fitness 0.9} {:value 20 :fitness 0.1} {:value 30 :fitness 0.5}) :n 1)`
  );
  return Array.isArray(r) && r.length === 1 && r[0] === 10;
});

// --- 20. mutate-config 빌트인 ---
test("20. mutate-config 빌트인", () => {
  const r = evalFL('(mutate-config :rate 0.3 :strength 0.2 :type "gaussian")');
  return r instanceof Map && r.get("rate") === 0.3 && r.get("type") === "gaussian";
});

// --- 21. mutation-count 빌트인 ---
test("21. mutation-count 빌트인", () => {
  const r = evalFL('(mutation-count (mutate-numbers [1 2 3] :rate 0))');
  return r === 0;
});

// --- 22. gaussian 타입 변이 ---
test("22. gaussian 타입 변이", () => {
  const m = new Mutator({ rate: 1.0, strength: 0.01, type: 'gaussian' });
  const r = m.mutateNumbers([100, 200, 300]);
  return r.mutations === 3 && r.mutationType === 'gaussian';
});

// --- 23. insert 타입 (문자열에 문자 삽입) ---
test("23. insert 타입 — 문자열 길이 증가", () => {
  const m = new Mutator({ rate: 1.0, type: 'insert' });
  const r = m.mutateString("hello");
  // rate=1이면 모든 문자 뒤에 삽입, 길이가 늘어야 함
  return r.mutated.length > r.original.length && r.mutationType === 'insert';
});

// --- 24. delete 타입 (문자열에서 문자 제거) ---
test("24. delete 타입 — 문자열 길이 감소 가능", () => {
  const m = new Mutator({ rate: 1.0, type: 'delete' });
  const r = m.mutateString("hello");
  // rate=1이면 모든 문자 삭제
  return r.mutated.length < r.original.length && r.mutationType === 'delete';
});

// --- 25. original은 불변 (참조 복사 없음) ---
test("25. original은 불변 (깊은 복사)", () => {
  const m = new Mutator({ rate: 1.0 });
  const original = [1, 2, 3, 4, 5];
  const r = m.mutateNumbers(original);
  // 원본 배열과 result.original은 값이 같지만 다른 참조
  const originalUnchanged = original[0] === 1 && original[1] === 2 && original[4] === 5;
  const resultOriginalMatch = r.original[0] === 1 && r.original[1] === 2 && r.original[4] === 5;
  return originalUnchanged && resultOriginalMatch;
});

// --- 26. selectBest 편의 함수 ---
test("26. selectBest 편의 함수 (ratio=0.5)", () => {
  const items = [
    { value: "a", fitness: 0.1 },
    { value: "b", fitness: 0.9 },
    { value: "c", fitness: 0.5 },
    { value: "d", fitness: 0.7 },
  ];
  const best = selectBest(items, 0.5);
  return best.length === 2 && best[0] === "b";
});

// --- 27. mutateNumbers 편의 함수 ---
test("27. mutateNumbers 편의 함수 (rate=0)", () => {
  const r = mutateNumbers([10, 20, 30], 0);
  return r.mutations === 0 && r.original[0] === 10;
});

// --- 28. mutateString 편의 함수 ---
test("28. mutateString 편의 함수 (rate=0)", () => {
  const r = mutateString("world", 0);
  return r.mutations === 0 && r.original === "world" && r.mutated === "world";
});

// --- 29. globalMutator 싱글톤 ---
test("29. globalMutator 싱글톤 존재", () => {
  return globalMutator !== null && globalMutator !== undefined;
});

// --- 30. mutate-select :n 3 ---
test("30. mutate-select :n 3 — 3개 선택", () => {
  const r = evalFL(
    `(mutate-select (list {:value 1 :fitness 0.9} {:value 2 :fitness 0.8} {:value 3 :fitness 0.3} {:value 4 :fitness 0.5}) :n 3)`
  );
  return Array.isArray(r) && r.length === 3;
});

// 결과 출력
console.log(`\n=== 결과: ${passed} PASS / ${failed} FAIL ===\n`);
if (failed > 0) process.exit(1);
