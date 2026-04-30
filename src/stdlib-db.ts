// FreeLang v9: Database Driver Standard Library
// Phase 20: kimdb REST API + SQLite CLI driver

import { spawnSync } from "child_process";
import Database from "better-sqlite3";

// ── kimdb helper ─────────────────────────────────────────────────────────────

const KIMDB = process.env.KIMDB_URL || "http://localhost:40000";

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

const dbConnections = new Map<string, Database.Database>();

function getDb(dbPath: string): Database.Database {
  if (!dbConnections.has(dbPath)) {
    dbConnections.set(dbPath, new Database(dbPath));
  }
  return dbConnections.get(dbPath)!;
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
      const db = getDb(dbPath);
      return db.prepare(sql).all(params);
    },

    // db_exec dbPath sql [params] -> stdout string
    "db_exec": (dbPath: string, sql: string, params: any[] = []): string => {
      const db = getDb(dbPath);
      db.prepare(sql).run(params);
      return "";
    },

    // db_insert dbPath table data -> true
    "db_insert": (dbPath: string, table: string, data: Record<string, any>): boolean => {
      const db = getDb(dbPath);
      const keys = Object.keys(data);
      const placeholders = keys.map(() => '?').join(',');
      const vals = Object.values(data);
      db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders})`).run(vals);
      return true;
    },

    // db_update dbPath table data where -> true
    "db_update": (dbPath: string, table: string, data: Record<string, any>, where: string): boolean => {
      const db = getDb(dbPath);
      const keys = Object.keys(data);
      const sets = keys.map(k => `${k}=?`).join(", ");
      const vals = Object.values(data);
      // Assuming 'where' doesn't need parameter binding for this simple helper, though it's a risk.
      // Better way would be to support where params, but keeping it compatible with existing sig.
      db.prepare(`UPDATE ${table} SET ${sets} WHERE ${where}`).run(vals);
      return true;
    },

    // db_delete_row dbPath table where -> true
    "db_delete_row": (dbPath: string, table: string, where: string): boolean => {
      const db = getDb(dbPath);
      db.prepare(`DELETE FROM ${table} WHERE ${where}`).run();
      return true;
    },

    // db_count dbPath table -> number
    "db_count": (dbPath: string, table: string): number => {
      const db = getDb(dbPath);
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as {cnt: number};
      return Number(row?.cnt ?? 0);
    },

    // db_tables dbPath -> string[]
    "db_tables": (dbPath: string): string[] => {
      const db = getDb(dbPath);
      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {name: string}[];
      return rows.map(r => r.name);
    },

    // db_create dbPath sql -> true  (CREATE TABLE ...)
    "db_create": (dbPath: string, sql: string): boolean => {
      const db = getDb(dbPath);
      db.exec(sql); // exec can run multiple statements
      return true;
    },
    
    // db_close dbPath -> true
    "db_close": (dbPath: string): boolean => {
      if (dbConnections.has(dbPath)) {
        dbConnections.get(dbPath)!.close();
        dbConnections.delete(dbPath);
      }
      return true;
    }
  };
}
