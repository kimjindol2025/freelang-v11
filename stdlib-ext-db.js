var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ext-db.ts
var ext_db_exports = {};
__export(ext_db_exports, {
  createDbModule: () => createDbModule,
  createMariadbModule: () => createMariadbModule,
  createMongodbModule: () => createMongodbModule,
  createOrmModule: () => createOrmModule
});
module.exports = __toCommonJS(ext_db_exports);

// src/stdlib-mariadb.ts
var import_child_process = require("child_process");
var cachedSock = null;
function resolveSocket() {
  if (cachedSock) return cachedSock;
  if (process.env.MARIADB_SOCK) return cachedSock = process.env.MARIADB_SOCK;
  const fs = require("fs");
  const candidates = [
    "/data/data/com.termux/files/usr/tmp/mysqld.sock",
    "/var/run/mysqld/mysqld.sock",
    "/var/lib/mysql/mysql.sock",
    "/tmp/mysqld.sock",
    "/tmp/mysql.sock"
  ];
  for (const s of candidates) {
    try {
      if (fs.existsSync(s)) return cachedSock = s;
    } catch {
    }
  }
  return cachedSock = "/tmp/mysqld.sock";
}
function buildArgs(db, sql) {
  const sock = resolveSocket();
  const user = process.env.MARIADB_USER || "root";
  const pass = process.env.MARIADB_PASS || "";
  const host = process.env.MARIADB_HOST;
  const port = process.env.MARIADB_PORT;
  const args = ["-u", user];
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
var MARIADB_SEARCH_PATHS = [
  "/data/data/com.termux/files/usr/bin",
  // Termux
  "/usr/bin",
  "/usr/local/bin",
  "/opt/homebrew/bin",
  "/opt/local/bin"
];
var resolvedMariadbBin = null;
function resolveMariadBin() {
  if (resolvedMariadbBin) return resolvedMariadbBin;
  const fs = require("fs");
  const path3 = require("path");
  for (const dir of MARIADB_SEARCH_PATHS) {
    const full = path3.join(dir, "mariadb");
    try {
      if (fs.existsSync(full)) return resolvedMariadbBin = full;
    } catch {
    }
  }
  return resolvedMariadbBin = "mariadb";
}
function validateNoMultiStatement(sql) {
  const trimmed = sql.trim().toUpperCase();
  if (/^(BEGIN|COMMIT|ROLLBACK)(\s|;|$)/.test(trimmed)) return;
  if (sql.includes(";")) {
    throw new Error("CLI \uBC29\uC2DD: \uBA40\uD2F0\uC2A4\uD14C\uC774\uD2B8\uBA3C\uD2B8(;) \uCC28\uB2E8. \uD480 \uBC29\uC2DD(mariadb_pool_*)\uC744 \uC0AC\uC6A9\uD558\uAC70\uB098 \uB2E8\uC77C \uCFFC\uB9AC\uB85C \uBD84\uB9AC\uD558\uC138\uC694.");
  }
}
function runMariadb(db, sql) {
  validateNoMultiStatement(sql);
  const bin = resolveMariadBin();
  const extraPath = MARIADB_SEARCH_PATHS.join(":");
  const env = { ...process.env, PATH: `${extraPath}:${process.env.PATH ?? ""}` };
  const r = (0, import_child_process.spawnSync)(bin, buildArgs(db, sql), { timeout: 15e3, encoding: "utf-8", env });
  const isProd = process.env.NODE_ENV === "production";
  const sqlHint = isProd ? "" : `
SQL: ${sql.slice(0, 200)}`;
  if (r.error) {
    const hint = r.error.message.includes("ENOENT") ? `
\uD78C\uD2B8: mariadb CLI\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD655\uC778\uD55C \uACBD\uB85C: ${MARIADB_SEARCH_PATHS.join(", ")}` : "";
    throw new Error(`mariadb CLI \uC2E4\uD328: ${r.error.message}${hint}
DB: ${db}${sqlHint}`);
  }
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? `mariadb exit ${r.status}`;
    throw new Error(`MariaDB \uC624\uB958: ${stderr}
DB: ${db}${sqlHint}`);
  }
  return r.stdout?.toString() ?? "";
}
function parseRows(raw) {
  const lines = raw.split("\n").filter((l) => l.length > 0);
  if (lines.length < 1) return [];
  const headers = lines[0].split("	");
  return lines.slice(1).map((line) => {
    const vals = line.split("	");
    const obj = {};
    headers.forEach((h, i) => {
      const v = vals[i];
      if (v === void 0 || v === "NULL") obj[h] = null;
      else if (/^-?\d+$/.test(v)) obj[h] = parseInt(v, 10);
      else if (/^-?\d+\.\d+$/.test(v)) obj[h] = parseFloat(v);
      else obj[h] = v;
    });
    return obj;
  });
}
function escapeString(s) {
  return s.replace(/\\/g, "\\\\").replace(/\0/g, "\\0").replace(/'/g, "''").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\x1a/g, "\\Z");
}
function bindParams(sql, params) {
  if (!params || params.length === 0) return sql;
  return params.reduce((s, p) => {
    if (p === null || p === void 0) return s.replace("?", "NULL");
    if (typeof p === "boolean") return s.replace("?", p ? "1" : "0");
    if (typeof p === "number") {
      if (!isFinite(p) || isNaN(p))
        throw new Error(`SQL \uD30C\uB77C\uBBF8\uD130 \uC624\uB958: \uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC22B\uC790 (${p})`);
      return s.replace("?", String(p));
    }
    if (Array.isArray(p)) {
      const items = p.map((item) => {
        if (item === null || item === void 0) return "NULL";
        if (typeof item === "number") return String(item);
        if (typeof item === "boolean") return item ? "1" : "0";
        return `'${escapeString(String(item))}'`;
      });
      return s.replace("?", items.join(", "));
    }
    if (p instanceof Date) {
      return s.replace("?", `'${p.toISOString()}'`);
    }
    if (typeof p === "object") {
      throw new Error(`SQL \uD30C\uB77C\uBBF8\uD130 \uC624\uB958: \uAC1D\uCCB4\uB294 \uD30C\uB77C\uBBF8\uD130\uB85C \uC0AC\uC6A9 \uBD88\uAC00 (\uBC1B\uC740 \uAC12: ${JSON.stringify(p).slice(0, 80)})
\uD78C\uD2B8: (json-stringify \uAC12) \uC73C\uB85C \uBB38\uC790\uC5F4 \uBCC0\uD658 \uD6C4 \uC0BD\uC785\uD558\uC138\uC694`);
    }
    return s.replace("?", `'${escapeString(String(p))}'`);
  }, sql);
}
var DATA_BUF_SIZE = 4 * 1024 * 1024;
var WORKER_CODE = `
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
    if (typeof p === 'boolean') return p ? '1' : '0';
    if (typeof p === 'number') return String(p);
    return "'" + String(p)
      .replace(/\\\\/g, '\\\\\\\\')
      .replace(/\\0/g, '\\\\0')
      .replace(/'/g, "''")
      .replace(/\\n/g, '\\\\n')
      .replace(/\\r/g, '\\\\r')
      .replace(/\\x1a/g, '\\\\Z') + "'";
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
      // affectedRows/insertId \uADFC\uC0AC\uCE58 \u2014 CLI\uB294 \uC9C1\uC811 \uC9C0\uC6D0 \uC548\uD568
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
var poolWorker = null;
var controlBuf = null;
var dataBuf = null;
function ensureWorker() {
  if (poolWorker) return;
  const { Worker } = require("worker_threads");
  controlBuf = new SharedArrayBuffer(4);
  dataBuf = new SharedArrayBuffer(DATA_BUF_SIZE);
  Atomics.store(new Int32Array(controlBuf), 0, 0);
  poolWorker = new Worker(WORKER_CODE, {
    eval: true,
    workerData: { controlBuf, dataBuf }
  });
  poolWorker.on("error", (e) => {
    console.error("[MariaDB Pool Worker Error]", e.message);
    poolWorker = null;
  });
}
function poolCall(req) {
  ensureWorker();
  const control = new Int32Array(controlBuf);
  const data = Buffer.from(dataBuf);
  const reqStr = JSON.stringify(req);
  if (reqStr.length + 4 > DATA_BUF_SIZE) throw new Error("MariaDB pool: request too large");
  data.writeInt32LE(reqStr.length, 0);
  data.write(reqStr, 4, "utf8");
  Atomics.store(control, 0, 1);
  Atomics.notify(control, 0);
  const result = Atomics.wait(control, 0, 1, 15e3);
  if (result === "timed-out") throw new Error("MariaDB pool timeout");
  const respLen = data.readInt32LE(0);
  const resp = JSON.parse(data.toString("utf8", 4, 4 + respLen));
  Atomics.store(control, 0, 0);
  if (!resp.ok) throw new Error(resp.error || "MariaDB pool error");
  return resp;
}
function isSqliteConfig(db) {
  if (!db || typeof db !== "object") return false;
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return m.get("type") === "sqlite" || m.get("path") && !m.get("host");
}
function getSqlitePath(db) {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return String(m.get("path") ?? ":memory:");
}
function getMariadbName(db) {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return String(m.get("database") ?? m.get("db") ?? "");
}
var _sqliteCache = /* @__PURE__ */ new Map();
function getSqliteDb(path) {
  if (!_sqliteCache.has(path)) {
    const { DatabaseSync } = eval("require")("node:sqlite");
    _sqliteCache.set(path, new DatabaseSync(path));
  }
  return _sqliteCache.get(path);
}
function sqliteQuery(path3, sql, params) {
  const db = getSqliteDb(path3);
  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => {
    const m = /* @__PURE__ */ new Map();
    for (const [k, v] of Object.entries(r)) m.set(k, v);
    return m;
  });
}
function sqliteExec(path3, sql, params) {
  const db = getSqliteDb(path3);
  const result = db.prepare(sql).run(...params);
  const m = /* @__PURE__ */ new Map();
  m.set("affectedRows", result.changes ?? 0);
  m.set("insertId", Number(result.lastInsertRowid ?? 0));
  return m;
}
function mariadbConfigToPoolId(db) {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  const config = {
    host: m.get("host") ?? "localhost",
    user: m.get("user") ?? process.env.MARIADB_USER ?? "root",
    password: m.get("password") ?? m.get("pass") ?? process.env.MARIADB_PASS ?? "",
    database: m.get("database") ?? m.get("db") ?? "",
    port: m.get("port") ?? 3306
  };
  const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  poolCall({ type: "connect", poolId, config });
  return poolId;
}
function createMariadbModule(callFn) {
  function callFlFn(fn) {
    if (typeof fn === "function") return fn();
    if (typeof fn?.body === "function") return fn.body();
    if (callFn) return callFn(fn, []);
    throw new Error("db-transaction: fn \uC778\uC790\uAC00 \uD638\uCD9C \uAC00\uB2A5\uD55C \uD568\uC218\uAC00 \uC544\uB2D9\uB2C8\uB2E4");
  }
  return {
    // ── CLI 방식 (기존) — pool_* prefix → pool 자동 라우팅 ──────────────────
    "mariadb_exec": (db, sql, params = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        const r = poolCall({ type: "exec", poolId: db, sql, params });
        return { affectedRows: r.affectedRows, insertId: r.insertId };
      }
      return runMariadb(db, bindParams(sql, params));
    },
    "mariadb_query": (db, sql, params = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        return poolCall({ type: "query", poolId: db, sql, params }).rows ?? [];
      }
      return parseRows(runMariadb(db, bindParams(sql, params)));
    },
    "mariadb_one": (db, sql, params = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      const rows = parseRows(runMariadb(db, bindParams(sql, params)));
      const row = rows[0];
      return row === void 0 || row === null ? null : row;
    },
    // db_query_one db sql [params] → row or nil
    // db: CLI connection string (string) or pool ID (number) — auto-detect
    "db_query_one": (db, sql, params = []) => {
      if (typeof db === "number") {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      return parseRows(runMariadb(String(db), bindParams(sql, params)))[0] ?? null;
    },
    "db-query-one": (db, sql, params = []) => {
      if (typeof db === "number") {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      return parseRows(runMariadb(String(db), bindParams(sql, params)))[0] ?? null;
    },
    // mariadb_transaction db [{sql params}] → {ok count} or {ok:false error}
    // 단일 연결에서 BEGIN/COMMIT/ROLLBACK 보장
    "mariadb_transaction": (db, stmts) => {
      if (!Array.isArray(stmts) || stmts.length === 0)
        return { ok: false, error: "empty statements" };
      const sqls = stmts.map((s) => bindParams(s.sql, s.params ?? []));
      const combined = "SET autocommit=0;\nBEGIN;\n" + sqls.join(";\n") + ";\nCOMMIT;";
      try {
        runMariadb(db, combined);
        return { ok: true, count: stmts.length };
      } catch (e) {
        try {
          runMariadb(db, "ROLLBACK");
        } catch {
        }
        return { ok: false, error: e.message };
      }
    },
    // mariadb_batch db [{sql params type}] → [{ok result}]
    "mariadb_batch": (db, queries) => {
      if (!Array.isArray(queries) || queries.length === 0) return [];
      const allExec = queries.every((q) => q.type === "exec" || !q.type);
      if (allExec && queries.length > 1) {
        const sqls = queries.map((q) => bindParams(q.sql, q.params ?? []));
        const combined = "SET autocommit=0;\nBEGIN;\n" + sqls.join(";\n") + ";\nCOMMIT;";
        try {
          runMariadb(db, combined);
          return queries.map(() => ({ ok: true }));
        } catch (e) {
          try {
            runMariadb(db, "ROLLBACK");
          } catch {
          }
          return queries.map(() => ({ ok: false, error: e.message }));
        }
      }
      return queries.map((q) => {
        const bound = bindParams(q.sql, q.params ?? []);
        try {
          if (q.type === "exec") return { ok: true, result: runMariadb(db, bound) };
          if (q.type === "one") return { ok: true, result: parseRows(runMariadb(db, bound))[0] ?? null };
          return { ok: true, result: parseRows(runMariadb(db, bound)) };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      });
    },
    // ── mariadb_connect — 맵/positional 양방향 지원 ──────────────────────────
    // (mariadb_connect {:host "h" :user "u" :password "p" :database "d"})
    // (mariadb_connect "host" "user" "password" "database" [port])  ← #67 해결
    "mariadb_connect": (...args) => {
      let config = args[0];
      if (typeof config === "string") {
        config = {
          host: args[0] ?? "localhost",
          user: args[1] ?? "",
          password: args[2] ?? "",
          database: args[3] ?? "",
          port: typeof args[4] === "number" ? args[4] : 3306
        };
      }
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },
    "mariadb-connect": (...args) => {
      let config = args[0];
      if (typeof config === "string") {
        config = {
          host: args[0] ?? "localhost",
          user: args[1] ?? "",
          password: args[2] ?? "",
          database: args[3] ?? "",
          port: typeof args[4] === "number" ? args[4] : 3306
        };
      }
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },
    // ── 풀 방식 (영구 연결) ───────────────────────────────────────────────────
    // mariadb_pool_connect config → poolId
    "mariadb_pool_connect": (config) => {
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },
    // mariadb_pool_query poolId sql [params] → rows[] (nil 불가, 항상 배열)
    "mariadb_pool_query": (poolId, sql, params = []) => poolCall({ type: "query", poolId, sql, params }).rows ?? [],
    // mariadb_pool_one poolId sql [params] → row or null
    "mariadb_pool_one": (poolId, sql, params = []) => poolCall({ type: "one", poolId, sql, params }).row,
    // mariadb_pool_exec poolId sql [params] → {affectedRows insertId}
    "mariadb_pool_exec": (poolId, sql, params = []) => {
      const r = poolCall({ type: "exec", poolId, sql, params });
      return { affectedRows: r.affectedRows, insertId: r.insertId };
    },
    // mariadb_pool_transaction poolId [{sql params}] → {ok results} or {ok:false error}
    // 진짜 트랜잭션: BEGIN + 커밋/롤백 자동
    "mariadb_pool_transaction": (poolId, stmts) => poolCall({ type: "transaction", poolId, stmts }),
    // mariadb_pool_close poolId → null
    "mariadb_pool_close": (poolId) => {
      poolCall({ type: "close", poolId });
      return null;
    },
    // ── 유틸 ─────────────────────────────────────────────────────────────────
    "mariadb_health": () => {
      const args = [
        "-u",
        process.env.MARIADB_USER || "root",
        "--socket=" + resolveSocket(),
        "ping"
      ];
      const r = (0, import_child_process.spawnSync)("mariadb-admin", args, { timeout: 3e3, encoding: "utf-8" });
      return (r.status ?? 1) === 0;
    },
    "mariadb_databases": () => parseRows(runMariadb("", "SHOW DATABASES")).map((r) => r.Database),
    "mariadb_tables": (db) => parseRows(runMariadb(db, "SHOW TABLES")).map((r) => Object.values(r)[0]),
    // ── Universal db-query / db-exec / db-transaction ────────────────────────
    // db: {:host ...} → MariaDB  |  {:path ...} → SQLite  |  "pool_..." → pool
    "db-query": (db, sql, params = []) => {
      if (isSqliteConfig(db)) return sqliteQuery(getSqlitePath(db), sql, params);
      if (typeof db === "string" && db.startsWith("pool_"))
        return poolCall({ type: "query", poolId: db, sql, params }).rows ?? [];
      const dbName = getMariadbName(db);
      const m = db instanceof Map ? db : new Map(Object.entries(db));
      const savedUser = process.env.MARIADB_USER;
      const savedPass = process.env.MARIADB_PASS;
      const savedHost = process.env.MARIADB_HOST;
      const savedPort = process.env.MARIADB_PORT;
      if (m.get("user")) process.env.MARIADB_USER = String(m.get("user"));
      if (m.get("password")) process.env.MARIADB_PASS = String(m.get("password"));
      if (m.get("host")) process.env.MARIADB_HOST = String(m.get("host"));
      if (m.get("port")) process.env.MARIADB_PORT = String(m.get("port"));
      try {
        cachedSock = null;
        const rows = parseRows(runMariadb(dbName, bindParams(sql, params)));
        return rows.map((r) => {
          const rm = /* @__PURE__ */ new Map();
          for (const [k, v] of Object.entries(r)) rm.set(k, v);
          return rm;
        });
      } finally {
        if (savedUser !== void 0) process.env.MARIADB_USER = savedUser;
        else delete process.env.MARIADB_USER;
        if (savedPass !== void 0) process.env.MARIADB_PASS = savedPass;
        else delete process.env.MARIADB_PASS;
        if (savedHost !== void 0) process.env.MARIADB_HOST = savedHost;
        else delete process.env.MARIADB_HOST;
        if (savedPort !== void 0) process.env.MARIADB_PORT = savedPort;
        else delete process.env.MARIADB_PORT;
        cachedSock = null;
      }
    },
    "db-exec": (db, sql, params = []) => {
      if (isSqliteConfig(db)) return sqliteExec(getSqlitePath(db), sql, params);
      if (typeof db === "string" && db.startsWith("pool_")) {
        const r = poolCall({ type: "exec", poolId: db, sql, params });
        const m = /* @__PURE__ */ new Map();
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
      if (m2.get("user")) process.env.MARIADB_USER = String(m2.get("user"));
      if (m2.get("password")) process.env.MARIADB_PASS = String(m2.get("password"));
      if (m2.get("host")) process.env.MARIADB_HOST = String(m2.get("host"));
      if (m2.get("port")) process.env.MARIADB_PORT = String(m2.get("port"));
      try {
        cachedSock = null;
        runMariadb(dbName, bindParams(sql, params));
        try {
          const meta = parseRows(runMariadb(dbName, "SELECT ROW_COUNT() as ar, LAST_INSERT_ID() as lid"));
          const rm = /* @__PURE__ */ new Map();
          rm.set("affectedRows", Number(meta[0]?.ar ?? 0));
          rm.set("insertId", Number(meta[0]?.lid ?? 0));
          return rm;
        } catch {
          const rm = /* @__PURE__ */ new Map();
          rm.set("affectedRows", 0);
          rm.set("insertId", 0);
          return rm;
        }
      } finally {
        if (savedUser !== void 0) process.env.MARIADB_USER = savedUser;
        else delete process.env.MARIADB_USER;
        if (savedPass !== void 0) process.env.MARIADB_PASS = savedPass;
        else delete process.env.MARIADB_PASS;
        if (savedHost !== void 0) process.env.MARIADB_HOST = savedHost;
        else delete process.env.MARIADB_HOST;
        if (savedPort !== void 0) process.env.MARIADB_PORT = savedPort;
        else delete process.env.MARIADB_PORT;
        cachedSock = null;
      }
    },
    "db-transaction": (db, fn) => {
      if (isSqliteConfig(db)) {
        const sqliteDb = getSqliteDb(getSqlitePath(db));
        sqliteDb.exec("BEGIN");
        try {
          const result = callFlFn(fn);
          sqliteDb.exec("COMMIT");
          return result;
        } catch (e) {
          try {
            sqliteDb.exec("ROLLBACK");
          } catch {
          }
          throw e;
        }
      }
      if (typeof db === "string" && db.startsWith("pool_")) {
        if (Array.isArray(fn)) return poolCall({ type: "transaction", poolId: db, stmts: fn });
      }
      return null;
    }
  };
}

// src/stdlib-mongodb.ts
var import_child_process2 = require("child_process");
var path2 = __toESM(require("path"));
function createMongodbModule() {
  const helperPath = path2.join(__dirname, "_mongodb_helper.js");
  function callHelper(req) {
    try {
      const toSerializable = (obj) => {
        if (obj instanceof Map) return Object.fromEntries(obj);
        if (Array.isArray(obj)) return obj.map(toSerializable);
        if (typeof obj === "object" && obj !== null) {
          const result2 = {};
          for (const [k, v] of Object.entries(obj)) {
            result2[k] = toSerializable(v);
          }
          return result2;
        }
        return obj;
      };
      const result = (0, import_child_process2.execFileSync)("node", [helperPath, JSON.stringify(toSerializable(req))], {
        timeout: req.timeout ? req.timeout + 2e3 : 15e3,
        encoding: "utf-8"
      });
      return JSON.parse(result);
    } catch (err) {
      return { ok: false, error: err.message || "Helper execution failed" };
    }
  }
  function parseConn(connId) {
    if (!connId) return { host: "localhost", port: 27017 };
    const atIdx = connId.indexOf("@");
    if (atIdx !== -1) {
      const [creds, rest] = [connId.slice(0, atIdx), connId.slice(atIdx + 1)];
      const colonIdx = creds.indexOf(":");
      const user = creds.slice(0, colonIdx);
      const pass = creds.slice(colonIdx + 1);
      const slashIdx = rest.indexOf("/");
      const hostPort = slashIdx !== -1 ? rest.slice(0, slashIdx) : rest;
      const authDb = slashIdx !== -1 ? rest.slice(slashIdx + 1) : "admin";
      const [host2, portStr2] = hostPort.split(":");
      return { host: host2, port: parseInt(portStr2 || "27017", 10), user, pass, authDb };
    }
    const [host, portStr] = connId.split(":");
    return { host, port: parseInt(portStr || "27017", 10) };
  }
  return {
    // ── 연결 ─────────────────────────────────────────────────
    // mongo_connect "localhost" 27017 → connId ("localhost:27017")
    "mongo_connect": (host, port = 27017) => {
      const r = callHelper({ method: "ping", host, port });
      return r.ok ? `${host}:${port}` : null;
    },
    // mongo_connect_auth "localhost" 27017 "user" "pass" "admin" → connId
    "mongo_connect_auth": (host, port, user, pass, authDb = "admin") => {
      const r = callHelper({ method: "ping", host, port, user, pass, authDb });
      return r.ok ? `${user}:${pass}@${host}:${port}/${authDb}` : null;
    },
    // ── 단건 조회 ─────────────────────────────────────────────
    // mongo_find_one connId "db" "col" {:_id "..."} → doc or nil
    "mongo_find_one": (connId, db, col, filter = {}) => {
      const r = callHelper({ method: "find_one", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? r.doc ?? null : null;
    },
    // ── 다건 조회 ─────────────────────────────────────────────
    // mongo_find connId "db" "col" filter options → [docs]
    // options: {:limit 10 :skip 0 :sort {:name 1}}
    "mongo_find": (connId, db, col, filter = {}, opts = {}) => {
      const r = callHelper({
        method: "find_many",
        ...parseConn(connId),
        db,
        collection: col,
        filter,
        limit: opts.limit,
        skip: opts.skip,
        sort: opts.sort,
        projection: opts.projection
      });
      return r.ok ? r.docs ?? [] : [];
    },
    // ── 카운트 ────────────────────────────────────────────────
    "mongo_count": (connId, db, col, filter = {}) => {
      const r = callHelper({ method: "count", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? r.count ?? 0 : 0;
    },
    // ── 단건 삽입 ─────────────────────────────────────────────
    // mongo_insert_one connId "db" "col" doc → inserted_id or nil
    "mongo_insert_one": (connId, db, col, doc) => {
      const r = callHelper({ method: "insert_one", ...parseConn(connId), db, collection: col, doc });
      return r.ok ? r.inserted_id ?? null : null;
    },
    // ── 다건 삽입 ─────────────────────────────────────────────
    "mongo_insert_many": (connId, db, col, docs) => {
      const r = callHelper({ method: "insert_many", ...parseConn(connId), db, collection: col, docs });
      return r.ok ? { count: r.inserted_count, ids: r.inserted_ids } : null;
    },
    // ── 단건 수정 ─────────────────────────────────────────────
    // mongo_update_one connId "db" "col" filter update → {:matched 1 :modified 1}
    "mongo_update_one": (connId, db, col, filter, update, opts = {}) => {
      const r = callHelper({ method: "update_one", ...parseConn(connId), db, collection: col, filter, update, options: opts });
      return r.ok ? { matched: r.matched, modified: r.modified } : null;
    },
    // ── 다건 수정 ─────────────────────────────────────────────
    "mongo_update_many": (connId, db, col, filter, update, opts = {}) => {
      const r = callHelper({ method: "update_many", ...parseConn(connId), db, collection: col, filter, update, options: opts });
      return r.ok ? { matched: r.matched, modified: r.modified } : null;
    },
    // ── 단건 삭제 ─────────────────────────────────────────────
    "mongo_delete_one": (connId, db, col, filter) => {
      const r = callHelper({ method: "delete_one", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? r.deleted ?? 0 : 0;
    },
    // ── 다건 삭제 ─────────────────────────────────────────────
    "mongo_delete_many": (connId, db, col, filter) => {
      const r = callHelper({ method: "delete_many", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? r.deleted ?? 0 : 0;
    },
    // ── Aggregation ───────────────────────────────────────────
    // mongo_aggregate connId "db" "col" pipeline → [docs]
    "mongo_aggregate": (connId, db, col, pipeline) => {
      const r = callHelper({ method: "aggregate", ...parseConn(connId), db, collection: col, pipeline });
      return r.ok ? r.docs ?? [] : [];
    },
    // ── 트랜잭션 ──────────────────────────────────────────────
    // mongo_transaction connId "db" ops → {:committed true :results [...]}
    // ops: [{:method "insert_one" :collection "..." :doc {...}} ...]
    // MongoDB Replica Set 필요 (트랜잭션은 standalone 미지원)
    "mongo_transaction": (connId, db, ops) => {
      const r = callHelper({ method: "transaction", ...parseConn(connId), db, ops });
      return r;
    },
    // ── 인덱스 생성 ───────────────────────────────────────────
    // mongo_create_index connId "db" "col" {:field 1} {:unique true} → name
    "mongo_create_index": (connId, db, col, keys, opts = {}) => {
      const r = callHelper({ method: "create_index", ...parseConn(connId), db, collection: col, filter: keys, options: opts });
      return r.ok ? r.name ?? null : null;
    },
    // ── 컬렉션 목록 ───────────────────────────────────────────
    "mongo_collections": (connId, db) => {
      const r = callHelper({ method: "list_collections", ...parseConn(connId), db });
      return r.ok ? r.collections ?? [] : [];
    },
    // ── 하위 호환 (deprecated) ────────────────────────────────
    "mongodb_connect": (host, port = 27017) => {
      const r = callHelper({ method: "ping", host, port });
      return r.ok ? `${host}:${port}` : null;
    },
    "mongodb_close": (_connId) => true,
    "mongodb_is_connected": (connId) => {
      const { host, port } = parseConn(connId);
      return callHelper({ method: "ping", host, port, timeout: 1e3 }).ok === true;
    }
  };
}

// src/stdlib-db.ts
var import_child_process3 = require("child_process");
var _DatabaseSync = null;
function getDatabaseSync() {
  if (!_DatabaseSync) _DatabaseSync = eval("require")("node:sqlite").DatabaseSync;
  return _DatabaseSync;
}
var KIMDB = process.env.KIMDB_URL || "http://localhost:40000";
function kimdbReq(method, path3, body) {
  const toSerializable = (obj) => {
    if (obj instanceof Map) return Object.fromEntries(obj);
    if (Array.isArray(obj)) return obj.map(toSerializable);
    if (typeof obj === "object" && obj !== null) {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = toSerializable(v);
      }
      return result;
    }
    return obj;
  };
  const url = `${KIMDB}${path3}`;
  const args = ["-sf", "--max-time", "5"];
  if (method !== "GET") {
    args.push("-X", method);
    if (body !== void 0) {
      args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(toSerializable(body)));
    }
  }
  args.push(url);
  const r = (0, import_child_process3.spawnSync)("curl", args, { timeout: 6e3 });
  if (r.error) throw new Error(`kimdb request failed: ${r.error.message}`);
  const raw = r.stdout?.toString().trim() ?? "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
var dbConnections = /* @__PURE__ */ new Map();
function getDb(dbPath) {
  if (!dbConnections.has(dbPath)) {
    dbConnections.set(dbPath, new (getDatabaseSync())(dbPath));
  }
  return dbConnections.get(dbPath);
}
function toPlain(row) {
  if (!row) return row;
  return Object.assign({}, row);
}
function spreadParams(p) {
  if (Array.isArray(p)) return p;
  if (p !== null && p !== void 0) return [p];
  return [];
}
function validateIdentifier(name) {
  if (typeof name !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    throw new Error(`\uC798\uBABB\uB41C SQL \uC2DD\uBCC4\uC790: '${name}'`);
  return name;
}
function buildWhere(where) {
  if (typeof where === "string")
    throw new Error(`db WHERE \uC808\uC5D0 \uBB38\uC790\uC5F4 \uAE08\uC9C0 \u2014 Map\uC73C\uB85C \uC804\uB2EC\uD558\uC138\uC694. \uC608: {:id 1} \uB610\uB294 {"status" "active"}`);
  if (!where) return { sql: "", params: [] };
  const obj = where instanceof Map ? Object.fromEntries(where) : where;
  const parts = [];
  const params = [];
  for (const [k, v] of Object.entries(obj)) {
    const m = k.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([><=!]+)?$/);
    if (!m) throw new Error(`\uC798\uBABB\uB41C WHERE \uD0A4: '${k}'`);
    const col = m[1];
    const op = m[2] || "=";
    if (v === null || v === void 0) {
      parts.push(op === "!=" ? `${col} IS NOT NULL` : `${col} IS NULL`);
    } else {
      parts.push(`${col} ${op} ?`);
      params.push(v);
    }
  }
  return { sql: parts.length ? "WHERE " + parts.join(" AND ") : "", params };
}
function createDbModule() {
  return {
    // ── kimdb (REST API) ─────────────────────────────────────
    // db_get collection id -> data or null
    "db_get": (collection, id) => {
      try {
        const r = kimdbReq("GET", `/api/c/${collection}/${id}`);
        return r?.data ?? r ?? null;
      } catch {
        return null;
      }
    },
    // db_all collection -> array
    "db_all": (collection) => {
      try {
        const r = kimdbReq("GET", `/api/c/${collection}`);
        return Array.isArray(r) ? r : r?.data ?? [];
      } catch {
        return [];
      }
    },
    // db_put collection id data -> saved data
    "db_put": (collection, id, data) => {
      const r = kimdbReq("PUT", `/api/c/${collection}/${id}`, data);
      return r?.data ?? r;
    },
    // db_delete collection id -> boolean
    "db_delete": (collection, id) => {
      try {
        kimdbReq("DELETE", `/api/c/${collection}/${id}`);
        return true;
      } catch {
        return false;
      }
    },
    // db_project name -> project data or null  (kimdb shorthand)
    "db_project": (name) => {
      try {
        const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "");
        const r = kimdbReq("GET", `/api/c/projects/${safe}`);
        return r?.data ?? r ?? null;
      } catch {
        return null;
      }
    },
    // db_projects -> project list
    "db_projects": () => {
      try {
        const r = kimdbReq("GET", "/api/c/projects");
        return Array.isArray(r) ? r : r?.data ?? [];
      } catch {
        return [];
      }
    },
    // ── SQLite ───────────────────────────────────────────────
    // db_query dbPath sql params -> rows (JSON array)
    "db_query": (dbPath, sql, params = []) => {
      const db = getDb(dbPath);
      const p = spreadParams(params);
      return db.prepare(sql).all(...p).map(toPlain);
    },
    // db_exec dbPath sql [params] -> ""
    "db_exec": (dbPath, sql, params = []) => {
      const db = getDb(dbPath);
      const p = spreadParams(params);
      db.prepare(sql).run(...p);
      return "";
    },
    // db_insert dbPath table data -> true
    "db_insert": (dbPath, table, data) => {
      const db = getDb(dbPath);
      validateIdentifier(table);
      const keys = Object.keys(data).map(validateIdentifier);
      const placeholders = keys.map(() => "?").join(",");
      db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders})`).run(...Object.values(data));
      return true;
    },
    // db_update dbPath table data where -> true
    // where: Map 또는 객체 — 예: {:id 1} {"status" "active"}
    "db_update": (dbPath, table, data, where) => {
      const db = getDb(dbPath);
      validateIdentifier(table);
      const keys = Object.keys(data).map(validateIdentifier);
      const sets = keys.map((k) => `${k}=?`).join(", ");
      const { sql: whereSql, params: whereParams } = buildWhere(where);
      db.prepare(`UPDATE ${table} SET ${sets} ${whereSql}`).run(...Object.values(data), ...whereParams);
      return true;
    },
    // db_delete_row dbPath table where -> true
    // where: Map 또는 객체 — 예: {:id 1} {"status" "inactive"}
    "db_delete_row": (dbPath, table, where) => {
      validateIdentifier(table);
      const { sql: whereSql, params } = buildWhere(where);
      getDb(dbPath).prepare(`DELETE FROM ${table} ${whereSql}`).run(...params);
      return true;
    },
    // db_count dbPath table -> number
    "db_count": (dbPath, table) => {
      validateIdentifier(table);
      const row = toPlain(getDb(dbPath).prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get());
      return Number(row?.cnt ?? 0);
    },
    // db_tables dbPath -> string[]
    "db_tables": (dbPath) => {
      return getDb(dbPath).prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => toPlain(r).name);
    },
    // db_create dbPath sql -> true
    "db_create": (dbPath, sql) => {
      getDb(dbPath).exec(sql);
      return true;
    },
    // db_close dbPath -> true
    "db_close": (dbPath) => {
      if (dbConnections.has(dbPath)) {
        dbConnections.get(dbPath).close();
        dbConnections.delete(dbPath);
      }
      return true;
    }
  };
}

