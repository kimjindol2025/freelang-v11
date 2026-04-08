// FreeLang v9: Phase 35 — 에러 메시지 개선
//
// 목표: 에러에 [line:col] 위치 + 에러 종류 포함
//       lexer 토큰에 :col 필드 추가
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
function testErr(name: string, fn: () => void, expectPat: string) {
  try {
    fn();
    console.log(`  ❌ ${name}: expected error but got none`);
    failed++;
  } catch (e: any) {
    const msg = e.message || "";
    if (msg.includes(expectPat)) {
      console.log(`  ✅ ${name}`);
      console.log(`    → "${msg.slice(0, 80)}"`);
      passed++;
    } else {
      console.log(`  ❌ ${name}: error lacks "${expectPat}": "${msg.slice(0, 80)}"`);
      failed++;
    }
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
    return { kind: "block", type: node.type, name: node.name, fields };
  }
  if (kind === "sexpr") return { kind: "sexpr", op: node.op, args: (node.args || []).map(convertTStoFL) };
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
console.log("\n[35-A] Gen1 빌드");

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

// ── 렉서 :col 검증 ────────────────────────────────────────────
console.log("\n[35-B] 렉서 토큰 :col 필드 검증");

test("단순 토큰 col 위치", () => {
  const tokens = lexerMod1.lex("(+ 1 2)");
  // ( col=1, + col=2, 1 col=4, 2 col=6, ) col=7
  const lparen = tokens[0];
  const plus   = tokens[1];
  const num1   = tokens[2];
  if (lparen.col !== 1) throw new Error(`( col=${lparen.col}, want 1`);
  if (plus.col !== 2)   throw new Error(`+ col=${plus.col}, want 2`);
  if (num1.col !== 4)   throw new Error(`1 col=${num1.col}, want 4`);
});
test("멀티라인 col 추적", () => {
  const tokens = lexerMod1.lex("(foo)\n(bar)");
  const bar = tokens.find((t: any) => t.value === "bar");
  if (!bar) throw new Error("bar token not found");
  if (bar.line !== 2) throw new Error(`bar line=${bar.line}, want 2`);
  if (bar.col !== 2)  throw new Error(`bar col=${bar.col}, want 2`);
});
test("들여쓰기 col 추적", () => {
  const tokens = lexerMod1.lex("  [FUNC add");
  const lb   = tokens.find((t: any) => t.type === "LBRACKET");
  const func = tokens.find((t: any) => t.value === "FUNC");
  if (!lb)   throw new Error("[ not found");
  if (!func) throw new Error("FUNC not found");
  if (lb.col !== 3)   throw new Error(`[ col=${lb.col}, want 3`);
  if (func.col !== 4) throw new Error(`FUNC col=${func.col}, want 4`);
});
test("문자열 토큰 col", () => {
  const tokens = lexerMod1.lex(`  "hello"`);
  const str = tokens[0];
  if (str.col !== 3) throw new Error(`str col=${str.col}, want 3`);
  if (str.value !== "hello") throw new Error(`value=${str.value}`);
});

// ── 파서 에러 메시지 형식 검증 ────────────────────────────────
console.log("\n[35-C] 파서 에러 메시지: [line:col] + ErrorType");

testErr("미닫힌 괄호",
  () => parserMod1.parse(lexerMod1.lex("(+ 1 2")),
  "SyntaxError"
);
testErr("미닫힌 배열 파싱 에러",
  () => parserMod1.parse(lexerMod1.lex("[FUNC add :params [$a $b")),
  "SyntaxError"
);
testErr("블록 타입 없음",
  () => parserMod1.parse(lexerMod1.lex("[123 add]")),
  "ParseError"
);
testErr("에러에 line:col 포함",
  () => parserMod1.parse(lexerMod1.lex("\n\n    (")),
  "[3:"   // 3번째 라인
);

// ── 에러 위치 정확도 검증 ─────────────────────────────────────
console.log("\n[35-D] 에러 위치 정확도");

test("1:1 — 첫 글자 에러", () => {
  try {
    parserMod1.parse(lexerMod1.lex(")"));
    throw new Error("should fail");
  } catch(e: any) {
    const m = e.message;
    if (!m.includes("[1:1]")) throw new Error(`got: ${m.slice(0, 60)}`);
    console.log(`    → "${m.slice(0, 60)}"`);
  }
});
test("멀티라인 에러: 2번 줄", () => {
  try {
    parserMod1.parse(lexerMod1.lex("(+ 1 2)\n("));
    throw new Error("should fail");
  } catch(e: any) {
    const m = e.message;
    if (!m.includes("[2:")) throw new Error(`expected [2:... but got: ${m.slice(0, 60)}`);
    console.log(`    → "${m.slice(0, 80)}"`);
  }
});

// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[35-E] Gen2 + Gen3 고정점 유지");

function standaloneCompile1(src: string) {
  return codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(src)));
}

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
  console.log(`    → ${parser3JS.length} chars`);
});
test("standaloneCompile2(codegen.fl) → Gen3", () => {
  codegen3JS = standaloneCompile2(codegenSrc);
  makeModule(codegen3JS);
  console.log(`    → ${codegen3JS.length} chars`);
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

// ── Gen2 파서 에러 메시지도 개선됐는지 검증 ──────────────────
console.log("\n[35-F] Gen2 파서 에러 메시지 형식 유지");

testErr("Gen2 parser: SyntaxError 형식",
  () => parserMod2.parse(lexerMod2.lex("(+ 1 2")),
  "SyntaxError"
);
testErr("Gen2 parser: [line:col] 형식",
  () => parserMod2.parse(lexerMod2.lex(")")),
  "[1:1]"
);

// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 35 Error Messages: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
