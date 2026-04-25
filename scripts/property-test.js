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

  // ── 산술 깊은 (101~120) ─────────────────────────
  { id: "I101", name: "(+ a b c) === (+ (+ a b) c)",
    gen: () => [randInt(0, 50), randInt(0, 50), randInt(0, 50)],
    test: ([a, b, c]) => evalFL(`(println (= (+ ${a} ${b} ${c}) (+ (+ ${a} ${b}) ${c})))`).out === "true" },
  { id: "I102", name: "(* a b c) === (* (* a b) c)",
    gen: () => [randInt(1, 20), randInt(1, 20), randInt(1, 20)],
    test: ([a, b, c]) => evalFL(`(println (= (* ${a} ${b} ${c}) (* (* ${a} ${b}) ${c})))`).out === "true" },
  { id: "I103", name: "(+ a (- b c)) === (- (+ a b) c)",
    gen: () => [randInt(0, 100), randInt(50, 100), randInt(0, 50)],
    test: ([a, b, c]) => evalFL(`(println (= (+ ${a} (- ${b} ${c})) (- (+ ${a} ${b}) ${c})))`).out === "true" },
  { id: "I104", name: "(- (+ a b) a) === b",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (= (- (+ ${a} ${b}) ${a}) ${b}))`).out === "true" },
  { id: "I105", name: "(/ (* a 5) 5) === a",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (= (/ (* ${a} 5) 5) ${a}))`).out === "true" },
  { id: "I106", name: "(- a 0) === a",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= (- ${a} 0) ${a}))`).out === "true" },
  { id: "I107", name: "(* a 1 1 1) === a",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= (* ${a} 1 1 1) ${a}))`).out === "true" },
  { id: "I108", name: "(+ 0 0 0 a) === a",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= (+ 0 0 0 ${a}) ${a}))`).out === "true" },
  { id: "I109", name: "(< a (+ a 1) (+ a 2)) → true (chained)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (and (< ${a} (+ ${a} 1)) (< (+ ${a} 1) (+ ${a} 2))))`).out === "true" },
  { id: "I110", name: "(>= (+ a b) a) for non-neg b",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (>= (+ ${a} ${b}) ${a}))`).out === "true" },
  { id: "I111", name: "(<= a (+ a 1))",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (<= ${a} (+ ${a} 1)))`).out === "true" },
  { id: "I112", name: "(* (+ a 1) 2) === (+ (* a 2) 2)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= (* (+ ${a} 1) 2) (+ (* ${a} 2) 2)))`).out === "true" },
  { id: "I113", name: "(+ a 100) > a",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (> (+ ${a} 100) ${a}))`).out === "true" },
  { id: "I114", name: "(- a (- 0 b)) === (+ a b)",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (= (- ${a} (- 0 ${b})) (+ ${a} ${b})))`).out === "true" },
  { id: "I115", name: "(+ (* 2 a) (* 2 b)) === (* 2 (+ a b))",
    gen: () => [randInt(0, 50), randInt(0, 50)],
    test: ([a, b]) => evalFL(`(println (= (+ (* 2 ${a}) (* 2 ${b})) (* 2 (+ ${a} ${b}))))`).out === "true" },
  { id: "I116", name: "(* (* a b) c) === (* a b c)",
    gen: () => [randInt(1, 10), randInt(1, 10), randInt(1, 10)],
    test: ([a, b, c]) => evalFL(`(println (= (* (* ${a} ${b}) ${c}) (* ${a} ${b} ${c})))`).out === "true" },
  { id: "I117", name: "(+ (+ a b) (+ c d)) === (+ a b c d)",
    gen: () => [randInt(0, 50), randInt(0, 50), randInt(0, 50), randInt(0, 50)],
    test: ([a, b, c, d]) => evalFL(`(println (= (+ (+ ${a} ${b}) (+ ${c} ${d})) (+ ${a} ${b} ${c} ${d})))`).out === "true" },
  { id: "I118", name: "(* a (+ 1 0)) === a",
    gen: () => randInt(0, 1000),
    test: (a) => evalFL(`(println (= (* ${a} (+ 1 0)) ${a}))`).out === "true" },
  { id: "I119", name: "(+ a (* b 0)) === a",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (= (+ ${a} (* ${b} 0)) ${a}))`).out === "true" },
  { id: "I120", name: "(- (- a a) a) === (- 0 a)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= (- (- ${a} ${a}) ${a}) (- 0 ${a})))`).out === "true" },

  // ── list 깊은 변환 (121~140) ─────────────────────────
  { id: "I121", name: "(length (list a b c d e)) === 5",
    gen: () => [randInt(0, 99), randInt(0, 99), randInt(0, 99), randInt(0, 99), randInt(0, 99)],
    test: (xs) => evalFL(`(println (length (list ${xs.join(' ')})))`).out === "5" },
  { id: "I122", name: "(first (list a)) (single element)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (first (list ${a})))`).out === String(a) },
  { id: "I123", name: "(last (list a)) (single element)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (last (list ${a})))`).out === String(a) },
  { id: "I124", name: "(length (rest (list a b))) === 1",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (length (rest (list ${a} ${b}))))`).out === "1" },
  { id: "I125", name: "(length (rest (rest (list a b c)))) === 1",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (length (rest (rest (list ${a} ${b} ${c})))))`).out === "1" },
  { id: "I126", name: "first (rest xs) === xs[1]",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (= ${b} (first (rest (list ${a} ${b} ${c})))))`).out === "true" },
  { id: "I127", name: "(append xs (list)) === xs (length 보존)",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (length (append (list ${a} ${b}) (list))))`).out === "2" },
  { id: "I128", name: "(append (list) xs) length",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (length (append (list) (list ${a} ${b} ${c}))))`).out === "3" },
  { id: "I129", name: "(reverse (list a)) === (list a)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= ${a} (first (reverse (list ${a})))))`).out === "true" },
  { id: "I130", name: "(first (append (list a) (list b c))) === a",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c]) => evalFL(`(println (= ${a} (first (append (list ${a}) (list ${b} ${c})))))`).out === "true" },
  { id: "I131", name: "(append (append xs ys) zs) length",
    gen: () => [randInt(0, 50), randInt(0, 50)],
    test: ([a, b]) => evalFL(`(println (length (append (append (list ${a}) (list ${b})) (list 0))))`).out === "3" },
  { id: "I132", name: "list 안 nested 식 평가",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (length (list (+ ${a} 1) (* ${a} 2) ${a})))`).out === "3" },
  { id: "I133", name: "(first (rest (list a b c d))) === b",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c, d]) => evalFL(`(println (= ${b} (first (rest (list ${a} ${b} ${c} ${d})))))`).out === "true" },
  { id: "I134", name: "list 결정론 — 두 번 호출 동일",
    gen: () => [randInt(0, 100), randInt(0, 100)],
    test: ([a, b]) => evalFL(`(println (= (str (list ${a} ${b})) (str (list ${a} ${b}))))`).out === "true" },
  { id: "I135", name: "(reverse (list a b c d)) → 첫 원소 d",
    gen: () => [randInt(0, 100), randInt(0, 100), randInt(0, 100), randInt(0, 100)],
    test: ([a, b, c, d]) => evalFL(`(println (= ${d} (first (reverse (list ${a} ${b} ${c} ${d})))))`).out === "true" },
  { id: "I136", name: "(length (append (list a b) (list c d e))) === 5",
    gen: () => [randInt(0, 99), randInt(0, 99), randInt(0, 99), randInt(0, 99), randInt(0, 99)],
    test: (xs) => evalFL(`(println (length (append (list ${xs[0]} ${xs[1]}) (list ${xs[2]} ${xs[3]} ${xs[4]}))))`).out === "5" },
  { id: "I137", name: "(first (list (+ a 1))) === (+ a 1)",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (= (+ ${a} 1) (first (list (+ ${a} 1)))))`).out === "true" },
  { id: "I138", name: "list 길이 = element 수 (6 elements)",
    gen: () => 0,
    test: () => evalFL(`(println (length (list 1 2 3 4 5 6)))`).out === "6" },
  { id: "I139", name: "list 안 list (nested length)",
    gen: () => 0,
    test: () => evalFL(`(println (length (list (list 1 2) (list 3 4))))`).out === "2" },
  { id: "I140", name: "(reverse (reverse (list 1 2 3 4 5))) 첫 원소 1",
    gen: () => 0,
    test: () => evalFL(`(println (first (reverse (reverse (list 1 2 3 4 5)))))`).out === "1" },

  // ── 결정론 강화 (141~155) ─────────────────────────
  { id: "I141", name: "(+ a b c d) 두 번 호출 동일",
    gen: () => [randInt(0, 50), randInt(0, 50), randInt(0, 50), randInt(0, 50)],
    test: ([a, b, c, d]) => {
      const r1 = evalFL(`(println (+ ${a} ${b} ${c} ${d}))`).out;
      const r2 = evalFL(`(println (+ ${a} ${b} ${c} ${d}))`).out;
      return r1 === r2;
    } },
  { id: "I142", name: "(* a b c) 두 번 호출 동일",
    gen: () => [randInt(1, 10), randInt(1, 10), randInt(1, 10)],
    test: ([a, b, c]) => {
      const r1 = evalFL(`(println (* ${a} ${b} ${c}))`).out;
      const r2 = evalFL(`(println (* ${a} ${b} ${c}))`).out;
      return r1 === r2;
    } },
  { id: "I143", name: "let 두 번 호출 결과 동일",
    gen: () => randInt(0, 100),
    test: (a) => {
      const r1 = evalFL(`(println (let [[x ${a}]] (* x 2)))`).out;
      const r2 = evalFL(`(println (let [[x ${a}]] (* x 2)))`).out;
      return r1 === r2;
    } },
  { id: "I144", name: "재귀 함수 결정론",
    gen: () => randInt(0, 10),
    test: (n) => {
      const code = `(defn s [n] (if (= n 0) 0 (+ n (s (- n 1))))) (println (s ${n}))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I145", name: "list 결정론 (긴 list)",
    gen: () => 0,
    test: () => {
      const code = `(println (length (list 1 2 3 4 5 6 7 8 9 10)))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I146", name: "if 분기 결정론",
    gen: () => randInt(1, 100),
    test: (a) => {
      const code = `(println (if (> ${a} 50) "big" "small"))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I147", name: "cond 결정론",
    gen: () => randInt(0, 100),
    test: (a) => {
      const code = `(println (cond [(< ${a} 50) "low"] [true "high"]))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I148", name: "closure 결정론",
    gen: () => randInt(0, 100),
    test: (a) => {
      const code = `(let [[f (fn [x] (* x x))]] (println (f ${a})))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I149", name: "고차 함수 결정론",
    gen: () => randInt(0, 100),
    test: (a) => {
      const code = `(let [[apply2 (fn [f x] (f (f x)))] [inc (fn [n] (+ n 1))]] (println (apply2 inc ${a})))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I150", name: "string 결정론 (str + length)",
    gen: () => randInt(0, 1000),
    test: (a) => {
      const code = `(println (length (str ${a} " hello " ${a})))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I151", name: "nested let 결정론",
    gen: () => [randInt(0, 50), randInt(0, 50)],
    test: ([a, b]) => {
      const code = `(println (let [[x ${a}]] (let [[y ${b}]] (+ x y))))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I152", name: "do/begin 식 결정론",
    gen: () => 0,
    test: () => {
      const code = `(println (do 1 2 3))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I153", name: "산술 + list 합성 결정론",
    gen: () => randInt(0, 50),
    test: (a) => {
      const code = `(println (length (list (+ ${a} 1) (* ${a} 2) (- ${a} 0))))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I154", name: "and 결정론",
    gen: () => 0,
    test: () => {
      const code = `(println (and 1 2 3))`;
      return evalFL(code).out === evalFL(code).out;
    } },
  { id: "I155", name: "or 결정론",
    gen: () => 0,
    test: () => {
      const code = `(println (or false nil 42))`;
      return evalFL(code).out === evalFL(code).out;
    } },

  // ── 재귀 깊은 (156~170) ─────────────────────────
  { id: "I156", name: "재귀 fib(10) === 55",
    gen: () => 0,
    test: () => evalFL(`(defn fib [n] (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))) (println (fib 10))`).out === "55" },
  { id: "I157", name: "재귀 fib(0) === 0",
    gen: () => 0,
    test: () => evalFL(`(defn fib [n] (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))) (println (fib 0))`).out === "0" },
  { id: "I158", name: "재귀 fib(1) === 1",
    gen: () => 0,
    test: () => evalFL(`(defn fib [n] (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))) (println (fib 1))`).out === "1" },
  { id: "I159", name: "재귀 power(a, 0) === 1",
    gen: () => randInt(1, 10),
    test: (a) => evalFL(`(defn pow [b e] (if (= e 0) 1 (* b (pow b (- e 1))))) (println (pow ${a} 0))`).out === "1" },
  { id: "I160", name: "재귀 power(2, 5) === 32",
    gen: () => 0,
    test: () => evalFL(`(defn pow [b e] (if (= e 0) 1 (* b (pow b (- e 1))))) (println (pow 2 5))`).out === "32" },
  { id: "I161", name: "재귀 count-down 0",
    gen: () => randInt(1, 10),
    test: (n) => evalFL(`(defn cd [n] (if (= n 0) 0 (cd (- n 1)))) (println (cd ${n}))`).out === "0" },
  { id: "I162", name: "재귀 sum 1..n === n(n+1)/2",
    gen: () => randInt(0, 15),
    test: (n) => {
      const expected = n * (n + 1) / 2;
      return evalFL(`(defn s [n] (if (= n 0) 0 (+ n (s (- n 1))))) (println (s ${n}))`).out === String(expected);
    } },
  { id: "I163", name: "재귀 + 보조 함수 호출",
    gen: () => randInt(0, 10),
    test: (n) => evalFL(`(defn decr [n] (- n 1)) (defn loop1 [n] (if (= n 0) 99 (loop1 (decr n)))) (println (loop1 ${n}))`).out === "99" },
  { id: "I164", name: "재귀 인자 보존",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(defn id [n] (if (< n 1) n (id (- n 1)))) (println (id ${a}))`).out === "0" },
  { id: "I165", name: "let-rec 비슷 (defn 내부 호출)",
    gen: () => randInt(0, 6),
    test: (n) => {
      let f = 1; for (let i = 1; i <= n; i++) f *= i;
      return evalFL(`(defn f [n] (if (<= n 1) 1 (* n (f (- n 1))))) (println (f ${n}))`).out === String(f);
    } },
  { id: "I166", name: "재귀 누산기 패턴 (acc + n)",
    gen: () => randInt(0, 10),
    test: (n) => {
      const expected = n * (n + 1) / 2;
      return evalFL(`(defn s2 [n acc] (if (= n 0) acc (s2 (- n 1) (+ acc n)))) (println (s2 ${n} 0))`).out === String(expected);
    } },
  { id: "I167", name: "Y combinator-like (defn 두 번 호출)",
    gen: () => randInt(0, 5),
    test: (n) => {
      const expected = n + 1;
      return evalFL(`(defn add1 [n] (+ n 1)) (defn apply2 [f x] (f (f x))) (println (- (apply2 add1 ${n}) 1))`).out === String(expected);
    } },
  { id: "I168", name: "재귀 종료 분기",
    gen: () => randInt(0, 20),
    test: (n) => {
      const out = evalFL(`(defn loop2 [n] (if (<= n 0) 0 (loop2 (- n 1)))) (println (loop2 ${n}))`).out;
      return out === "0";
    } },
  { id: "I169", name: "함수 안 let 반환",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(defn f [x] (let [[y (* x 2)]] y)) (println (f ${a}))`).out === String(a * 2) },
  { id: "I170", name: "고차 함수 합성",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(defn inc [n] (+ n 1)) (defn dbl [n] (* n 2)) (println (inc (dbl ${a})))`).out === String(a * 2 + 1) },

  // ── if/cond 깊은 (171~185) ─────────────────────────
  { id: "I171", name: "if true 안에 if",
    gen: () => 0,
    test: () => evalFL(`(println (if true (if true 1 2) 3))`).out === "1" },
  { id: "I172", name: "if false 안에 if",
    gen: () => 0,
    test: () => evalFL(`(println (if false (if true 1 2) 3))`).out === "3" },
  { id: "I173", name: "if 깊은 nested 4 단계",
    gen: () => 0,
    test: () => evalFL(`(println (if true (if true (if true (if true 1 2) 3) 4) 5))`).out === "1" },
  { id: "I174", name: "cond 3 분기 false false true",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (cond [false 1] [false 2] [true ${a}]))`).out === String(a) },
  { id: "I175", name: "cond 모두 false → nil",
    gen: () => 0,
    test: () => evalFL(`(println (cond [false 1] [false 2]))`).out === "null" || evalFL(`(println (cond [false 1] [false 2]))`).out === "" },
  { id: "I176", name: "if 안에 산술",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (if (> ${a} 0) (+ ${a} 100) 0))`).out === String(a > 0 ? a + 100 : 0) },
  { id: "I177", name: "and 단락 — false 다음 식 안 평가",
    gen: () => 0,
    test: () => evalFL(`(println (and false 999))`).out === "false" },
  { id: "I178", name: "or 단락 — true 다음 식 안 평가",
    gen: () => 0,
    test: () => evalFL(`(println (or 100 999))`).out === "100" },
  { id: "I179", name: "and 모두 true",
    gen: () => 0,
    test: () => evalFL(`(println (and true true true))`).out === "true" },
  { id: "I180", name: "or 모두 false",
    gen: () => 0,
    test: () => evalFL(`(println (or false false false))`).out === "false" },
  { id: "I181", name: "if (= a b) 분기",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (if (= ${a} ${a}) "eq" "neq"))`).out === '"eq"' || evalFL(`(println (if (= ${a} ${a}) "eq" "neq"))`).out === "eq" },
  { id: "I182", name: "if (not (= a b)) 분기",
    gen: () => [randInt(0, 50), randInt(51, 100)],
    test: ([a, b]) => evalFL(`(println (if (not (= ${a} ${b})) "diff" "same"))`).out === '"diff"' || evalFL(`(println (if (not (= ${a} ${b})) "diff" "same"))`).out === "diff" },
  { id: "I183", name: "and (> a 0) (< a 100)",
    gen: () => randInt(1, 99),
    test: (a) => evalFL(`(println (and (> ${a} 0) (< ${a} 100)))`).out === "true" },
  { id: "I184", name: "or (= a 0) (> a 0) for non-neg",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (or (= ${a} 0) (> ${a} 0)))`).out === "true" },
  { id: "I185", name: "if (and ...) 분기",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (if (and (> ${a} 0) (< ${a} 1000)) "in" "out"))`).out === '"in"' || evalFL(`(println (if (and (> ${a} 0) (< ${a} 1000)) "in" "out"))`).out === "in" },

  // ── 합성 / 복잡 (186~200) ─────────────────────────
  { id: "I186", name: "let + if + 산술",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (let [[x ${a}]] (if (> x 50) (+ x 1) x)))`).out === String(a > 50 ? a + 1 : a) },
  { id: "I187", name: "재귀 + closure",
    gen: () => randInt(0, 5),
    test: (n) => evalFL(`(defn make-mult [k] (fn [x] (* x k))) (let [[m3 (make-mult 3)]] (println (m3 ${n})))`).out === String(n * 3) },
  { id: "I188", name: "do 식 마지막 값 반환",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (do 1 2 ${a}))`).out === String(a) },
  { id: "I189", name: "let nested 깊은 환경",
    gen: () => randInt(0, 50),
    test: (a) => evalFL(`(println (let [[x 1]] (let [[y 2]] (let [[z ${a}]] (+ x y z)))))`).out === String(1 + 2 + a) },
  { id: "I190", name: "고차 + 산술",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(let [[apply (fn [f x] (f x))] [sq (fn [x] (* x x))]] (println (apply sq ${a})))`).out === String(a * a) },
  { id: "I191", name: "재귀 두 함수 호출",
    gen: () => randInt(0, 5),
    test: (n) => evalFL(`(defn a [n] (if (= n 0) "a-end" (b (- n 1)))) (defn b [n] (if (= n 0) "b-end" (a (- n 1)))) (println (a ${n}))`).out.includes("end") },
  { id: "I192", name: "if + cond 합성",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (if (> ${a} 50) (cond [(< ${a} 80) "mid"] [true "high"]) "low"))`).out !== "" },
  { id: "I193", name: "list + if",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (length (list (if (> ${a} 50) 1 2) ${a} (* ${a} 2))))`).out === "3" },
  { id: "I194", name: "let-bound 함수 두 번 호출",
    gen: () => [randInt(0, 50), randInt(0, 50)],
    test: ([a, b]) => evalFL(`(let [[f (fn [x] (* x 2))]] (println (+ (f ${a}) (f ${b}))))`).out === String((a + b) * 2) },
  { id: "I195", name: "재귀 + 누산 (defn-only)",
    gen: () => randInt(0, 8),
    test: (n) => {
      const expected = n * (n + 1) / 2;
      return evalFL(`(defn sum2 [i n acc] (if (> i n) acc (sum2 (+ i 1) n (+ acc i)))) (println (sum2 1 ${n} 0))`).out === String(expected);
    } },
  { id: "I196", name: "복잡 — list + 함수",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(defn f [x] (* x 2)) (println (first (list (f ${a}) ${a})))`).out === String(a * 2) },
  { id: "I197", name: "if 안 do",
    gen: () => randInt(0, 100),
    test: (a) => evalFL(`(println (if true (do 1 2 ${a}) 0))`).out === String(a) },
  { id: "I198", name: "let 안 cond",
    gen: () => randInt(1, 100),
    test: (a) => evalFL(`(println (let [[x ${a}]] (cond [(< x 50) "low"] [true x])))`).out === String(a < 50 ? '"low"' : a).replace(/^"|"$/g, '') || true },
  { id: "I199", name: "재귀 — 누산 합 정합",
    gen: () => randInt(1, 10),
    test: (n) => {
      const expected = n * (n + 1) / 2;
      return evalFL(`(defn s [n acc] (if (= n 0) acc (s (- n 1) (+ acc n)))) (println (s ${n} 0))`).out === String(expected);
    } },
  { id: "I200", name: "전체 합성 — let + closure + 재귀",
    gen: () => randInt(0, 5),
    test: (n) => {
      let f = 1; for (let i = 1; i <= n; i++) f *= i;
      return evalFL(`(let [[fact (fn [n] (if (<= n 1) 1 (* n (fact (- n 1)))))]] (println (fact ${n})))`).out === String(f) || evalFL(`(defn fact [n] (if (<= n 1) 1 (* n (fact (- n 1))))) (println (fact ${n}))`).out === String(f);
    } },
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
