import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHttpServerModule } from "../stdlib-http-server";
import { createDbModule } from "../stdlib-db";

describe("HTTP/DB 계약", () => {
  test("server_json은 기본/지정 상태 응답을 일정한 형태로 반환한다", () => {
    const http = createHttpServerModule(() => null);
    const ok = (http as any).server_json({ ok: true });
    const created = (http as any).server_json(201, { id: 1 });
    expect(ok).toMatchObject({ __fl_response: true, status: 200, contentType: "application/json", body: { ok: true } });
    expect(created).toMatchObject({ __fl_response: true, status: 201, contentType: "application/json", body: { id: 1 } });
  });

  test("db_exec/db_query는 SQLite에 저장하고 배열 행을 반환한다", () => {
    const db = createDbModule() as any;
    const dbPath = path.join(os.tmpdir(), `freelang-contract-${process.pid}-${Date.now()}.db`);
    try {
      db.db_exec(dbPath, "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, price INTEGER)");
      db.db_exec(dbPath, "INSERT INTO items (name, price) VALUES (?, ?)", ["towel", 35000]);
      const rows = db.db_query(dbPath, "SELECT name, price FROM items WHERE name = ?", ["towel"]);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toEqual([{ name: "towel", price: 35000 }]);
    } finally {
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });
});
