// FreeLang v9: Phase 29 — 크로스 파일 import/module 지원
// (import "./file.js" [$fn]) → const { fn } = require("./file.js");

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
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc   = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"),  "utf-8");
const parserSrc  = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");

function compileToJS(flSrc: string): string {
  const interp = new Interpreter();
  for (const src of [lexerSrc, parserSrc, codegenSrc]) {
    interp.interpret(parse(lex(src)));
  }
  interp.interpret(parse(lex(`(gen-js (parse (lex ${JSON.stringify(flSrc)})))`)));
  const jsCode = interp.context.lastValue as string;
  if (typeof jsCode !== "string") throw new Error(`codegen returned ${typeof jsCode}`);
  return jsCode;
}

// Node.js require 가능한 sandbox 실행 (임시 파일 방식)
function runWithRequire(mainJS: string, deps: Record<string, string>): any {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fl-test-"));
  try {
    // 의존 파일들 임시 디렉토리에 저장
    for (const [name, code] of Object.entries(deps)) {
      fs.writeFileSync(path.join(tmpDir, name), code);
    }
    // 메인 파일 저장 + 실행
    const mainPath = path.join(tmpDir, "main.js");
    fs.writeFileSync(mainPath, mainJS);
    // require 가능하게 실행
    const mod = require(mainPath);
    return mod;
  } finally {
    // cleanup
    for (const [name] of Object.entries(deps)) {
      try { fs.unlinkSync(path.join(tmpDir, name)); } catch {}
    }
    try { fs.unlinkSync(path.join(tmpDir, "main.js")); } catch {}
    try { fs.rmdirSync(tmpDir); } catch {}
  }
}

// ─── [22] import 코드젠 검증 ──────────────────────────────────────
console.log("\n[22] import 코드젠 검증");

test("import 코드 생성 확인", () => {
  const js = compileToJS(`
(import "./math-utils.js" [$double $triple])
[FUNC quad :params [$n] :body ((double (double $n)))]
(export quad)
  `.trim());
  if (!js.includes('require("./math-utils.js")')) throw new Error("require not found");
  if (!js.includes("double")) throw new Error("double not found");
});

test("import: 하이픈 이름 처리", () => {
  const js = compileToJS(`
(import "./utils.js" [$add-one $sub-one])
[FUNC apply-both :params [$n] :body ((+ (add-one $n) (sub-one $n)))]
(export apply-both)
  `.trim());
  if (!js.includes('"add-one": add_one')) throw new Error(`hyphen name not properly aliased: ${js.slice(0, 300)}`);
});

// ─── [23] import 실행 검증 (실제 파일 require) ────────────────────
console.log("\n[23] import 실행 검증");

test("두 FL 파일: math-utils + main", () => {
  // 1. math-utils.fl 컴파일
  const utilsJS = compileToJS(`
[FUNC double :params [$n] :body ((* $n 2))]
[FUNC square :params [$n] :body ((* $n $n))]
(export double square)
  `.trim());

  // 2. main.fl 컴파일 (import 사용)
  const mainJS = compileToJS(`
(import "./math-utils.js" [$double $square])
[FUNC double-square :params [$n] :body ((double (square $n)))]
(export double-square)
  `.trim());

  const exp = runWithRequire(mainJS, { "math-utils.js": utilsJS });
  // double-square(3) = double(square(3)) = double(9) = 18
  if (exp["double-square"](3) !== 18) throw new Error(`got ${exp["double-square"](3)}`);
  if (exp["double-square"](5) !== 50) throw new Error(`got ${exp["double-square"](5)}`);
});

test("세 FL 파일: a → b → main", () => {
  const aJS = compileToJS(`
[FUNC inc :params [$n] :body ((+ $n 1))]
(export inc)
  `.trim());

  const bJS = compileToJS(`
(import "./a.js" [$inc])
[FUNC inc3 :params [$n] :body ((inc (inc (inc $n))))]
(export inc3)
  `.trim());

  const mainJS = compileToJS(`
(import "./b.js" [$inc3])
[FUNC inc6 :params [$n] :body ((inc3 (inc3 $n)))]
(export inc6)
  `.trim());

  const exp = runWithRequire(mainJS, { "a.js": aJS, "b.js": bJS });
  if (exp.inc6(0) !== 6) throw new Error(`got ${exp.inc6(0)}`);
  if (exp.inc6(10) !== 16) throw new Error(`got ${exp.inc6(10)}`);
});

test("import + loop/recur 조합", () => {
  const mathJS = compileToJS(`
[FUNC pow2 :params [$n] :body ((* $n $n))]
(export pow2)
  `.trim());

  const mainJS = compileToJS(`
(import "./math.js" [$pow2])
[FUNC sum-squares :params [$lst]
  :body (
    (loop [[$i 0] [$acc 0]]
      (if (>= $i (length $lst))
        $acc
        (recur (+ $i 1) (+ $acc (pow2 (get $lst $i))))
      )
    )
  )
]
(export sum-squares)
  `.trim());

  const exp = runWithRequire(mainJS, { "math.js": mathJS });
  // 1²+2²+3²+4²+5² = 55
  if (exp["sum-squares"]([1,2,3,4,5]) !== 55) throw new Error(`got ${exp["sum-squares"]([1,2,3,4,5])}`);
});

// ─── 결과 ─────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 29 import/module: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
