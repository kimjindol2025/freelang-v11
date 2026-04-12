// FreeLang v9: Phase 70 — 이뮤터블 데이터 구조 테스트
// imm-map / imm-vec + 영속적 업데이트 함수 검증

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
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 160)}`);
    failed++;
  }
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runMulti(src: string): Interpreter {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp;
}

function getVar(interp: Interpreter, name: string): any {
  // FreeLang에서 define은 $name으로 저장됨 (Phase 56 패턴)
  const vars = (interp as any).context.variables;
  return vars.get("$" + name) ?? vars.get(name);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEqual(a: any, b: any) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`Expected ${sb}, got ${sa}`);
}

// ─── TC-1: imm-map 생성 + imm-get ────────────────────────────────
console.log("\n[TC-1] imm-map 생성 + imm-get");

test("imm-map {:a 1 :b 2} 생성", () => {
  const v = run(`(imm-map {:a 1 :b 2 :c 3})`);
  assert(v !== null && typeof v === "object", "맵이어야 함");
  assertEqual(v["a"], 1);
  assertEqual(v["b"], 2);
  assertEqual(v["c"], 3);
});

test("imm-get 키 조회 (콜론 키)", () => {
  const v = run(`
    (define m (imm-map {:x 10 :y 20}))
    (imm-get m :x)
  `);
  assertEqual(v, 10);
});

test("imm-get 존재하지 않는 키 → null", () => {
  const v = run(`
    (define m (imm-map {:a 1}))
    (imm-get m :z)
  `);
  assert(v === null || v === undefined, `null이어야 함, 받은 값: ${v}`);
});

test("imm? — 동결 여부 확인", () => {
  const v = run(`
    (define m (imm-map {:a 1}))
    (imm? m)
  `);
  assert(v === true, "frozen 맵은 imm?가 true여야 함");
});

// ─── TC-2: imm-assoc — 원본 불변, 새 맵 생성 ─────────────────────
console.log("\n[TC-2] imm-assoc — 원본 불변");

test("imm-assoc 새 키 추가 → 새 맵", () => {
  const interp = runMulti(`
    (define m (imm-map {:a 1 :b 2 :c 3}))
    (define m2 (imm-assoc m :d 4))
  `);
  const m = getVar(interp, "m");
  const m2 = getVar(interp, "m2");
  assert(m["d"] === undefined, "원본 m에 :d가 없어야 함");
  assertEqual(m2["d"], 4);
  assertEqual(Object.keys(m).length, 3);
  assertEqual(Object.keys(m2).length, 4);
});

test("imm-assoc 기존 키 업데이트 → 원본 불변", () => {
  const interp = runMulti(`
    (define m (imm-map {:a 1}))
    (define m2 (imm-assoc m :a 99))
  `);
  const m = getVar(interp, "m");
  const m2 = getVar(interp, "m2");
  assertEqual(m["a"], 1);
  assertEqual(m2["a"], 99);
});

test("imm-get m :d → nil (m은 여전히 3개)", () => {
  // m은 3개 키, m2는 4개 키. m에서 :d 조회 시 null
  const interp = runMulti(`
    (define m (imm-map {:a 1 :b 2 :c 3}))
    (define m2 (imm-assoc m :d 4))
    (define m2d (imm-get m2 :d))
  `);
  const m = getVar(interp, "m");
  const m2d = getVar(interp, "m2d");
  // m에 :d가 없음을 직접 JS에서 확인
  assert(m["d"] === undefined, `m에 d가 없어야 함, 받은: ${m["d"]}`);
  assertEqual(m2d, 4);
  assertEqual(Object.keys(m).length, 3);
});

// ─── TC-3: imm-dissoc ────────────────────────────────────────────
console.log("\n[TC-3] imm-dissoc");

test("imm-dissoc 키 제거 → 새 맵", () => {
  const interp = runMulti(`
    (define m (imm-map {:a 1 :b 2 :c 3}))
    (define m2 (imm-dissoc m :b))
  `);
  const m = getVar(interp, "m");
  const m2 = getVar(interp, "m2");
  assertEqual(Object.keys(m).length, 3);
  assertEqual(Object.keys(m2).length, 2);
  assert(m2["b"] === undefined, "m2에 :b가 없어야 함");
  assertEqual(m["b"], 2);
});

// ─── TC-4: imm-merge ─────────────────────────────────────────────
console.log("\n[TC-4] imm-merge");

test("imm-merge 두 맵 합치기", () => {
  const v = run(`
    (define m1 (imm-map {:a 1 :b 2}))
    (define m2 (imm-map {:b 99 :c 3}))
    (imm-merge m1 m2)
  `);
  assertEqual(v["a"], 1);
  assertEqual(v["b"], 99);  // m2가 우선
  assertEqual(v["c"], 3);
});

test("imm-keys / imm-vals", () => {
  const interp = runMulti(`
    (define m (imm-map {:x 10 :y 20}))
    (define ks (imm-keys m))
    (define vs (imm-vals m))
  `);
  const ks = getVar(interp, "ks");
  const vs = getVar(interp, "vs");
  assert(Array.isArray(ks), "keys는 배열이어야 함");
  assert(ks.includes("x") && ks.includes("y"), "x, y 키 포함");
  assert(Array.isArray(vs), "vals는 배열이어야 함");
  assert(vs.includes(10) && vs.includes(20), "10, 20 값 포함");
});

// ─── TC-5: imm-vec + imm-conj — 원본 불변 ────────────────────────
console.log("\n[TC-5] imm-vec + imm-conj — 원본 불변");

test("imm-vec 생성", () => {
  const v = run(`(imm-vec [1 2 3 4 5])`);
  assert(Array.isArray(v), "배열이어야 함");
  assertEqual(v.length, 5);
  assertEqual(v[0], 1);
  assertEqual(v[4], 5);
});

test("imm-conj 원소 추가 → 새 벡터", () => {
  const interp = runMulti(`
    (define v (imm-vec [1 2 3 4 5]))
    (define v2 (imm-conj v 6))
  `);
  const v = getVar(interp, "v");
  const v2 = getVar(interp, "v2");
  assertEqual(v.length, 5);
  assertEqual(v2.length, 6);
  assertEqual(v2[5], 6);
  assert(v[5] === undefined, "원본에 6번째 원소 없어야 함");
});

test("imm? — 벡터도 frozen", () => {
  const v = run(`
    (define v (imm-vec [1 2 3]))
    (imm? v)
  `);
  assert(v === true, "frozen 벡터는 imm?가 true여야 함");
});

// ─── TC-6: imm-nth, imm-slice ─────────────────────────────────────
console.log("\n[TC-6] imm-nth, imm-slice");

test("imm-nth 인덱스 조회", () => {
  const v = run(`
    (define v (imm-vec [10 20 30 40 50]))
    (imm-nth v 0)
  `);
  assertEqual(v, 10);
});

test("imm-nth 마지막 원소", () => {
  const v = run(`
    (define v (imm-vec [10 20 30]))
    (imm-nth v 2)
  `);
  assertEqual(v, 30);
});

test("imm-nth 범위 초과 → null", () => {
  const v = run(`
    (define v (imm-vec [1 2 3]))
    (imm-nth v 99)
  `);
  assert(v === null || v === undefined, `null이어야 함, 받은: ${v}`);
});

test("imm-slice [1 4] → [2 3 4]", () => {
  const interp = runMulti(`
    (define v2 (imm-conj (imm-conj (imm-conj (imm-conj (imm-conj (imm-vec [1]) 2) 3) 4) 5) 6))
    (define sl (imm-slice v2 1 4))
  `);
  const sl = getVar(interp, "sl");
  assertEqual(sl.length, 3);
  assertEqual(sl[0], 2);
  assertEqual(sl[1], 3);
  assertEqual(sl[2], 4);
});

// ─── TC-7: imm-update ────────────────────────────────────────────
console.log("\n[TC-7] imm-update");

test("imm-update 인덱스 교체 → 새 벡터", () => {
  const interp = runMulti(`
    (define v (imm-vec [1 2 3 4 5]))
    (define v2 (imm-update v 2 99))
  `);
  const v = getVar(interp, "v");
  const v2 = getVar(interp, "v2");
  assertEqual(v[2], 3);      // 원본 불변
  assertEqual(v2[2], 99);    // 새 벡터에만 반영
});

test("imm-pop 마지막 제거 → 새 벡터", () => {
  const interp = runMulti(`
    (define v (imm-vec [1 2 3]))
    (define v2 (imm-pop v))
  `);
  const v = getVar(interp, "v");
  const v2 = getVar(interp, "v2");
  assertEqual(v.length, 3);
  assertEqual(v2.length, 2);
  assertEqual(v2[1], 2);
});

// ─── TC-8: imm-count, imm-empty?, imm? ───────────────────────────
console.log("\n[TC-8] imm-count, imm-empty?, imm?");

test("imm-count 맵", () => {
  const v = run(`(imm-count (imm-map {:a 1 :b 2 :c 3}))`);
  assertEqual(v, 3);
});

test("imm-count 벡터", () => {
  const v = run(`(imm-count (imm-conj (imm-vec [1 2 3 4 5]) 6))`);
  assertEqual(v, 6);
});

test("imm-empty? 빈 맵", () => {
  const v = run(`(imm-empty? (imm-map {}))`);
  assert(v === true, "빈 맵은 empty여야 함");
});

test("imm-empty? 비어있지 않은 맵", () => {
  const v = run(`(imm-empty? (imm-map {:a 1}))`);
  assert(v === false, "원소 있으면 empty가 아님");
});

test("imm-empty? 빈 벡터", () => {
  const v = run(`(imm-empty? (imm-vec []))`);
  assert(v === true, "빈 벡터는 empty여야 함");
});

// ─── TC-9: imm-into ──────────────────────────────────────────────
console.log("\n[TC-9] imm-into");

test("imm-into 벡터 + 벡터", () => {
  const v = run(`
    (define v1 (imm-vec [1 2 3]))
    (define v2 (imm-vec [4 5 6]))
    (imm-into v1 v2)
  `);
  assertEqual(v.length, 6);
  assertEqual(v[3], 4);
  assertEqual(v[5], 6);
});

test("imm-into 맵 + 맵", () => {
  const v = run(`
    (define m1 (imm-map {:a 1}))
    (define m2 (imm-map {:b 2 :c 3}))
    (imm-into m1 m2)
  `);
  assertEqual(v["a"], 1);
  assertEqual(v["b"], 2);
  assertEqual(v["c"], 3);
});

// ─── TC-10: 중첩 이뮤터블 ────────────────────────────────────────
console.log("\n[TC-10] 중첩 이뮤터블");

test("중첩 맵 — 상위 frozen", () => {
  const v = run(`
    (define inner (imm-map {:x 1 :y 2}))
    (define outer (imm-map {:inner inner :z 99}))
    (imm? outer)
  `);
  assert(v === true, "outer는 frozen이어야 함");
});

test("중첩 맵 — 내부 값 조회", () => {
  const v = run(`
    (define inner (imm-map {:x 42}))
    (define outer (imm-map {:inner inner}))
    (imm-get (imm-get outer :inner) :x)
  `);
  assertEqual(v, 42);
});

// ─── TC-11: Phase 56 regression ──────────────────────────────────
console.log("\n[TC-11] Phase 56 regression (14/14)");

test("P56: 기본 fn 호출", () => {
  const v = run(`
    (define x 10)
    (define double (fn [$n] (* $n 2)))
    (double x)
  `);
  assertEqual(v, 20);
});

test("P56: 이항 fn", () => {
  const v = run(`
    (define add (fn [$a $b] (+ $a $b)))
    (add 3 4)
  `);
  assertEqual(v, 7);
});

test("P56: 클로저 카운터 — 순차 호출 누적", () => {
  const interp = runMulti(`
    (define counter 0)
    [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
    (inc!)
    (inc!)
    (define c3 (do (inc!) $counter))
  `);
  assertEqual(getVar(interp, "c3"), 3);
});

test("P56: make-adder 클로저", () => {
  const v = run(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add5 (make-adder 5))
    (add5 3)
  `);
  assertEqual(v, 8);
});

