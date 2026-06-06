// FreeLang v9: Phase 47 — 파일 I/O from FL
//
// 목표: FL 코드에서 (read-file), (write-file), (file-exists?),
//       (file-append), (dir-list) 직접 호출

import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;
const tmpDir = path.join(os.tmpdir(), "fl-phase47-test");

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

// ── 공통 유틸 ─────────────────────────────────────────────────
const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc       = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"),  "utf-8");
const parserSrc      = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc     = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");
const interpreterSrc = fs.readFileSync(path.join(flSrcDir, "freelang-interpreter.fl"), "utf-8");

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

const fileIO = {
  file_read:  (p: string) => fs.readFileSync(p, "utf-8"),
  file_write: (p: string, c: string) => { fs.writeFileSync(p, c, "utf-8"); return true; },
  file_exists: (p: string) => fs.existsSync(p),
  file_append: (p: string, c: string) => { fs.appendFileSync(p, c, "utf-8"); return true; },
  dir_list:   (p: string) => fs.readdirSync(p),
};

// ── Gen1 빌드 ─────────────────────────────────────────────────
console.log("\n[47-A] Gen1 빌드");

let lexerMod1: any, parserMod1: any, codegenMod1: any, interpMod1: any;
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
test("interpreter.fl → Gen1 (파일 I/O 추가)", () => {
  interpMod1 = makeModule(tsCompile(interpreterSrc), fileIO);
  if (typeof interpMod1.interpret !== "function") throw new Error("interpret not exported");
});

function flInterpret(flSrc: string): any {
  const ast = parserMod1.parse(lexerMod1.lex(flSrc));
  const converted = convertTStoFL(ast);
  return interpMod1.interpret(converted);
}

// ── 테스트 디렉터리 준비 ───────────────────────────────────────
fs.mkdirSync(tmpDir, { recursive: true });

// ── array?/string?/number? 내장 ───────────────────────────────
console.log("\n[47-B] 타입 체크 내장 함수");

test("array? — 배열에 true", () => {
  const result = flInterpret(`(array? [1 2 3])`);
  if (result !== true) throw new Error(`got ${result}`);
});

test("array? — 숫자에 false", () => {
  const result = flInterpret(`(array? 42)`);
  if (result !== false) throw new Error(`got ${result}`);
});

test("string? — 문자열에 true", () => {
  const result = flInterpret(`(string? "hello")`);
  if (result !== true) throw new Error(`got ${result}`);
});

test("string? — 숫자에 false", () => {
  const result = flInterpret(`(string? 42)`);
  if (result !== false) throw new Error(`got ${result}`);
});

test("number? — 숫자에 true", () => {
  const result = flInterpret(`(number? 42)`);
  if (result !== true) throw new Error(`got ${result}`);
});

test("number? — 문자열에 false", () => {
  const result = flInterpret(`(number? "hello")`);
  if (result !== false) throw new Error(`got ${result}`);
});

// ── 파일 I/O ──────────────────────────────────────────────────
console.log("\n[47-C] 파일 읽기/쓰기");

const testFile = path.join(tmpDir, "test.txt").replace(/\\/g, "/");
const testContent = "Hello, FreeLang!";

test("write-file — 파일 쓰기", () => {
  const src = `(write-file "${testFile}" "${testContent}")`;
  flInterpret(src);
  if (!fs.existsSync(testFile)) throw new Error("file not created");
  console.log(`    → 파일 생성: ${testFile}`);
});

test("read-file — 파일 읽기", () => {
  const src = `(read-file "${testFile}")`;
  const result = flInterpret(src);
  if (result !== testContent) throw new Error(`got: ${result}`);
});

test("write-file + read-file 라운드트립", () => {
  const file = path.join(tmpDir, "roundtrip.txt").replace(/\\/g, "/");
  const content = "FreeLang v9 Phase 47";
  flInterpret(`(write-file "${file}" "${content}")`);
  const result = flInterpret(`(read-file "${file}")`);
  if (result !== content) throw new Error(`got: ${result}`);
});

// ── file-exists? ─────────────────────────────────────────────
console.log("\n[47-D] file-exists?");

test("file-exists? — 존재하는 파일 → true", () => {
  const src = `(file-exists? "${testFile}")`;
  const result = flInterpret(src);
  if (result !== true) throw new Error(`got ${result}`);
});

