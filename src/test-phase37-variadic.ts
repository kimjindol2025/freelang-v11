// FreeLang v9: Phase 37 — 가변 인자 (& $rest)
//
// 목표: [FUNC f :params [$a & $rest]] → function f(a, ...rest)
//       gen-func-block, gen-fn, gen-define 모두 지원
//       Gen3 고정점 유지

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
console.log("\n[37-A] Gen1 빌드");

let lexerMod1: any, parserMod1: any, codegenMod1: any;
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

function standaloneCompile1(src: string): string {
  return codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(src)));
}

// ── 가변 인자 검증 ──────────────────────────────────────────────
console.log("\n[37-B] 가변 인자 & $rest 생성 검증");

test("FUNC rest 파라미터 JS 생성", () => {
  const src = `[FUNC f :params [$a & $rest] :body ($a)] (export f)`;
  const js = standaloneCompile1(src);
  if (!js.includes("...rest")) throw new Error(`no ...rest in:\n${js}`);
  console.log(`    → ${js.slice(0, 80).replace(/\n/g, " ")}`);
});

test("rest만 있는 함수", () => {
  const src = `[FUNC sum :params [& $args] :body ((reduce $args 0 [$acc $x] (+ $acc $x)))] (export sum)`;
  const js = standaloneCompile1(src);
  if (!js.includes("...args")) throw new Error(`no ...args`);
  const m = makeModule(js);
  if (m.sum(1, 2, 3, 4, 5) !== 15) throw new Error(`got ${m.sum(1,2,3,4,5)}`);
});

test("앞 파라미터 + rest", () => {
  const src = `[FUNC first-plus :params [$a & $rest] :body ((+ $a (reduce $rest 0 [$acc $x] (+ $acc $x))))] (export first-plus)`;
  const m = makeModule(standaloneCompile1(src));
  if (m["first-plus"](10, 1, 2, 3) !== 16) throw new Error(`got ${m["first-plus"](10,1,2,3)}`);
});

test("rest를 배열로 전달", () => {
  const src = `[FUNC join-all :params [$sep & $parts] :body ((str-join $parts $sep))] (export join-all)`;
  const m = makeModule(standaloneCompile1(src));
  if (m["join-all"]("-", "a", "b", "c") !== "a-b-c") throw new Error(`got ${m["join-all"]("-","a","b","c")}`);
});

test("가변 인자 0개 호출", () => {
  const src = `[FUNC zero-rest :params [$a & $rest] :body ((length $rest))] (export zero-rest)`;
  const m = makeModule(standaloneCompile1(src));
  if (m["zero-rest"]("x") !== 0) throw new Error(`got ${m["zero-rest"]("x")}`);
});

test("fn 람다 rest 파라미터", () => {
  const src = `
[FUNC apply-fn :params [$f & $args]
  :body (($f $args))
]
(export apply-fn)`;
  const js = standaloneCompile1(src);
  if (!js.includes("...args")) throw new Error("no ...args in fn");
  const m = makeModule(js);
  const result = m["apply-fn"]((arr: number[]) => arr.reduce((a: number, b: number) => a + b, 0), 1, 2, 3);
  if (result !== 6) throw new Error(`got ${result}`);
});

// ── 컴파일러 소스 자체 컴파일 ──────────────────────────────────
console.log("\n[37-C] 컴파일러 소스 자체 컴파일");

test("Gen1 codegen.fl 컴파일 가능", () => {
  const js = standaloneCompile1(codegenSrc);
  const m = makeModule(js);
  if (typeof m["gen-js"] !== "function") throw new Error("gen-js not exported");
  console.log(`    → ${js.length} chars`);
});

// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[37-D] Gen2 + Gen3 고정점 유지");

let lexer2JS = "", parser2JS = "", codegen2JS = "";
let lexerMod2: any, parserMod2: any, codegenMod2: any;

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

function standaloneCompile2(src: string) {
  return codegenMod2["gen-js"](parserMod2.parse(lexerMod2.lex(src)));
}

let lexer3JS = "", parser3JS = "", codegen3JS = "";
test("standaloneCompile2(lexer.fl) → Gen3", () => {
  lexer3JS = standaloneCompile2(lexerSrc);
  makeModule(lexer3JS);
  console.log(`    → ${lexer3JS.length} chars`);
});
test("standaloneCompile2(parser.fl) → Gen3", () => {
  parser3JS = standaloneCompile2(parserSrc);
  makeModule(parser3JS);
});
test("standaloneCompile2(codegen.fl) → Gen3", () => {
  codegen3JS = standaloneCompile2(codegenSrc);
  makeModule(codegen3JS);
});
test("Gen2===Gen3 lexer 고정점", () => {
  if (lexer2JS !== lexer3JS) throw new Error("diff");
});
test("Gen2===Gen3 parser 고정점", () => {
  if (parser2JS !== parser3JS) throw new Error("diff");
});
test("Gen2===Gen3 codegen 고정점", () => {
  if (codegen2JS !== codegen3JS) throw new Error("diff");
});

// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 37 Variadic Args: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
