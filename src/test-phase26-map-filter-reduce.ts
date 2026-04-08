// FreeLang v9: Phase 26 — map/filter/reduce Codegen 지원
// FL 고차 데이터 처리 연산 → JavaScript 컴파일 검증

import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
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
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc   = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"),  "utf-8");
const parserSrc  = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");

function compileAndRun(flSrc: string): any {
  const interp = new Interpreter();
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  interp.interpret(parse(lex(`(gen-js (parse (lex ${JSON.stringify(flSrc)})))`)));
  const jsCode = interp.context.lastValue as string;
  if (typeof jsCode !== "string") throw new Error(`codegen returned ${typeof jsCode}`);
  const sandbox: Record<string, any> = { module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);
  return sandbox.module.exports;
}

// ─── [10] map 컴파일 ─────────────────────────────────────────────
console.log("\n[10] map 컴파일");

test("map: 배열 각 원소 2배", () => {
  const exp = compileAndRun(`
[FUNC double-all :params [$lst]
  :body ((map $lst [x] (* $x 2)))
]
(export double-all)
  `.trim());
  const result = exp["double-all"]([1, 2, 3, 4]);
  if (!Array.isArray(result)) throw new Error(`not array: ${result}`);
  if (result.join(",") !== "2,4,6,8") throw new Error(`got ${result}`);
});

test("map: 문자열 변환", () => {
  const exp = compileAndRun(`
[FUNC stringify-all :params [$lst]
  :body ((map $lst [x] (num-to-str $x)))
]
(export stringify-all)
  `.trim());
  const result = exp["stringify-all"]([1, 2, 3]);
  if (result.join(",") !== "1,2,3") throw new Error(`got ${result}`);
});

test("map: 람다 참조 전달", () => {
  const exp = compileAndRun(`
[FUNC inc :params [$n] :body ((+ $n 1))]
[FUNC inc-all :params [$lst]
  :body ((map $lst inc))
]
(export inc-all)
  `.trim());
  const result = exp["inc-all"]([10, 20, 30]);
  if (result.join(",") !== "11,21,31") throw new Error(`got ${result}`);
});

test("map: 중첩 표현식", () => {
  const exp = compileAndRun(`
[FUNC transform :params [$lst]
  :body (
    (map $lst [x]
      (if (> $x 0) (* $x 10) 0)
    )
  )
]
(export transform)
  `.trim());
  const result = exp.transform([-1, 2, -3, 4]);
  if (result.join(",") !== "0,20,0,40") throw new Error(`got ${result}`);
});

// ─── [11] filter 컴파일 ──────────────────────────────────────────
console.log("\n[11] filter 컴파일");

test("filter: 양수만 추출", () => {
  const exp = compileAndRun(`
[FUNC positives :params [$lst]
  :body ((filter $lst [x] (> $x 0)))
]
(export positives)
  `.trim());
  const result = exp.positives([-1, 2, -3, 4, 0, 5]);
  if (result.join(",") !== "2,4,5") throw new Error(`got ${result}`);
});

test("filter: 짝수만 추출", () => {
  const exp = compileAndRun(`
[FUNC evens :params [$lst]
  :body ((filter $lst [x] (= (% $x 2) 0)))
]
(export evens)
  `.trim());
  const result = exp.evens([1, 2, 3, 4, 5, 6]);
  if (result.join(",") !== "2,4,6") throw new Error(`got ${result}`);
});

test("filter: 특정 값 이상", () => {
  const exp = compileAndRun(`
[FUNC above-threshold :params [$lst $n]
  :body ((filter $lst [x] (>= $x $n)))
]
(export above-threshold)
  `.trim());
  const result = exp["above-threshold"]([1, 5, 3, 8, 2, 7], 5);
  if (result.join(",") !== "5,8,7") throw new Error(`got ${result}`);
});

// ─── [12] reduce 컴파일 ──────────────────────────────────────────
console.log("\n[12] reduce 컴파일");

test("reduce: 합산", () => {
  const exp = compileAndRun(`
[FUNC sum :params [$lst]
  :body ((reduce $lst 0 [acc x] (+ $acc $x)))
]
(export sum)
  `.trim());
  if (exp.sum([1, 2, 3, 4, 5]) !== 15) throw new Error(`got ${exp.sum([1,2,3,4,5])}`);
});

test("reduce: 곱셈", () => {
  const exp = compileAndRun(`
[FUNC product :params [$lst]
  :body ((reduce $lst 1 [acc x] (* $acc $x)))
]
(export product)
  `.trim());
  if (exp.product([1, 2, 3, 4, 5]) !== 120) throw new Error(`got ${exp.product([1,2,3,4,5])}`);
});

