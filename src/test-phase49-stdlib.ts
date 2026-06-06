// FreeLang v9: Phase 49 — FL 표준 라이브러리
//
// 목표: freelang-stdlib.fl 컴파일 + 고차 함수 / Maybe / Result 동작 검증

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
const lexerSrc       = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"),  "utf-8");
const parserSrc      = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc     = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");
const interpreterSrc = fs.readFileSync(path.join(flSrcDir, "freelang-interpreter.fl"), "utf-8");
const stdlibSrc      = fs.readFileSync(path.join(flSrcDir, "freelang-stdlib.fl"), "utf-8");

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

function makeModule(jsCode: string, extra: Record<string, any> = {}): any {
  const sandbox: Record<string, any> = { module: { exports: {} }, console, ...extra };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);
  return sandbox.module.exports;
}

// ── Gen1 빌드 ─────────────────────────────────────────────────
console.log("\n[49-A] Gen1 빌드");

let lexerMod1: any, parserMod1: any, codegenMod1: any, interpMod1: any, stdlibMod1: any;
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
test("interpreter.fl → Gen1", () => {
  interpMod1 = makeModule(tsCompile(interpreterSrc), {
    file_read: () => "", file_write: () => true, file_exists: () => false,
    file_append: () => true, dir_list: () => [],
  });
  if (typeof interpMod1.interpret !== "function") throw new Error("interpret not exported");
});
test("stdlib.fl → Gen1 컴파일", () => {
  const js = tsCompile(stdlibSrc);
  stdlibMod1 = makeModule(js, {
    closure_p: interpMod1["closure?"] ?? (() => false),
    fl_apply: interpMod1["fl-apply"] ?? (() => null),
  });
  if (typeof stdlibMod1["fl-map"] !== "function") throw new Error("fl-map not exported");
  console.log(`    → stdlib Gen1 컴파일 성공 (${js.length} chars)`);
});

// stdlib을 interpreter를 통해 실행하는 flInterpretWithStdlib
function flInterpret(flSrc: string): any {
  const combined = stdlibSrc + "\n" + flSrc;
  const ast = parserMod1.parse(lexerMod1.lex(combined));
  const converted = convertTStoFL(ast);
  return interpMod1.interpret(converted);
}

// ── Array 유틸 ────────────────────────────────────────────────
console.log("\n[49-B] Array 유틸");

test("fl-map [1 2 3] double → [2 4 6]", () => {
  const src = `
[FUNC double :params [$x] :body ((* $x 2))]
(fl-map [1 2 3] double)`;
  const result = flInterpret(src);
  if (!Array.isArray(result)) throw new Error(`not array: ${result}`);
  if (result[0] !== 2 || result[1] !== 4 || result[2] !== 6) throw new Error(`got ${JSON.stringify(result)}`);
});

test("fl-filter [1..6] even? → [2 4 6]", () => {
  const src = `
[FUNC even? :params [$n] :body ((= (% $n 2) 0))]
(fl-filter [1 2 3 4 5 6] even?)`;
  const result = flInterpret(src);
  if (!Array.isArray(result)) throw new Error(`not array: ${result}`);
  if (result.length !== 3 || result[0] !== 2) throw new Error(`got ${JSON.stringify(result)}`);
});

test("fl-reduce [1 2 3 4 5] 0 add → 15", () => {
  const src = `
[FUNC add :params [$a $b] :body ((+ $a $b))]
(fl-reduce [1 2 3 4 5] 0 add)`;
  const result = flInterpret(src);
  if (result !== 15) throw new Error(`got ${result}`);
});

test("fl-find [1 2 3 4 5] (>3) → 4", () => {
  const src = `
[FUNC gt3 :params [$n] :body ((> $n 3))]
(fl-find [1 2 3 4 5] gt3)`;
  const result = flInterpret(src);
  if (result !== 4) throw new Error(`got ${result}`);
});

