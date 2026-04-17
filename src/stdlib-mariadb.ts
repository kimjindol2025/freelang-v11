// FreeLang v11.5: MariaDB Driver — mariadb CLI 직접 호출 (공식 stdlib)
// 의존성 0: mariadb/mysql CLI 바이너리만 필요 (설치되어 있지 않으면 에러)
// env: MARIADB_SOCK, MARIADB_USER, MARIADB_PASS, MARIADB_HOST, MARIADB_PORT

import { spawnSync } from "child_process";

// Socket 후보 순차 탐색 (최초 1회 캐시)
let cachedSock: string | null = null;
function resolveSocket(): string {
  if (cachedSock) return cachedSock;
  if (process.env.MARIADB_SOCK) return (cachedSock = process.env.MARIADB_SOCK);
  const fs = require("fs") as typeof import("fs");
  const candidates = [
    "/data/data/com.termux/files/usr/tmp/mysqld.sock", // Termux
    "/var/run/mysqld/mysqld.sock",                     // Debian/Ubuntu
    "/var/lib/mysql/mysql.sock",                       // RHEL/CentOS
    "/tmp/mysqld.sock",
    "/tmp/mysql.sock",
  ];
  for (const s of candidates) {
    try { if (fs.existsSync(s)) return (cachedSock = s); } catch {}
  }
  return (cachedSock = "/tmp/mysqld.sock");
}

function buildArgs(db: string, sql: string): string[] {
  const sock = resolveSocket();
  const user = process.env.MARIADB_USER || "root";
  const pass = process.env.MARIADB_PASS || "";
  const host = process.env.MARIADB_HOST;
  const port = process.env.MARIADB_PORT;

  const args: string[] = ["-u", user];
  // Prefer socket when present; otherwise fall back to host/port.
  if (host) {
    args.push("-h", host);
    if (port) args.push("-P", port);
  } else {
    args.push("--socket=" + sock);
  }
  if (pass) args.push("-p" + pass);
  if (db) args.push(db);
  args.push("--batch", "-e", sql);
  return args;
}

function runMariadb(db: string, sql: string): string {
  const r = spawnSync("mariadb", buildArgs(db, sql), { timeout: 15000, encoding: "utf-8" });
  if (r.error) throw new Error(`mariadb CLI not found or failed: ${r.error.message}`);
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? "";
    throw new Error(`mariadb exit ${r.status}${stderr ? ": " + stderr : ""}`);
  }
  return r.stdout?.toString() ?? "";
}

// tab-separated batch output → rows[]
function parseRows(raw: string): any[] {
  const lines = raw.split("\n").filter((l) => l.length > 0);
  if (lines.length < 1) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const vals = line.split("\t");
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => {
      const v = vals[i];
      if (v === undefined || v === "NULL") obj[h] = null;
      else if (/^-?\d+$/.test(v)) obj[h] = parseInt(v, 10);
      else if (/^-?\d+\.\d+$/.test(v)) obj[h] = parseFloat(v);
      else obj[h] = v;
    });
    return obj;
  });
}

function bindParams(sql: string, params: any[]): string {
  if (!params || params.length === 0) return sql;
  return params.reduce(
    (s: string, p: any) => {
      if (p === null || p === undefined) return s.replace("?", "NULL");
      if (typeof p === "number") return s.replace("?", String(p));
      if (typeof p === "boolean") return s.replace("?", p ? "1" : "0");
      return s.replace("?", `'${String(p).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`);
    },
    sql
  );
}

export function createMariadbModule() {
  return {
    // mariadb_exec db sql [params] -> raw output string (INSERT/UPDATE/DELETE/CREATE)
    "mariadb_exec": (db: string, sql: string, params: any[] = []) => {
      return runMariadb(db, bindParams(sql, params));
    },

    // mariadb_query db sql [params] -> rows[] (SELECT)
    "mariadb_query": (db: string, sql: string, params: any[] = []) => {
      return parseRows(runMariadb(db, bindParams(sql, params)));
    },

    // mariadb_one db sql [params] -> first row or null
    "mariadb_one": (db: string, sql: string, params: any[] = []) => {
      const rows = parseRows(runMariadb(db, bindParams(sql, params)));
      return rows[0] ?? null;
    },

    // mariadb_health -> true if server reachable
    "mariadb_health": () => {
      const sock = resolveSocket();
      const user = process.env.MARIADB_USER || "root";
      const args = ["-u", user, "--socket=" + sock, "ping"];
      const r = spawnSync("mariadb-admin", args, { timeout: 3000, encoding: "utf-8" });
      return (r.status ?? 1) === 0;
    },

    // mariadb_databases -> list of database names
    "mariadb_databases": () => {
      const rows = parseRows(runMariadb("", "SHOW DATABASES"));
      return rows.map((r: any) => r.Database);
    },

    // mariadb_tables db -> list of table names in given db
    "mariadb_tables": (db: string) => {
      const rows = parseRows(runMariadb(db, "SHOW TABLES"));
      return rows.map((r: any) => Object.values(r)[0]);
    },
  };
}
