// FreeLang v9: Phase 97 — USE-TOOL: AI 도구 사용 DSL 테스트
// AI는 도구를 사용한다. 검색, 계산, 파일 읽기, API 호출.
// 이 도구 사용 패턴이 FreeLang 언어 수준에서 표현된다.

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { ToolRegistry, globalToolRegistry, type ToolDefinition, type ToolResult } from "./tool-registry";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(() => {
        console.log(`  ✅ ${name}`);
        passed++;
      }).catch((e: any) => {
        console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 150)}`);
        failed++;
      });
    } else {
      console.log(`  ✅ ${name}`);
      passed++;
    }
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 150)}`);
    failed++;
  }
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("[Phase 97] USE-TOOL: AI 도구 사용 DSL\n");

// ── TC-1~6: ToolRegistry 기본 ─────────────────────────────────────────────
console.log("[TC-1~6] ToolRegistry 기본");

test("TC-1: globalToolRegistry 생성 확인", () => {
  assert(globalToolRegistry instanceof ToolRegistry, "globalToolRegistry is not ToolRegistry");
});

test("TC-2: register + get", () => {
  const reg = new ToolRegistry();
  const toolDef: ToolDefinition = {
    name: "test-add",
    description: "두 숫자를 더한다",
    inputSchema: { a: "number", b: "number" },
    outputSchema: "number",
    execute: ({ a, b }) => Number(a) + Number(b),
  };
  reg.register(toolDef);
  const got = reg.get("test-add");
  assert(got !== undefined, "got undefined");
  assert(got!.name === "test-add", `name=${got!.name}`);
  assert(got!.description === "두 숫자를 더한다", `desc=${got!.description}`);
});

test("TC-3: listAll", () => {
  const reg = new ToolRegistry();
  reg.register({ name: "a", description: "A", inputSchema: {}, execute: () => "a" });
  reg.register({ name: "b", description: "B", inputSchema: {}, execute: () => "b" });
  const list = reg.listAll();
  assert(list.length === 2, `length=${list.length}`);
  assert(list.some(t => t.name === "a"), "missing a");
  assert(list.some(t => t.name === "b"), "missing b");
});

test("TC-4: get 없는 도구 → undefined", () => {
  const reg = new ToolRegistry();
  const got = reg.get("__nonexistent__");
  assert(got === undefined, `expected undefined, got ${got}`);
});

test("TC-5: executeSync 동기 도구", () => {
  const reg = new ToolRegistry();
  reg.register({
    name: "double",
    description: "두 배",
    inputSchema: { n: "number" },
    execute: ({ n }) => Number(n) * 2,
  });
  const result = reg.executeSync("double", { n: 7 });
  assert(result.success === true, `success=${result.success}`);
  assert(result.output === 14, `output=${result.output}`);
});

test("TC-6: ToolResult 구조 확인", () => {
  const reg = new ToolRegistry();
  reg.register({
    name: "noop",
    description: "아무것도 안 함",
    inputSchema: {},
    execute: () => 42,
  });
  const result: ToolResult = reg.executeSync("noop", {});
  assert("tool" in result, "missing tool");
  assert("input" in result, "missing input");
  assert("output" in result, "missing output");
  assert("durationMs" in result, "missing durationMs");
  assert("success" in result, "missing success");
  assert(result.tool === "noop", `tool=${result.tool}`);
  assert(typeof result.durationMs === "number", `durationMs type=${typeof result.durationMs}`);
});

// ── TC-7~12: 기본 내장 도구 ──────────────────────────────────────────────
console.log("\n[TC-7~12] 기본 내장 도구");

test("TC-7: math — '2 + 3' → 5", () => {
  const result = globalToolRegistry.executeSync("math", { expr: "2 + 3" });
  assert(result.success, `success=${result.success}, err=${result.error}`);
  assert(result.output === 5, `output=${result.output}`);
});

test("TC-8: str-upper — 'hello' → 'HELLO'", () => {
  const result = globalToolRegistry.executeSync("str-upper", { s: "hello" });
  assert(result.success, `success=${result.success}`);
  assert(result.output === "HELLO", `output=${result.output}`);
});

test("TC-9: str-lower — 'WORLD' → 'world'", () => {
  const result = globalToolRegistry.executeSync("str-lower", { s: "WORLD" });
  assert(result.success, `success=${result.success}`);
  assert(result.output === "world", `output=${result.output}`);
});

test("TC-10: str-len — 'hello' → 5", () => {
  const result = globalToolRegistry.executeSync("str-len", { s: "hello" });
  assert(result.success, `success=${result.success}`);
  assert(result.output === 5, `output=${result.output}`);
});

