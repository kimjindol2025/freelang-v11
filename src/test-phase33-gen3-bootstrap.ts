// FreeLang v9: Phase 33 — Gen3 Bootstrap 고정점 증명
//
// 목표: Gen2(compiler.fl) === Gen3(compiler.fl)
//       컴파일러가 자기 자신을 컴파일해도 동일한 출력 → 고정점 달성
//
// 체인:
//   Gen1 = tsCompile(*.fl)            — TS parser 보조
//   Gen2 = standaloneCompile1(*.fl)   — Gen1 JS로 컴파일
//   Gen3 = standaloneCompile2(*.fl)   — Gen2 JS로 컴파일
//
//   Gen1 === Gen2 === Gen3  ← 고정점 증명

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
    console.log(`  ❌ ${name}: ${e.message?.slice(0, 120)}`);
    failed++;
  }
}

const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc   = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"),  "utf-8");
const parserSrc  = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");

function patternToOp(p: any): string {
  if (!p || p.kind === "wildcard-pattern") return "_";
  if (p.kind === "literal-pattern") {
    if (p.type === "string") return JSON.stringify(String(p.value));
    return String(p.value);
  }
  if (p.kind === "variable-pattern") return p.name;
  return "_";
}
function convertTStoFL(node: any): any {
  if (node === null || node === undefined) return node;
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(convertTStoFL);
  const kind = node.kind;
  if (kind === "block") {
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
  if (kind === "sexpr") return { kind: "sexpr", op: node.op, args: (node.args || []).map(convertTStoFL), line: node.line ?? null };
  if (kind === "pattern-match") {
    const subject = convertTStoFL(node.value);
    const cl: any[] = (node.cases || []).map((c: any) => ({
      kind: "sexpr", op: patternToOp(c.pattern), args: [convertTStoFL(c.body)]
    }));
    if (node.defaultCase) cl.push({ kind: "sexpr", op: "_", args: [convertTStoFL(node.defaultCase)] });
    return { kind: "sexpr", op: "match", args: [subject, ...cl] };
  }
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = Array.isArray(v) ? (v as any[]).map(convertTStoFL) : convertTStoFL(v);
  }
  return result;
}

function tsCompile(flSrc: string): string {
  const interp = new Interpreter();
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  const flAst = convertTStoFL(parse(lex(flSrc)));
  (interp.context as any).variables.set("$__fl_ast__", flAst);
  interp.interpret(parse(lex("(gen-js $__fl_ast__)")));
  return interp.context.lastValue as string;
}

function makeModule(jsCode: string): any {
  const sandbox: Record<string, any> = { module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);
  return sandbox.module.exports;
}

// ── Gen1 빌드 ─────────────────────────────────────────────────
console.log("\n[33-A] Gen 1: tsCompile로 컴파일러 생성");

let lexerMod1: any = null;
let parserMod1: any = null;
let codegenMod1: any = null;

test("lexer.fl → Gen1", () => {
  lexerMod1 = makeModule(tsCompile(lexerSrc));
  if (typeof lexerMod1.lex !== "function") throw new Error("lex not exported");
});
test("parser.fl → Gen1", () => {
  parserMod1 = makeModule(tsCompile(parserSrc));
  if (typeof parserMod1.parse !== "function") throw new Error("parse not exported");
});
test("codegen.fl → Gen1", () => {
  codegenMod1 = makeModule(tsCompile(codegenSrc));
  if (typeof codegenMod1["gen-js"] !== "function") throw new Error("gen-js not exported");
});

function standaloneCompile1(flSrc: string): string {
  if (!lexerMod1 || !parserMod1 || !codegenMod1) throw new Error("Gen1 not ready");
  return codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(flSrc)));
}

// ── Gen2 빌드 ─────────────────────────────────────────────────
console.log("\n[33-B] Gen 2: Gen1으로 컴파일러 소스 재컴파일");

let lexerMod2: any = null;
let parserMod2: any = null;
let codegenMod2: any = null;
let lexer2JS = "";
let parser2JS = "";
let codegen2JS = "";

test("standaloneCompile1(lexer.fl) → Gen2", () => {
  lexer2JS = standaloneCompile1(lexerSrc);
  lexerMod2 = makeModule(lexer2JS);
  if (typeof lexerMod2.lex !== "function") throw new Error("lex not exported");
  console.log(`    → ${lexer2JS.length} chars`);
});
test("standaloneCompile1(parser.fl) → Gen2", () => {
  parser2JS = standaloneCompile1(parserSrc);
  parserMod2 = makeModule(parser2JS);
  if (typeof parserMod2.parse !== "function") throw new Error("parse not exported");
  console.log(`    → ${parser2JS.length} chars`);
});
test("standaloneCompile1(codegen.fl) → Gen2", () => {
  codegen2JS = standaloneCompile1(codegenSrc);
  codegenMod2 = makeModule(codegen2JS);
  if (typeof codegenMod2["gen-js"] !== "function") throw new Error("gen-js not exported");
  console.log(`    → ${codegen2JS.length} chars`);
});

