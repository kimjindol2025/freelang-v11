// FreeLang v9: Phase 30 — 진짜 셀프 컴파일러
//
// 목표: FL 컴파일러(lexer+parser+codegen) 자체를 tsCompile로 컴파일 →
//       standalone JS 컴파일러 생성 → 이 standalone 컴파일러가 FL 프로그램을
//       tsCompile과 동일하게 컴파일하는지 검증
//
// compilerA(x) = tsCompile(x)   [TS 인터프리터 기반]
// compilerB(x) = standaloneLex → standaloneParse → standaloneCodegen
// 검증: compilerA(x) === compilerB(x)

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

// ── TS AST → FL AST 형식 변환 ────────────────────────────────────────
// TS 파서: fields=Map, 배열={kind:"block",type:"Array",...}
// FL 파서: fields=Object, 배열={kind:"array",items:[...]}
// TS PatternMatch → FL match sexpr 변환 시 패턴 op 추출
function patternToOp(pattern: any): string {
  if (!pattern || pattern.kind === "wildcard-pattern") return "_";
  if (pattern.kind === "literal-pattern") {
    // JSON.stringify로 JS 문자열 리터럴 형식(따옴표 포함)으로 변환
    // gen-match가 "\"" 포함 여부로 감싸기 여부를 결정함
    if (pattern.type === "string") return JSON.stringify(String(pattern.value));
    if (pattern.type === "number") return String(pattern.value);
    if (pattern.type === "boolean") return String(pattern.value);
  }
  if (pattern.kind === "variable-pattern") return pattern.name;
  return "_";
}

function convertTStoFL(node: any): any {
  if (node === null || node === undefined) return node;
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(convertTStoFL);

  const kind = node.kind;

  if (kind === "block") {
    // fields Map → plain object
    const rawFields = node.fields;
    const fields: Record<string, any> = {};
    if (rawFields instanceof Map) {
      for (const [k, v] of rawFields) fields[k] = convertTStoFL(v);
    } else if (rawFields && typeof rawFields === "object") {
      for (const [k, v] of Object.entries(rawFields)) fields[k] = convertTStoFL(v);
    }
    if (node.type === "Array") return { kind: "array", items: fields.items || [] };
    if (node.type === "Map")   return { kind: "map-literal", pairs: fields };
    return { kind: "block", type: node.type, name: node.name, fields, line: node.line ?? null };
  }
  if (kind === "sexpr") {
    return { kind: "sexpr", op: node.op, args: (node.args || []).map(convertTStoFL), line: node.line ?? null };
  }
  // TS PatternMatch → FL match sexpr
  // {kind:"pattern-match", value, cases:[{pattern, body}], defaultCase?}
  // → {kind:"sexpr", op:"match", args:[value, {kind:"sexpr", op:patOp, args:[body]}, ...]}
  if (kind === "pattern-match") {
    const subject = convertTStoFL(node.value);
    const clauseArgs: any[] = [];
    for (const c of (node.cases || [])) {
      const patOp = patternToOp(c.pattern);
      clauseArgs.push({ kind: "sexpr", op: patOp, args: [convertTStoFL(c.body)] });
    }
    if (node.defaultCase) {
      clauseArgs.push({ kind: "sexpr", op: "_", args: [convertTStoFL(node.defaultCase)] });
    }
    return { kind: "sexpr", op: "match", args: [subject, ...clauseArgs] };
  }
  // literal, variable, keyword — same structure
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = Array.isArray(v) ? (v as any[]).map(convertTStoFL) : convertTStoFL(v);
  }
  return result;
}

// ── 참조 컴파일러 (TS lex+parse → FL gen-js) ──────────────────────────
// TS lex/parse로 AST 생성 (스택 안전), FL gen-js로 코드 생성
function tsCompile(flSrc: string): string {
  const interp = new Interpreter();
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  const rawAst = parse(lex(flSrc));
  const flAst = convertTStoFL(rawAst);
  (interp.context as any).variables.set("$__fl_ast__", flAst);
  interp.interpret(parse(lex("(gen-js $__fl_ast__)")));
  return interp.context.lastValue as string;
}

// ── VM 모듈 헬퍼 ────────────────────────────────────────────────────
function makeModule(jsCode: string): any {
  const sandbox: Record<string, any> = { module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);
  return sandbox.module.exports;
}

// ── [24] FL 컴파일러 각 파일을 standalone JS로 컴파일 ────────────────
console.log("\n[24] FL 컴파일러 → standalone JS 컴파일");

let lexerMod: any = null;
let parserMod: any = null;
let codegenMod: any = null;

test("lexer.fl → standalone JS 컴파일", () => {
  const lexerJS = tsCompile(lexerSrc);
  if (typeof lexerJS !== "string" || lexerJS.length === 0) throw new Error("empty output");
  lexerMod = makeModule(lexerJS);
  if (typeof lexerMod.lex !== "function") throw new Error("lex not exported");
  // 기본 검증: lex가 토큰을 만들어내는지
  const tokens = lexerMod.lex("(+ 1 2)");
  if (!Array.isArray(tokens)) throw new Error("lex returned non-array");
  if (tokens.length === 0) throw new Error("lex returned empty");
});

