// FreeLang v9: Phase 12 HTTP + Shell Tests
// AI-native external world access: HTTP Client + Shell execution

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err: any) {
    console.log(`✗ ${name}`);
    console.log(`  ${err.message}`);
  }
}

function run(code: string): any {
  const interp = new Interpreter();
  const ast = parse(lex(code));
  interp.interpret(ast);
  return interp.context.lastValue;
}

console.log("=== Phase 12: HTTP Client + Shell Tests ===\n");

// ── Shell Tests ──────────────────────────────────────────────

test("shell echo", () => {
  const result = run(`(shell "echo hello")`);
  if (!result.trim().includes("hello")) throw new Error(`Expected "hello", got "${result}"`);
});

test("shell_status success", () => {
  const result = run(`(shell_status "true")`);
  if (result !== 0) throw new Error(`Expected 0, got ${result}`);
});

test("shell_status failure", () => {
  const result = run(`(shell_status "false")`);
  if (result !== 1) throw new Error(`Expected 1, got ${result}`);
});

test("shell_ok true", () => {
  const result = run(`(shell_ok "true")`);
  if (result !== true) throw new Error(`Expected true, got ${result}`);
});

test("shell_ok false", () => {
  const result = run(`(shell_ok "false")`);
  if (result !== false) throw new Error(`Expected false, got ${result}`);
});

test("shell_pipe", () => {
  const result = run(`(shell_pipe "echo hello world" "tr ' ' '_'")`);
  if (!result.trim().includes("hello_world")) throw new Error(`Expected "hello_world", got "${result}"`);
});

test("shell_capture stdout", () => {
  const result = run(`(shell_capture "echo captured")`);
  if (typeof result !== "object") throw new Error(`Expected object, got ${typeof result}`);
  if (!result.stdout.includes("captured")) throw new Error(`Expected stdout to contain "captured"`);
  if (result.code !== 0) throw new Error(`Expected code 0, got ${result.code}`);
});

test("shell_exists curl", () => {
  const result = run(`(shell_exists "curl")`);
  if (result !== true) throw new Error(`curl not found in PATH`);
});

test("shell_env PATH", () => {
  const result = run(`(shell_env "PATH")`);
  if (typeof result !== "string" || result.length === 0) throw new Error(`Expected non-empty PATH`);
});

test("shell_cwd", () => {
  const result = run(`(shell_cwd)`);
  if (typeof result !== "string" || result.length === 0) throw new Error(`Expected non-empty cwd`);
});

// ── HTTP Tests (local only, no external deps) ─────────────────

test("http_status localhost:40000 health", () => {
  // kimdb is expected to be running on port 40000
  const result = run(`(http_status "http://localhost:40000/health")`);
  if (typeof result !== "number") throw new Error(`Expected number, got ${typeof result}`);
  // Accept any response (200 = running, 7 = connection refused treated as 0 by curl)
  console.log(`    → status: ${result}`);
});

test("http_get echo via shell", () => {
  // Verify http_get returns a string response from a local service
  const result = run(`(http_get "http://localhost:40000/health")`);
  if (typeof result !== "string") throw new Error(`Expected string, got ${typeof result}`);
  console.log(`    → body: ${result.slice(0, 40)}`);
});

test("http_json from local service", () => {
  // Test http_json parses JSON from a local endpoint
  const result = run(`(http_json "http://localhost:40000/health")`);
  if (typeof result !== "object") throw new Error(`Expected object, got ${typeof result}`);
  console.log(`    → parsed: ${JSON.stringify(result).slice(0, 60)}`);
});

// ── Integration: Shell + File I/O ────────────────────────────

test("shell writes, file reads", () => {
  const tmpFile = `/tmp/freelang-phase12-test-${Date.now()}.txt`;
  run(`(shell "echo phase12 > ${tmpFile}")`);
  const content = run(`(file_read "${tmpFile}")`);
  if (!content.includes("phase12")) throw new Error(`Expected "phase12" in file, got "${content}"`);
  run(`(file_delete "${tmpFile}")`);
});

test("shell_capture + error handling integration", () => {
  const result = run(`(shell_capture "echo integration-test")`);
  if (!result.stdout.includes("integration-test")) throw new Error("Expected integration-test in stdout");
});

console.log("\n=== Phase 12 Tests Complete ===");
