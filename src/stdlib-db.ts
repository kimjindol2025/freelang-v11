// FreeLang v9: Database Driver Standard Library
// Phase 20: kimdb REST API + SQLite CLI driver

import { spawnSync } from "child_process";

// ── kimdb helper ─────────────────────────────────────────────────────────────

const KIMDB = "http://localhost:40000";

function kimdbReq(method: string, path: string, body?: any): any {
  const url = `${KIMDB}${path}`;
  const args = ["-sf", "--max-time", "5"];
  if (method !== "GET") {
    args.push("-X", method);
    if (body !== undefined) {
      args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
    }
  }
  args.push(url);
  const r = spawnSync("curl", args, { timeout: 6000 });
  if (r.error) throw new Error(`kimdb request failed: ${r.error.message}`);
  const raw = r.stdout?.toString().trim() ?? "";
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

// ── SQLite helper ─────────────────────────────────────────────────────────────

function sqliteExec(dbPath: string, sql: string): string {
  const r = spawnSync("sqlite3", [dbPath, sql], { timeout: 10000, encoding: "utf-8" });
  if (r.error) throw new Error(`sqlite3 error: ${r.error.message}`);
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? "";
    throw new Error(`sqlite3 exit ${r.status}${stderr ? ": " + stderr : ""}`);
  }
  return r.stdout?.trim() ?? "";
}

function sqliteJson(dbPath: string, sql: string): any[] {
  const r = spawnSync("sqlite3", ["-json", dbPath, sql], { timeout: 10000, encoding: "utf-8" });
  if (r.error) throw new Error(`sqlite3 error: ${r.error.message}`);
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? "";
    throw new Error(`sqlite3 exit ${r.status}${stderr ? ": " + stderr : ""}`);
  }
  const raw = r.stdout?.trim() ?? "";
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// Bind positional ? params (basic escaping — for simple string/number values)
function bindParams(sql: string, params: any[]): string {
  return params.reduce(
    (s: string, p: any) =>
      s.replace("?", typeof p === "number" ? String(p) : `'${String(p).replace(/'/g, "''")}'`),
    sql
  );
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
    "db_query": (dbPath: string, sql: string, params: any[] = []): any[] => {
      return sqliteJson(dbPath, bindParams(sql, params));
    },

    // db_exec dbPath sql -> stdout string
    "db_exec": (dbPath: string, sql: string): string => {
      return sqliteExec(dbPath, sql);
    },

    // db_insert dbPath table data -> true
    "db_insert": (dbPath: string, table: string, data: Record<string, any>): boolean => {
      const keys = Object.keys(data);
      const vals = Object.values(data).map(v =>
        typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`
      );
      sqliteExec(dbPath, `INSERT INTO ${table} (${keys.join(",")}) VALUES (${vals.join(",")});`);
      return true;
    },

    // db_update dbPath table data where -> true
    "db_update": (dbPath: string, table: string, data: Record<string, any>, where: string): boolean => {
      const sets = Object.entries(data).map(([k, v]) =>
        `${k}=${typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`}`
      ).join(", ");
      sqliteExec(dbPath, `UPDATE ${table} SET ${sets} WHERE ${where};`);
      return true;
    },

    // db_delete_row dbPath table where -> true
    "db_delete_row": (dbPath: string, table: string, where: string): boolean => {
      sqliteExec(dbPath, `DELETE FROM ${table} WHERE ${where};`);
      return true;
    },

    // db_count dbPath table -> number
    "db_count": (dbPath: string, table: string): number => {
      const rows = sqliteJson(dbPath, `SELECT COUNT(*) as cnt FROM ${table}`);
      return Number(rows[0]?.cnt ?? 0);
    },

    // db_tables dbPath -> string[]
    "db_tables": (dbPath: string): string[] => {
      const rows = sqliteJson(dbPath, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      return rows.map((r: any) => r.name);
    },

    // db_create dbPath sql -> true  (CREATE TABLE ...)
    "db_create": (dbPath: string, sql: string): boolean => {
      sqliteExec(dbPath, sql);
      return true;
    },
  };
}