test("fl-any? [1 2 3] (>2) → true", () => {
  const src = `
[FUNC gt2 :params [$n] :body ((> $n 2))]
(fl-any? [1 2 3] gt2)`;
  const result = flInterpret(src);
  if (result !== true) throw new Error(`got ${result}`);
});

test("fl-all? [2 4 6] even? → true", () => {
  const src = `
[FUNC even? :params [$n] :body ((= (% $n 2) 0))]
(fl-all? [2 4 6] even?)`;
  const result = flInterpret(src);
  if (result !== true) throw new Error(`got ${result}`);
});

test("fl-all? [1 2 3] even? → false", () => {
  const src = `
[FUNC even? :params [$n] :body ((= (% $n 2) 0))]
(fl-all? [1 2 3] even?)`;
  const result = flInterpret(src);
  if (result !== false) throw new Error(`got ${result}`);
});

test("fl-flatten [[1 2] [3 4]] → [1 2 3 4]", () => {
  const src = `(fl-flatten [[1 2] [3 4]])`;
  const result = flInterpret(src);
  if (!Array.isArray(result)) throw new Error(`not array: ${result}`);
  if (result.length !== 4 || result[0] !== 1 || result[3] !== 4) throw new Error(`got ${JSON.stringify(result)}`);
});

test("fl-zip [1 2 3] [a b c] → pairs", () => {
  const src = `(fl-zip [1 2 3] ["a" "b" "c"])`;
  const result = flInterpret(src);
  if (!Array.isArray(result)) throw new Error(`not array: ${result}`);
  if (result.length !== 3) throw new Error(`length: ${result.length}`);
  if (result[0][0] !== 1 || result[0][1] !== "a") throw new Error(`got ${JSON.stringify(result[0])}`);
});

test("fl-range 0 5 → [0 1 2 3 4]", () => {
  const src = `(fl-range 0 5)`;
  const result = flInterpret(src);
  if (!Array.isArray(result)) throw new Error(`not array`);
  if (result.length !== 5 || result[0] !== 0 || result[4] !== 4) throw new Error(`got ${JSON.stringify(result)}`);
});

// ── Maybe ──────────────────────────────────────────────────────
console.log("\n[49-C] Maybe/Option");

test("some + maybe-or → 값 반환", () => {
  const src = `(maybe-or (some 42) 0)`;
  const result = flInterpret(src);
  if (result !== 42) throw new Error(`got ${result}`);
});

test("none + maybe-or → 기본값 반환", () => {
  const src = `(maybe-or (none) 99)`;
  const result = flInterpret(src);
  if (result !== 99) throw new Error(`got ${result}`);
});

test("some + maybe-map → 값 변환", () => {
  const src = `
[FUNC double :params [$x] :body ((* $x 2))]
(maybe-or (maybe-map (some 5) double) 0)`;
  const result = flInterpret(src);
  if (result !== 10) throw new Error(`got ${result}`);
});

test("none + maybe-map → none 유지", () => {
  const src = `
[FUNC double :params [$x] :body ((* $x 2))]
(maybe-or (maybe-map (none) double) 0)`;
  const result = flInterpret(src);
  if (result !== 0) throw new Error(`got ${result}`);
});

test("some? / none? 검사", () => {
  const src = `
[FUNC check :params [$m]
  :body ((if (some? $m) "some" "none"))
]
(concat (check (some 1)) (concat "-" (check (none))))`;
  const result = flInterpret(src);
  if (result !== "some-none") throw new Error(`got ${result}`);
});

// ── Result ──────────────────────────────────────────────────────
console.log("\n[49-D] Result/Either");

test("ok + result-or → 값 반환", () => {
  const src = `(result-or (ok 42) 0)`;
  const result = flInterpret(src);
  if (result !== 42) throw new Error(`got ${result}`);
});

