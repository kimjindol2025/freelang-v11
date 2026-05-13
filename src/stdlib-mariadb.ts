// FreeLang v11.6: MariaDB Driver
// - mariadb_query/exec/one: CLI 방식 (의존성 0, 즉시 사용)
// - mariadb_pool_*: mysql2 Worker Thread 풀 (영구 연결, 트랜잭션, 빠름)
// env: MARIADB_SOCK, MARIADB_USER, MARIADB_PASS, MARIADB_HOST, MARIADB_PORT

import { spawnSync } from "child_process";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 방식 (기존 호환)
// ─────────────────────────────────────────────────────────────────────────────

let cachedSock: string | null = null;
function resolveSocket(): string {
  if (cachedSock) return cachedSock;
  if (process.env.MARIADB_SOCK) return (cachedSock = process.env.MARIADB_SOCK);
  const fs = require("fs") as typeof import("fs");
  const candidates = [
    "/data/data/com.termux/files/usr/tmp/mysqld.sock",
    "/var/run/mysqld/mysqld.sock",
    "/var/lib/mysql/mysql.sock",
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

const MARIADB_SEARCH_PATHS = [
  "/data/data/com.termux/files/usr/bin", // Termux
  "/usr/bin",
  "/usr/local/bin",
  "/opt/homebrew/bin",
  "/opt/local/bin",
];

let resolvedMariadbBin: string | null = null;
function resolveMariadBin(): string {
  if (resolvedMariadbBin) return resolvedMariadbBin;
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  for (const dir of MARIADB_SEARCH_PATHS) {
    const full = path.join(dir, "mariadb");
    try { if (fs.existsSync(full)) return (resolvedMariadbBin = full); } catch {}
  }
  return (resolvedMariadbBin = "mariadb"); // fallback — PATH 의존
}

function runMariadb(db: string, sql: string): string {
  const bin = resolveMariadBin();
  const extraPath = MARIADB_SEARCH_PATHS.join(":");
  const env = { ...process.env, PATH: `${extraPath}:${process.env.PATH ?? ""}` };
  const r = spawnSync(bin, buildArgs(db, sql), { timeout: 15000, encoding: "utf-8", env });
  if (r.error) {
    const hint = r.error.message.includes("ENOENT")
      ? `\n힌트: mariadb CLI를 찾을 수 없습니다. 확인한 경로: ${MARIADB_SEARCH_PATHS.join(", ")}`
      : "";
    throw new Error(`mariadb CLI 실패: ${r.error.message}${hint}\nDB: ${db}\nSQL: ${sql.slice(0, 200)}`);
  }
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? `mariadb exit ${r.status}`;
    throw new Error(`MariaDB 오류: ${stderr}\nDB: ${db}\nSQL: ${sql.slice(0, 200)}`);
  }
  return r.stdout?.toString() ?? "";
}

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

function escapeString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\0/g, "\\0")
    .replace(/'/g, "''")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
}

