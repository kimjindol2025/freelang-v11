"use strict";
// FreeLang v9: Phase 20 — Server + DB stdlib 테스트
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
const stdlib_server_1 = require("./stdlib-server");
const stdlib_db_1 = require("./stdlib-db");
let pass = 0;
let fail = 0;
function check(label, ok) {
    if (ok) {
        console.log(`  ✅ ${label}`);
        pass++;
    }
    else {
        console.error(`  ❌ ${label}`);
        fail++;
    }
}
// ── Server 모듈 단위 테스트 ────────────────────────────────────────
console.log("\n══════════════════════════════════════════");
console.log("  Phase 20: stdlib-server 단위 테스트");
console.log("══════════════════════════════════════════");
// callFn mock
const mockCallFn = (name, args) => {
    if (name === "handle_hello")
        return { msg: "hello" };
    if (name === "handle_text")
        return "plain text";
    if (name === "handle_status")
        return { __fl_response: true, type: "json", status: 201, body: { created: true } };
    throw new Error(`Unknown handler: ${name}`);
};
const S = (0, stdlib_server_1.createServerModule)(mockCallFn);
check("server_get 함수 존재", typeof S["server_get"] === "function");
check("server_post 함수 존재", typeof S["server_post"] === "function");
check("server_put 함수 존재", typeof S["server_put"] === "function");
check("server_delete 함수 존재", typeof S["server_delete"] === "function");
check("server_start 함수 존재", typeof S["server_start"] === "function");
check("server_stop 함수 존재", typeof S["server_stop"] === "function");
// server_json
const jsonResp = S["server_json"]({ ok: true });
check("server_json: __fl_response 마커", jsonResp.__fl_response === true);
check("server_json: type=json", jsonResp.type === "json");
check("server_json: status=200", jsonResp.status === 200);
check("server_json: body 포함", jsonResp.body?.ok === true);
// server_text
const textResp = S["server_text"]("hello world");
check("server_text: type=text", textResp.type === "text");
check("server_text: body 문자열", textResp.body === "hello world");
// server_status
const errResp = S["server_status"](404, "Not Found");
check("server_status: code=404", errResp.status === 404);
check("server_status: type=text", errResp.type === "text");
// server_req_* 파싱 (mock Request 객체)
const mockReq = {
    body: { name: "김", age: 30 },
    params: { id: "42", slug: "hello" },
    query: { q: "search term", page: "2" },
    headers: { "x-api-key": "secret", "content-type": "application/json" },
};
check("server_req_body: body 반환", S["server_req_body"](mockReq)?.name === "김");
check("server_req_params: params 반환", S["server_req_params"](mockReq)?.id === "42");
check("server_req_query: query 반환", S["server_req_query"](mockReq)?.q === "search term");
check("server_req_header: 헤더 반환", S["server_req_header"](mockReq, "x-api-key") === "secret");
check("server_req_header: 대소문자 무시", S["server_req_header"](mockReq, "X-API-KEY") === "secret");
check("server_req_header: 없는 헤더 null", S["server_req_header"](mockReq, "authorization") === null);
// server_get 라우트 등록 (오류 없이 실행)
let routeRegistered = false;
try {
    S["server_get"]("/test", "handle_hello");
    routeRegistered = true;
}
catch { }
check("server_get: 라우트 등록 오류 없음", routeRegistered);
// ── DB 모듈 단위 테스트 ───────────────────────────────────────────
console.log("\n══════════════════════════════════════════");
console.log("  Phase 20: stdlib-db 단위 테스트");
console.log("══════════════════════════════════════════");
const D = (0, stdlib_db_1.createDbModule)();
check("db_get 함수 존재", typeof D["db_get"] === "function");
check("db_all 함수 존재", typeof D["db_all"] === "function");
check("db_put 함수 존재", typeof D["db_put"] === "function");
check("db_delete 함수 존재", typeof D["db_delete"] === "function");
check("db_project 함수 존재", typeof D["db_project"] === "function");
check("db_projects 함수 존재", typeof D["db_projects"] === "function");
check("db_query 함수 존재", typeof D["db_query"] === "function");
check("db_exec 함수 존재", typeof D["db_exec"] === "function");
check("db_insert 함수 존재", typeof D["db_insert"] === "function");
check("db_update 함수 존재", typeof D["db_update"] === "function");
check("db_count 함수 존재", typeof D["db_count"] === "function");
check("db_tables 함수 존재", typeof D["db_tables"] === "function");
check("db_create 함수 존재", typeof D["db_create"] === "function");
// kimdb 연결 테스트 (kimdb가 실행 중이면 통과, 아니면 null 반환)
const proj = D["db_project"]("freelang-v9");
check("db_project: 오류 없이 반환 (null or data)", proj === null || typeof proj === "object");
const all = D["db_all"]("projects");
check("db_all: 배열 반환", Array.isArray(all));
// SQLite 테스트 (임시 DB)
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const tmpDb = path.join(os.tmpdir(), `fl_test_${Date.now()}.db`);
try {
    // 테이블 생성
    D["db_create"](tmpDb, "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT, val INTEGER)");
    check("db_create: 테이블 생성", true);
    // 행 삽입
    D["db_insert"](tmpDb, "items", { name: "foo", val: 42 });
    D["db_insert"](tmpDb, "items", { name: "bar", val: 99 });
    check("db_insert: 행 삽입 2개", true);
    // 카운트
    const cnt = D["db_count"](tmpDb, "items");
    check("db_count: 2행", cnt === 2);
    // 조회
    const rows = D["db_query"](tmpDb, "SELECT * FROM items ORDER BY val");
    check("db_query: 2행 반환", rows.length === 2);
    check("db_query: 첫 행 name=foo", rows[0]?.name === "foo");
    check("db_query: 첫 행 val=42", Number(rows[0]?.val) === 42);
    // ? 바인딩
    const filtered = D["db_query"](tmpDb, "SELECT * FROM items WHERE name=?", ["bar"]);
    check("db_query: ? 바인딩", filtered.length === 1 && filtered[0]?.name === "bar");
    // 업데이트
    D["db_update"](tmpDb, "items", { val: 100 }, "name='foo'");
    const updated = D["db_query"](tmpDb, "SELECT val FROM items WHERE name='foo'");
    check("db_update: val=100", Number(updated[0]?.val) === 100);
    // 테이블 목록
    const tables = D["db_tables"](tmpDb);
    check("db_tables: items 포함", tables.includes("items"));
    // 행 삭제
    D["db_delete_row"](tmpDb, "items", "name='foo'");
    const cntAfter = D["db_count"](tmpDb, "items");
    check("db_delete_row: 1행 남음", cntAfter === 1);
}
catch (e) {
    console.error(`  SQLite 테스트 오류: ${e.message}`);
    fail++;
}
finally {
    try {
        fs.unlinkSync(tmpDb);
    }
    catch { }
}
// ── 결과 ─────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════");
console.log(`결과: ${pass}/${pass + fail} PASS`);
console.log("══════════════════════════════════════════");
if (fail > 0)
    process.exit(1);
//# sourceMappingURL=test-phase20-server-db.js.map