test("parser.fl → standalone JS 컴파일", () => {
  const parserJS = tsCompile(parserSrc);
  if (typeof parserJS !== "string" || parserJS.length === 0) throw new Error("empty output");
  parserMod = makeModule(parserJS);
  if (typeof parserMod.parse !== "function") throw new Error("parse not exported");
  // 기본 검증: parse가 AST를 만들어내는지
  const tokens = lexerMod.lex("(+ 1 2)");
  const ast = parserMod.parse(tokens);
  if (!Array.isArray(ast)) throw new Error("parse returned non-array");
});

test("codegen.fl → standalone JS 컴파일", () => {
  const codegenJS = tsCompile(codegenSrc);
  if (typeof codegenJS !== "string" || codegenJS.length === 0) throw new Error("empty output");
  codegenMod = makeModule(codegenJS);
  if (typeof codegenMod["gen-js"] !== "function") throw new Error("gen-js not exported");
});

// ── [25] Standalone 컴파일러로 FL 프로그램 컴파일 ──────────────────
console.log("\n[25] Standalone 컴파일러 동작 검증");

function standaloneCompile(flSrc: string): string {
  if (!lexerMod || !parserMod || !codegenMod) throw new Error("modules not ready");
  const tokens = lexerMod.lex(flSrc);
  const ast = parserMod.parse(tokens);
  return codegenMod["gen-js"](ast);
}

const TEST_PROGRAMS = [
  { name: "덧셈 함수",   src: `[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)` },
  { name: "재귀 팩토리얼", src: `[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)` },
  { name: "fibonacci",   src: `[FUNC fib :params [$n] :body ((if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2)))))] (export fib)` },
  { name: "map 체이닝",  src: `[FUNC double-positives :params [$lst] :body ((map (filter $lst [x] (> $x 0)) [x] (* $x 2)))] (export double-positives)` },
  { name: "loop/recur",  src: `[FUNC sum-n :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export sum-n)` },
  { name: "match",       src: `[FUNC grade :params [$s] :body ((match $s ("A" "excellent") ("B" "good") (_ "ok")))] (export grade)` },
  { name: "cond",        src: `[FUNC sign :params [$n] :body ((cond [(> $n 0) "positive"] [(< $n 0) "negative"] [else "zero"]))] (export sign)` },
  { name: "fn 람다",     src: `[FUNC make-adder :params [$n] :body ((fn [$x] (+ $x $n)))] (export make-adder)` },
  { name: "reduce 합산", src: `[FUNC sum :params [$lst] :body ((reduce $lst 0 [acc x] (+ $acc $x)))] (export sum)` },
];

for (const prog of TEST_PROGRAMS) {
  test(`standalone 컴파일: ${prog.name}`, () => {
    if (!codegenMod) throw new Error("not ready");
    const js = standaloneCompile(prog.src);
    if (typeof js !== "string" || js.length === 0) throw new Error("empty output");
  });
}

// ── [26] Bootstrap 동치성: tsCompile === standaloneCompile ──────────
console.log("\n[26] Bootstrap 동치성 검증");

for (const prog of TEST_PROGRAMS) {
  test(`동치: ${prog.name}`, () => {
    if (!codegenMod) throw new Error("not ready");
    const tsJS = tsCompile(prog.src);
    const stJS = standaloneCompile(prog.src);
    if (tsJS !== stJS) {
      let diffIdx = 0;
      for (let i = 0; i < Math.min(tsJS.length, stJS.length); i++) {
        if (tsJS[i] !== stJS[i]) { diffIdx = i; break; }
      }
      const ctx1 = tsJS.substring(Math.max(0, diffIdx - 20), diffIdx + 40);
      const ctx2 = stJS.substring(Math.max(0, diffIdx - 20), diffIdx + 40);
      throw new Error(`diff at ${diffIdx}\nTS: ${JSON.stringify(ctx1)}\nST: ${JSON.stringify(ctx2)}`);
    }
  });
}

// ── [27] 런타임 정확성: standalone 컴파일 결과 실행 ────────────────
console.log("\n[27] 런타임 정확성");

test("fact(10) = 3628800", () => {
  const js = standaloneCompile(`[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)`);
  const m = makeModule(js);
  if (m.fact(10) !== 3628800) throw new Error(`fact(10)=${m.fact(10)}`);
});

test("fib(15) = 610", () => {
  const js = standaloneCompile(`[FUNC fib :params [$n] :body ((if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2)))))] (export fib)`);
  const m = makeModule(js);
  if (m.fib(15) !== 610) throw new Error(`fib(15)=${m.fib(15)}`);
});

test("loop 10만 반복 sum = 5000050000", () => {
  const js = standaloneCompile(`[FUNC big-sum :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export big-sum)`);
  const m = makeModule(js);
  if (m["big-sum"](100000) !== 5000050000) throw new Error(`got ${m["big-sum"](100000)}`);
});

test("filter+map+reduce 파이프라인", () => {
  const src = `
[FUNC pipeline :params [$lst]
  :body (
    (let [[filtered (filter $lst [x] (> $x 0))]]
      (let [[mapped (map $filtered [x] (* $x $x))]]
        (reduce $mapped 0 [acc x] (+ $acc $x))
      )
    )
  )
]
(export pipeline)
  `.trim();
  const js = standaloneCompile(src);
  const m = makeModule(js);
  // filter >0: [1,2,3,4,5] → map²: [1,4,9,16,25] → reduce+: 55
  if (m.pipeline([-1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) !== 55) {
    throw new Error(`got ${m.pipeline([-1,1,-2,2,-3,3,-4,4,-5,5])}`);
  }
});

// ── 결과 ──────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 30 Self-Compile: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
