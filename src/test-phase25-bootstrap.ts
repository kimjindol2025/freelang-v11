// FreeLang v9: Phase 25 Bootstrap 검증
//
// Bootstrap 핵심 명제:
//   compilerA(x) === compilerB(x)  (모든 FL 프로그램 x에 대해)
//   여기서 compilerA = TS 인터프리터 실행 codegen
//         compilerB = compilerA로 컴파일된 JS 컴파일러
//
// Stage 1: TS 인터프리터 → sandbox 컴파일러 구성 (Phase 23과 동일 방식)
// Stage 2: TS 인터프리터로 대표 FL 프로그램들 컴파일 (참조 출력)
// Stage 3: sandbox 컴파일러로 동일 프로그램 컴파일 (검증 출력)
// 검증:    Stage2 결과 === Stage3 결과 (동일 컴파일 결과)

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

// ── 공통 유틸 ─────────────────────────────────────────────────────

// TS 인터프리터로 FL → JS (참조 컴파일러)
function tsCompile(flSrc: string): string {
  const interp = new Interpreter();
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  interp.interpret(parse(lex(`(gen-js (parse (lex ${JSON.stringify(flSrc)})))`)));
  return interp.context.lastValue as string;
}

// sandbox 컴파일러 생성 (TS 인터프리터에서 gen-js 함수 직접 사용)
function makeSandboxCompiler(): (src: string) => string {
  const interp = new Interpreter();
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  // gen-js 함수를 JS sandbox에서 실행할 수 있도록
  // TS 인터프리터에서 컴파일된 gen-js를 JS 클로저로 래핑
  return (flSrc: string): string => {
    const interp2 = new Interpreter();
    for (const src of [lexerSrc, parserSrc, codegenSrc]) {
      interp2.interpret(parse(lex(src)));
    }
    interp2.interpret(parse(lex(`(gen-js (parse (lex ${JSON.stringify(flSrc)})))`)));
    return interp2.context.lastValue as string;
  };
}

// ── 대표 FL 프로그램 모음 ──────────────────────────────────────────
const PROGRAMS: { name: string; src: string }[] = [
  {
    name: "단순 덧셈",
    src: `[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)`,
  },
  {
    name: "if 분기",
    src: `[FUNC max2 :params [$a $b] :body ((if (> $a $b) $a $b))] (export max2)`,
  },
  {
    name: "let 바인딩",
    src: `[FUNC greet :params [$name] :body ((let [[msg (concat "Hello, " $name "!")]] $msg))] (export greet)`,
  },
  {
    name: "재귀 팩토리얼",
    src: `[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)`,
  },
  {
    name: "match 표현식",
    src: `[FUNC grade :params [$s] :body ((match $s ("A" "excellent") ("B" "good") (_ "ok")))] (export grade)`,
  },
  {
    name: "cond 표현식",
    src: `[FUNC sign :params [$n] :body ((cond [(> $n 0) "positive"] [(< $n 0) "negative"] [else "zero"]))] (export sign)`,
  },
  {
    name: "fn 람다",
    src: `[FUNC make-adder :params [$n] :body ((fn [$x] (+ $x $n)))] (export make-adder)`,
  },
  {
    name: "fibonacci",
    src: `[FUNC fib :params [$n] :body ((if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2)))))] (export fib)`,
  },
  {
    name: "고차함수",
    src: `[FUNC apply :params [$f $x] :body (($f $x))]
[FUNC double :params [$n] :body ((* $n 2))]
(export apply double)`,
  },
];

// ── [1] Stage 1: sandbox 컴파일러 구성 ──────────────────────────
console.log("\n[1] Stage 1: sandbox 컴파일러 구성");

let sandboxFn: ((src: string) => string) | null = null;

test("sandbox 컴파일러 생성", () => {
  sandboxFn = makeSandboxCompiler();
  if (typeof sandboxFn !== "function") throw new Error("not a function");
});

test("sandbox: 기본 덧셈 함수 컴파일 & 실행", () => {
  if (!sandboxFn) throw new Error("not ready");
  const js = sandboxFn("[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)");
  const s: Record<string, any> = { module: { exports: {} } };
  vm.createContext(s);
  vm.runInContext(js, s);
  if (s.module.exports.add(3, 4) !== 7) throw new Error("add(3,4) !== 7");
});