function bindParams(sql: string, params: any[]): string {
  if (!params || params.length === 0) return sql;
  return params.reduce((s: string, p: any) => {
    // null/undefined → NULL
    if (p === null || p === undefined) return s.replace("?", "NULL");

    // boolean → 1/0
    if (typeof p === "boolean") return s.replace("?", p ? "1" : "0");

    // number → 검증 후 숫자
    if (typeof p === "number") {
      if (!isFinite(p) || isNaN(p))
        throw new Error(`SQL 파라미터 오류: 유효하지 않은 숫자 (${p})`);
      return s.replace("?", String(p));
    }

    // 배열 (IN 절) — v11.6.21
    if (Array.isArray(p)) {
      const items = p.map((item) => {
        if (item === null || item === undefined) return "NULL";
        if (typeof item === "number") return String(item);
        if (typeof item === "boolean") return item ? "1" : "0";
        return `'${escapeString(String(item))}'`;
      });
      return s.replace("?", items.join(", "));
    }

    // Date 객체 → ISO 문자열 (v11.6.21)
    if (p instanceof Date) {
      return s.replace("?", `'${p.toISOString()}'`);
    }

    // 일반 객체 → 에러
    if (typeof p === "object") {
      throw new Error(`SQL 파라미터 오류: 객체는 파라미터로 사용 불가 (받은 값: ${JSON.stringify(p).slice(0, 80)})\n힌트: (json-stringify 값) 으로 문자열 변환 후 삽입하세요`);
    }

    // string (기본)
    return s.replace("?", `'${escapeString(String(p))}'`);
  }, sql);
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Thread 풀 방식 (영구 연결 + 트랜잭션)
// ─────────────────────────────────────────────────────────────────────────────

const DATA_BUF_SIZE = 4 * 1024 * 1024; // 4MB

// 인라인 워커 코드: 네이티브 CLI 방식 풀 (npm 0 — mysql2 제거)
// spawnSync('mysql') 기반 — Worker Thread 동기화는 그대로 유지
const WORKER_CODE = `
const { workerData } = require('worker_threads');
const { spawnSync } = require('child_process');
const control = new Int32Array(workerData.controlBuf);
const data = Buffer.from(workerData.dataBuf);
const pools = new Map(); // poolId -> config

function buildArgs(config) {
  const args = ['-u', config.user || 'root'];
  if (config.socketPath) {
    args.push('--socket=' + config.socketPath);
  } else {
    args.push('-h', config.host || '127.0.0.1', '-P', String(config.port || 3306));
  }
  if (config.password) args.push('-p' + config.password);
  if (config.database) args.push(config.database);
  return args;
}

function runSql(config, sql) {
  const args = [...buildArgs(config), '--batch', '--column-names', '-e', sql];
  const r = spawnSync('mysql', args, { timeout: 15000, encoding: 'utf8' });
  if (r.error) throw new Error('mysql: ' + r.error.message);
  if (r.status !== 0) throw new Error((r.stderr || '').trim() || 'mysql exit ' + r.status);
  return r.stdout || '';
}

function parseRows(text) {
  const lines = text.trim().split('\\n').filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split('\\t');
  return lines.slice(1).map(line => {
    const vals = line.split('\\t');
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] === 'NULL' ? null : vals[i]; });
    return row;
  });
}

function bindParams(sql, params) {
  if (!params || !params.length) return sql;
  let i = 0;
  return sql.replace(/\\?/g, () => {
    const p = params[i++];
    if (p === null || p === undefined) return 'NULL';
    if (typeof p === 'number') return String(p);
    return "'" + String(p).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'") + "'";
  });
}

function handle(req) {
  if (req.type === 'connect') {
    pools.set(req.poolId, req.config);
    return { ok: true };
  }
  if (req.type === 'close') {
    pools.delete(req.poolId);
    return { ok: true };
  }
  const config = pools.get(req.poolId);
  if (!config) return { ok: false, error: 'pool ' + req.poolId + ' not found' };

  try {
    const sql = bindParams(req.sql, req.params || []);
    if (req.type === 'query') {
      return { ok: true, rows: parseRows(runSql(config, sql)) };
    }
    if (req.type === 'one') {
      return { ok: true, row: parseRows(runSql(config, sql))[0] || null };
    }
    if (req.type === 'exec') {
      runSql(config, sql);
      // affectedRows/insertId 근사치 — CLI는 직접 지원 안함
      try {
        const meta = parseRows(runSql(config, 'SELECT ROW_COUNT() as ar, LAST_INSERT_ID() as lid'));
        return { ok: true, affectedRows: Number(meta[0]?.ar || 0), insertId: Number(meta[0]?.lid || 0) };
      } catch { return { ok: true, affectedRows: 0, insertId: 0 }; }
    }
    if (req.type === 'transaction') {
      const sqls = req.stmts.map(s => bindParams(s.sql, s.params || []));
      const txSql = 'START TRANSACTION;\\n' + sqls.join(';\\n') + ';\\nCOMMIT;';
      runSql(config, txSql);
      return { ok: true, results: req.stmts.map(() => ({ ok: true, affectedRows: 0, insertId: 0 })) };
    }
    return { ok: false, error: 'unknown type: ' + req.type };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

function loop() {
  while (true) {
    Atomics.wait(control, 0, 0);
    const flag = Atomics.load(control, 0);
    if (flag === -1) break;
    const reqLen = data.readInt32LE(0);
    const reqStr = data.toString('utf8', 4, 4 + reqLen);
    let resp;
    try { resp = handle(JSON.parse(reqStr)); }
    catch(e) { resp = { ok: false, error: e.message }; }
    const respStr = JSON.stringify(resp);
    data.writeInt32LE(respStr.length, 0);
    data.write(respStr, 4, 'utf8');
    Atomics.store(control, 0, 2);
    Atomics.notify(control, 0);
    Atomics.wait(control, 0, 2);
  }
}
loop();
`;

let poolWorker: any = null;
let controlBuf: SharedArrayBuffer | null = null;
let dataBuf: SharedArrayBuffer | null = null;

function ensureWorker() {
  if (poolWorker) return;
  const { Worker } = require("worker_threads");
  controlBuf = new SharedArrayBuffer(4);
  dataBuf    = new SharedArrayBuffer(DATA_BUF_SIZE);
  Atomics.store(new Int32Array(controlBuf), 0, 0);
  poolWorker = new Worker(WORKER_CODE, {
    eval: true,
    workerData: { controlBuf, dataBuf },
  });
  poolWorker.on("error", (e: any) => {
    console.error("[MariaDB Pool Worker Error]", e.message);
    poolWorker = null;
  });
}

function poolCall(req: object): any {
  ensureWorker();
  const control = new Int32Array(controlBuf!);
  const data    = Buffer.from(dataBuf!);
  const reqStr  = JSON.stringify(req);
  if (reqStr.length + 4 > DATA_BUF_SIZE) throw new Error("MariaDB pool: request too large");
  data.writeInt32LE(reqStr.length, 0);
  data.write(reqStr, 4, "utf8");
  Atomics.store(control, 0, 1);
  Atomics.notify(control, 0);
  const result = Atomics.wait(control, 0, 1, 15000);
  if (result === "timed-out") throw new Error("MariaDB pool timeout");
  const respLen = data.readInt32LE(0);
  const resp    = JSON.parse(data.toString("utf8", 4, 4 + respLen));
  Atomics.store(control, 0, 0); // reset to idle so worker can wait again
  if (!resp.ok) throw new Error(resp.error || "MariaDB pool error");
  return resp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal DB wrapper — db-query / db-exec / db-transaction
// config map: {:host ... :user ... :password ... :database ...} → MariaDB
//             {:type "sqlite" :path "..."} or {:path "..."}     → SQLite
// pool ID string (starts with "pool_")                          → MariaDB pool
// ─────────────────────────────────────────────────────────────────────────────

function isSqliteConfig(db: any): boolean {
  if (!db || typeof db !== "object") return false;
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return m.get("type") === "sqlite" || (m.get("path") && !m.get("host"));
}

function getSqlitePath(db: any): string {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return String(m.get("path") ?? ":memory:");
}

function getMariadbName(db: any): string {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return String(m.get("database") ?? m.get("db") ?? "");
}

const _sqliteCache = new Map<string, any>();
function getSqliteDb(path: string): any {
  if (!_sqliteCache.has(path)) {
    const { DatabaseSync } = eval('require')("node:sqlite");
    _sqliteCache.set(path, new DatabaseSync(path));
  }
  return _sqliteCache.get(path);
}

function sqliteQuery(path: string, sql: string, params: any[]): any[] {
  const db = getSqliteDb(path);
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((r: any) => {
    const m = new Map<string, any>();
    for (const [k, v] of Object.entries(r)) m.set(k, v);
    return m;
  });
}

function sqliteExec(path: string, sql: string, params: any[]): any {
  const db = getSqliteDb(path);
  const result = db.prepare(sql).run(...params);
  const m = new Map<string, any>();
  m.set("affectedRows", result.changes ?? 0);
  m.set("insertId", Number(result.lastInsertRowid ?? 0));
  return m;
}

function mariadbConfigToPoolId(db: any): string {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  const config = {
    host:     m.get("host") ?? "localhost",
    user:     m.get("user") ?? process.env.MARIADB_USER ?? "root",
    password: m.get("password") ?? m.get("pass") ?? process.env.MARIADB_PASS ?? "",
    database: m.get("database") ?? m.get("db") ?? "",
    port:     m.get("port") ?? 3306,
  };
  const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  poolCall({ type: "connect", poolId, config });
  return poolId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module export
// ─────────────────────────────────────────────────────────────────────────────

export function createMariadbModule(callFn?: (fn: any, args: any[]) => any) {
  // FreeLang function value 호출 헬퍼
  function callFlFn(fn: any): any {
    if (typeof fn === "function") return fn();
    if (typeof fn?.body === "function") return fn.body();
    if (callFn) return callFn(fn, []);
    throw new Error("db-transaction: fn 인자가 호출 가능한 함수가 아닙니다");
  }

  return {
    // ── CLI 방식 (기존) — pool_* prefix → pool 자동 라우팅 ──────────────────
    "mariadb_exec":  (db: string, sql: string, params: any[] = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        const r = poolCall({ type: "exec", poolId: db, sql, params });
        return { affectedRows: r.affectedRows, insertId: r.insertId };
      }
      return runMariadb(db, bindParams(sql, params));
    },

    "mariadb_query": (db: string, sql: string, params: any[] = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        return poolCall({ type: "query", poolId: db, sql, params }).rows ?? [];
      }
      return parseRows(runMariadb(db, bindParams(sql, params)));
    },

    "mariadb_one":   (db: string, sql: string, params: any[] = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      const rows = parseRows(runMariadb(db, bindParams(sql, params)));
      // 결과 없으면 반드시 null (undefined 금지 — nil-safe 보장)
      const row = rows[0];
      return (row === undefined || row === null) ? null : row;
    },

    // db_query_one db sql [params] → row or nil
    // db: CLI connection string (string) or pool ID (number) — auto-detect
    "db_query_one": (db: any, sql: string, params: any[] = []) => {
      if (typeof db === "number") {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      return parseRows(runMariadb(String(db), bindParams(sql, params)))[0] ?? null;
    },
    "db-query-one": (db: any, sql: string, params: any[] = []) => {
      if (typeof db === "number") {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      return parseRows(runMariadb(String(db), bindParams(sql, params)))[0] ?? null;
    },

    // mariadb_transaction db [{sql params}] → {ok count} or {ok:false error}
    // 단일 연결에서 BEGIN/COMMIT/ROLLBACK 보장
    "mariadb_transaction": (db: string, stmts: Array<{sql: string, params?: any[]}>) => {
      if (!Array.isArray(stmts) || stmts.length === 0)
        return { ok: false, error: "empty statements" };
      const sqls    = stmts.map((s) => bindParams(s.sql, s.params ?? []));
      const combined = "SET autocommit=0;\nBEGIN;\n" + sqls.join(";\n") + ";\nCOMMIT;";
      try {
        runMariadb(db, combined);
        return { ok: true, count: stmts.length };
      } catch (e: any) {
        try { runMariadb(db, "ROLLBACK"); } catch {}
        return { ok: false, error: e.message };
      }
    },

    // mariadb_batch db [{sql params type}] → [{ok result}]
    "mariadb_batch": (db: string, queries: Array<{sql: string, params?: any[], type?: string}>) => {
      if (!Array.isArray(queries) || queries.length === 0) return [];

      // exec 타입만 있으면 단일 spawnSync로 처리 (성능 최적화)
      const allExec = queries.every(q => q.type === "exec" || !q.type);
      if (allExec && queries.length > 1) {
        const sqls = queries.map(q => bindParams(q.sql, q.params ?? []));
        const combined = "SET autocommit=0;\nBEGIN;\n" + sqls.join(";\n") + ";\nCOMMIT;";
        try {
          runMariadb(db, combined);
          return queries.map(() => ({ ok: true }));
        } catch (e: any) {
          try { runMariadb(db, "ROLLBACK"); } catch {}
          return queries.map(() => ({ ok: false, error: e.message }));
        }
      }

      // SELECT/ONE 타입이 있으면 개별 처리 (반환값 필요)
      return queries.map((q) => {
        const bound = bindParams(q.sql, q.params ?? []);
        try {
          if (q.type === "exec") return { ok: true, result: runMariadb(db, bound) };
          if (q.type === "one")  return { ok: true, result: parseRows(runMariadb(db, bound))[0] ?? null };
          return { ok: true, result: parseRows(runMariadb(db, bound)) };
        } catch (e: any) { return { ok: false, error: e.message }; }
      });
    },

    // ── mariadb_connect — 맵/positional 양방향 지원 ──────────────────────────
    // (mariadb_connect {:host "h" :user "u" :password "p" :database "d"})
    // (mariadb_connect "host" "user" "password" "database" [port])  ← #67 해결
    "mariadb_connect":  (...args: any[]) => {
      let config: any = args[0];
      // positional 감지: 첫 인자가 문자열이면 4-5 인자를 맵으로 변환
      if (typeof config === "string") {
        config = {
          host:     args[0] ?? "localhost",
          user:     args[1] ?? "",
          password: args[2] ?? "",
          database: args[3] ?? "",
          port:     typeof args[4] === "number" ? args[4] : 3306,
        };
      }
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },
    "mariadb-connect":  (...args: any[]) => {
      let config: any = args[0];
      if (typeof config === "string") {
        config = {
          host: args[0] ?? "localhost", user: args[1] ?? "",
          password: args[2] ?? "", database: args[3] ?? "",
          port: typeof args[4] === "number" ? args[4] : 3306,
        };
      }
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },

    // ── 풀 방식 (영구 연결) ───────────────────────────────────────────────────
    // mariadb_pool_connect config → poolId
    "mariadb_pool_connect": (config: any) => {
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },

    // mariadb_pool_query poolId sql [params] → rows[] (nil 불가, 항상 배열)
    "mariadb_pool_query": (poolId: string, sql: string, params: any[] = []) =>
      poolCall({ type: "query", poolId, sql, params }).rows ?? [],

    // mariadb_pool_one poolId sql [params] → row or null
    "mariadb_pool_one": (poolId: string, sql: string, params: any[] = []) =>
      poolCall({ type: "one", poolId, sql, params }).row,

    // mariadb_pool_exec poolId sql [params] → {affectedRows insertId}
    "mariadb_pool_exec": (poolId: string, sql: string, params: any[] = []) => {
      const r = poolCall({ type: "exec", poolId, sql, params });
      return { affectedRows: r.affectedRows, insertId: r.insertId };
    },

    // mariadb_pool_transaction poolId [{sql params}] → {ok results} or {ok:false error}
    // 진짜 트랜잭션: BEGIN + 커밋/롤백 자동
    "mariadb_pool_transaction": (poolId: string, stmts: Array<{sql: string, params?: any[]}>) =>
      poolCall({ type: "transaction", poolId, stmts }),

    // mariadb_pool_close poolId → null
    "mariadb_pool_close": (poolId: string) => {
      poolCall({ type: "close", poolId });
      return null;
    },

    // ── 유틸 ─────────────────────────────────────────────────────────────────
    "mariadb_health": () => {
      const args = ["-u", process.env.MARIADB_USER || "root",
                    "--socket=" + resolveSocket(), "ping"];
      const r = spawnSync("mariadb-admin", args, { timeout: 3000, encoding: "utf-8" });
      return (r.status ?? 1) === 0;
    },

    "mariadb_databases": () =>
      parseRows(runMariadb("", "SHOW DATABASES")).map((r: any) => r.Database),

    "mariadb_tables": (db: string) =>
      parseRows(runMariadb(db, "SHOW TABLES")).map((r: any) => Object.values(r)[0]),

    // ── Universal db-query / db-exec / db-transaction ────────────────────────
    // db: {:host ...} → MariaDB  |  {:path ...} → SQLite  |  "pool_..." → pool
    "db-query": (db: any, sql: string, params: any[] = []): any[] => {
      if (isSqliteConfig(db)) return sqliteQuery(getSqlitePath(db), sql, params);
      if (typeof db === "string" && db.startsWith("pool_"))
        return poolCall({ type: "query", poolId: db, sql, params }).rows ?? [];
      // map config → MariaDB CLI
      const dbName = getMariadbName(db);
      const m = db instanceof Map ? db : new Map(Object.entries(db));
      const savedUser = process.env.MARIADB_USER;
      const savedPass = process.env.MARIADB_PASS;
      const savedHost = process.env.MARIADB_HOST;
      const savedPort = process.env.MARIADB_PORT;
      if (m.get("user"))     process.env.MARIADB_USER = String(m.get("user"));
      if (m.get("password")) process.env.MARIADB_PASS = String(m.get("password"));
      if (m.get("host"))     process.env.MARIADB_HOST = String(m.get("host"));
      if (m.get("port"))     process.env.MARIADB_PORT = String(m.get("port"));
      try {
        cachedSock = null;
        const rows = parseRows(runMariadb(dbName, bindParams(sql, params)));
        return rows.map((r: any) => {
          const rm = new Map<string, any>();
          for (const [k, v] of Object.entries(r)) rm.set(k, v);
          return rm;
        });
      } finally {
        if (savedUser !== undefined) process.env.MARIADB_USER = savedUser; else delete process.env.MARIADB_USER;
        if (savedPass !== undefined) process.env.MARIADB_PASS = savedPass; else delete process.env.MARIADB_PASS;
        if (savedHost !== undefined) process.env.MARIADB_HOST = savedHost; else delete process.env.MARIADB_HOST;
        if (savedPort !== undefined) process.env.MARIADB_PORT = savedPort; else delete process.env.MARIADB_PORT;
        cachedSock = null;
      }
    },

    "db-exec": (db: any, sql: string, params: any[] = []): any => {
      if (isSqliteConfig(db)) return sqliteExec(getSqlitePath(db), sql, params);
      if (typeof db === "string" && db.startsWith("pool_")) {
        const r = poolCall({ type: "exec", poolId: db, sql, params });
        const m = new Map<string, any>();
        m.set("affectedRows", r.affectedRows ?? 0);
        m.set("insertId", r.insertId ?? 0);
        return m;
      }
      const dbName = getMariadbName(db);
      const m2 = db instanceof Map ? db : new Map(Object.entries(db));
      const savedUser = process.env.MARIADB_USER;
      const savedPass = process.env.MARIADB_PASS;
      const savedHost = process.env.MARIADB_HOST;
      const savedPort = process.env.MARIADB_PORT;
      if (m2.get("user"))     process.env.MARIADB_USER = String(m2.get("user"));
      if (m2.get("password")) process.env.MARIADB_PASS = String(m2.get("password"));
      if (m2.get("host"))     process.env.MARIADB_HOST = String(m2.get("host"));
      if (m2.get("port"))     process.env.MARIADB_PORT = String(m2.get("port"));
      try {
        cachedSock = null;
        runMariadb(dbName, bindParams(sql, params));
        try {
          const meta = parseRows(runMariadb(dbName, "SELECT ROW_COUNT() as ar, LAST_INSERT_ID() as lid"));
          const rm = new Map<string, any>();
          rm.set("affectedRows", Number(meta[0]?.ar ?? 0));
          rm.set("insertId", Number(meta[0]?.lid ?? 0));
          return rm;
        } catch { const rm = new Map<string, any>(); rm.set("affectedRows", 0); rm.set("insertId", 0); return rm; }
      } finally {
        if (savedUser !== undefined) process.env.MARIADB_USER = savedUser; else delete process.env.MARIADB_USER;
        if (savedPass !== undefined) process.env.MARIADB_PASS = savedPass; else delete process.env.MARIADB_PASS;
        if (savedHost !== undefined) process.env.MARIADB_HOST = savedHost; else delete process.env.MARIADB_HOST;
        if (savedPort !== undefined) process.env.MARIADB_PORT = savedPort; else delete process.env.MARIADB_PORT;
        cachedSock = null;
      }
    },

    "db-transaction": (db: any, fn: any): any => {
      if (isSqliteConfig(db)) {
        const sqliteDb = getSqliteDb(getSqlitePath(db));
        sqliteDb.exec("BEGIN");
        try {
          const result = callFlFn(fn);
          sqliteDb.exec("COMMIT");
          return result;
        } catch (e: any) {
          try { sqliteDb.exec("ROLLBACK"); } catch {}
          throw e;
        }
      }
      // MariaDB pool
      if (typeof db === "string" && db.startsWith("pool_")) {
        // fn은 [{sql, params}] 배열 또는 호출 가능한 함수
        if (Array.isArray(fn)) return poolCall({ type: "transaction", poolId: db, stmts: fn });
      }
      return null;
    },
  };
}
