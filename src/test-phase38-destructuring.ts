// FreeLang v9: Phase 38 — 구조 분해 바인딩
//
// 목표: (let [[$a $b] $pair] body) → const [a, b] = pair;
//       배열 구조 분해, & rest 구조 분해
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
console.log("\n[38-A] Gen1 빌드");

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

// ── 구조 분해 바인딩 검증 ──────────────────────────────────────
console.log("\n[38-B] 배열 구조 분해 바인딩");

test("기본 쌍 구조 분해", () => {
  const src = `
[FUNC swap :params [$pair]
  :body (
    (let [[[$a $b] $pair]]
      [$b $a]
    )
  )
]
(export swap)`;
  const js = standaloneCompile1(src);
  if (!js.includes("[a, b]") && !js.includes("const [a") && !js.includes("[b,")) throw new Error(`no destructuring in:\n${js.slice(0, 200)}`);
  const m = makeModule(js);
  const result = m.swap([1, 2]);
  if (!Array.isArray(result) || result[0] !== 2 || result[1] !== 1) throw new Error(`got ${JSON.stringify(result)}`);
});

test("3원소 구조 분해", () => {
  const src = `
[FUNC sum3 :params [$triple]
  :body (
    (let [[[$a $b $c] $triple]]
      (+ $a (+ $b $c))
    )
  )
]
(export sum3)`;
  const m = makeModule(standaloneCompile1(src));
  if (m.sum3([10, 20, 30]) !== 60) throw new Error(`got ${m.sum3([10,20,30])}`);
});

test("구조 분해 + 나머지 rest", () => {
  const src = `
[FUNC head-rest :params [$lst]
  :body (
    (let [[[$h & $t] $lst]]
      [$h (length $t)]
    )
  )
]
(export head-rest)`;
  const js = standaloneCompile1(src);
  if (!js.includes("...t") && !js.includes("...")) {
    console.log(`    → js: ${js.slice(0, 200)}`);
  }
  const m = makeModule(js);
  const result = m["head-rest"]([1, 2, 3, 4]);
  if (result[0] !== 1 || result[1] !== 3) throw new Error(`got ${JSON.stringify(result)}`);
});

test("다중 구조 분해 바인딩", () => {
  const src = `
[FUNC cross-add :params [$p1 $p2]
  :body (
    (let [[[$a $b] $p1]
          [[$c $d] $p2]]
      (+ (+ $a $b) (+ $c $d))
    )
  )
]
(export cross-add)`;
  const m = makeModule(standaloneCompile1(src));
  if (m["cross-add"]([1, 2], [3, 4]) !== 10) throw new Error(`got ${m["cross-add"]([1,2],[3,4])}`);
});

test("일반 let + 구조 분해 혼합", () => {
  const src = `
[FUNC mixed :params [$lst $n]
  :body (
    (let [[[$a $b] $lst]
          [$x $n]]
      (* (+ $a $b) $x)
    )
  )
]
(export mixed)`;
  const m = makeModule(standaloneCompile1(src));
  if (m.mixed([3, 4], 5) !== 35) throw new Error(`got ${m.mixed([3,4],5)}`);
});

// ── 컴파일러 소스 자체 컴파일 ──────────────────────────────────
console.log("\n[38-C] 컴파일러 자체 컴파일");

test("Gen1 codegen.fl 컴파일 가능", () => {
  const js = standaloneCompile1(codegenSrc);
  const m = makeModule(js);
  if (typeof m["gen-js"] !== "function") throw new Error("gen-js not exported");
});

// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[38-D] Gen2 + Gen3 고정점 유지");

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
console.log(`Phase 38 Destructuring: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
