// FreeLang v11: dclub-queue atomic dequeue helper (Phase X1)
//
// SQLite 의 BEGIN IMMEDIATE + UPDATE...RETURNING 패턴으로 race-free dequeue.
// stdlib-db.ts 의 db_query/db_exec 는 spawnSync 라 트랜잭션 미지원 →
// 단일 sqlite3 호출로 한 번에 SELECT+UPDATE 수행.

import { spawnSync } from "child_process";

function sqliteJson(dbPath: string, sql: string): any[] {
  const r = spawnSync("sqlite3", ["-json", dbPath, sql], { timeout: 10000, encoding: "utf-8" });
  if (r.error) throw new Error(`sqlite3 error: ${r.error.message}`);
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? "";
    throw new Error(`sqlite3 exit ${r.status}: ${stderr}`);
  }
  const raw = r.stdout?.trim() ?? "";
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function escapeStr(s: string): string {
  return String(s).replace(/'/g, "''");
}

export function createQueueHelpersModule() {
  return {
    // queue_dequeue_atomic db_path topic worker_id lock_seconds
    //   -> {id, topic, payload, attempt, ...} or null
    //
    // BEGIN IMMEDIATE → 첫 queued 메시지 잡고 in_flight 로 마킹 → COMMIT.
    // 단일 sqlite3 호출이라 외부 race 없음.
    "queue_dequeue_atomic": (
      dbPath: string,
      topic: string,
      workerId: string,
      lockSeconds: number = 30,
    ): Record<string, any> | null => {
      const now = Date.now();
      const lockUntil = now + lockSeconds * 1000;
      const t = escapeStr(topic);
      const w = escapeStr(workerId);

      // 단일 sqlite3 호출 — UPDATE...RETURNING (SQLite 3.35+) 으로
      // SELECT+UPDATE 를 한 implicit 트랜잭션에 묶음.
      // WAL + busy_timeout 으로 동시 worker 의 race 방지.
      const sql = `
        UPDATE q_messages
        SET status='in_flight',
            locked_until=${lockUntil},
            worker_id='${w}',
            updated_at=datetime('now')
        WHERE id = (
          SELECT id FROM q_messages
          WHERE topic='${t}' AND status='queued' AND next_run_at <= ${now}
          ORDER BY id ASC LIMIT 1
        )
        RETURNING id, topic, payload, attempt, next_run_at;
      `;
      const rows = sqliteJson(dbPath, sql);
      return rows.length === 0 ? null : rows[0];
    },

    // queue_db_init db_path -> bool  (WAL 모드 + busy_timeout 활성화)
    "queue_db_init": (dbPath: string): boolean => {
      const sql = `
        PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=5000;
        PRAGMA synchronous=NORMAL;
      `;
      const r = spawnSync("sqlite3", [dbPath, sql], { timeout: 5000 });
      return (r.status ?? 1) === 0;
    },

    // queue_recover_stuck db_path stuck_seconds -> count
    //   in_flight 상태에서 locked_until 지난 메시지를 다시 queued 로 (worker 죽은 경우 대비)
    "queue_recover_stuck": (dbPath: string, stuckSeconds: number = 60): number => {
      const cutoff = Date.now();
      const sql = `
        UPDATE q_messages
        SET status='queued', worker_id=NULL,
            attempt=attempt+1,
            updated_at=datetime('now')
        WHERE status='in_flight' AND locked_until < ${cutoff};
        SELECT changes();
      `;
      const r = spawnSync("sqlite3", [dbPath, sql], { timeout: 5000, encoding: "utf-8" });
      if ((r.status ?? 1) !== 0) return 0;
      const out = r.stdout?.trim() ?? "0";
      return parseInt(out, 10) || 0;
    },
  };
}