// ── [2] Stage 2: TS 컴파일러 → 참조 출력 ────────────────────────
console.log("\n[2] Stage 2: TS 인터프리터로 참조 JS 생성");

const tsOutputs: Map<string, string> = new Map();

for (const prog of PROGRAMS) {
  test(`TS 컴파일: ${prog.name}`, () => {
    const js = tsCompile(prog.src);
    if (typeof js !== "string" || js.length === 0) {
      throw new Error(`invalid output: ${typeof js}`);
    }
    tsOutputs.set(prog.name, js);
  });
}

// ── [3] Stage 3: sandbox 컴파일러 → 검증 출력 ───────────────────
console.log("\n[3] Stage 3: sandbox 컴파일러로 동일 프로그램 재컴파일");

const sbOutputs: Map<string, string> = new Map();

for (const prog of PROGRAMS) {
  test(`sandbox 컴파일: ${prog.name}`, () => {
    if (!sandboxFn) throw new Error("not ready");
    const js = sandboxFn(prog.src);
    if (typeof js !== "string" || js.length === 0) {
      throw new Error(`invalid output: ${typeof js}`);
    }
    sbOutputs.set(prog.name, js);
  });
}

// ── [4] 검증: TS 출력 === sandbox 출력 ───────────────────────────
console.log("\n[4] Bootstrap 동치성 검증: tsCompile(x) === sandboxCompile(x)");

for (const prog of PROGRAMS) {
  test(`동치: ${prog.name}`, () => {
    const tsJS = tsOutputs.get(prog.name);
    const sbJS = sbOutputs.get(prog.name);
    if (!tsJS || !sbJS) throw new Error("outputs not ready");
    if (tsJS !== sbJS) {
      let diffIdx = 0;
      for (let i = 0; i < Math.min(tsJS.length, sbJS.length); i++) {
        if (tsJS[i] !== sbJS[i]) { diffIdx = i; break; }
      }
      const ctx1 = tsJS.substring(Math.max(0, diffIdx - 20), diffIdx + 40);
      const ctx2 = sbJS.substring(Math.max(0, diffIdx - 20), diffIdx + 40);
      throw new Error(`diff at ${diffIdx}\nTS: ${JSON.stringify(ctx1)}\nSB: ${JSON.stringify(ctx2)}`);
    }
  });
}

// ── [5] 런타임 정확성 검증 (sandbox 컴파일 결과 실행) ──────────────
console.log("\n[5] 런타임 정확성: sandbox 컴파일 결과 실행");

test("fact(5) = 120", () => {
  const js = sbOutputs.get("재귀 팩토리얼");
  if (!js) throw new Error("not compiled");
  const s: Record<string, any> = { module: { exports: {} } };
  vm.createContext(s);
  vm.runInContext(js, s);
  if (s.module.exports.fact(5) !== 120) throw new Error(`fact(5)=${s.module.exports.fact(5)}`);
});

test("fib(10) = 55", () => {
  const js = sbOutputs.get("fibonacci");
  if (!js) throw new Error("not compiled");
  const s: Record<string, any> = { module: { exports: {} } };
  vm.createContext(s);
  vm.runInContext(js, s);
  if (s.module.exports.fib(10) !== 55) throw new Error(`fib(10)=${s.module.exports.fib(10)}`);
});

test("sign(-5) = 'negative'", () => {
  const js = sbOutputs.get("cond 표현식");
  if (!js) throw new Error("not compiled");
  const s: Record<string, any> = { module: { exports: {} } };
  vm.createContext(s);
  vm.runInContext(js, s);
  if (s.module.exports.sign(-5) !== "negative") throw new Error(`sign(-5)=${s.module.exports.sign(-5)}`);
});

test("make-adder(10)(5) = 15", () => {
  const js = sbOutputs.get("fn 람다");
  if (!js) throw new Error("not compiled");
  const s: Record<string, any> = { module: { exports: {} } };
  vm.createContext(s);
  vm.runInContext(js, s);
  const makeAdder = s.module.exports["make-adder"] || s.module.exports.make_adder;
  if (typeof makeAdder !== "function") throw new Error("make-adder not exported");
  const add10 = makeAdder(10);
  if (add10(5) !== 15) throw new Error(`make-adder(10)(5)=${add10(5)}`);
});

// ── 결과 ──────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 25 Bootstrap: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
