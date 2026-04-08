// FreeLang v9: Phase 34 — Parser TCO
//
// 목표: freelang-parser.fl의 누산기 재귀 → loop/recur TCO
//       read-pairs / read-items / read-do / read-args / read-fields / parse-top
//       → standaloneCompile(parserSrc) 성공 + Gen3 고정점 유지

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
console.log("\n[34-A] Gen1: tsCompile로 컴파일러 생성");

let lexerMod1: any, parserMod1: any, codegenMod1: any;

test("lexer.fl → Gen1", () => {
  lexerMod1 = makeModule(tsCompile(lexerSrc));
  if (typeof lexerMod1.lex !== "function") throw new Error("lex not exported");
});
test("parser.fl → Gen1 (TCO 버전)", () => {
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

// ── Gen1 파서 기능 검증 ────────────────────────────────────────
console.log("\n[34-B] Gen1 파서 기능 검증 (TCO 버전)");

test("FUNC + export 파싱", () => {
  const tokens = lexerMod1.lex(`[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)`);
  const ast = parserMod1.parse(tokens);
  if (!Array.isArray(ast) || ast.length < 2) throw new Error(`ast.length=${ast.length}`);
  if (ast[0].kind !== "block" || ast[0].type !== "FUNC") throw new Error("not FUNC block");
});
test("loop/recur 파싱", () => {
  const src = `[FUNC sum :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export sum)`;
  const tokens = lexerMod1.lex(src);
  const ast = parserMod1.parse(tokens);
  if (!ast[0].fields.body) throw new Error("no body");
});
test("match 파싱", () => {
  const src = `[FUNC grade :params [$s] :body ((match $s ("A" "excellent") (_ "ok")))] (export grade)`;
  const tokens = lexerMod1.lex(src);
  const ast = parserMod1.parse(tokens);
  if (!ast[0].fields.body) throw new Error("no body");
});
test("map literal 파싱 {:k v}", () => {
  const tokens = lexerMod1.lex(`(define x {:type "NUMBER" :value 42})`);
  const ast = parserMod1.parse(tokens);
  if (ast[0].kind !== "sexpr") throw new Error("not sexpr");
});

// ── Gen1 파서: 대용량 파일 파싱 (TCO 검증) ────────────────────
console.log("\n[34-C] Gen1 파서: 컴파일러 소스 파싱 (TCO 검증)");

test("Gen1 parser로 lexer.fl 파싱", () => {
  const tokens = lexerMod1.lex(lexerSrc);
  const ast = parserMod1.parse(tokens);
  if (!Array.isArray(ast) || ast.length < 5) throw new Error(`nodes=${ast.length}`);
  console.log(`    → ${tokens.length} tokens → ${ast.length} nodes`);
});
test("Gen1 parser로 parser.fl 파싱 (자기 자신)", () => {
  const tokens = lexerMod1.lex(parserSrc);
  const ast = parserMod1.parse(tokens);
  if (!Array.isArray(ast) || ast.length < 2) throw new Error(`nodes=${ast.length}`);
  console.log(`    → ${tokens.length} tokens → ${ast.length} nodes`);
});
test("Gen1 parser로 codegen.fl 파싱", () => {
  const tokens = lexerMod1.lex(codegenSrc);
  const ast = parserMod1.parse(tokens);
  if (!Array.isArray(ast) || ast.length < 20) throw new Error(`nodes=${ast.length}`);
  console.log(`    → ${tokens.length} tokens → ${ast.length} nodes`);
});

// ── Gen2 빌드 ─────────────────────────────────────────────────
console.log("\n[34-D] Gen2: standaloneCompile1으로 컴파일러 재컴파일");

let lexerMod2: any, parserMod2: any, codegenMod2: any;
let lexer2JS = "", parser2JS = "", codegen2JS = "";

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

function standaloneCompile2(src: string): string {
  return codegenMod2["gen-js"](parserMod2.parse(lexerMod2.lex(src)));
}

// ── Gen3 빌드 + 고정점 검증 ────────────────────────────────────
console.log("\n[34-E] Gen3: standaloneCompile2 + Gen2===Gen3 고정점");

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
test("lexer2JS === lexer3JS (고정점)", () => {
  if (lexer2JS !== lexer3JS) throw new Error(`diff at ${[...lexer2JS].findIndex((c,i)=>c!==lexer3JS[i])}`);
});
test("parser2JS === parser3JS (고정점)", () => {
  if (parser2JS !== parser3JS) throw new Error(`diff at ${[...parser2JS].findIndex((c,i)=>c!==parser3JS[i])}`);
});
test("codegen2JS === codegen3JS (고정점)", () => {
  if (codegen2JS !== codegen3JS) throw new Error(`diff at ${[...codegen2JS].findIndex((c,i)=>c!==codegen3JS[i])}`);
});

// ── Gen1===Gen2===Gen3 동치 ───────────────────────────────────
console.log("\n[34-F] Gen1 === Gen2 === Gen3 프로그램 동치");

const lexerMod3 = makeModule(lexer3JS || "module.exports={}");
const parserMod3 = makeModule(parser3JS || "module.exports={}");
const codegenMod3 = makeModule(codegen3JS || "module.exports={}");
function standaloneCompile3(src: string): string {
  return codegenMod3["gen-js"](parserMod3.parse(lexerMod3.lex(src)));
}

const PROGS = [
  { name: "덧셈",        src: `[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)` },
  { name: "loop/recur", src: `[FUNC sum-n :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export sum-n)` },
  { name: "match",      src: `[FUNC grade :params [$s] :body ((match $s ("A" "excellent") ("B" "good") (_ "ok")))] (export grade)` },
  { name: "cond",       src: `[FUNC sign :params [$n] :body ((cond [(> $n 0) "pos"] [(< $n 0) "neg"] [else "zero"]))] (export sign)` },
  { name: "map/filter", src: `[FUNC dp :params [$lst] :body ((map (filter $lst [x] (> $x 0)) [x] (* $x 2)))] (export dp)` },
  { name: "nested let", src: `[FUNC calc :params [$x $y] :body ((let [[$a (* $x 2)] [$b (+ $y 3)]] (+ $a $b)))] (export calc)` },
];

for (const p of PROGS) {
  test(`동치: ${p.name}`, () => {
    const js1 = standaloneCompile1(p.src);
    const js2 = standaloneCompile2(p.src);
    const js3 = standaloneCompile3(p.src);
    if (js1 !== js2) throw new Error(`Gen1≠Gen2`);
    if (js2 !== js3) throw new Error(`Gen2≠Gen3`);
  });
}

// ── 런타임 정확성 ─────────────────────────────────────────────
console.log("\n[34-G] Gen3 런타임 정확성");

test("Gen3: fact(10)", () => {
  const m = makeModule(standaloneCompile3(`[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)`));
  if (m.fact(10) !== 3628800) throw new Error(`got ${m.fact(10)}`);
});
test("Gen3: loop 10만", () => {
  const m = makeModule(standaloneCompile3(`[FUNC big-sum :params [$n] :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))] (export big-sum)`));
  if (m["big-sum"](100000) !== 5000050000) throw new Error(`got ${m["big-sum"](100000)}`);
});

// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 34 Parser TCO: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
