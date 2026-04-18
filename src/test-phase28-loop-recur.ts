// FreeLang v9: Phase 28 — loop/recur 꼬리 재귀 최적화
// (loop [bindings] body) + (recur vals) → while 루프로 컴파일

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
  const sandbox: Record<string, any> = { module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);
  return sandbox.module.exports;
}

// ─── [20] loop/recur 기본 ──────────────────────────────────────────
console.log("\n[20] loop/recur 기본");

test("loop: 단순 카운트다운", () => {
  const exp = compileAndRun(`
[FUNC countdown :params [$n]
  :body (
    (loop [[$n $n] [$acc 0]]
      (if (<= $n 0)
        $acc
        (recur (- $n 1) (+ $acc 1))
      )
    )
  )
]
(export countdown)
  `.trim());
  if (exp.countdown(100) !== 100) throw new Error(`got ${exp.countdown(100)}`);
  if (exp.countdown(0) !== 0) throw new Error(`got ${exp.countdown(0)}`);
});

test("loop: 반복 덧셈 (꼬리 재귀 sum)", () => {
  const exp = compileAndRun(`
[FUNC sum-loop :params [$n]
  :body (
    (loop [[$i $n] [$acc 0]]
      (if (<= $i 0)
        $acc
        (recur (- $i 1) (+ $acc $i))
      )
    )
  )
]
(export sum-loop)
  `.trim());
  // 1+2+...+100 = 5050
  if (exp["sum-loop"](100) !== 5050) throw new Error(`got ${exp["sum-loop"](100)}`);
});

test("loop: 팩토리얼 (꼬리 재귀)", () => {
  const exp = compileAndRun(`
[FUNC fact-loop :params [$n]
  :body (
    (loop [[$n $n] [$acc 1]]
      (if (<= $n 1)
        $acc
        (recur (- $n 1) (* $acc $n))
      )
    )
  )
]
(export fact-loop)
  `.trim());
  if (exp["fact-loop"](10) !== 3628800) throw new Error(`got ${exp["fact-loop"](10)}`);
  if (exp["fact-loop"](0) !== 1) throw new Error(`got ${exp["fact-loop"](0)}`);
});

test("loop: fibonacci (꼬리 재귀)", () => {
  const exp = compileAndRun(`
[FUNC fib-loop :params [$n]
  :body (
    (loop [[$n $n] [$a 0] [$b 1]]
      (if (<= $n 0)
        $a
        (recur (- $n 1) $b (+ $a $b))
      )
    )
  )
]
(export fib-loop)
  `.trim());
  if (exp["fib-loop"](10) !== 55) throw new Error(`got ${exp["fib-loop"](10)}`);
  if (exp["fib-loop"](0) !== 0) throw new Error(`got ${exp["fib-loop"](0)}`);
  if (exp["fib-loop"](1) !== 1) throw new Error(`got ${exp["fib-loop"](1)}`);
});

// ─── [21] 깊은 재귀 (TCO 검증) ───────────────────────────────────
console.log("\n[21] 깊은 재귀 — TCO 검증");

test("loop: 10만 번 반복 (스택 오버플로우 없음)", () => {
  const exp = compileAndRun(`
[FUNC big-sum :params [$n]
  :body (
    (loop [[$i $n] [$acc 0]]
      (if (<= $i 0)
        $acc
        (recur (- $i 1) (+ $acc $i))
      )
    )
  )
]
(export big-sum)
  `.trim());
  // 1+2+...+100000 = 5000050000
  const result = exp["big-sum"](100000);
  if (result !== 5000050000) throw new Error(`got ${result}`);
});

test("loop: GCD (최대공약수)", () => {
  const exp = compileAndRun(`
[FUNC gcd :params [$a $b]
  :body (
    (loop [[$a $a] [$b $b]]
      (if (= $b 0)
        $a
        (recur $b (% $a $b))
      )
    )
  )
]
(export gcd)
  `.trim());
  if (exp.gcd(48, 18) !== 6) throw new Error(`gcd(48,18)=${exp.gcd(48,18)}`);
  if (exp.gcd(100, 75) !== 25) throw new Error(`gcd(100,75)=${exp.gcd(100,75)}`);
});

test("loop: 문자열 반복 구성", () => {
  const exp = compileAndRun(`
[FUNC repeat-str :params [$s $n]
  :body (
    (loop [[$n $n] [$acc ""]]
      (if (<= $n 0)
        $acc
        (recur (- $n 1) (concat $acc $s))
      )
    )
  )
]
(export repeat-str)
  `.trim());
  if (exp["repeat-str"]("ab", 3) !== "ababab") throw new Error(`got ${exp["repeat-str"]("ab",3)}`);
  if (exp["repeat-str"]("x", 0) !== "") throw new Error(`got ${exp["repeat-str"]("x",0)}`);
});

// ─── 결과 ─────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 28 loop/recur TCO: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