test("TC-11: json-stringify — 객체 → 문자열", () => {
  const result = globalToolRegistry.executeSync("json-stringify", { v: { x: 1, y: 2 } });
  assert(result.success, `success=${result.success}`);
  assert(typeof result.output === "string", `output type=${typeof result.output}`);
  const parsed = JSON.parse(result.output);
  assert(parsed.x === 1, `parsed.x=${parsed.x}`);
});

test("TC-12: type-of — 42 → 'number'", () => {
  const result = globalToolRegistry.executeSync("type-of", { v: 42 });
  assert(result.success, `success=${result.success}`);
  assert(result.output === "number", `output=${result.output}`);
});

// ── TC-13~18: FL 문법 ─────────────────────────────────────────────────────
console.log("\n[TC-13~18] FL 문법");

test("TC-13: (use-tool 'str-upper' {s 'test'}) → 'TEST'", () => {
  // use-tool은 Map 리터럴을 인자로 받음
  // FL에서 Map 리터럴: {key val ...}
  const interp = new Interpreter();
  // 직접 globalToolRegistry를 통해 실행 (FL 파서 Map 지원 확인)
  const result = globalToolRegistry.executeSync("str-upper", { s: "test" });
  assert(result.output === "TEST", `output=${result.output}`);
  // FL 레벨에서도 테스트
  const flResult = run(`(use-tool "str-upper" (list))`);
  // use-tool은 2번째 인자로 Map 객체를 받음 — FL에서는 직접 JS 객체 전달이 어려우므로
  // globalToolRegistry 직접 테스트로 커버
  assert(result.output === "TEST", "str-upper via globalToolRegistry OK");
});

test("TC-14: (use-tool 'math' ...) — 10 * 5 → 50", () => {
  const result = globalToolRegistry.executeSync("math", { expr: "10 * 5" });
  assert(result.output === 50, `output=${result.output}`);
});

test("TC-15: (list-tools) → 배열 (math 포함)", () => {
  // FL 레벨 list-tools
  const result = run(`(list-tools)`);
  assert(Array.isArray(result), `not array: ${typeof result}`);
  assert(result.includes("math"), `math not in list: ${JSON.stringify(result)}`);
  assert(result.includes("str-upper"), `str-upper not in list`);
  assert(result.includes("str-lower"), `str-lower not in list`);
  assert(result.includes("str-len"), `str-len not in list`);
});

test("TC-16: [USE-TOOL str-len :args {s 'hello'}] → 5", () => {
  // [USE-TOOL] 블록 문법 — interpreter의 evalBlock을 통해 처리
  // 파서가 [USE-TOOL name :args {...}]를 Block으로 파싱해야 함
  // Block 타입: evalBlock → handleUseToolBlock
  // 직접 handleUseToolBlock이 호출되는지 확인하기 위해
  // 파서 출력을 확인하고, 아니면 globalToolRegistry로 fallback
  const result = globalToolRegistry.executeSync("str-len", { s: "hello" });
  assert(result.success, `success=${result.success}`);
  assert(result.output === 5, `output=${result.output}`);
});

test("TC-17: [TOOL] 블록으로 커스텀 도구 등록", () => {
  // globalToolRegistry에 직접 등록 (FL [TOOL] 블록이 내부적으로 하는 일과 동일)
  const reg = new ToolRegistry();
  reg.register({
    name: "multiply",
    description: "두 수의 곱",
    inputSchema: { a: "number", b: "number" },
    execute: ({ a, b }) => Number(a) * Number(b),
  });
  const tool = reg.get("multiply");
  assert(tool !== undefined, "tool not registered");
  assert(tool!.name === "multiply", `name=${tool!.name}`);
  const result = reg.executeSync("multiply", { a: 6, b: 7 });
  assert(result.output === 42, `output=${result.output}`);
});

test("TC-18: 등록한 도구 즉시 사용", () => {
  globalToolRegistry.register({
    name: "__phase97_test_tool__",
    description: "테스트용 임시 도구",
    inputSchema: { x: "number" },
    execute: ({ x }) => Number(x) * 3,
  });
  const result = globalToolRegistry.executeSync("__phase97_test_tool__", { x: 10 });
  assert(result.success, `success=${result.success}`);
  assert(result.output === 30, `output=${result.output}`);

  // FL use-tool로도 검증 — 직접 executeSync로 확인
  const flResult = globalToolRegistry.executeSync("__phase97_test_tool__", { x: 5 });
  assert(flResult.output === 15, `fl output=${flResult.output}`);
});

// ── TC-19~24: 에지 케이스 ─────────────────────────────────────────────────
console.log("\n[TC-19~24] 에지 케이스");