test("file-exists? — 없는 파일 → false", () => {
  const noFile = path.join(tmpDir, "nonexistent.txt").replace(/\\/g, "/");
  const src = `(file-exists? "${noFile}")`;
  const result = flInterpret(src);
  if (result !== false) throw new Error(`got ${result}`);
});

// ── file-append ──────────────────────────────────────────────
console.log("\n[47-E] file-append");

const appendFile = path.join(tmpDir, "append.txt").replace(/\\/g, "/");

test("file-append — 첫 번째 쓰기", () => {
  flInterpret(`(write-file "${appendFile}" "line1\n")`);
  flInterpret(`(file-append "${appendFile}" "line2\n")`);
  const content = fs.readFileSync(appendFile, "utf-8");
  if (!content.includes("line1") || !content.includes("line2")) {
    throw new Error(`got: ${content}`);
  }
});

test("file-append — 내용 누적 확인", () => {
  const src = `(read-file "${appendFile}")`;
  const result = flInterpret(src);
  if (typeof result !== "string" || !result.includes("line1")) {
    throw new Error(`got: ${result}`);
  }
});

// ── dir-list ─────────────────────────────────────────────────
console.log("\n[47-F] dir-list");

test("dir-list — 배열 반환", () => {
  const dirPath = tmpDir.replace(/\\/g, "/");
  const src = `(dir-list "${dirPath}")`;
  const result = flInterpret(src);
  if (!Array.isArray(result)) throw new Error(`not array: ${typeof result}`);
  if (result.length === 0) throw new Error("empty dir");
  console.log(`    → ${result.length}개 파일`);
});

test("dir-list — 생성한 파일 포함 확인", () => {
  const dirPath = tmpDir.replace(/\\/g, "/");
  const src = `(dir-list "${dirPath}")`;
  const result = flInterpret(src) as string[];
  if (!result.some((f: string) => f.includes("test.txt"))) {
    throw new Error(`test.txt not found in: ${result.join(",")}`);
  }
});

// ── FL에서 파일 처리 함수 작성 ────────────────────────────────
console.log("\n[47-G] FL 함수로 파일 처리");

test("FL 함수로 파일 존재 시 읽기", () => {
  const file = path.join(tmpDir, "check.txt").replace(/\\/g, "/");
  fs.writeFileSync(file, "exists!");
  const src = `
[FUNC safe-read :params [$path]
  :body (
    (if (file-exists? $path)
      (read-file $path)
      "not found"
    )
  )
]
(safe-read "${file}")`;
  const result = flInterpret(src);
  if (result !== "exists!") throw new Error(`got: ${result}`);
});

test("FL 함수로 파일 없으면 기본값 반환", () => {
  const src = `
[FUNC safe-read :params [$path]
  :body (
    (if (file-exists? $path)
      (read-file $path)
      "not found"
    )
  )
]
(safe-read "/nonexistent/path/file.txt")`;
  const result = flInterpret(src);
  if (result !== "not found") throw new Error(`got: ${result}`);
});

test("array? + dir-list 조합", () => {
  const dirPath = tmpDir.replace(/\\/g, "/");
  const src = `
[FUNC count-files :params [$path]
  :body (
    (let [[$files (dir-list $path)]]
      (if (array? $files)
        (length $files)
        0
      )
    )
  )
]
(count-files "${dirPath}")`;
  const result = flInterpret(src);
  if (typeof result !== "number" || result <= 0) throw new Error(`got: ${result}`);
  console.log(`    → ${result}개 파일`);
});

// ── Phase 46 regression ───────────────────────────────────────
console.log("\n[47-H] Phase 46/45 regression 확인");

test("match 숫자 패턴 (regression)", () => {
  const src = `
[FUNC f :params [$n]
  :body ((match $n (1 "one") (_ "other")))
]
(f 1)`;
  const result = flInterpret(src);
  if (result !== "one") throw new Error(`got ${result}`);
});

test("팩토리얼 재귀 (regression)", () => {
  const src = `
[FUNC fact :params [$n]
  :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))
]
(fact 5)`;
  const result = flInterpret(src);
  if (result !== 120) throw new Error(`got ${result}`);
});

// ── 정리 ─────────────────────────────────────────────────────
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n    → 임시 파일 정리 완료`);

// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 47 File I/O: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
