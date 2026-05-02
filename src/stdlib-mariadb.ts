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

function runMariadb(db: string, sql: string): string {
  const r = spawnSync("mariadb", buildArgs(db, sql), { timeout: 15000, encoding: "utf-8" });
  if (r.error) throw new Error(`mariadb CLI failed: ${r.error.message}`);
  if ((r.status ?? 1) !== 0) throw new Error(r.stderr?.trim() ?? `mariadb exit ${r.status}`);
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

function bindParams(sql: string, params: any[]): string {
  if (!params || params.length === 0) return sql;
  return params.reduce((s: string, p: any) => {
    if (p === null || p === undefined) return s.replace("?", "NULL");
    if (typeof p === "number") return s.replace("?", String(p));
    if (typeof p === "boolean") return s.replace("?", p ? "1" : "0");
    return s.replace("?", `'${String(p).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`);
  }, sql);
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Thread 풀 방식 (영구 연결 + 트랜잭션)
// ─────────────────────────────────────────────────────────────────────────────

const DATA_BUF_SIZE = 4 * 1024 * 1024; // 4MB

// 인라인 워커 코드: mysql2 커넥션 풀 유지 + Atomics 동기화
const WORKER_CODE = `
const { workerData } = require('worker_threads');
const mysql2 = require('mysql2/promise');
const control = new Int32Array(workerData.controlBuf);
const data = Buffer.from(workerData.dataBuf);
const pools = new Map();

async function handle(req) {
  if (req.type === 'connect') {
    if (pools.has(req.poolId)) return { ok: true };
    const pool = await mysql2.createPool({
      host:     req.config.host || '127.0.0.1',
      port:     req.config.port || 3306,
      user:     req.config.user || 'root',
      password: req.config.password || '',
      database: req.config.database || '',
      connectionLimit: req.config.poolSize || 5,
      socketPath: req.config.socketPath,
    });
    pools.set(req.poolId, pool);
    return { ok: true };
  }
  if (req.type === 'close') {
    const pool = pools.get(req.poolId);
    if (pool) { await pool.end(); pools.delete(req.poolId); }
    return { ok: true };
  }
  const pool = pools.get(req.poolId);
  if (!pool) return { ok: false, error: 'pool ' + req.poolId + ' not found' };

  if (req.type === 'query') {
    const [rows] = await pool.query(req.sql, req.params || []);
    return { ok: true, rows: Array.from(rows).map(r => Object.assign({}, r)) };
  }
  if (req.type === 'exec') {
    const [result] = await pool.query(req.sql, req.params || []);
    return { ok: true, affectedRows: result.affectedRows || 0, insertId: result.insertId || 0 };
  }
  if (req.type === 'one') {
    const [rows] = await pool.query(req.sql, req.params || []);
    return { ok: true, row: rows[0] ? Object.assign({}, rows[0]) : null };
  }
  if (req.type === 'transaction') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const results = [];
      for (const stmt of req.stmts) {
        const [r] = await conn.query(stmt.sql, stmt.params || []);
        results.push({ ok: true, affectedRows: r.affectedRows || 0, insertId: r.insertId || 0 });
      }
      await conn.commit();
      return { ok: true, results };
    } catch (e) {
      await conn.rollback();
      return { ok: false, error: e.message };
    } finally {
      conn.release();
    }
  }
  return { ok: false, error: 'unknown type: ' + req.type };
}

async function loop() {
  while (true) {
    Atomics.wait(control, 0, 0);
    const flag = Atomics.load(control, 0);
    if (flag === -1) break;
    const reqLen = data.readInt32LE(0);
    const reqStr = data.toString('utf8', 4, 4 + reqLen);
    let resp;
    try {
      const req = JSON.parse(reqStr);
      resp = await handle(req);
    } catch(e) {
      resp = { ok: false, error: e.message };
    }
    const respStr = JSON.stringify(resp);
    data.writeInt32LE(respStr.length, 0);
    data.write(respStr, 4, 'utf8');
    Atomics.store(control, 0, 2);
    Atomics.notify(control, 0);
    Atomics.wait(control, 0, 2); // wait for main thread to acknowledge (reset to 0)
  }
}
loop().catch(e => {
  console.error('[MariaDB Worker]', e.message);
  Atomics.store(control, 0, -2);
  Atomics.notify(control, 0);
});
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
// Module export
// ─────────────────────────────────────────────────────────────────────────────

export function createMariadbModule() {
  return {
    // ── CLI 방식 (기존) ──────────────────────────────────────────────────────
    "mariadb_exec":  (db: string, sql: string, params: any[] = []) =>
      runMariadb(db, bindParams(sql, params)),

    "mariadb_query": (db: string, sql: string, params: any[] = []) =>
      parseRows(runMariadb(db, bindParams(sql, params))),

    "mariadb_one":   (db: string, sql: string, params: any[] = []) =>
      parseRows(runMariadb(db, bindParams(sql, params)))[0] ?? null,

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
    "mariadb_batch": (db: string, queries: Array<{sql: string, params?: any[], type?: string}>) =>
      queries.map((q) => {
        const bound = bindParams(q.sql, q.params ?? []);
        try {
          if (q.type === "exec") return { ok: true, result: runMariadb(db, bound) };
          if (q.type === "one")  return { ok: true, result: parseRows(runMariadb(db, bound))[0] ?? null };
          return { ok: true, result: parseRows(runMariadb(db, bound)) };
        } catch (e: any) { return { ok: false, error: e.message }; }
      }),

    // ── 풀 방식 (영구 연결) ───────────────────────────────────────────────────
    // mariadb_pool_connect config → poolId
    "mariadb_pool_connect": (config: any) => {
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },

    // mariadb_pool_query poolId sql [params] → rows[]
    "mariadb_pool_query": (poolId: string, sql: string, params: any[] = []) =>
      poolCall({ type: "query", poolId, sql, params }).rows,

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
  };
}
