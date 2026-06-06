// FreeLang v9: Database Driver Standard Library
// Phase 20: kimdb REST API + SQLite CLI driver
// npm 0 달성: better-sqlite3 → node:sqlite (Node.js v22.5+ 내장)

import { spawnSync } from "child_process";
let _DatabaseSync: any = null;
function getDatabaseSync() {
  if (!_DatabaseSync) _DatabaseSync = eval('require')("node:sqlite").DatabaseSync;
  return _DatabaseSync;
}

// ── kimdb helper ─────────────────────────────────────────────────────────────

const KIMDB = process.env.KIMDB_URL || "http://localhost:40000";

function kimdbReq(method: string, path: string, body?: any): any {
  const toSerializable = (obj: any): any => {
    if (obj instanceof Map) return Object.fromEntries(obj);
    if (Array.isArray(obj)) return obj.map(toSerializable);
    if (typeof obj === "object" && obj !== null) {
      const result: any = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = toSerializable(v);
      }
      return result;
    }
    return obj;
  };

  const url = `${KIMDB}${path}`;
  const args = ["-sf", "--max-time", "5"];
  if (method !== "GET") {
    args.push("-X", method);
    if (body !== undefined) {
      args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(toSerializable(body)));
    }
  }
  args.push(url);
  const r = spawnSync("curl", args, { timeout: 6000 });
  if (r.error) throw new Error(`kimdb request failed: ${r.error.message}`);
  const raw = r.stdout?.toString().trim() ?? "";
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

// ── SQLite helper (node:sqlite 내장) ─────────────────────────────────────────

const dbConnections = new Map<string, any>();

function getDb(dbPath: string): any {
  if (!dbConnections.has(dbPath)) {
    dbConnections.set(dbPath, new (getDatabaseSync())(dbPath));
  }
  return dbConnections.get(dbPath)!;
}

function toPlain(row: any): any {
  if (!row) return row;
  return Object.assign({}, row);
}

function spreadParams(p: any): any[] {
  if (Array.isArray(p)) return p;
  if (p !== null && p !== undefined) return [p];
  return [];
}

function validateIdentifier(name: string): string {
  if (typeof name !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    throw new Error(`잘못된 SQL 식별자: '${name}'`);
  return name;
}

function buildWhere(where: any): { sql: string; params: any[] } {
  if (typeof where === "string")
    throw new Error(`db WHERE 절에 문자열 금지 — Map으로 전달하세요. 예: {:id 1} 또는 {"status" "active"}`);
  if (!where) return { sql: "", params: [] };
  const obj: Record<string, any> = where instanceof Map ? Object.fromEntries(where) : where;
  const parts: string[] = [];
  const params: any[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const m = k.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([><=!]+)?$/);
    if (!m) throw new Error(`잘못된 WHERE 키: '${k}'`);
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

// ── Module ───────────────────────────────────────────────────────────────────

export function createDbModule() {
  return {
    // ── kimdb (REST API) ─────────────────────────────────────

    // db_get collection id -> data or null
    "db_get": (collection: string, id: string): any => {
      try {
        const r = kimdbReq("GET", `/api/c/${collection}/${id}`);
        return r?.data ?? r ?? null;
      } catch { return null; }
    },

    // db_all collection -> array
    "db_all": (collection: string): any[] => {
      try {
        const r = kimdbReq("GET", `/api/c/${collection}`);
        return Array.isArray(r) ? r : (r?.data ?? []);
      } catch { return []; }
    },

    // db_put collection id data -> saved data
    "db_put": (collection: string, id: string, data: any): any => {
      const r = kimdbReq("PUT", `/api/c/${collection}/${id}`, data);
      return r?.data ?? r;
    },

    // db_delete collection id -> boolean
    "db_delete": (collection: string, id: string): boolean => {
      try {
        kimdbReq("DELETE", `/api/c/${collection}/${id}`);
        return true;
      } catch { return false; }
    },

    // db_project name -> project data or null  (kimdb shorthand)
    "db_project": (name: string): any => {
      try {
        const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "");
        const r = kimdbReq("GET", `/api/c/projects/${safe}`);
        return r?.data ?? r ?? null;
      } catch { return null; }
    },

    // db_projects -> project list
    "db_projects": (): any[] => {
      try {
        const r = kimdbReq("GET", "/api/c/projects");
        return Array.isArray(r) ? r : (r?.data ?? []);
      } catch { return []; }
    },

    // ── SQLite ───────────────────────────────────────────────

    // db_query dbPath sql params -> rows (JSON array)
    "db_query": (dbPath: string, sql: string, params: any = []): any[] => {
      const db = getDb(dbPath);
      const p = spreadParams(params);
      return db.prepare(sql).all(...p).map(toPlain);
    },

    // db_exec dbPath sql [params] -> ""
    "db_exec": (dbPath: string, sql: string, params: any = []): string => {
      const db = getDb(dbPath);
      const p = spreadParams(params);
      db.prepare(sql).run(...p);
      return "";
    },

    // db_insert dbPath table data -> true
    "db_insert": (dbPath: string, table: string, data: Record<string, any>): boolean => {
      const db = getDb(dbPath);
      validateIdentifier(table);
      const keys = Object.keys(data).map(validateIdentifier);
      const placeholders = keys.map(() => '?').join(',');
      db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders})`).run(...Object.values(data));
      return true;
    },

    // db_update dbPath table data where -> true
    // where: Map 또는 객체 — 예: {:id 1} {"status" "active"}
    "db_update": (dbPath: string, table: string, data: Record<string, any>, where: any): boolean => {
      const db = getDb(dbPath);
      validateIdentifier(table);
      const keys = Object.keys(data).map(validateIdentifier);
      const sets = keys.map(k => `${k}=?`).join(", ");
      const { sql: whereSql, params: whereParams } = buildWhere(where);
      db.prepare(`UPDATE ${table} SET ${sets} ${whereSql}`).run(...Object.values(data), ...whereParams);
      return true;
    },

    // db_delete_row dbPath table where -> true
    // where: Map 또는 객체 — 예: {:id 1} {"status" "inactive"}
    "db_delete_row": (dbPath: string, table: string, where: any): boolean => {
      validateIdentifier(table);
      const { sql: whereSql, params } = buildWhere(where);
      getDb(dbPath).prepare(`DELETE FROM ${table} ${whereSql}`).run(...params);
      return true;
    },

    // db_count dbPath table -> number
    "db_count": (dbPath: string, table: string): number => {
      validateIdentifier(table);
      const row = toPlain(getDb(dbPath).prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get());
      return Number(row?.cnt ?? 0);
    },

    // db_tables dbPath -> string[]
    "db_tables": (dbPath: string): string[] => {
      return getDb(dbPath)
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all().map((r: any) => toPlain(r).name);
    },

    // db_create dbPath sql -> true
    "db_create": (dbPath: string, sql: string): boolean => {
      getDb(dbPath).exec(sql);
      return true;
    },

    // db_close dbPath -> true
    "db_close": (dbPath: string): boolean => {
      if (dbConnections.has(dbPath)) {
        dbConnections.get(dbPath).close();
        dbConnections.delete(dbPath);
      }
      return true;
    }
  };
}
