// FreeLang v9: Phase 31 — Gen 2 자가 컴파일 (lexer TCO)
//
// 목표: standalone FL lexer(loop/recur)가 컴파일러 소스를 스택 없이 렉싱
//       standaloneCompile(lexer.fl) 성공 → lexer2.js === lexer1.js

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

// ── TS AST → FL AST ──────────────────────────────────────────
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

// ── Gen 1: tsCompile (TS parser 보조) ───────────────────────
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

// ── Gen 1 컴파일 ──────────────────────────────────────────────
console.log("\n[31-A] Gen 1: tsCompile로 standalone 컴파일러 생성");

let lexer1JS = "";
let parser1JS = "";
let codegen1JS = "";
let lexerMod1: any = null;
let parserMod1: any = null;
let codegenMod1: any = null;

test("lexer.fl → Gen1 JS", () => {
  lexer1JS = tsCompile(lexerSrc);
  lexerMod1 = makeModule(lexer1JS);
  if (typeof lexerMod1.lex !== "function") throw new Error("lex not exported");
  const tokens = lexerMod1.lex("(+ 1 2)");
  if (!Array.isArray(tokens) || tokens.length === 0) throw new Error("lex failed");
});

test("parser.fl → Gen1 JS", () => {
  parser1JS = tsCompile(parserSrc);
  parserMod1 = makeModule(parser1JS);
  if (typeof parserMod1.parse !== "function") throw new Error("parse not exported");
});

test("codegen.fl → Gen1 JS", () => {
  codegen1JS = tsCompile(codegenSrc);
  codegenMod1 = makeModule(codegen1JS);
  if (typeof codegenMod1["gen-js"] !== "function") throw new Error("gen-js not exported");
});

// ── Gen 1 lexer 대용량 파일 렉싱 검증 ────────────────────────
console.log("\n[31-B] Gen 1 lexer: 컴파일러 소스 렉싱 (TCO 검증)");

test("Gen1 lexer로 lexer.fl 렉싱 (1800+ tokens)", () => {
  if (!lexerMod1) throw new Error("not ready");
  const tokens = lexerMod1.lex(lexerSrc);
  if (!Array.isArray(tokens)) throw new Error("not array");
  if (tokens.length < 1000) throw new Error(`too few tokens: ${tokens.length}`);
  console.log(`    → ${tokens.length} tokens`);
});

test("Gen1 lexer로 parser.fl 렉싱", () => {
  if (!lexerMod1) throw new Error("not ready");
  const tokens = lexerMod1.lex(parserSrc);
  if (tokens.length < 500) throw new Error(`too few: ${tokens.length}`);
  console.log(`    → ${tokens.length} tokens`);
});

test("Gen1 lexer로 codegen.fl 렉싱 (4000+ tokens)", () => {
  if (!lexerMod1) throw new Error("not ready");
  const tokens = lexerMod1.lex(codegenSrc);
  if (tokens.length < 2000) throw new Error(`too few: ${tokens.length}`);
  console.log(`    → ${tokens.length} tokens`);
});

// ── standaloneCompile 함수 (Gen1 사용) ──────────────────────
function standaloneCompile1(flSrc: string): string {
  if (!lexerMod1 || !parserMod1 || !codegenMod1) throw new Error("Gen1 not ready");
  const tokens = lexerMod1.lex(flSrc);
  const ast = parserMod1.parse(tokens);
  return codegenMod1["gen-js"](ast);
}

// ── Gen 2: standaloneCompile로 컴파일러 소스 재컴파일 ─────────
console.log("\n[31-C] Gen 2: standalone FL compiler로 자가 컴파일");

let lexer2JS = "";
let parser2JS = "";
let codegen2JS = "";
let lexerMod2: any = null;
let parserMod2: any = null;
let codegenMod2: any = null;

