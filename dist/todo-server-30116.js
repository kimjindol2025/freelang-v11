"use strict";
// Phase 55: 인메모리 TODO 서버 — 포트 30116
// test-phase55-http-client.ts가 별도 프로세스로 실행
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
const http = __importStar(require("http"));
let todos = [];
let nextId = 1;
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (c) => (data += c));
        req.on("end", () => resolve(data));
        req.on("error", reject);
    });
}
const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";
    res.setHeader("Content-Type", "application/json");
    if (method === "GET" && url === "/todos") {
        res.writeHead(200);
        res.end(JSON.stringify(todos));
    }
    else if (method === "POST" && url === "/todos") {
        const body = await readBody(req);
        let title = "untitled";
        try {
            title = JSON.parse(body).title ?? "untitled";
        }
        catch { }
        const todo = { id: nextId++, title, done: false };
        todos.push(todo);
        res.writeHead(201);
        res.end(JSON.stringify(todo));
    }
    else if (method === "DELETE" && url.startsWith("/todos/")) {
        const id = parseInt(url.split("/").pop() ?? "0", 10);
        todos = todos.filter((t) => t.id !== id);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
    }
    else if (method === "POST" && url === "/_reset") {
        todos = [];
        nextId = 1;
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
    }
    else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "not found" }));
    }
});
server.listen(30116, "127.0.0.1", () => {
    process.stdout.write("READY\n");
});
//# sourceMappingURL=todo-server-30116.js.map