// FreeLang v9: Phase 42 — Watch 모드
//
// 목표: 파일 변경 감지 → 자동 재컴파일
//       watchCompile(file): 파일 읽기 → 컴파일 → 결과 반환
//       Gen3 고정점 유지

import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
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
console.log("\n[42-A] Gen1 빌드");

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

// Watch 핵심: 파일 읽기 → 컴파일 → 실행
function watchCompile(filePath: string): any {
  const src = fs.readFileSync(filePath, "utf-8");
  const js = standaloneCompile1(src);
  return makeModule(js);
}

// ── Watch 모드 핵심 동작 ─────────────────────────────────────
console.log("\n[42-B] Watch 모드 핵심 동작");

test("파일 읽기 → 컴파일 → 실행", () => {
  const tmpFile = path.join(os.tmpdir(), `fl-watch-${Date.now()}.fl`);
  const src = `[FUNC greet :params [$name] :body ((concat "Hello, " $name "!"))] (export greet)`;
  fs.writeFileSync(tmpFile, src);
  const m = watchCompile(tmpFile);
  fs.unlinkSync(tmpFile);
  if (m.greet("World") !== "Hello, World!") throw new Error("wrong result");
});

test("파일 변경 후 재컴파일: 결과 갱신", () => {
  const tmpFile = path.join(os.tmpdir(), `fl-watch2-${Date.now()}.fl`);

  // v1: (+ 1 2) = 3
  fs.writeFileSync(tmpFile, `[FUNC compute :params [] :body ((+ 1 2))] (export compute)`);
  const m1 = watchCompile(tmpFile);
  if (m1.compute() !== 3) throw new Error(`v1: ${m1.compute()}`);

  // v2: (* 3 4) = 12
  fs.writeFileSync(tmpFile, `[FUNC compute :params [] :body ((* 3 4))] (export compute)`);
  const m2 = watchCompile(tmpFile);
  fs.unlinkSync(tmpFile);
  if (m2.compute() !== 12) throw new Error(`v2: ${m2.compute()}`);
  console.log(`    → v1=3, v2=12 재컴파일 성공`);
});

test("3회 연속 파일 변경 재컴파일", () => {
  const tmpFile = path.join(os.tmpdir(), `fl-watch3-${Date.now()}.fl`);
  const versions = [
    { src: `[FUNC f :params [] :body ((+ 1 0))] (export f)`, expected: 1 },
    { src: `[FUNC f :params [] :body ((+ 2 0))] (export f)`, expected: 2 },
    { src: `[FUNC f :params [] :body ((+ 3 0))] (export f)`, expected: 3 },
  ];

  for (const { src, expected } of versions) {
    fs.writeFileSync(tmpFile, src);
    const m = watchCompile(tmpFile);
    if (m.f() !== expected) throw new Error(`got ${m.f()}, expected ${expected}`);
  }
  fs.unlinkSync(tmpFile);
  console.log(`    → 3회 재컴파일 정합성 확인`);
});

// ── 컴파일 결과 캐싱 ─────────────────────────────────────────
console.log("\n[42-C] 컴파일 결정론적 출력");

test("동일 소스 → 동일 JS 출력", () => {
  const src = `[FUNC identity :params [$x] :body ($x)] (export identity)`;
  const js1 = standaloneCompile1(src);
  const js2 = standaloneCompile1(src);
  if (js1 !== js2) throw new Error("non-deterministic output");
  console.log(`    → 결정론적 출력 확인 (${js1.length} chars)`);
});

test("소스 변경 → JS 출력 변경", () => {
  const src1 = `[FUNC f :params [] :body (1)] (export f)`;
  const src2 = `[FUNC f :params [] :body (2)] (export f)`;
  const js1 = standaloneCompile1(src1);
  const js2 = standaloneCompile1(src2);
  if (js1 === js2) throw new Error("different source produced identical output");
});

// ── mtime 기반 변경 감지 시뮬레이션 ──────────────────────────
console.log("\n[42-D] mtime 기반 변경 감지");

class FileWatchState {
  private lastMtime: number = 0;

  hasChanged(filePath: string): boolean {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;
    if (mtime > this.lastMtime) {
      this.lastMtime = mtime;
      return true;
    }
    return false;
  }
}

test("첫 체크 → 변경 감지", () => {
  const tmpFile = path.join(os.tmpdir(), `fl-mtime-${Date.now()}.fl`);
  fs.writeFileSync(tmpFile, `[FUNC f :params [] :body (1)] (export f)`);
  const state = new FileWatchState();
  if (!state.hasChanged(tmpFile)) throw new Error("first check should detect change");
  fs.unlinkSync(tmpFile);
});

test("두 번째 체크 → 변경 없음", () => {
  const tmpFile = path.join(os.tmpdir(), `fl-mtime2-${Date.now()}.fl`);
  fs.writeFileSync(tmpFile, `[FUNC f :params [] :body (1)] (export f)`);
  const state = new FileWatchState();
  state.hasChanged(tmpFile); // 첫 체크
  if (state.hasChanged(tmpFile)) throw new Error("second check should not detect change");
  fs.unlinkSync(tmpFile);
});

// ── 다중 파일 컴파일 체인 ────────────────────────────────────
console.log("\n[42-E] 다중 파일 컴파일 체인");

test("라이브러리 + 앱 분리 컴파일", () => {
  const libSrc = `
[FUNC square :params [$n] :body ((* $n $n))]
[FUNC cube :params [$n] :body ((* $n (* $n $n)))]
[FUNC lib-exports :params [] :body (null)]
(export lib-exports)`;

  const appSrc = `
[FUNC square :params [$n] :body ((* $n $n))]
[FUNC cube :params [$n] :body ((* $n (* $n $n)))]
[FUNC sum-powers :params [$x] :body ((+ (square $x) (cube $x)))]
(export sum-powers)`;

  const libMod = makeModule(standaloneCompile1(libSrc));
  const appMod = makeModule(standaloneCompile1(appSrc));

  if (appMod["sum-powers"](3) !== 36) throw new Error(`sum-powers: ${appMod["sum-powers"](3)}`);
  if (appMod["sum-powers"](4) !== 80) throw new Error(`sum-powers(4): ${appMod["sum-powers"](4)}`);
});

test("파일 변경 → 의존 모듈 재컴파일 결과 정합성", () => {
  const tmpApp = path.join(os.tmpdir(), `fl-app-${Date.now()}.fl`);

  fs.writeFileSync(tmpApp, `[FUNC base-val :params [] :body ((+ 10 0))] [FUNC get-val :params [] :body ((base-val))] (export get-val)`);
  const m1 = watchCompile(tmpApp);
  if (m1["get-val"]() !== 10) throw new Error(`v1: ${m1["get-val"]()}`);

  // 변경 후 재컴파일
  fs.writeFileSync(tmpApp, `[FUNC base-val :params [] :body ((+ 42 0))] [FUNC get-val :params [] :body ((base-val))] (export get-val)`);
  const m2 = watchCompile(tmpApp);

  fs.unlinkSync(tmpApp);

  if (m2["get-val"]() !== 42) throw new Error(`v2: ${m2["get-val"]()}`);
});

// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[42-F] Gen2 + Gen3 고정점 유지");

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
console.log(`Phase 42 Watch Mode: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
