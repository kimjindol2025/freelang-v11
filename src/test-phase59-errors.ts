// FreeLang v9: Phase 59 에러 시스템 개선 테스트
// 위치 정보 + 소스 코드 강조 + 유사 함수 힌트

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { suggestSimilar, levenshtein, formatError, FreeLangError } from "./error-formatter";
import { FunctionNotFoundError } from "./errors";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function runCode(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runCodeExpectError(src: string): Error {
  const interp = new Interpreter();
  try {
    interp.interpret(parse(lex(src)));
    throw new Error("에러가 발생하지 않음");
  } catch (e: any) {
    return e;
  }
}

// ─── TC-1: 존재하지 않는 함수 호출 → 유사 함수명 힌트 포함 ───
console.log("\n[TC-1] 존재하지 않는 함수 호출 — 유사 함수명 힌트");
test("compute-tax 호출 시 에러 발생", () => {
  const code = `
(define compute-rate [$x]
  (* $x 0.1))

(compute-tax 100)
`;
  const e = runCodeExpectError(code);
  assert(
    e.message.includes("Function not found") || e.message.includes("compute-tax"),
    `에러 메시지에 'Function not found' 또는 'compute-tax' 포함 필요: ${e.message}`
  );
});

// compute-taz (오타, 거리=1) → compute-tax 힌트 제안 확인
test("compute-taz 오타 → compute-tax 힌트 포함 (레벤슈타인 거리 1)", () => {
  const code = `
(define compute-tax [$x]
  (* $x 0.1))

(compute-taz 100)
`;
  const e = runCodeExpectError(code);
  const isFNFE = e instanceof FunctionNotFoundError;
  const msgHasHint = e.message.includes("compute-tax");
  const hintHasSimilar = isFNFE && !!((e as FunctionNotFoundError).hint?.includes("compute-tax"));
  assert(
    msgHasHint || hintHasSimilar,
    `힌트에 'compute-tax' 포함 필요:\nmessage=${e.message}\nhint=${isFNFE ? (e as FunctionNotFoundError).hint : "N/A"}`
  );
});

test("FunctionNotFoundError 타입 확인", () => {
  const e = runCodeExpectError(`(compute-missing 1)`);
  assert(
    e instanceof FunctionNotFoundError || e.message.includes("Function not found"),
    `FunctionNotFoundError 또는 'Function not found' 메시지: ${e.message}`
  );
});

// ─── TC-2: 정의된 함수 호출 → 정상 동작 ───
console.log("\n[TC-2] 정의된 함수 호출 — 정상 동작");
test("정의된 함수 compute-rate 정상 실행 (100 * 0.1 = 10)", () => {
  const result = runCode(`
(define compute-rate [$x]
  (* $x 0.1))

(compute-rate 100)
`);
  assert(result === 10, `결과값이 10이어야 합니다: ${result}`);
});

test("여러 함수 정의 후 올바른 함수 호출 성공 (3 + 4 = 7)", () => {
  const result = runCode(`
(define add [$a $b] (+ $a $b))
(define subtract [$a $b] (- $a $b))
(add 3 4)
`);
  assert(result === 7, `결과값이 7이어야 합니다: ${result}`);
});

// ─── TC-3: suggestSimilar 정확도 ───
console.log("\n[TC-3] suggestSimilar 정확도");
test("거리 1 — compute-taz → compute-tax", () => {
  const result = suggestSimilar("compute-taz", ["compute-tax", "compute-rate"]);
  assert(result === "compute-tax", `'compute-tax' 반환 필요: ${result}`);
});

test("거리 2 — compule-tax → compute-tax", () => {
  const result = suggestSimilar("compule-tax", ["compute-tax", "add"]);
  assert(result === "compute-tax", `'compute-tax' 반환 필요: ${result}`);
});

test("거리 3 이상 — null 반환", () => {
  const result = suggestSimilar("xyz", ["compute-tax", "compute-rate"]);
  assert(result === null, `null 반환 필요: ${result}`);
});

test("정확히 일치 — 거리 0", () => {
  const result = suggestSimilar("add", ["add", "subtract"]);
  assert(result === "add", `'add' 반환 필요: ${result}`);
});

test("빈 후보 목록 — null", () => {
  const result = suggestSimilar("foo", []);
  assert(result === null, `null 반환 필요: ${result}`);
});

test("대소문자 무시 — FOO vs foo", () => {
  const result = suggestSimilar("FOO", ["foo", "bar"]);
  assert(result === "foo", `'foo' 반환 필요: ${result}`);
});

// ─── TC-3b: levenshtein 직접 검증 ───
console.log("\n[TC-3b] levenshtein 거리 검증");
test("동일 문자열 → 0", () => {
  assert(levenshtein("abc", "abc") === 0, "거리가 0이어야 합니다");
});
test("빈 문자열 → 길이", () => {
  assert(levenshtein("", "abc") === 3, "거리가 3이어야 합니다");
});
test("1글자 치환 → 1", () => {
  assert(levenshtein("cat", "car") === 1, "거리가 1이어야 합니다");
});
test("삽입 1회 → 1", () => {
  assert(levenshtein("ab", "abc") === 1, "거리가 1이어야 합니다");
});

// ─── TC-4: 에러 포매팅 (file/line 포함) ───
console.log("\n[TC-4] formatError 포매팅");
test("file/line/col 포함 시 헤더 형식", () => {
  const err: FreeLangError = {
    message: "Function not found: compute-tax",
    file: "agent.fl",
    line: 42,
    col: 12,
    hint: "'compute-tax'를 찾을 수 없습니다. 혹시 'compute-rate'를 말씀하신 건가요?",
  };
  const out = formatError(err);
  assert(out.includes("agent.fl:42:12"), `파일:줄:컬럼 포함 필요:\n${out}`);
  assert(out.includes("힌트:"), `힌트 줄 포함 필요:\n${out}`);
  assert(out.includes("compute-rate"), `힌트에 'compute-rate' 포함 필요:\n${out}`);
});

test("소스 코드 강조 — 오류 줄 + 캐럿 표시", () => {
  const source = [
    "(define result",
    "  (let [[$x 100]]",
    "    (compute-tax $x)))",
  ].join("\n");
  const err: FreeLangError = {
    message: "Function not found: compute-tax",
    file: "agent.fl",
    line: 3,
    col: 5,
    source,
    hint: "혹시 'compute-rate'를 말씀하신 건가요?",
  };
  const out = formatError(err);
  assert(out.includes("compute-tax"), `소스 줄 포함 필요:\n${out}`);
  assert(out.includes("^"), `캐럿(^) 표시 필요:\n${out}`);
  console.log("\n--- 실제 출력 미리보기 ---");
  console.log(out);
  console.log("--- 끝 ---\n");
});

test("file/line 없이도 기본 포매팅 동작", () => {
  const err: FreeLangError = {
    message: "Function not found: foo",
  };
  const out = formatError(err);
  assert(out.includes("FreeLang 실행 오류"), `기본 헤더 포함 필요:\n${out}`);
  assert(out.includes("foo"), `함수명 포함 필요:\n${out}`);
});

test("FunctionNotFoundError — 필드 설정 확인", () => {
  const e = new FunctionNotFoundError(
    "compute-tax",
    "agent.fl",
    42,
    12,
    "혹시 'compute-rate'를 말씀하신 건가요?"
  );
  assert(e.name === "FunctionNotFoundError", `name: ${e.name}`);
  assert(e.functionName === "compute-tax", `functionName: ${e.functionName}`);
  assert(e.file === "agent.fl", `file: ${e.file}`);
  assert(e.line === 42, `line: ${e.line}`);
  assert(!!(e.hint && e.hint.includes("compute-rate")), `hint: ${e.hint}`);
});

// ─── 결과 출력 ───
console.log(`\n${"=".repeat(50)}`);
console.log(`Phase 59 에러 시스템 개선 테스트 결과`);
console.log(`${"=".repeat(50)}`);
console.log(`총 ${passed + failed}개 | PASS: ${passed} | FAIL: ${failed}`);
if (failed === 0) {
  console.log("✅ 모든 테스트 통과!");
} else {
  console.log(`❌ ${failed}개 실패`);
  process.exit(1);
}