test("reduce: 최대값", () => {
  const exp = compileAndRun(`
[FUNC list-max :params [$lst]
  :body ((reduce $lst (get $lst 0) [acc x] (if (> $x $acc) $x $acc)))
]
(export list-max)
  `.trim());
  if (exp["list-max"]([3, 1, 4, 1, 5, 9, 2, 6]) !== 9) {
    throw new Error(`got ${exp["list-max"]([3,1,4,1,5,9,2,6])}`);
  }
});

test("reduce: 문자열 합치기", () => {
  const exp = compileAndRun(`
[FUNC join-words :params [$lst]
  :body ((reduce $lst "" [acc x] (concat $acc (if (= $acc "") $x (concat " " $x)))))
]
(export join-words)
  `.trim());
  const result = exp["join-words"](["hello", "world", "fl"]);
  if (result !== "hello world fl") throw new Error(`got "${result}"`);
});

// ─── [13] 조합 연산 (체이닝) ─────────────────────────────────────
console.log("\n[13] map + filter + reduce 체이닝");

test("filter → map 체이닝", () => {
  const exp = compileAndRun(`
[FUNC positive-doubles :params [$lst]
  :body (
    (let [[pos (filter $lst [x] (> $x 0))]]
      (map $pos [x] (* $x 2))
    )
  )
]
(export positive-doubles)
  `.trim());
  const result = exp["positive-doubles"]([-1, 2, -3, 4, -5, 6]);
  if (result.join(",") !== "4,8,12") throw new Error(`got ${result}`);
});

test("map → reduce 체이닝", () => {
  const exp = compileAndRun(`
[FUNC sum-of-squares :params [$lst]
  :body (
    (let [[squares (map $lst [x] (* $x $x))]]
      (reduce $squares 0 [acc x] (+ $acc $x))
    )
  )
]
(export sum-of-squares)
  `.trim());
  // 1²+2²+3²+4²+5² = 1+4+9+16+25 = 55
  if (exp["sum-of-squares"]([1, 2, 3, 4, 5]) !== 55) {
    throw new Error(`got ${exp["sum-of-squares"]([1,2,3,4,5])}`);
  }
});

test("filter → reduce: 양수 합산", () => {
  const exp = compileAndRun(`
[FUNC sum-positives :params [$lst]
  :body (
    (reduce (filter $lst [x] (> $x 0)) 0 [acc x] (+ $acc $x))
  )
]
(export sum-positives)
  `.trim());
  if (exp["sum-positives"]([-1, 2, -3, 4, -5, 6]) !== 12) {
    throw new Error(`got ${exp["sum-positives"]([-1,2,-3,4,-5,6])}`);
  }
});

test("전체 파이프라인: filter → map → reduce", () => {
  const exp = compileAndRun(`
[FUNC pipeline :params [$lst]
  :body (
    (let [[filtered (filter $lst [x] (> $x 2))]]
      (let [[mapped (map $filtered [x] (* $x $x))]]
        (reduce $mapped 0 [acc x] (+ $acc $x))
      )
    )
  )
]
(export pipeline)
  `.trim());
  // filter > 2: [3, 4, 5] → map ²: [9, 16, 25] → reduce +: 50
  if (exp.pipeline([1, 2, 3, 4, 5]) !== 50) {
    throw new Error(`got ${exp.pipeline([1,2,3,4,5])}`);
  }
});

// ─── [14] 실용적 예제 ────────────────────────────────────────────
console.log("\n[14] 실용적 예제");

test("단어 길이 목록", () => {
  const exp = compileAndRun(`
[FUNC word-lengths :params [$words]
  :body ((map $words [w] (length $w)))
]
(export word-lengths)
  `.trim());
  const result = exp["word-lengths"](["hello", "world", "fl"]);
  if (result.join(",") !== "5,5,2") throw new Error(`got ${result}`);
});

test("count-if: 조건 만족 원소 수", () => {
  const exp = compileAndRun(`
[FUNC count-if :params [$lst $pred]
  :body (
    (length (filter $lst $pred))
  )
]
[FUNC count-positives :params [$lst]
  :body ((count-if $lst (fn [$x] (> $x 0))))
]
(export count-positives)
  `.trim());
  if (exp["count-positives"]([-1, 2, -3, 4, 5]) !== 3) {
    throw new Error(`got ${exp["count-positives"]([-1,2,-3,4,5])}`);
  }
});

// ─── 결과 ─────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 26 map/filter/reduce: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
