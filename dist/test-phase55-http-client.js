"use strict";
// FreeLang v9: Phase 55 — FL HTTP 클라이언트 테스트
// todo-server-30116.ts를 별도 프로세스로 구동 후 FL 코드로 HTTP 검증
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const PORT = 30116;
const BASE = `http://localhost:${PORT}`;
let passed = 0;
let failed = 0;
let serverProc = null;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function makeInterp() {
    return new interpreter_1.Interpreter();
}
function flEval(interp, src) {
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
function resetServer() {
    (0, child_process_1.spawnSync)("curl", ["-s", "-X", "POST", `${BASE}/_reset`], { timeout: 5000 });
}
function startServer() {
    return new Promise((resolve, reject) => {
        serverProc = (0, child_process_1.spawn)("npx", ["ts-node", path.join(__dirname, "todo-server-30116.ts")], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        serverProc.stdout?.on("data", (data) => {
            if (data.toString().includes("READY"))
                resolve();
        });
        serverProc.on("error", reject);
        setTimeout(() => reject(new Error("Server start timeout")), 15000);
    });
}
function stopServer() {
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
        if (res !== "[]")
            throw new Error(`got: ${res}`);
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
        if (!obj.ok)
            throw new Error(`got: ${raw}`);
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
        if (res !== 1)
            throw new Error(`got: ${res}`);
    });
    resetServer();
    test("2개 POST 후 (length (http_json)) = 2", () => {
        const interp = makeInterp();
        flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"a\\"}")`);
        flEval(interp, `(http_post "${BASE}/todos" "{\\"title\\":\\"b\\"}")`);
        const res = flEval(interp, `(length (http_json "${BASE}/todos"))`);
        if (res !== 2)
            throw new Error(`got: ${res}`);
    });
    // ── TC-5: http_status ─────────────────────────────────────────
    console.log("\n[http_status]");
    test("http_status /todos → 200", () => {
        const interp = makeInterp();
        const res = flEval(interp, `(http_status "${BASE}/todos")`);
        if (res !== 200)
            throw new Error(`got: ${res}`);
    });
    test("http_status /notfound → 404", () => {
        const interp = makeInterp();
        const res = flEval(interp, `(http_status "${BASE}/notfound")`);
        if (res !== 404)
            throw new Error(`got: ${res}`);
    });
    // ── TC-6: fl-http-demo.fl 전체 실행 ──────────────────────────
    console.log("\n[fl-http-demo.fl 전체 실행]");
    resetServer();
    test("fl-http-demo.fl 오류 없이 실행", () => {
        const demoPath = path.join(__dirname, "fl-http-demo.fl");
        const src = fs.readFileSync(demoPath, "utf-8");
        const interp = makeInterp();
        interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    });
}
//# sourceMappingURL=test-phase55-http-client.js.map