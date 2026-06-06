// FreeLang v9: Phase 55 — FL HTTP 클라이언트 테스트
// todo-server-30116.ts를 별도 프로세스로 구동 후 FL 코드로 HTTP 검증

import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { spawn, spawnSync, ChildProcess } from "child_process";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

const PORT = 30116;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
let serverProc: ChildProcess | null = null;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

function makeInterp(): Interpreter {
  return new Interpreter();
}

function flEval(interp: Interpreter, src: string): any {
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function resetServer(): void {
  spawnSync("curl", ["-s", "-X", "POST", `${BASE}/_reset`], { timeout: 5000 });
}

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    serverProc = spawn("npx", ["ts-node", path.join(__dirname, "todo-server-30116.ts")], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    serverProc.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("READY")) resolve();
    });
    serverProc.on("error", reject);
    setTimeout(() => reject(new Error("Server start timeout")), 15000);
  });
}

function stopServer(): void {
  serverProc?.kill();
}

// ── 메인 ──────────────────────────────────────────────────────────
console.log("[Phase 55] FL HTTP 클라이언트 검증\n");

startServer().then(() => {
  runTests();
  const code = failed > 0 ? 1 : 0;
  stopServer();
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Phase 55 HTTP 클라이언트: ${passed} passed, ${failed} failed`);
  process.exit(code);
}).catch((err) => {
  console.error("서버 시작 실패:", err.message);
  process.exit(1);
});

function runTests() {
  // ── TC-1: http_get ────────────────────────────────────────────
  console.log("[http_get 기본 동작]");

  resetServer();
  test("GET /todos → 빈 배열 문자열", () => {
    const interp = makeInterp();
    const res = flEval(interp, `(http_get "${BASE}/todos")`);
    if (res !== "[]") throw new Error(`got: ${res}`);
  });

  resetServer();
  test("http_json /todos → JS 배열 (length 0)", () => {
    const interp = makeInterp();
    const res = flEval(interp, `(http_json "${BASE}/todos")`);
    if (!Array.isArray(res) || res.length !== 0)
      throw new Error(`got: ${JSON.stringify(res)}`);
  });

  // ── TC-2: http_post ────────────────────────────────────────────
  console.log("\n[http_post 동작]");

  resetServer();
  test("POST /todos → id:1, title 일치", () => {
    const interp = makeInterp();
    const raw = flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"buy milk\\"}")`);
    const obj = JSON.parse(raw);
    if (obj.id !== 1 || obj.title !== "buy milk")
      throw new Error(`got: ${raw}`);
  });

  resetServer();
  test("POST 후 GET → 1개 항목", () => {
    const interp = makeInterp();
    flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"walk dog\\"}")`);
    const list = flEval(interp, `(http_json "${BASE}/todos")`);
    if (!Array.isArray(list) || list.length !== 1)
      throw new Error(`got: ${JSON.stringify(list)}`);
  });

  // ── TC-3: http_delete ──────────────────────────────────────────
  console.log("\n[http_delete 동작]");

  resetServer();
  test("DELETE /todos/1 → ok:true", () => {
    const interp = makeInterp();
    flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"task1\\"}")`);
    const raw = flEval(interp, `(http_delete "${BASE}/todos/1")`);
    const obj = JSON.parse(raw);
    if (!obj.ok) throw new Error(`got: ${raw}`);
  });

  resetServer();
  test("DELETE 후 GET → 빈 배열", () => {
    const interp = makeInterp();
    flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"tmp\\"}")`);
    flEval(interp, `(http_delete "${BASE}/todos/1")`);
    const list = flEval(interp, `(http_json "${BASE}/todos")`);
    if (!Array.isArray(list) || list.length !== 0)
      throw new Error(`got: ${JSON.stringify(list)}`);
  });

  // ── TC-4: JSON 파싱 ────────────────────────────────────────────
  console.log("\n[JSON 자동 파싱]");

  resetServer();
  test("http_json → (get item 'id') 접근 = 1", () => {
    const interp = makeInterp();
    flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"test\\"}")`);
    const res = flEval(interp, `(get (get (http_json "${BASE}/todos") 0) "id")`);
    if (res !== 1) throw new Error(`got: ${res}`);
  });

  resetServer();
  test("2개 POST 후 (length (http_json)) = 2", () => {
    const interp = makeInterp();
    flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"a\\"}")`);
    flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"b\\"}")`);
    const res = flEval(interp, `(length (http_json "${BASE}/todos"))`);
    if (res !== 2) throw new Error(`got: ${res}`);
  });

  // ── TC-5: http_status ─────────────────────────────────────────
  console.log("\n[http_status]");

  test("http_status /todos → 200", () => {
    const interp = makeInterp();
    const res = flEval(interp, `(http_status "${BASE}/todos")`);
    if (res !== 200) throw new Error(`got: ${res}`);
  });

  test("http_status /notfound → 404", () => {
    const interp = makeInterp();
    const res = flEval(interp, `(http_status "${BASE}/notfound")`);
    if (res !== 404) throw new Error(`got: ${res}`);
  });

  // ── TC-6: fl-http-demo.fl 전체 실행 ──────────────────────────
  console.log("\n[fl-http-demo.fl 전체 실행]");

  resetServer();
  test("fl-http-demo.fl 오류 없이 실행", () => {
    const demoPath = path.join(__dirname, "fl-http-demo.fl");
    const src = fs.readFileSync(demoPath, "utf-8");
    const interp = makeInterp();
    interp.interpret(parse(lex(src)));
  });
}
