#!/usr/bin/env node
// scripts/property-test.js — FreeLang v11 Property-Based Testing
//
// Year 2 Y3: 100~200 invariant 검증. random input N회 + counter-example 발견.
// 외부 의존 없이 자체 구현 (fast-check 안 씀).
//
// 사용:
//   node scripts/property-test.js                # 모든 invariant, N=50
//   node scripts/property-test.js --n=100        # 각 invariant 100회
//   node scripts/property-test.js --json         # CI용 JSON 결과
//   node scripts/property-test.js --invariant=I001    # 단일

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const REPO = path.resolve(__dirname, "..");
const STAGE1 = path.join(REPO, "stage1.js");

const args = process.argv.slice(2);
const N = Number(args.find(a => a.startsWith("--n="))?.split("=")[1] ?? "50");
const JSON_OUT = args.includes("--json");
const FILTER = args.find(a => a.startsWith("--invariant="))?.split("=")[1] ?? null;
const SEED = Number(args.find(a => a.startsWith("--seed="))?.split("=")[1] ?? "12345");

// 고정 seed PRNG (재현 가능)
let _rng = SEED;
function rand() { _rng = (_rng * 1103515245 + 12345) & 0x7fffffff; return _rng / 0x7fffffff; }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function randPick(arr) { return arr[Math.floor(rand() * arr.length)]; }

// ─────────────────────────────────────────────────────────────
// FL 코드 평가 (stage1로 compile + node로 실행)
// ─────────────────────────────────────────────────────────────

function evalFL(src) {
  const tmpFL = path.join(REPO, ".tmp-prop-" + process.pid + "-" + Date.now() + ".fl");
  const tmpJS = tmpFL + ".out.js";
  try {
    fs.writeFileSync(tmpFL, src);
    execSync(`node --stack-size=8000 ${STAGE1} ${tmpFL} ${tmpJS}`,
      { stdio: ["ignore", "pipe", "pipe"], timeout: 10000 });
    const out = execSync(`node --stack-size=8000 ${tmpJS}`,
      { encoding: "utf-8", timeout: 5000 });
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, err: (e.message || "").slice(0, 100) };
  } finally {
    [tmpFL, tmpJS].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  }
}

// ─────────────────────────────────────────────────────────────
// Invariants (200+ 잠재. 50개로 시작)
// ─────────────────────────────────────────────────────────────

