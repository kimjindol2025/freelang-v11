// FreeLang v11: MongoDB Driver
// High-level CRUD + 트랜잭션 지원 (mongodb npm 드라이버 기반)
// 모든 작업은 _mongodb_helper.js를 통해 동기식(execFileSync)으로 실행

import { execFileSync } from "child_process";
import * as path from "path";

export function createMongodbModule() {
  const helperPath = path.join(__dirname, "_mongodb_helper.js");

  function callHelper(req: Record<string, any>): any {
    try {
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
      const result = execFileSync("node", [helperPath, JSON.stringify(toSerializable(req))], {
        timeout: req.timeout ? req.timeout + 2000 : 15000,
        encoding: "utf-8",
      });
      return JSON.parse(result);
    } catch (err: any) {
      return { ok: false, error: err.message || "Helper execution failed" };
    }
  }

  // connId = "host:port" 또는 "user:pass@host:port/authDb"
  // 내부적으로 파싱하여 host/port/user/pass 분리
  function parseConn(connId: string): Record<string, any> {
    if (!connId) return { host: "localhost", port: 27017 };
    // "user:pass@host:port/authDb" 형태
    const atIdx = connId.indexOf("@");
    if (atIdx !== -1) {
      const [creds, rest] = [connId.slice(0, atIdx), connId.slice(atIdx + 1)];
      const colonIdx = creds.indexOf(":");
      const user = creds.slice(0, colonIdx);
      const pass = creds.slice(colonIdx + 1);
      const slashIdx = rest.indexOf("/");
      const hostPort = slashIdx !== -1 ? rest.slice(0, slashIdx) : rest;
      const authDb = slashIdx !== -1 ? rest.slice(slashIdx + 1) : "admin";
      const [host, portStr] = hostPort.split(":");
      return { host, port: parseInt(portStr || "27017", 10), user, pass, authDb };
    }
    const [host, portStr] = connId.split(":");
    return { host, port: parseInt(portStr || "27017", 10) };
  }

  return {
    // ── 연결 ─────────────────────────────────────────────────
    // mongo_connect "localhost" 27017 → connId ("localhost:27017")
    "mongo_connect": (host: string, port: number = 27017): string | null => {
      const r = callHelper({ method: "ping", host, port });
      return r.ok ? `${host}:${port}` : null;
    },

    // mongo_connect_auth "localhost" 27017 "user" "pass" "admin" → connId
    "mongo_connect_auth": (
      host: string, port: number, user: string, pass: string, authDb: string = "admin"
    ): string | null => {
      const r = callHelper({ method: "ping", host, port, user, pass, authDb });
      return r.ok ? `${user}:${pass}@${host}:${port}/${authDb}` : null;
    },

    // ── 단건 조회 ─────────────────────────────────────────────
    // mongo_find_one connId "db" "col" {:_id "..."} → doc or nil
    "mongo_find_one": (connId: string, db: string, col: string, filter: any = {}): any => {
      const r = callHelper({ method: "find_one", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? (r.doc ?? null) : null;
    },

    // ── 다건 조회 ─────────────────────────────────────────────
    // mongo_find connId "db" "col" filter options → [docs]
    // options: {:limit 10 :skip 0 :sort {:name 1}}
    "mongo_find": (connId: string, db: string, col: string, filter: any = {}, opts: any = {}): any[] => {
      const r = callHelper({
        method: "find_many", ...parseConn(connId), db, collection: col, filter,
        limit: opts.limit, skip: opts.skip, sort: opts.sort, projection: opts.projection,
      });
      return r.ok ? (r.docs ?? []) : [];
    },

    // ── 카운트 ────────────────────────────────────────────────
    "mongo_count": (connId: string, db: string, col: string, filter: any = {}): number => {
      const r = callHelper({ method: "count", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? (r.count ?? 0) : 0;
    },

    // ── 단건 삽입 ─────────────────────────────────────────────
    // mongo_insert_one connId "db" "col" doc → inserted_id or nil
    "mongo_insert_one": (connId: string, db: string, col: string, doc: any): string | null => {
      const r = callHelper({ method: "insert_one", ...parseConn(connId), db, collection: col, doc });
      return r.ok ? (r.inserted_id ?? null) : null;
    },

    // ── 다건 삽입 ─────────────────────────────────────────────
    "mongo_insert_many": (connId: string, db: string, col: string, docs: any[]): any => {
      const r = callHelper({ method: "insert_many", ...parseConn(connId), db, collection: col, docs });
      return r.ok ? { count: r.inserted_count, ids: r.inserted_ids } : null;
    },

    // ── 단건 수정 ─────────────────────────────────────────────
    // mongo_update_one connId "db" "col" filter update → {:matched 1 :modified 1}
    "mongo_update_one": (connId: string, db: string, col: string, filter: any, update: any, opts: any = {}): any => {
      const r = callHelper({ method: "update_one", ...parseConn(connId), db, collection: col, filter, update, options: opts });
      return r.ok ? { matched: r.matched, modified: r.modified } : null;
    },

    // ── 다건 수정 ─────────────────────────────────────────────
    "mongo_update_many": (connId: string, db: string, col: string, filter: any, update: any, opts: any = {}): any => {
      const r = callHelper({ method: "update_many", ...parseConn(connId), db, collection: col, filter, update, options: opts });
      return r.ok ? { matched: r.matched, modified: r.modified } : null;
    },

    // ── 단건 삭제 ─────────────────────────────────────────────
    "mongo_delete_one": (connId: string, db: string, col: string, filter: any): number => {
      const r = callHelper({ method: "delete_one", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? (r.deleted ?? 0) : 0;
    },

    // ── 다건 삭제 ─────────────────────────────────────────────
    "mongo_delete_many": (connId: string, db: string, col: string, filter: any): number => {
      const r = callHelper({ method: "delete_many", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? (r.deleted ?? 0) : 0;
    },

    // ── Aggregation ───────────────────────────────────────────
    // mongo_aggregate connId "db" "col" pipeline → [docs]
    "mongo_aggregate": (connId: string, db: string, col: string, pipeline: any[]): any[] => {
      const r = callHelper({ method: "aggregate", ...parseConn(connId), db, collection: col, pipeline });
      return r.ok ? (r.docs ?? []) : [];
    },

    // ── 트랜잭션 ──────────────────────────────────────────────
    // mongo_transaction connId "db" ops → {:committed true :results [...]}
    // ops: [{:method "insert_one" :collection "..." :doc {...}} ...]
    // MongoDB Replica Set 필요 (트랜잭션은 standalone 미지원)
    "mongo_transaction": (connId: string, db: string, ops: any[]): any => {
      const r = callHelper({ method: "transaction", ...parseConn(connId), db, ops });
      return r;
    },

    // ── 인덱스 생성 ───────────────────────────────────────────
    // mongo_create_index connId "db" "col" {:field 1} {:unique true} → name
    "mongo_create_index": (connId: string, db: string, col: string, keys: any, opts: any = {}): string | null => {
      const r = callHelper({ method: "create_index", ...parseConn(connId), db, collection: col, filter: keys, options: opts });
      return r.ok ? (r.name ?? null) : null;
    },

    // ── 컬렉션 목록 ───────────────────────────────────────────
    "mongo_collections": (connId: string, db: string): string[] => {
      const r = callHelper({ method: "list_collections", ...parseConn(connId), db });
      return r.ok ? (r.collections ?? []) : [];
    },

    // ── 하위 호환 (deprecated) ────────────────────────────────
    "mongodb_connect": (host: string, port: number = 27017): string | null => {
      const r = callHelper({ method: "ping", host, port });
      return r.ok ? `${host}:${port}` : null;
    },
    "mongodb_close": (_connId: string): boolean => true,
    "mongodb_is_connected": (connId: string): boolean => {
      const { host, port } = parseConn(connId);
      return callHelper({ method: "ping", host, port, timeout: 1000 }).ok === true;
    },
  };
}