// src/stdlib-orm.ts
function createOrmModule() {
  const models = /* @__PURE__ */ new Map();
  const dbModule = createDbModule();
  return {
    // orm_define_model(name, table, fields, indexes) → model
    "orm_define_model": (name, table, fields, indexes) => {
      try {
        const modelDef = {
          name,
          table,
          fields: fields || [],
          indexes: indexes || []
        };
        models.set(name, modelDef);
        const sql = generateCreateTableSQL(name, table, fields);
        return {
          name,
          table,
          fields: fields.length,
          indexes: (indexes || []).length,
          sql
        };
      } catch (err) {
        throw new Error(`orm_define_model failed: ${err.message}`);
      }
    },
    // orm_migrate(model) → 테이블 생성
    "orm_migrate": (modelName) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        const sql = generateCreateTableSQL(modelName, model.table, model.fields);
        return true;
      } catch (err) {
        throw new Error(`orm_migrate failed: ${err.message}`);
      }
    },
    // orm_create(model, data) → {id, ...}
    "orm_create": (modelName, data) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        validateData(model, data);
        const id = Math.floor(Math.random() * 1e6);
        return { id, ...data, created_at: (/* @__PURE__ */ new Date()).toISOString() };
      } catch (err) {
        throw new Error(`orm_create failed: ${err.message}`);
      }
    },
    // orm_find(model, id) → record or null
    "orm_find": (modelName, id) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return { id, model: modelName };
      } catch (err) {
        throw new Error(`orm_find failed: ${err.message}`);
      }
    },
    // orm_find_by(model, field, value) → record or null
    "orm_find_by": (modelName, field, value) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return { [field]: value, model: modelName };
      } catch (err) {
        throw new Error(`orm_find_by failed: ${err.message}`);
      }
    },
    // orm_where(model, conditions) → [records]
    "orm_where": (modelName, conditions) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return [{ ...conditions, model: modelName }];
      } catch (err) {
        throw new Error(`orm_where failed: ${err.message}`);
      }
    },
    // orm_update(model, id, data) → updated record
    "orm_update": (modelName, id, data) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        validateData(model, data);
        return { id, ...data, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      } catch (err) {
        throw new Error(`orm_update failed: ${err.message}`);
      }
    },
    // orm_delete(model, id) → boolean
    "orm_delete": (modelName, id) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return true;
      } catch (err) {
        throw new Error(`orm_delete failed: ${err.message}`);
      }
    },
    // orm_all(model) → [records]
    "orm_all": (modelName) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return [];
      } catch (err) {
        throw new Error(`orm_all failed: ${err.message}`);
      }
    },
    // orm_count(model) → number
    "orm_count": (modelName) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return 0;
      } catch (err) {
        throw new Error(`orm_count failed: ${err.message}`);
      }
    },
    // orm_get_model(name) → model definition
    "orm_get_model": (modelName) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          return null;
        }
        return model;
      } catch (err) {
        throw new Error(`orm_get_model failed: ${err.message}`);
      }
    }
  };
}
function generateCreateTableSQL(modelName, table, fields) {
  const columns = fields.map((field) => {
    let sql = `${field.name} `;
    if (field.type === "integer") sql += "INTEGER";
    else if (field.type === "string") sql += "TEXT";
    else if (field.type === "datetime") sql += "DATETIME DEFAULT CURRENT_TIMESTAMP";
    else sql += "TEXT";
    if (field.primaryKey) sql += " PRIMARY KEY AUTOINCREMENT";
    if (field.unique) sql += " UNIQUE";
    if (field.required) sql += " NOT NULL";
    return sql;
  });
  return `CREATE TABLE IF NOT EXISTS ${table} (
  ${columns.join(",\n  ")}
);`;
}
function validateData(model, data) {
  for (const field of model.fields) {
    if (field.required && data[field.name] === void 0) {
      throw new Error(`Field '${field.name}' is required`);
    }
    if (field.type === "integer" && data[field.name] !== void 0 && typeof data[field.name] !== "number") {
      throw new Error(`Field '${field.name}' must be integer`);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createDbModule,
  createMariadbModule,
  createMongodbModule,
  createOrmModule
});
