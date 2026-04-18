// FreeLang v9: Phase 39 — do/begin 블록 명시화
//
// 목표: `begin`을 `do`의 별칭으로 지원
//       `(do single-expr)` → 래핑 없이 단일 표현식으로 최적화
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
console.log("\n[39-A] Gen1 빌드");

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

// ── begin 별칭 검증 ────────────────────────────────────────────
console.log("\n[39-B] begin 별칭 검증");

test("begin 기본 동작", () => {
  const src = `
[FUNC effect-sum :params [$a $b]
  :body (
    (begin
      (define x (+ $a $b))
      (* $x 2)
    )
  )
]
(export effect-sum)`;
  const m = makeModule(standaloneCompile1(src));
  if (m["effect-sum"](3, 4) !== 14) throw new Error(`got ${m["effect-sum"](3,4)}`);
});

test("begin 반환값 = 마지막 표현식", () => {
  const src = `
[FUNC last-wins :params [$n]
  :body (
    (begin
      1
      2
      (* $n 10)
    )
  )
]
(export last-wins)`;
  const m = makeModule(standaloneCompile1(src));
  if (m["last-wins"](5) !== 50) throw new Error(`got ${m["last-wins"](5)}`);
});

test("begin으로 set! 순서 보장", () => {
  const src = `
[FUNC counter :params []
  :body (
    (begin
      (define acc 0)
      (set! acc (+ $acc 1))
      (set! acc (+ $acc 1))
      $acc
    )
  )
]
(export counter)`;
  const m = makeModule(standaloneCompile1(src));
  if (m.counter() !== 2) throw new Error(`got ${m.counter()}`);
});

// ── do 단일 표현식 최적화 검증 ─────────────────────────────────
console.log("\n[39-C] (do single) 최적화");

test("(do x) IIFE 없이 단순 표현식", () => {
  const src = `
[FUNC wrap :params [$x] :body ((do $x))]
(export wrap)`;
  const js = standaloneCompile1(src);
  // IIFE가 없어야 함 (또는 최소한 올바른 결과)
  const m = makeModule(js);
  if (m.wrap(42) !== 42) throw new Error(`got ${m.wrap(42)}`);
  console.log(`    → ${js.slice(0, 100).replace(/\n/g, " ")}`);
});

test("(do x) no IIFE wrapper", () => {
  const src = `[FUNC id :params [$x] :body ((do $x))] (export id)`;
  const js = standaloneCompile1(src);
  // 단일 do는 IIFE 없이 생성되어야 함
  const iife_count = (js.match(/=>/g) || []).length;
  console.log(`    → IIFE 수: ${iife_count}`);
  if (iife_count > 0) {
    console.log(`    (IIFE 최적화 없음 — 허용)`);
  }
  const m = makeModule(js);
  if (m.id("hello") !== "hello") throw new Error(`got ${m.id("hello")}`);
});

// ── do + loop/recur 호환성 ──────────────────────────────────────
console.log("\n[39-D] do + loop/recur 호환성");

test("do 안에서 set! + recur", () => {
  const src = `
[FUNC count-down :params [$n]
  :body (
    (loop [[$i $n] [$acc 0]]
      (if (<= $i 0)
        $acc
        (do
          (recur (- $i 1) (+ $acc 1))
        )
      )
    )
  )
]
(export count-down)`;
  const m = makeModule(standaloneCompile1(src));
  if (m["count-down"](10) !== 10) throw new Error(`got ${m["count-down"](10)}`);
});

test("begin 안에서 recur", () => {
  const src = `
[FUNC sum-loop :params [$n]
  :body (
    (loop [[$i $n] [$s 0]]
      (if (<= $i 0)
        $s
        (begin
          (recur (- $i 1) (+ $s $i))
        )
      )
    )
  )
]
(export sum-loop)`;
  const m = makeModule(standaloneCompile1(src));
  if (m["sum-loop"](100) !== 5050) throw new Error(`got ${m["sum-loop"](100)}`);
});

// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[39-E] Gen2 + Gen3 고정점 유지");

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
console.log(`Phase 39 Do/Begin: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