test("standaloneCompile(lexer.fl) → Gen2 lexer", () => {
  lexer2JS = standaloneCompile1(lexerSrc);
  if (typeof lexer2JS !== "string" || lexer2JS.length === 0) throw new Error("empty");
  lexerMod2 = makeModule(lexer2JS);
  if (typeof lexerMod2.lex !== "function") throw new Error("lex not exported");
  const tokens = lexerMod2.lex("(+ 1 2)");
  if (!Array.isArray(tokens) || tokens.length === 0) throw new Error("lex failed");
  console.log(`    → ${lexer2JS.length} chars`);
});

test("standaloneCompile(parser.fl) → Gen2 parser", () => {
  parser2JS = standaloneCompile1(parserSrc);
  if (typeof parser2JS !== "string" || parser2JS.length === 0) throw new Error("empty");
  parserMod2 = makeModule(parser2JS);
  if (typeof parserMod2.parse !== "function") throw new Error("parse not exported");
  console.log(`    → ${parser2JS.length} chars`);
});

test("standaloneCompile(codegen.fl) → Gen2 codegen", () => {
  codegen2JS = standaloneCompile1(codegenSrc);
  if (typeof codegen2JS !== "string" || codegen2JS.length === 0) throw new Error("empty");
  codegenMod2 = makeModule(codegen2JS);
  if (typeof codegenMod2["gen-js"] !== "function") throw new Error("gen-js not exported");
  console.log(`    → ${codegen2JS.length} chars`);
});

// ── Gen 1 === Gen 2 동치 검증 ─────────────────────────────────
console.log("\n[31-D] Gen 1 === Gen 2 동치 검증");

const TEST_PROGRAMS = [
  { name: "덧셈 함수",      src: `[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)` },
  { name: "재귀 팩토리얼",  src: `[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)` },
  { name: "fibonacci",    src: `[FUNC fib :params [$n] :body ((if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2)))))] (export fib)` },
  { name: "loop/recur",   src: `[FUNC sum-n :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export sum-n)` },
  { name: "match",        src: `[FUNC grade :params [$s] :body ((match $s ("A" "excellent") ("B" "good") (_ "ok")))] (export grade)` },
  { name: "map 체이닝",   src: `[FUNC dp :params [$lst] :body ((map (filter $lst [x] (> $x 0)) [x] (* $x 2)))] (export dp)` },
];

function standaloneCompile2(flSrc: string): string {
  if (!lexerMod2 || !parserMod2 || !codegenMod2) throw new Error("Gen2 not ready");
  const tokens = lexerMod2.lex(flSrc);
  const ast = parserMod2.parse(tokens);
  return codegenMod2["gen-js"](ast);
}

for (const prog of TEST_PROGRAMS) {
  test(`동치: ${prog.name}`, () => {
    const js1 = standaloneCompile1(prog.src);
    const js2 = standaloneCompile2(prog.src);
    if (js1 !== js2) {
      let di = 0;
      for (let k = 0; k < Math.min(js1.length, js2.length); k++) {
        if (js1[k] !== js2[k]) { di = k; break; }
      }
      throw new Error(`diff at ${di}: "${js1.substring(di, di+30)}" vs "${js2.substring(di, di+30)}"`);
    }
  });
}

// ── Gen 2 런타임 정확성 ───────────────────────────────────────
console.log("\n[31-E] Gen 2 런타임 정확성");

test("Gen2: fact(10) = 3628800", () => {
  const js = standaloneCompile2(`[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)`);
  const m = makeModule(js);
  if (m.fact(10) !== 3628800) throw new Error(`got ${m.fact(10)}`);
});

test("Gen2: fib(15) = 610", () => {
  const js = standaloneCompile2(`[FUNC fib :params [$n] :body ((if (<= $n 1) $n (+ (fib (- $n 1)) (fib (- $n 2)))))] (export fib)`);
  const m = makeModule(js);
  if (m.fib(15) !== 610) throw new Error(`got ${m.fib(15)}`);
});

test("Gen2: loop 10만 반복", () => {
  const js = standaloneCompile2(`[FUNC big-sum :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export big-sum)`);
  const m = makeModule(js);
  if (m["big-sum"](100000) !== 5000050000) throw new Error(`got ${m["big-sum"](100000)}`);
});

// ── 결과 ───────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 31 Gen2 Lexer TCO: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
