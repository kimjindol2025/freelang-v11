// FreeLang v9: Phase 22 Process 모듈 테스트
// env_load, env_get, env_require, on_sigterm, error line numbers

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

function run(code: string): any {
  const interp = new Interpreter();
  const ast = parse(lex(code));
  interp.interpret(ast);
  return interp.context.lastValue;
}

// ─── 1. env_get ─────────────────────────────────────────────────────────────
console.log("\n[1] env_get");

test("env_get: 존재하는 변수", () => {
  process.env["FL_TEST_VAR"] = "hello";
  const result = run(`(env_get "FL_TEST_VAR")`);
  if (result !== "hello") throw new Error(`expected "hello", got "${result}"`);
});

test("env_get: 없는 변수 → 빈 문자열", () => {
  delete process.env["FL_NONEXISTENT_XYZ"];
  const result = run(`(env_get "FL_NONEXISTENT_XYZ")`);
  if (result !== "") throw new Error(`expected "", got "${result}"`);
});

// ─── 2. env_load ─────────────────────────────────────────────────────────────
console.log("\n[2] env_load");

test("env_load: .env 파일 읽기", () => {
  const tmpDir = os.tmpdir();
  const envFile = path.join(tmpDir, ".env.fl-test");
  fs.writeFileSync(envFile, `FL_DB_HOST=localhost\nFL_DB_PORT=5432\n# comment\nFL_SECRET="my secret"\n`);

  run(`(env_load "${envFile}")`);

  if (process.env["FL_DB_HOST"] !== "localhost")
    throw new Error(`FL_DB_HOST should be "localhost", got "${process.env["FL_DB_HOST"]}"`);
  if (process.env["FL_DB_PORT"] !== "5432")
    throw new Error(`FL_DB_PORT should be "5432"`);
  if (process.env["FL_SECRET"] !== "my secret")
    throw new Error(`FL_SECRET should be "my secret" (quotes stripped), got "${process.env["FL_SECRET"]}"`);

  fs.unlinkSync(envFile);
});

test("env_load: 없는 파일 → 빈 맵 반환 (no throw)", () => {
  const result = run(`(env_load "/nonexistent/.env.xyz")`);
  if (typeof result !== "object" || result === null)
    throw new Error(`expected object, got ${typeof result}`);
});

// ─── 3. env_require ──────────────────────────────────────────────────────────
console.log("\n[3] env_require");

test("env_require: 있는 변수 반환", () => {
  process.env["FL_REQ_VAR"] = "value123";
  const result = run(`(env_require "FL_REQ_VAR")`);
  if (result !== "value123") throw new Error(`expected "value123", got "${result}"`);
});

test("env_require: 없는 변수 → throw", () => {
  delete process.env["FL_MISSING_REQ"];
  let threw = false;
  try {
    run(`(env_require "FL_MISSING_REQ")`);
  } catch (e: any) {
    threw = true;
    if (!e.message.includes("FL_MISSING_REQ"))
      throw new Error(`error should mention var name, got: ${e.message}`);
  }
  if (!threw) throw new Error("should have thrown");
});

// ─── 4. on_sigterm / process helpers ─────────────────────────────────────────
console.log("\n[4] on_sigterm / process helpers");

test("on_sigterm: 등록 (예외 없이)", () => {
  run(`(on_sigterm)`); // no callback — just register handlers
});

test("process_pid: 양수 숫자 반환", () => {
  const result = run(`(process_pid)`);
  if (typeof result !== "number" || result <= 0)
    throw new Error(`expected positive number, got ${result}`);
});

test("process_argv: 배열 반환", () => {
  const result = run(`(process_argv)`);
  if (!Array.isArray(result))
    throw new Error(`expected array, got ${typeof result}`);
});

// ─── 5. 에러 라인 번호 ────────────────────────────────────────────────────────
console.log("\n[5] 에러 라인 번호");

test("에러 메시지에 FreeLang line N 포함", () => {
  let errorMsg = "";
  try {
    run(`(unknown_func_xyz 1 2 3)`);
  } catch (e: any) {
    errorMsg = e.message;
  }
  if (!errorMsg.includes("FreeLang line"))
    throw new Error(`에러에 라인 정보 없음: "${errorMsg}"`);
});

test("멀티라인 코드에서 라인 번호 추적", () => {
  const code = `
(+ 1 2)
(+ 3 4)
(nonexistent_fn 42)
`;
  let errorMsg = "";
  try {
    run(code);
  } catch (e: any) {
    errorMsg = e.message;
  }
  if (!errorMsg.includes("FreeLang line"))
    throw new Error(`에러에 라인 정보 없음: "${errorMsg}"`);
  console.log(`     → ${errorMsg.split("\n")[0]}`);
});

test("라인 번호가 실제 소스 라인과 일치", () => {
  // 4번째 라인에서 에러
  const code = `(+ 1 2)\n(+ 3 4)\n(+ 5 6)\n(this_does_not_exist)`;
  let errorMsg = "";
  try {
    run(code);
  } catch (e: any) {
    errorMsg = e.message;
  }
  if (!errorMsg.includes("FreeLang line 4"))
    throw new Error(`4번 라인 에러 기대, 실제: "${errorMsg}"`);
});

// ─── 결과 ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 22 결과: ${passed}/${passed + failed} PASS`);
if (failed > 0) {
  console.log(`❌ ${failed}개 실패`);
  process.exit(1);
} else {
  console.log(`✅ 전부 통과`);
}