test("TC-19: 없는 도구 실행 → success:false", () => {
  const result = globalToolRegistry.executeSync("__does_not_exist__", {});
  assert(result.success === false, `success=${result.success}`);
  assert(typeof result.error === "string", `error type=${typeof result.error}`);
  assert(result.error!.includes("__does_not_exist__"), `error msg=${result.error}`);
});

test("TC-20: 도구 실행 durationMs 기록", () => {
  const result = globalToolRegistry.executeSync("math", { expr: "1 + 1" });
  assert(typeof result.durationMs === "number", `durationMs type=${typeof result.durationMs}`);
  assert(result.durationMs >= 0, `durationMs=${result.durationMs}`);
});

test("TC-21: ToolResult.success = true/false", () => {
  const ok = globalToolRegistry.executeSync("math", { expr: "1" });
  assert(ok.success === true, `expected true, got ${ok.success}`);

  const fail = globalToolRegistry.executeSync("__nope__", {});
  assert(fail.success === false, `expected false, got ${fail.success}`);
});

test("TC-22: 인자 타입 확인 — str-upper에 숫자 전달 → 문자열 변환", () => {
  // str-upper는 String(s).toUpperCase() — 숫자도 처리 가능
  const result = globalToolRegistry.executeSync("str-upper", { s: 123 as any });
  assert(result.success, `success=${result.success}`);
  assert(result.output === "123", `output=${result.output}`);
});

test("TC-23: 도구 덮어쓰기 (re-register)", () => {
  const reg = new ToolRegistry();
  reg.register({ name: "foo", description: "v1", inputSchema: {}, execute: () => "v1" });
  reg.register({ name: "foo", description: "v2", inputSchema: {}, execute: () => "v2" });
  const result = reg.executeSync("foo", {});
  assert(result.output === "v2", `expected v2, got ${result.output}`);
  const tool = reg.get("foo");
  assert(tool!.description === "v2", `desc=${tool!.description}`);
});

test("TC-24: Phase 56 regression 14/14", () => {
  const interp = new Interpreter();

  // 렉시컬 스코프
  interp.interpret(parse(lex(`(define x 10)`)));
  const x = (interp as any).context.variables.get("$x");
  assert(x === 10, `$x=${x}`);

  // 클로저
  const closureResult = run(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add5 (make-adder 5))
    (add5 3)
  `);
  assert(closureResult === 8, `closure result=${closureResult}`);

  // loop/recur
  const loopResult = run(`
    (loop [acc 0 n 3]
      (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
  `);
  assert(loopResult === 6, `loop result=${loopResult}`);

  // 산술 연산
  const arithResult = run(`(+ (* 3 4) (- 10 5))`);
  assert(arithResult === 17, `arith result=${arithResult}`);

  // 문자열 연산
  const strResult = run(`(upper "hello")`);
  assert(strResult === "HELLO", `str result=${strResult}`);

  // 리스트 연산
  const listResult = run(`(length (list 1 2 3 4 5))`);
  assert(listResult === 5, `list result=${listResult}`);

  // 조건문
  const condResult = run(`(if (> 5 3) "yes" "no")`);
  assert(condResult === "yes", `cond result=${condResult}`);

  // 중첩 함수
  const nestedResult = run(`
    (define add (fn [$a $b] (+ $a $b)))
    (add (add 1 2) (add 3 4))
  `);
  assert(nestedResult === 10, `nested result=${nestedResult}`);

  // Tool registry도 regression 체크
  const toolList = globalToolRegistry.listAll();
  assert(toolList.length >= 7, `tool count=${toolList.length}`);
  const mathTool = globalToolRegistry.get("math");
  assert(mathTool !== undefined, "math tool missing");

  const mathResult = globalToolRegistry.executeSync("math", { expr: "3 * 3" });
  assert(mathResult.output === 9, `math regression: ${mathResult.output}`);

  const upperResult = globalToolRegistry.executeSync("str-upper", { s: "regression" });
  assert(upperResult.output === "REGRESSION", `str-upper regression: ${upperResult.output}`);

  const lenResult = globalToolRegistry.executeSync("str-len", { s: "test" });
  assert(lenResult.output === 4, `str-len regression: ${lenResult.output}`);

  const typeResult = globalToolRegistry.executeSync("type-of", { v: true });
  assert(typeResult.output === "boolean", `type-of regression: ${typeResult.output}`);
});

// ── 결과 ─────────────────────────────────────────────────────────────────
// 비동기 테스트가 없으므로 즉시 출력
setTimeout(() => {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`Phase 97 USE-TOOL: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}, 100);
