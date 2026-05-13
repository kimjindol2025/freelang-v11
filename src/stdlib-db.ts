// FreeLang v9: Database Driver Standard Library
// Phase 20: kimdb REST API + SQLite CLI driver
// npm 0 달성: better-sqlite3 → node:sqlite (Node.js v22.5+ 내장)

import { spawnSync } from "child_process";
const { DatabaseSync } = require("node:sqlite");

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
    dbConnections.set(dbPath, new DatabaseSync(dbPath));
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
      const keys = Object.keys(data);
      const placeholders = keys.map(() => '?').join(',');
      db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders})`).run(...Object.values(data));
      return true;
    },

    // db_update dbPath table data where -> true
    "db_update": (dbPath: string, table: string, data: Record<string, any>, where: string): boolean => {
      const db = getDb(dbPath);
      const keys = Object.keys(data);
      const sets = keys.map(k => `${k}=?`).join(", ");
      db.prepare(`UPDATE ${table} SET ${sets} WHERE ${where}`).run(...Object.values(data));
      return true;
    },

    // db_delete_row dbPath table where -> true
    "db_delete_row": (dbPath: string, table: string, where: string): boolean => {
      getDb(dbPath).prepare(`DELETE FROM ${table} WHERE ${where}`).run();
      return true;
    },

    // db_count dbPath table -> number
    "db_count": (dbPath: string, table: string): number => {
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
