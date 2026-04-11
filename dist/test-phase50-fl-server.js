"use strict";
// FreeLang v9: Phase 50 — 첫 FL 프로덕션 서버 테스트
// fl-server-demo.fl을 TS interpreter로 로드 후 실제 HTTP 요청 검증
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
const http = __importStar(require("http"));
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const PORT = 30116;
let passed = 0;
let failed = 0;
let interp;
function test(name, fn) {
    return fn()
        .then(() => {
        console.log(`  ✅ ${name}`);
        passed++;
    })
        .catch((e) => {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
        failed++;
    });
}
function request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const options = {
            hostname: "127.0.0.1",
            port: PORT,
            path: urlPath,
            method,
            headers: {
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
            },
        };
        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve({ status: res.statusCode ?? 0, json: JSON.parse(data) });
                }
                catch {
                    resolve({ status: res.statusCode ?? 0, json: data });
                }
            });
        });
        req.on("error", reject);
        if (payload)
            req.write(payload);
        req.end();
    });
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function main() {
    // ── 서버 시작 ────────────────────────────────────────────
    console.log("\n[SETUP] FL 서버 로드 중...");
    interp = new interpreter_1.Interpreter();
    const flPath = path.join(__dirname, "fl-server-demo.fl");
    const src = fs.readFileSync(flPath, "utf-8");
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    // 서버가 Listen 상태가 될 때까지 대기
    await sleep(300);
    console.log(`[SETUP] 서버 준비 완료 (포트 ${PORT})\n`);
    console.log("[Phase 50] FL 프로덕션 서버 — REST API 검증");
    // TC-1: GET /todos → 빈 배열
    await test("GET /todos → 초기 빈 배열", async () => {
        const res = await request("GET", "/todos");
        if (res.status !== 200)
            throw new Error(`status ${res.status}`);
        if (!Array.isArray(res.json) || res.json.length !== 0)
            throw new Error(`got ${JSON.stringify(res.json)}`);
    });
    // TC-2: POST 첫 번째 TODO
    await test("POST /todos {title:'buy milk'} → 201, id:1", async () => {
        const res = await request("POST", "/todos", { title: "buy milk" });
        if (res.status !== 201)
            throw new Error(`status ${res.status}`);
        if (res.json.id !== 1)
            throw new Error(`id=${res.json.id}`);
        if (res.json.title !== "buy milk")
            throw new Error(`title=${res.json.title}`);
        if (res.json.done !== false)
            throw new Error(`done=${res.json.done}`);
    });
    // TC-3: POST 두 번째 TODO
    await test("POST /todos {title:'walk dog'} → 201, id:2", async () => {
        const res = await request("POST", "/todos", { title: "walk dog" });
        if (res.status !== 201)
            throw new Error(`status ${res.status}`);
        if (res.json.id !== 2)
            throw new Error(`id=${res.json.id}`);
    });
    // TC-4: GET /todos → 2개
    await test("GET /todos → 2개 항목", async () => {
        const res = await request("GET", "/todos");
        if (res.status !== 200)
            throw new Error(`status ${res.status}`);
        if (!Array.isArray(res.json) || res.json.length !== 2)
            throw new Error(`length=${res.json.length}`);
    });
    // TC-5: DELETE 첫 번째 TODO
    await test("DELETE /todos/1 → {ok:true}", async () => {
        const res = await request("DELETE", "/todos/1");
        if (res.status !== 200)
            throw new Error(`status ${res.status}`);
        if (!res.json.ok)
            throw new Error(`ok=${res.json.ok}`);
    });
    // TC-6: GET 삭제 후 1개 남음
    await test("GET /todos → 삭제 후 1개 (id:2만 남음)", async () => {
        const res = await request("GET", "/todos");
        if (!Array.isArray(res.json) || res.json.length !== 1)
            throw new Error(`length=${res.json.length}`);
        if (res.json[0].id !== 2)
            throw new Error(`remaining id=${res.json[0].id}`);
    });
    // TC-7: 없는 id 삭제 → no-op
    await test("DELETE /todos/999 (없는 id) → {ok:true} no-op", async () => {
        const res = await request("DELETE", "/todos/999");
        if (!res.json.ok)
            throw new Error(`ok=${res.json.ok}`);
        const listRes = await request("GET", "/todos");
        if (listRes.json.length !== 1)
            throw new Error(`after delete: length=${listRes.json.length}`);
    });
    // TC-8: PATCH todo 완료 상태 변경
    await test("PUT /todos/2 → done:true", async () => {
        await request("PUT", "/todos/2", { done: true });
        const listRes = await request("GET", "/todos");
        const todo2 = listRes.json.find((t) => t.id === 2);
        if (!todo2)
            throw new Error("todo 2 not found");
        if (todo2.done !== true)
            throw new Error(`done=${todo2.done}`);
    });
    // ── 서버 종료 ────────────────────────────────────────────
    try {
        interp.interpret((0, parser_1.parse)((0, lexer_1.lex)("(server_stop)")));
    }
    catch { /* ignore */ }
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Phase 50 FL 서버: ${passed} passed, ${failed} failed`);
    if (failed > 0)
        process.exit(1);
    process.exit(0);
}
main().catch((e) => {
    console.error("fatal:", e);
    process.exit(1);
});
//# sourceMappingURL=test-phase50-fl-server.js.map