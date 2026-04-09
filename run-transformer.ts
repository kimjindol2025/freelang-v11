// FreeLang v9 Transformer: Codegen 경로로 실행
// FL → JS 컴파일 → vm.runInContext

import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./src/interpreter";
import { lex } from "./src/lexer";
import { parse } from "./src/parser";

const srcDir = path.join(__dirname, "src");
const rootDir = __dirname;

const lexerSrc   = fs.readFileSync(path.join(srcDir, "freelang-lexer.fl"),   "utf-8");
const parserSrc  = fs.readFileSync(path.join(srcDir, "freelang-parser.fl"),  "utf-8");
const codegenSrc = fs.readFileSync(path.join(srcDir, "freelang-codegen.fl"), "utf-8");

const transformerSrc = fs.readFileSync(path.join(rootDir, "gpt-transformer.fl"), "utf-8");

console.log("🔨 FreeLang v9 → JS 컴파일 중...");

const interp = new Interpreter();
for (const src of [lexerSrc, parserSrc, codegenSrc]) {
  interp.interpret(parse(lex(src)));
}

// gen-js로 컴파일
const escaped = JSON.stringify(transformerSrc);
interp.interpret(parse(lex(`(gen-js (parse (lex ${escaped})))`)));

const jsCode = interp.context.lastValue;
if (typeof jsCode !== "string") {
  console.error("❌ 컴파일 실패:", typeof jsCode, jsCode);
  process.exit(1);
}

console.log("✅ JS 컴파일 완료 (" + jsCode.length + " chars)");
// str 함수 호출 확인
const strCallIdx = jsCode.indexOf("str(");
if (strCallIdx >= 0) {
  console.log("str() 호출:", jsCode.slice(Math.max(0, strCallIdx-20), strCallIdx+80));
}
console.log("🚀 실행 중...\n");

// JS 실행 — FreeLang 런타임 내장함수
const sandbox: Record<string, any> = {
  console,
  Math,
  module: { exports: {} },
  require: () => ({}),
  // FreeLang 런타임
  str: (...args: any[]) => args.map(String).join(""),
  println: (...args: any[]) => console.log(...args),
  print: (...args: any[]) => process.stdout.write(args.map(String).join("")),
  append: (arr: any, ...rest: any[]) => {
    if (Array.isArray(arr)) {
      return rest.length === 1 && Array.isArray(rest[0])
        ? [...arr, ...rest[0]]
        : [...arr, ...rest];
    }
    return [arr, ...rest];
  },
  length: (a: any) => Array.isArray(a) ? a.length : String(a).length,
};
vm.createContext(sandbox);
try {
  vm.runInContext(jsCode, sandbox, { timeout: 60000 });
  process.exit(0);
} catch (e: any) {
  console.error("❌ 실행 오류:", e.message);
  // 오류 위치 찾기
  if (e.message && jsCode) {
    const varName = e.message.match(/(\w+) is not defined/)?.[1];
    if (varName) {
      const idx = jsCode.indexOf(varName);
      if (idx >= 0) {
        console.error("관련 JS 코드:", jsCode.slice(Math.max(0, idx-200), idx+200));
      }
    }
  }
  process.exit(1);
}
