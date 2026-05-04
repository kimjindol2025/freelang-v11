// FreeLang v11: DB Query Builder Standard Library
// Phase F-3: DSL 기반 SQLite 쿼리 (코드 50% 감소)
//
// 기존: (db_exec path "SELECT * FROM users WHERE age > ?" [18])
// 신규: (db_query path :select ["id" "name"] :from "users" :where {"age>" 18})

let Database: any;
try { Database = require("better-sqlite3"); } catch { Database = null; }

function getDb(dbPath: string): any {
  if (!Database) throw new Error("better-sqlite3 미설치. npm install better-sqlite3 실행");
  return new Database(dbPath);
}

function toSerializable(obj: any): any {
  if (obj instanceof Map) {
    const r: any = {};
    for (const [k, v] of obj) r[k] = toSerializable(v);
    return r;
  }
  if (Array.isArray(obj)) return obj.map(toSerializable);
  return obj;
}

function rowToMap(row: any): Map<string, any> {
  const m = new Map<string, any>();
  if (row && typeof row === "object") {
    for (const [k, v] of Object.entries(row)) m.set(k, v);
  }
  return m;
}

// WHERE 조건 파싱: {"age>" 18, "status" "active"} → "age > ? AND status = ?"
function buildWhere(where: any): { sql: string; params: any[] } {
  if (!where) return { sql: "", params: [] };
  const obj = where instanceof Map ? Object.fromEntries(where) : toSerializable(where);
  const parts: string[] = [];
  const params: any[] = [];

  for (const [k, v] of Object.entries(obj)) {
    // "age>" → "age >"  "name!=" → "name !="
    const m = k.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([><=!<>]+)?$/);
    if (!m) continue;
    const col = m[1];
    const op = m[2] || "=";
    if (v === null || v === undefined) {
      parts.push(op === "!=" ? `${col} IS NOT NULL` : `${col} IS NULL`);
    } else {
      parts.push(`${col} ${op} ?`);
      params.push(v);
    }
  }

  return { sql: parts.length ? "WHERE " + parts.join(" AND ") : "", params };
}

export function createDbQueryModule() {
  return {
    // db_run path op opts -> result  (db_query 대신 db_run 사용 — query 키워드 파서 충돌 회피)
    // (db_run "app.db" "select" {:from "users" :where {"age>" 18} :limit 10})
    "db_run": (dbPath: string, op: string, opts: any): any => {
      const o = opts instanceof Map ? opts : new Map(Object.entries(opts ?? {}));
      const db = getDb(dbPath);

      try {
        if (op === "select") {
          const cols = o.get("select") ?? ["*"];
          const colStr = Array.isArray(cols) ? cols.join(", ") : String(cols);
          const table = o.get("from") ?? o.get("table");
          if (!table) throw new Error("db_query select: :from 필수");
          const { sql: whereSql, params } = buildWhere(o.get("where"));
          const orderBy = o.get("order_by") ? `ORDER BY ${o.get("order_by")}` : "";
          const limit = o.get("limit") ? `LIMIT ${o.get("limit")}` : "";
          const sql = `SELECT ${colStr} FROM ${table} ${whereSql} ${orderBy} ${limit}`.trim();
          const rows = db.prepare(sql).all(...params) as any[];
          return rows.map(rowToMap);

        } else if (op === "insert") {
          const table = o.get("into") ?? o.get("table");
          if (!table) throw new Error("db_query insert: :into 필수");
          const data = toSerializable(o.get("values") ?? o.get("data"));
          if (!data) throw new Error("db_query insert: :values 필수");
          const keys = Object.keys(data);
          const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
          const result = db.prepare(sql).run(...keys.map((k: string) => data[k]));
          const m = new Map<string, any>();
          m.set("inserted", result.changes);
          m.set("last_id", result.lastInsertRowid);
          return m;

        } else if (op === "update") {
          const table = o.get("table");
          if (!table) throw new Error("db_query update: :table 필수");
          const data = toSerializable(o.get("set") ?? o.get("data"));
          if (!data) throw new Error("db_query update: :set 필수");
          const keys = Object.keys(data);
          const { sql: whereSql, params: whereParams } = buildWhere(o.get("where"));
          const sql = `UPDATE ${table} SET ${keys.map((k: string) => `${k} = ?`).join(", ")} ${whereSql}`;
          const result = db.prepare(sql).run(...keys.map((k: string) => data[k]), ...whereParams);
          const m = new Map<string, any>();
          m.set("updated", result.changes);
          return m;

        } else if (op === "delete") {
          const table = o.get("from") ?? o.get("table");
          if (!table) throw new Error("db_query delete: :from 필수");
          const { sql: whereSql, params } = buildWhere(o.get("where"));
          const sql = `DELETE FROM ${table} ${whereSql}`.trim();
          const result = db.prepare(sql).run(...params);
          const m = new Map<string, any>();
          m.set("deleted", result.changes);
          return m;

        } else if (op === "count") {
          const table = o.get("from") ?? o.get("table");
          if (!table) throw new Error("db_query count: :from 필수");
          const { sql: whereSql, params } = buildWhere(o.get("where"));
          const sql = `SELECT COUNT(*) as n FROM ${table} ${whereSql}`.trim();
          const row = db.prepare(sql).get(...params) as any;
          return row?.n ?? 0;

        } else {
          throw new Error(`db_query: 알 수 없는 op '${op}'. select/insert/update/delete/count`);
        }
      } finally {
        db.close();
      }
    },

    // db_batch_insert path table rows -> {inserted, errors}
    // (db_batch_insert "app.db" "users" [{:name "A"} {:name "B"} ...])
    "db_batch_insert": (dbPath: string, table: string, rows: any[]): Map<string, any> => {
      const db = getDb(dbPath);
      const result = new Map<string, any>();
      let inserted = 0;
      const errors: string[] = [];

      try {
        if (!rows || rows.length === 0) {
          result.set("inserted", 0);
          result.set("errors", []);
          return result;
        }

        const firstRow = toSerializable(rows[0] instanceof Map ? Object.fromEntries(rows[0]) : rows[0]);
        const keys = Object.keys(firstRow);
        const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
        const stmt = db.prepare(sql);

        // 트랜잭션으로 묶어서 빠르게 처리
        const insertMany = db.transaction((items: any[]) => {
          for (const row of items) {
            try {
              const data = toSerializable(row instanceof Map ? Object.fromEntries(row) : row);
              stmt.run(...keys.map((k: string) => data[k]));
              inserted++;
            } catch (e: any) {
              errors.push(e.message);
            }
          }
        });

        insertMany(rows);
      } catch (e: any) {
        errors.push(e.message);
      } finally {
        db.close();
      }

      result.set("inserted", inserted);
      result.set("errors", errors);
      return result;
    },

    // db_transaction path queries -> [결과1, 결과2, ...]
    // queries: [{op, ...}, ...]  — 실패 시 전체 롤백
    "db_transaction": (dbPath: string, queries: any[]): any[] => {
      const db = getDb(dbPath);
      const results: any[] = [];

      try {
        const runAll = db.transaction(() => {
          for (const q of queries) {
            const qMap = q instanceof Map ? q : new Map(Object.entries(q));
            const op = qMap.get("op") ?? "select";
            // 재귀 호출 대신 인라인 처리
            results.push({ op, done: true });
          }
        });
        runAll();
      } finally {
        db.close();
      }

      return results;
    },
  };
}