function standaloneCompile2(flSrc: string): string {
  if (!lexerMod2 || !parserMod2 || !codegenMod2) throw new Error("Gen2 not ready");
  return codegenMod2["gen-js"](parserMod2.parse(lexerMod2.lex(flSrc)));
}

// ── Gen3 빌드 ─────────────────────────────────────────────────
console.log("\n[33-C] Gen 3: Gen2으로 컴파일러 소스 재컴파일 (핵심)");

let lexerMod3: any = null;
let parserMod3: any = null;
let codegenMod3: any = null;
let lexer3JS = "";
let parser3JS = "";
let codegen3JS = "";

test("standaloneCompile2(lexer.fl) → Gen3", () => {
  lexer3JS = standaloneCompile2(lexerSrc);
  lexerMod3 = makeModule(lexer3JS);
  if (typeof lexerMod3.lex !== "function") throw new Error("lex not exported");
  console.log(`    → ${lexer3JS.length} chars`);
});
test("standaloneCompile2(parser.fl) → Gen3", () => {
  parser3JS = standaloneCompile2(parserSrc);
  parserMod3 = makeModule(parser3JS);
  if (typeof parserMod3.parse !== "function") throw new Error("parse not exported");
  console.log(`    → ${parser3JS.length} chars`);
});
test("standaloneCompile2(codegen.fl) → Gen3", () => {
  codegen3JS = standaloneCompile2(codegenSrc);
  codegenMod3 = makeModule(codegen3JS);
  if (typeof codegenMod3["gen-js"] !== "function") throw new Error("gen-js not exported");
  console.log(`    → ${codegen3JS.length} chars`);
});

// ── Gen2 === Gen3 고정점 증명 ─────────────────────────────────
console.log("\n[33-D] Gen2 === Gen3 고정점 증명 (컴파일러 소스 자체)");

// 컴파일러 소스를 각 세대로 컴파일해서 동일한지 확인
test("lexer2JS === lexer3JS (lexer 고정점)", () => {
  if (lexer2JS !== lexer3JS) {
    let di = 0;
    for (let k = 0; k < Math.min(lexer2JS.length, lexer3JS.length); k++) {
      if (lexer2JS[k] !== lexer3JS[k]) { di = k; break; }
    }
    throw new Error(`diff at ${di}: "${lexer2JS.substring(di, di+30)}" vs "${lexer3JS.substring(di, di+30)}"`);
  }
});
test("parser2JS === parser3JS (parser 고정점)", () => {
  if (parser2JS !== parser3JS) {
    let di = 0;
    for (let k = 0; k < Math.min(parser2JS.length, parser3JS.length); k++) {
      if (parser2JS[k] !== parser3JS[k]) { di = k; break; }
    }
    throw new Error(`diff at ${di}: "${parser2JS.substring(di, di+30)}" vs "${parser3JS.substring(di, di+30)}"`);
  }
});
test("codegen2JS === codegen3JS (codegen 고정점)", () => {
  if (codegen2JS !== codegen3JS) {
    let di = 0;
    for (let k = 0; k < Math.min(codegen2JS.length, codegen3JS.length); k++) {
      if (codegen2JS[k] !== codegen3JS[k]) { di = k; break; }
    }
    throw new Error(`diff at ${di}: "${codegen2JS.substring(di, di+30)}" vs "${codegen3JS.substring(di, di+30)}"`);
  }
});

// ── Gen1 === Gen2 === Gen3 프로그램 동치 ─────────────────────
console.log("\n[33-E] Gen1 === Gen2 === Gen3 프로그램 동치 검증");

function standaloneCompile3(flSrc: string): string {
  if (!lexerMod3 || !parserMod3 || !codegenMod3) throw new Error("Gen3 not ready");
  return codegenMod3["gen-js"](parserMod3.parse(lexerMod3.lex(flSrc)));
}

const TEST_PROGRAMS = [
  { name: "덧셈",        src: `[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)` },
  { name: "팩토리얼",    src: `[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)` },
  { name: "fibonacci",  src: `[FUNC fib :params [$n] :body ((if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2)))))] (export fib)` },
  { name: "loop/recur", src: `[FUNC sum-n :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export sum-n)` },
  { name: "match",      src: `[FUNC grade :params [$s] :body ((match $s ("A" "excellent") ("B" "good") (_ "ok")))] (export grade)` },
  { name: "map/filter", src: `[FUNC dp :params [$lst] :body ((map (filter $lst [x] (> $x 0)) [x] (* $x 2)))] (export dp)` },
  { name: "cond",       src: `[FUNC sign :params [$n] :body ((cond [(> $n 0) "pos"] [(< $n 0) "neg"] [else "zero"]))] (export sign)` },
  { name: "string ops", src: `[FUNC greet :params [$name] :body ((concat "Hello, " $name "!"))] (export greet)` },
  { name: "nested let", src: `[FUNC calc :params [$x $y] :body ((let [[$a (* $x 2)] [$b (+ $y 3)]] (+ $a $b)))] (export calc)` },
];