test("err + result-or → 기본값 반환", () => {
  const src = `(result-or (err "실패") 99)`;
  const result = flInterpret(src);
  if (result !== 99) throw new Error(`got ${result}`);
});

test("ok + result-map → 값 변환", () => {
  const src = `
[FUNC double :params [$x] :body ((* $x 2))]
(result-or (result-map (ok 5) double) 0)`;
  const result = flInterpret(src);
  if (result !== 10) throw new Error(`got ${result}`);
});

test("err + result-map → err 패스스루", () => {
  const src = `
[FUNC double :params [$x] :body ((* $x 2))]
(result-or (result-map (err "fail") double) -1)`;
  const result = flInterpret(src);
  if (result !== -1) throw new Error(`got ${result}`);
});

test("ok? / err? 검사", () => {
  const src = `
[FUNC check :params [$r]
  :body ((if (ok? $r) "ok" "err"))
]
(concat (check (ok 1)) (concat "-" (check (err "x"))))`;
  const result = flInterpret(src);
  if (result !== "ok-err") throw new Error(`got ${result}`);
});

// ── 조합 패턴 ─────────────────────────────────────────────────
console.log("\n[49-E] 조합 패턴");

test("fl-map + fl-filter 파이프라인", () => {
  const src = `
[FUNC double :params [$x] :body ((* $x 2))]
[FUNC gt5 :params [$n] :body ((> $n 5))]
(fl-filter (fl-map [1 2 3 4 5] double) gt5)`;
  const result = flInterpret(src);
  if (!Array.isArray(result)) throw new Error(`not array`);
  if (result.length !== 3 || result[0] !== 6) throw new Error(`got ${JSON.stringify(result)}`);
});

test("fl-reduce + fl-range 합계", () => {
  const src = `
[FUNC add :params [$a $b] :body ((+ $a $b))]
(fl-reduce (fl-range 1 11) 0 add)`;
  const result = flInterpret(src);
  if (result !== 55) throw new Error(`got ${result}`);
});

test("maybe-chain 연쇄", () => {
  const src = `
[FUNC safe-double :params [$n]
  :body ((if (> $n 0) (some (* $n 2)) (none)))
]
(maybe-or (maybe-chain (some 5) safe-double) 0)`;
  const result = flInterpret(src);
  if (result !== 10) throw new Error(`got ${result}`);
});

// ── Gen2===Gen3 고정점 ─────────────────────────────────────────
console.log("\n[49-F] Gen2===Gen3 고정점 (stdlib 포함)");

function standaloneCompile1(src: string): string {
  return codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(src)));
}
function standaloneCompile2(src: string): string {
  const interp = new Interpreter();
  for (const s of [lexerSrc, parserSrc, codegenSrc]) interp.interpret(parse(lex(s)));
  const lexer2 = makeModule(standaloneCompile1(lexerSrc));
  const parser2 = makeModule(standaloneCompile1(parserSrc));
  const codegen2 = makeModule(standaloneCompile1(codegenSrc));
  return codegen2["gen-js"](parser2.parse(lexer2.lex(src)));
}

let stdlib2JS = "", stdlib3JS = "";
test("stdlib.fl → Gen2", () => {
  stdlib2JS = standaloneCompile1(stdlibSrc);
  makeModule(stdlib2JS);
  console.log(`    → Gen2 ${stdlib2JS.length} chars`);
});
test("stdlib.fl → Gen3", () => {
  stdlib3JS = standaloneCompile2(stdlibSrc);
  makeModule(stdlib3JS);
  console.log(`    → Gen3 ${stdlib3JS.length} chars`);
});
test("Gen2===Gen3 stdlib 고정점", () => {
  if (stdlib2JS !== stdlib3JS) throw new Error(`diff: Gen2 ${stdlib2JS.length} vs Gen3 ${stdlib3JS.length}`);
  console.log(`    → 고정점 확인 ✓`);
});

// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 49 Standard Library: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
