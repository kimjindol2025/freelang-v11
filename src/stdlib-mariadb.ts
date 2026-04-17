// FreeLang v11: MariaDB Driver via HTTP API Wrapper
// 의존성 0 유지: freelang_mariadb HTTP 서버 (포트 33100) 경유

import { spawnSync } from "child_process";

const MARIADB_URL = process.env.MARIADB_URL || "http://localhost:33100";

function mariadbReq(sql: string): any {
  const body = JSON.stringify({ sql });
  const r = spawnSync(
    "curl",
    [
      "-sf",
      "--max-time", "10",
      "-X", "POST",
      "-H", "Content-Type: application/json",
      "-d", body,
      `${MARIADB_URL}/api/query`
    ],
    { timeout: 11000, encoding: "utf-8" }
  );
  if (r.error) throw new Error(`mariadb request failed: ${r.error.message}`);
  const raw = r.stdout?.toString().trim() ?? "";
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.error) throw new Error(`mariadb: ${parsed.error}`);
    return parsed;
  } catch (e: any) {
    if (e.message?.startsWith("mariadb:")) throw e;
    return raw;
  }
}

function bindParams(sql: string, params: any[]): string {
  if (!params || params.length === 0) return sql;
  return params.reduce(
    (s: string, p: any) => {
      if (p === null || p === undefined) return s.replace("?", "NULL");
      if (typeof p === "number") return s.replace("?", String(p));
      if (typeof p === "boolean") return s.replace("?", p ? "1" : "0");
      return s.replace("?", `'${String(p).replace(/'/g, "''")}'`);
    },
    sql
  );
}

export function createMariadbModule() {
  return {
    // mariadb_exec db sql params -> result (INSERT/UPDATE/DELETE/CREATE)
    "mariadb_exec": (db: string, sql: string, params: any[] = []) => {
      const finalSql = bindParams(sql, params);
      return mariadbReq(finalSql);
    },

    // mariadb_query db sql params -> rows array (SELECT)
    "mariadb_query": (db: string, sql: string, params: any[] = []) => {
      const finalSql = bindParams(sql, params);
      const r = mariadbReq(finalSql);
      if (Array.isArray(r)) return r;
      if (r && Array.isArray(r.rows)) return r.rows;
      if (r && Array.isArray(r.data)) return r.data;
      return [];
    },

    // mariadb_one db sql params -> first row or null
    "mariadb_one": (db: string, sql: string, params: any[] = []) => {
      const finalSql = bindParams(sql, params);
      const r = mariadbReq(finalSql);
      const rows = Array.isArray(r) ? r : (r?.rows ?? r?.data ?? []);
      return rows[0] ?? null;
    },

    // mariadb_health -> true if HTTP server is up
    "mariadb_health": () => {
      const r = spawnSync(
        "curl",
        ["-sf", "--max-time", "3", `${MARIADB_URL}/health`],
        { timeout: 4000, encoding: "utf-8" }
      );
      return (r.status ?? 1) === 0;
    },

    // mariadb_tables -> list of tables
    "mariadb_tables": () => {
      const r = spawnSync(
        "curl",
        ["-sf", "--max-time", "5", `${MARIADB_URL}/api/tables`],
        { timeout: 6000, encoding: "utf-8" }
      );
      if ((r.status ?? 1) !== 0) return [];
      const raw = r.stdout?.trim() ?? "";
      try {
        const parsed = JSON.parse(raw);
        return parsed.tables ?? [];
      } catch {
        return [];
      }
    }
  };
}