test("P56: make-adder 10 클로저", () => {
  const v = run(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add10 (make-adder 10))
    (add10 3)
  `);
  assertEqual(v, 13);
});

test("P56: 재귀 팩토리얼 5! = 120", () => {
  const v = run(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 5)
  `);
  assertEqual(v, 120);
});

test("P56: 재귀 팩토리얼 10! = 3628800", () => {
  const v = run(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 10)
  `);
  assertEqual(v, 3628800);
});

test("P56: imm-map과 fn 혼용", () => {
  const interp = runMulti(`
    (define base (imm-map {:val 100}))
    (define adder (fn [$m $k] (+ (imm-get $m :val) $k)))
    (define result (adder base 42))
  `);
  assertEqual(getVar(interp, "result"), 142);
});

test("P56: imm-assoc 체인 — 원본 불변 보장", () => {
  const interp = runMulti(`
    (define m0 (imm-map {:a 0}))
    (define m1 (imm-assoc m0 :b 1))
    (define m2 (imm-assoc m1 :c 2))
    (define m3 (imm-assoc m2 :d 3))
    (define cnt0 (imm-count m0))
    (define cnt1 (imm-count m1))
    (define cnt2 (imm-count m2))
    (define cnt3 (imm-count m3))
  `);
  assertEqual(getVar(interp, "cnt0"), 1);
  assertEqual(getVar(interp, "cnt1"), 2);
  assertEqual(getVar(interp, "cnt2"), 3);
  assertEqual(getVar(interp, "cnt3"), 4);
});

test("P56: imm-vec conj 체인", () => {
  const interp = runMulti(`
    (define v0 (imm-vec []))
    (define v1 (imm-conj v0 "a"))
    (define v2 (imm-conj v1 "b"))
    (define v3 (imm-conj v2 "c"))
    (define len (imm-count v3))
    (define vfirst (imm-nth v3 0))
    (define vlast (imm-nth v3 2))
  `);
  assertEqual(getVar(interp, "len"), 3);
  assertEqual(getVar(interp, "vfirst"), "a");
  assertEqual(getVar(interp, "vlast"), "c");
});

test("P56: 전역 스코프 — fn이 전역 변수 오염 안 함", () => {
  const interp = runMulti(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
    (define result x)
  `);
  assertEqual(getVar(interp, "result"), 10);
});

test("P56: 고차함수 클로저 capture", () => {
  const v = run(`
    (define base 100)
    (define add-base (fn [$x] (+ $x $base)))
    (add-base 5)
  `);
  assertEqual(v, 105);
});

test("P56: imm-dissoc 스코프 안전성", () => {
  const interp = runMulti(`
    (define outer-m (imm-map {:shared 1 :extra 2}))
    (define reduced (imm-dissoc outer-m :extra))
    (define outer-cnt (imm-count outer-m))
    (define reduced-cnt (imm-count reduced))
  `);
  assertEqual(getVar(interp, "outer-cnt"), 2);
  assertEqual(getVar(interp, "reduced-cnt"), 1);
});

// ─── 결과 출력 ───────────────────────────────────────────────────
console.log(`\n${"=".repeat(50)}`);
console.log(`Phase 70 결과: ${passed} PASS / ${failed} FAIL`);
if (failed === 0) {
  console.log("🎉 ALL TESTS PASSED!");
} else {
  console.log(`⚠️  ${failed}개 실패`);
  process.exit(1);
}