const INVARIANTS = [
  // 산술 항등성
  { id: "I001", name: "(+ 0 x) === x",
    gen: () => randInt(-100, 100),
    test: (x) => evalFL(`(println (= ${x} (+ 0 ${x})))`).out === "true" },
  { id: "I002", name: "(* 1 x) === x",
    gen: () => randInt(-100, 100),
    test: (x) => evalFL(`(println (= ${x} (* 1 ${x})))`).out === "true" },
  { id: "I003", name: "(- x x) === 0",
    gen: () => randInt(0, 100),
    test: (x) => evalFL(`(println (= 0 (- ${x} ${x})))`).out === "true" },
  { id: "I004", name: "(* 0 x) === 0",
    gen: () => randInt(-100, 100),
    test: (x) => evalFL(`(println (= 0 (* 0 ${x})))`).out === "true" },
  { id: "I005", name: "(+ a b) === (+ b a) (commutative)",
    gen: () => [randInt(-50, 50), randInt(-50, 50)],
    test: ([a, b]) => evalFL(`(println (= (+ ${a} ${b}) (+ ${b} ${a})))`).out === "true" },
  { id: "I006", name: "(* a b) === (* b a) (commutative)",
    gen: () => [randInt(-20, 20), randInt(-20, 20)],
    test: ([a, b]) => evalFL(`(println (= (* ${a} ${b}) (* ${b} ${a})))`).out === "true" },

  // 비교 항등
  { id: "I007", name: "(= x x) → true",
    gen: () => randInt(-100, 100),
    test: (x) => evalFL(`(println (= ${x} ${x}))`).out === "true" },
  { id: "I008", name: "(< x x) → false",
    gen: () => randInt(-100, 100),
    test: (x) => evalFL(`(println (< ${x} ${x}))`).out === "false" },

  // List 항등성
  { id: "I009", name: "(length (list a b c)) === 3",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (length (list ${a} ${b} ${c})))`).out === "3" },
  { id: "I010", name: "(reverse (reverse xs)) === xs",
    gen: () => [randInt(0, 50), randInt(0, 50), randInt(0, 50)],
    test: ([a, b, c]) => evalFL(`(println (= (str (list ${a} ${b} ${c})) (str (reverse (reverse (list ${a} ${b} ${c}))))))`).out === "true" },
  { id: "I011", name: "(first (list x y z)) === x",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (= ${a} (first (list ${a} ${b} ${c}))))`).out === "true" },

  // String 항등
  { id: "I012", name: "(length (str x)) > 0 for non-empty x",
    gen: () => randInt(1, 1000),
    test: (x) => Number(evalFL(`(println (length (str ${x})))`).out) > 0 },

  // 결정론
  { id: "I013", name: "같은 식 두 번 → 같은 결과",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => {
      const r1 = evalFL(`(println (+ ${a} ${b}))`).out;
      const r2 = evalFL(`(println (+ ${a} ${b}))`).out;
      return r1 === r2;
    } },

  // nil 일관성 (P0-1 검증)
  { id: "I014", name: "(if nil x y) → y (P0-1)",
    gen: () => [randInt(0, 100), randInt(101, 200)],
    test: ([x, y]) => evalFL(`(println (if nil ${x} ${y}))`).out === String(y) },
  { id: "I015", name: "(= nil null) → true",
    gen: () => 0,
    test: () => evalFL(`(println (= nil null))`).out === "true" },
  { id: "I016", name: "(or nil x) → x (P0-1 부수)",
    gen: () => randInt(1, 100),
    test: (x) => evalFL(`(println (or nil ${x}))`).out === String(x) },

  // nil-safe 직접
  { id: "I017", name: "(if (= nil x) d x) — nil 분기",
    gen: () => randInt(1, 100),
    test: (d) => evalFL(`(println (if (= nil nil) ${d} 0))`).out === String(d) },

  // reduce 항등 (lambda로 + 우회)
  { id: "I018", name: "(reduce (fn [a b] (+ a b)) 0 (list)) === 0",
    gen: () => 0,
    test: () => evalFL(`(println (reduce (fn [a b] (+ a b)) 0 (list)))`).out === "0" },
  { id: "I019", name: "(reduce (fn [a b] (+ a b)) 0 (list a)) === a",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (reduce (fn [a b] (+ a b)) 0 (list ${a})))`).out === String(a) },

  // 함수형 (let-bound identity)
  { id: "I020", name: "let-bound identity x === x",
    gen: () => randInt(0, 100),
    test: (x) => evalFL(`(let [[id (fn [v] v)]] (println (= ${x} (id ${x}))))`).out === "true" },

  // ── 산술 결합/분배 ─────────────────────────
  { id: "I021", name: "(+ (+ a b) c) === (+ a (+ b c))",
    gen: () => [randInt(0, 50), randInt(0, 50), randInt(0, 50)],
    test: ([a, b, c]) => evalFL(`(println (= (+ (+ ${a} ${b}) ${c}) (+ ${a} (+ ${b} ${c}))))`).out === "true" },
  { id: "I022", name: "(* a (+ b c)) === (+ (* a b) (* a c)) (distributive)",
    gen: () => [randInt(0, 20), randInt(0, 20), randInt(0, 20)],
    test: ([a, b, c]) => evalFL(`(println (= (* ${a} (+ ${b} ${c})) (+ (* ${a} ${b}) (* ${a} ${c}))))`).out === "true" },
  { id: "I023", name: "(- a b) === (+ a (- 0 b))",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (= (- ${a} ${b}) (+ ${a} (- 0 ${b}))))`).out === "true" },
  { id: "I024", name: "(+ a 1) > a (양수 증가)",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (> (+ ${a} 1) ${a}))`).out === "true" },
  { id: "I025", name: "(* 2 a) === (+ a a)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= (* 2 ${a}) (+ ${a} ${a})))`).out === "true" },

  // ── 비교 transitivity ─────────────────────────
  { id: "I026", name: "(< a b) ∧ (< b c) → (< a c)",
    gen: () => { const a = randInt(0, 30); return [a, a + randInt(1, 30), a + randInt(31, 100)]; },
    test: ([a, b, c]) => evalFL(`(println (and (< ${a} ${b}) (< ${b} ${c}) (< ${a} ${c})))`).out === "true" },
  { id: "I027", name: "(<= a a) → true (반사성)",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (<= ${a} ${a}))`).out === "true" },
  { id: "I028", name: "(>= a a) → true (반사성)",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (>= ${a} ${a}))`).out === "true" },
  { id: "I029", name: "(not (= a b)) === (or (< a b) (> a b))",
    gen: () => [randInt(0, 50), randInt(0, 50)],
    test: ([a, b]) => evalFL(`(println (= (not (= ${a} ${b})) (or (< ${a} ${b}) (> ${a} ${b}))))`).out === "true" },

  // ── 논리 ─────────────────────────
  { id: "I030", name: "(not (not x)) === x — true",
    gen: () => 1,
    test: () => evalFL(`(println (= true (not (not true))))`).out === "true" },
  { id: "I031", name: "(not (not x)) === x — false",
    gen: () => 0,
    test: () => evalFL(`(println (= false (not (not false))))`).out === "true" },
  { id: "I032", name: "(and true x) === x",
    gen: () => randInt(1, 100),
    test: (x) => evalFL(`(println (and true ${x}))`).out === String(x) },
  { id: "I033", name: "(or false x) === x",
    gen: () => randInt(1, 100),
    test: (x) => evalFL(`(println (or false ${x}))`).out === String(x) },
  { id: "I034", name: "(and false x) === false (단락)",
    gen: () => randInt(1, 100),
    test: (_) => evalFL(`(println (and false 999))`).out === "false" },

  // ── if/cond ─────────────────────────
  { id: "I035", name: "(if true a b) === a",
    gen: () => [randInt(0, 100), randInt(101, 200)],
    test: ([a, b]) => evalFL(`(println (if true ${a} ${b}))`).out === String(a) },
  { id: "I036", name: "(if false a b) === b",
    gen: () => [randInt(0, 100), randInt(101, 200)],
    test: ([a, b]) => evalFL(`(println (if false ${a} ${b}))`).out === String(b) },
  { id: "I037", name: "(if (= a a) 1 2) === 1",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (if (= ${a} ${a}) 1 2))`).out === "1" },

  // ── list ─────────────────────────
  { id: "I038", name: "(length (rest (list a b c))) === 2",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (length (rest (list ${a} ${b} ${c}))))`).out === "2" },
  { id: "I039", name: "(last (list a b c)) === c",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (= ${c} (last (list ${a} ${b} ${c}))))`).out === "true" },
  { id: "I040", name: "(length (append (list a) (list b))) === 2",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (length (append (list ${a}) (list ${b}))))`).out === "2" },
  { id: "I041", name: "(first (reverse (list a b))) === b",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (= ${b} (first (reverse (list ${a} ${b})))))`).out === "true" },

  // ── string ─────────────────────────
  { id: "I042", name: "(str a) parse 가능",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= "${a}" (str ${a})))`).out === "true" },
  { id: "I043", name: "(length (str a b)) === sum",
    gen: () => [randInt(0, 99), randInt(0, 99)],
    test: ([a, b]) => {
      const expected = String(a).length + String(b).length;
      return Number(evalFL(`(println (length (str ${a} ${b})))`).out) === expected;
    } },

  // ── let scope ─────────────────────────
  { id: "I044", name: "(let [[x N]] x) === N",
    gen: () => randInt(0, 1000),
    test: (n) => evalFL(`(println (let [[x ${n}]] x))`).out === String(n) },
  { id: "I045", name: "let nested shadow",
    gen: () => randInt(0, 100),
    test: (n) => evalFL(`(println (let [[x 0]] (let [[x ${n}]] x)))`).out === String(n) },

  // ── nil safety (P0-1 강화) ─────────────────────────
  { id: "I046", name: "(if (or nil false) a b) → b",
    gen: () => [randInt(0, 100), randInt(101, 200)],
    test: ([a, b]) => evalFL(`(println (if (or nil false) ${a} ${b}))`).out === String(b) },
  { id: "I047", name: "(if (and nil x) a b) → b",
    gen: () => [randInt(0, 100), randInt(101, 200)],
    test: ([a, b]) => evalFL(`(println (if (and nil 999) ${a} ${b}))`).out === String(b) },
  { id: "I048", name: "(= nil nil) → true",
    gen: () => 0,
    test: () => evalFL(`(println (= nil nil))`).out === "true" },

  // ── closure ─────────────────────────
  { id: "I049", name: "let-bound add closure",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(let [[add (fn [x y] (+ x y))]] (println (add ${a} ${b})))`).out === String(a + b) },
  { id: "I050", name: "let captured constant",
    gen: () => randInt(0, 100),
    test: (n) => evalFL(`(let [[k ${n}] [g (fn [] k)]] (println (g)))`).out === String(n) },

  // ── 숫자 연산 (51~60) ─────────────────────────
  { id: "I051", name: "(/ a 1) === a",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (/ ${a} 1))`).out === String(a) },
  { id: "I052", name: "(* a a) >= 0",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (>= (* ${a} ${a}) 0))`).out === "true" },
  { id: "I053", name: "(+ a a a) === (* 3 a)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= (+ ${a} ${a} ${a}) (* 3 ${a})))`).out === "true" },
  { id: "I054", name: "(- (+ a b) b) === a",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (= (- (+ ${a} ${b}) ${b}) ${a}))`).out === "true" },
  { id: "I055", name: "(* a 0) === 0 (zero element)",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (* ${a} 0))`).out === "0" },
  { id: "I056", name: "(+ a a) === (* a 2)",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= (+ ${a} ${a}) (* ${a} 2)))`).out === "true" },
  { id: "I057", name: "(< 0 (+ a 1)) for non-neg a",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (< 0 (+ ${a} 1)))`).out === "true" },
  { id: "I058", name: "(= (+ a 1) (+ 1 a))",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= (+ ${a} 1) (+ 1 ${a})))`).out === "true" },
  { id: "I059", name: "double inversion (- (- a)) === a",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= ${a} (- 0 (- 0 ${a}))))`).out === "true" },
  { id: "I060", name: "(+ a (- 0 a)) === 0",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= 0 (+ ${a} (- 0 ${a}))))`).out === "true" },

  // ── list 깊은 ops (61~70) ─────────────────────────
  { id: "I061", name: "(length (list)) === 0",
    gen: () => 0,
    test: () => evalFL(`(println (length (list)))`).out === "0" },
  { id: "I062", name: "(length (list a)) === 1",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (length (list ${a})))`).out === "1" },
  { id: "I063", name: "(first (list a)) === a",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= ${a} (first (list ${a}))))`).out === "true" },
  { id: "I064", name: "(rest (list a)) === (list)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (length (rest (list ${a}))))`).out === "0" },
  { id: "I065", name: "(length (append xs ys)) === sum",
    gen: () => [randInt(0, 50), randInt(0, 50), randInt(0, 50)],
    test: ([a, b, c]) => evalFL(`(println (length (append (list ${a} ${b}) (list ${c}))))`).out === "3" },
  { id: "I066", name: "reverse 2회 항등 (5 elements)",
    gen: () => [randInt(0, 9), randInt(0, 9), randInt(0, 9), randInt(0, 9), randInt(0, 9)],
    test: ([a, b, c, d, e]) => evalFL(`(println (= (str (list ${a} ${b} ${c} ${d} ${e})) (str (reverse (reverse (list ${a} ${b} ${c} ${d} ${e}))))))`).out === "true" },
  { id: "I067", name: "(length (reverse xs)) === (length xs)",
    gen: () => [randInt(0, 50), randInt(0, 50), randInt(0, 50), randInt(0, 50)],
    test: ([a, b, c, d]) => evalFL(`(println (= (length (list ${a} ${b} ${c} ${d})) (length (reverse (list ${a} ${b} ${c} ${d})))))`).out === "true" },
  { id: "I068", name: "(first (append (list a) xs)) === a",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (= ${a} (first (append (list ${a}) (list ${b} ${c})))))`).out === "true" },
  { id: "I069", name: "(last (append xs (list y))) === y",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (= ${c} (last (append (list ${a} ${b}) (list ${c})))))`).out === "true" },
  { id: "I070", name: "(first (reverse (list a b c))) === c",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (= ${c} (first (reverse (list ${a} ${b} ${c})))))`).out === "true" },

  // ── string (71~75) ─────────────────────────
  { id: "I071", name: "(str a) === (str a)",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= (str ${a}) (str ${a})))`).out === "true" },
  { id: "I072", name: "(length \"\") === 0",
    gen: () => 0,
    test: () => evalFL(`(println (length ""))`).out === "0" },
  { id: "I073", name: "(length (str a)) > 0",
    gen: () => randInt(1, 1000),
    test: (a) => Number(evalFL(`(println (length (str ${a})))`).out) > 0 },
  { id: "I074", name: "(= (str a) (str a)) → true",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= (str ${a}) (str ${a})))`).out === "true" },
  { id: "I075", name: "(length (str a b)) === |a|+|b|",
    gen: () => [randInt(10, 99), randInt(10, 99)],
    test: ([a, b]) => Number(evalFL(`(println (length (str ${a} ${b})))`).out) === 4 },

  // ── type predicate (76~80) ─────────────────────────
  { id: "I076", name: "(number? N) → true",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (number? ${a}))`).out === "true" },
  { id: "I077", name: "(string? \"x\") → true",
    gen: () => 0,
    test: () => evalFL(`(println (string? "hello"))`).out === "true" },
  { id: "I078", name: "(= nil nil) → true (nil 동치)",
    gen: () => 0,
    test: () => evalFL(`(println (= nil nil))`).out === "true" },
  { id: "I079", name: "(= nil N) → false",
    gen: () => randInt(1, 1000),
    test: (a) => evalFL(`(println (= nil ${a}))`).out === "false" },
  { id: "I080", name: "(number? \"x\") → false",
    gen: () => 0,
    test: () => evalFL(`(println (number? "hello"))`).out === "false" },

  // ── 분기/cond (81~85) ─────────────────────────
  { id: "I081", name: "cond 첫 true 분기",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (cond [true ${a}] [false 0]))`).out === String(a) },
  { id: "I082", name: "cond 두번째 분기 true",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (cond [false 0] [true ${a}]))`).out === String(a) },
  { id: "I083", name: "(if true a nil) → a",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (if true ${a} nil))`).out === String(a) },
  { id: "I084", name: "(if false 999 nil) → null",
    gen: () => 0,
    test: () => evalFL(`(println (if false 999 nil))`).out === "null" },
  { id: "I085", name: "(if (not false) a nil) → a",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (if (not false) ${a} nil))`).out === String(a) },

  // ── nil 깊은 안전 (86~90) ─────────────────────────
  { id: "I086", name: "(if (= nil nil) a b) === a",
    gen: () => [randInt(0, 100), randInt(101, 200)],
    test: ([a, b]) => evalFL(`(println (if (= nil nil) ${a} ${b}))`).out === String(a) },
  { id: "I087", name: "(or nil nil x) === x",
    gen: () => randInt(1, 100),
    test: (x) => evalFL(`(println (or nil nil ${x}))`).out === String(x) },
  { id: "I088", name: "(and 1 1 1) → 1 (모두 truthy)",
    gen: () => 0,
    test: () => evalFL(`(println (and 1 1 1))`).out === "1" },
  { id: "I089", name: "(if 0 a b) — 0이 falsy인지 검증",
    gen: () => [randInt(0, 100), randInt(101, 200)],
    test: ([a, b]) => {
      const out = evalFL(`(println (if 0 ${a} ${b}))`).out;
      return out === String(a) || out === String(b);
    } },
  { id: "I090", name: "(not nil) → true",
    gen: () => 0,
    test: () => evalFL(`(println (not nil))`).out === "true" },

  // ── recursion / closure (91~95) ─────────────────────────
  { id: "I091", name: "재귀 sum 0..n",
    gen: () => randInt(0, 20),
    test: (n) => {
      const expected = n * (n + 1) / 2;
      return evalFL(`(defn sum [n] (if (= n 0) 0 (+ n (sum (- n 1))))) (println (sum ${n}))`).out === String(expected);
    } },
  { id: "I092", name: "재귀 fact 0..6",
    gen: () => randInt(0, 6),
    test: (n) => {
      let f = 1; for (let i = 1; i <= n; i++) f *= i;
      return evalFL(`(defn f [n] (if (= n 0) 1 (* n (f (- n 1))))) (println (f ${n}))`).out === String(f);
    } },
  { id: "I093", name: "let 함수 즉시 호출",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(let [[double (fn [x] (* 2 x))]] (println (double ${a})))`).out === String(a * 2) },
  { id: "I094", name: "고차 함수 — 람다 인자 호출",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(let [[apply-it (fn [f x] (f x))] [inc (fn [n] (+ n 1))]] (println (apply-it inc ${a})))`).out === String(a + 1) },
  { id: "I095", name: "closure 환경 보존",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(defn make-adder [n] (fn [x] (+ x n))) (let [[add5 (make-adder 5)]] (println (add5 ${a})))`).out === String(a + 5) },

  // ── 큰 수 / 경계 (96~100) ─────────────────────────
  { id: "I096", name: "(+ 1 (- 0 1)) === 0",
    gen: () => 0,
    test: () => evalFL(`(println (+ 1 (- 0 1)))`).out === "0" },
  { id: "I097", name: "큰 수 (10000) 보존",
    gen: () => 0,
    test: () => evalFL(`(println (= 10000 (* 100 100)))`).out === "true" },
  { id: "I098", name: "(< 0 999999) → true",
    gen: () => 0,
    test: () => evalFL(`(println (< 0 999999))`).out === "true" },
  { id: "I099", name: "(> 1000000 1) → true",
    gen: () => 0,
    test: () => evalFL(`(println (> 1000000 1))`).out === "true" },
  { id: "I100", name: "(if true (if true 1 2) 3) === 1 (nested if)",
    gen: () => 0,
    test: () => evalFL(`(println (if true (if true 1 2) 3))`).out === "1" },
];

// ─────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────

function run() {
  const targets = FILTER ? INVARIANTS.filter(i => i.id === FILTER || i.id.includes(FILTER)) : INVARIANTS;
  if (!JSON_OUT) {
    console.log("════════════════════════════════════════════");
    console.log("  Property-Based Testing (Y3, Year 2)");
    console.log(`  Invariants: ${targets.length} × ${N} cases`);
    console.log(`  Seed: ${SEED} (재현 가능)`);
    console.log("════════════════════════════════════════════\n");
  }

  const results = [];
  let totalCases = 0, totalPass = 0;
  const t0 = Date.now();

  for (const inv of targets) {
    let pass = 0, fail = 0;
    let counterExample = null;
    for (let i = 0; i < N; i++) {
      const input = inv.gen();
      try {
        if (inv.test(input)) pass++;
        else {
          fail++;
          if (!counterExample) counterExample = input;
        }
      } catch (e) {
        fail++;
        if (!counterExample) counterExample = { input, error: e.message?.slice(0, 50) };
      }
      totalCases++;
    }
    totalPass += pass;
    const status = fail === 0 ? "✅" : "❌";
    if (!JSON_OUT) {
      console.log(`  ${status} ${inv.id} ${pass}/${N} — ${inv.name}`);
      if (counterExample) console.log(`      counter-example: ${JSON.stringify(counterExample)}`);
    }
    results.push({ id: inv.id, name: inv.name, pass, fail, total: N, counterExample });
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const score = totalCases > 0 ? ((totalPass / totalCases) * 100).toFixed(2) : "0";

  if (!JSON_OUT) {
    console.log("\n════════════════════════════════════════════");
    console.log(`  결과: ${totalPass}/${totalCases} cases pass (${score}%) — ${elapsed}s`);
    console.log(`  Invariants: ${results.filter(r => r.fail === 0).length}/${results.length} 완전 통과`);
    console.log("════════════════════════════════════════════");
  }

  // 결과 저장
  const outPath = path.join(REPO, "PROPERTY-TEST-RESULTS.json");
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    seed: SEED,
    n_per_invariant: N,
    total_invariants: results.length,
    total_cases: totalCases,
    total_pass: totalPass,
    score: parseFloat(score),
    elapsed_seconds: parseFloat(elapsed),
    results,
  }, null, 2), "utf-8");

  if (JSON_OUT) console.log(fs.readFileSync(outPath, "utf-8"));
  else console.log(`\n  결과 저장: ${path.relative(REPO, outPath)}`);

  process.exit(results.some(r => r.fail > 0) ? 1 : 0);
}

run();
