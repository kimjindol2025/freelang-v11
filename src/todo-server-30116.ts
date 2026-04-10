// Phase 55: 인메모리 TODO 서버 — 포트 30116
// test-phase55-http-client.ts가 별도 프로세스로 실행

import * as http from "http";

interface Todo { id: number; title: string; done: boolean; }
let todos: Todo[] = [];
let nextId = 1;

function readBody(req: http.IncomingMessage): Promise<string> {
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
  } else if (method === "POST" && url === "/todos") {
    const body = await readBody(req);
    let title = "untitled";
    try { title = JSON.parse(body).title ?? "untitled"; } catch {}
    const todo: Todo = { id: nextId++, title, done: false };
    todos.push(todo);
    res.writeHead(201);
    res.end(JSON.stringify(todo));
  } else if (method === "DELETE" && url.startsWith("/todos/")) {
    const id = parseInt(url.split("/").pop() ?? "0", 10);
    todos = todos.filter((t) => t.id !== id);
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
  } else if (method === "POST" && url === "/_reset") {
    todos = [];
    nextId = 1;
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(30116, "127.0.0.1", () => {
  process.stdout.write("READY\n");
});
