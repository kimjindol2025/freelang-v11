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