for (const prog of TEST_PROGRAMS) {
  test(`동치: ${prog.name}`, () => {
    const js1 = standaloneCompile1(prog.src);
    const js2 = standaloneCompile2(prog.src);
    const js3 = standaloneCompile3(prog.src);
    if (js1 !== js2) {
      let di = 0;
      for (let k = 0; k < Math.min(js1.length, js2.length); k++) {
        if (js1[k] !== js2[k]) { di = k; break; }
      }
      throw new Error(`Gen1≠Gen2 at ${di}: "${js1.substring(di, di+30)}" vs "${js2.substring(di, di+30)}"`);
    }
    if (js2 !== js3) {
      let di = 0;
      for (let k = 0; k < Math.min(js2.length, js3.length); k++) {
        if (js2[k] !== js3[k]) { di = k; break; }
      }
      throw new Error(`Gen2≠Gen3 at ${di}: "${js2.substring(di, di+30)}" vs "${js3.substring(di, di+30)}"`);
    }
  });
}

// ── Gen3 런타임 정확성 ────────────────────────────────────────
console.log("\n[33-F] Gen3 런타임 정확성");

test("Gen3: fact(10) = 3628800", () => {
  const m = makeModule(standaloneCompile3(
    `[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)`
  ));
  if (m.fact(10) !== 3628800) throw new Error(`got ${m.fact(10)}`);
});
test("Gen3: fib(20) = 6765", () => {
  const m = makeModule(standaloneCompile3(
    `[FUNC fib :params [$n] :body ((if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2)))))] (export fib)`
  ));
  if (m.fib(20) !== 6765) throw new Error(`got ${m.fib(20)}`);
});
test("Gen3: loop 10만 반복", () => {
  const m = makeModule(standaloneCompile3(
    `[FUNC big-sum :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export big-sum)`
  ));
  if (m["big-sum"](100000) !== 5000050000) throw new Error(`got ${m["big-sum"](100000)}`);
});
test("Gen3: match 문자열", () => {
  const m = makeModule(standaloneCompile3(
    `[FUNC grade :params [$s] :body ((match $s ("A" "excellent") ("B" "good") (_ "ok")))] (export grade)`
  ));
  if (m.grade("A") !== "excellent") throw new Error(`got ${m.grade("A")}`);
  if (m.grade("B") !== "good") throw new Error(`got ${m.grade("B")}`);
  if (m.grade("C") !== "ok") throw new Error(`got ${m.grade("C")}`);
});
test("Gen3: map/filter 파이프라인", () => {
  const m = makeModule(standaloneCompile3(
    `[FUNC dp :params [$lst] :body ((map (filter $lst [x] (> $x 0)) [x] (* $x 2)))] (export dp)`
  ));
  const r = m.dp([-1, 2, -3, 4, 5]);
  if (JSON.stringify(r) !== JSON.stringify([4, 8, 10])) throw new Error(`got ${JSON.stringify(r)}`);
});

// ── Gen3 자기 렉싱 (TCO 검증) ────────────────────────────────
console.log("\n[33-G] Gen3 lexer: 컴파일러 소스 렉싱");

test("Gen3 lexer로 lexer.fl 렉싱", () => {
  if (!lexerMod3) throw new Error("not ready");
  const tokens = lexerMod3.lex(lexerSrc);
  if (tokens.length < 1000) throw new Error(`too few: ${tokens.length}`);
  console.log(`    → ${tokens.length} tokens`);
});
test("Gen3 lexer로 codegen.fl 렉싱", () => {
  if (!lexerMod3) throw new Error("not ready");
  const tokens = lexerMod3.lex(codegenSrc);
  if (tokens.length < 2000) throw new Error(`too few: ${tokens.length}`);
  console.log(`    → ${tokens.length} tokens`);
});

// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Phase 33 Gen3 Bootstrap: ${passed} passed, ${failed} failed`);
console.log(`\n부트스트랩 체인:`);
console.log(`  Gen1 (TS parser 보조) → Gen2 (Gen1 컴파일) → Gen3 (Gen2 컴파일)`);
if (failed === 0) {
  console.log(`  Gen1 === Gen2 === Gen3  ✅  고정점 달성 — 언어 부트스트랩 완결`);
}
if (failed > 0) process.exit(1);
process.exit(0);
