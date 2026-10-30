var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ext-async.ts
var ext_async_exports = {};
__export(ext_async_exports, {
  createAsyncModule: () => createAsyncModule,
  createChannelModule: () => createChannelModule,
  createImmutableModule: () => createImmutableModule,
  createQueueHelpersModule: () => createQueueHelpersModule
});
module.exports = __toCommonJS(ext_async_exports);

// src/async-runtime.ts
var FreeLangPromise = class _FreeLangPromise {
  constructor(executor) {
    this.state = "pending";
    this.value = void 0;
    this.error = null;
    this.resolvers = [];
    this.rejecters = [];
    try {
      executor(this.resolve.bind(this), this.reject.bind(this));
    } catch (e) {
      this.reject(e);
    }
  }
  /**
   * Promise 상태 확인
   */
  getState() {
    return this.state;
  }
  /**
   * Promise 값 추출 (resolved 상태일 때만)
   */
  getValue() {
    if (this.state === "resolved") {
      return this.value;
    }
    throw new Error("Cannot get value from non-resolved Promise");
  }
  /**
   * Promise 에러 추출 (rejected 상태일 때만)
   */
  getError() {
    if (this.state === "rejected") {
      return this.error;
    }
    return null;
  }
  /**
   * resolve 핸들러 호출
   */
  resolve(value) {
    if (this.state !== "pending") return;
    this.state = "resolved";
    this.value = value;
    for (const resolver of this.resolvers) {
      try {
        resolver(value);
      } catch (e) {
      }
    }
    this.resolvers = [];
  }
  /**
   * reject 핸들러 호출
   */
  reject(error) {
    if (this.state !== "pending") return;
    this.state = "rejected";
    this.error = error;
    for (const rejecter of this.rejecters) {
      try {
        rejecter(error);
      } catch (e) {
      }
    }
    this.rejecters = [];
  }
  /**
   * Promise 체이닝: then 메서드
   * onFulfilled가 성공했을 때 호출되고, 새로운 Promise 반환
   */
  then(onFulfilled) {
    return new _FreeLangPromise((resolve, reject) => {
      if (this.state === "resolved") {
        try {
          const result = onFulfilled(this.value);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      } else if (this.state === "rejected") {
        reject(this.error);
      } else {
        this.resolvers.push((value) => {
          try {
            const result = onFulfilled(value);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        });
      }
    });
  }
  /**
   * Promise 에러 처리: catch 메서드
   * onRejected가 에러일 때 호출되고, 새로운 Promise 반환
   */
  catch(onRejected) {
    return new _FreeLangPromise((resolve, reject) => {
      if (this.state === "rejected") {
        try {
          const result = onRejected(this.error);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      } else if (this.state === "resolved") {
        resolve(this.value);
      } else {
        this.rejecters.push((error) => {
          try {
            const result = onRejected(error);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        });
      }
    });
  }
  /**
   * finally 메서드: 성공/실패 상관없이 항상 실행
   */
  finally(onFinally) {
    return new _FreeLangPromise((resolve, reject) => {
      const executeFinally = () => {
        try {
          onFinally();
        } catch (e) {
          reject(e);
          return;
        }
        if (this.state === "resolved") {
          resolve(this.value);
        } else if (this.state === "rejected") {
          reject(this.error);
        }
      };
      if (this.state !== "pending") {
        executeFinally();
      } else {
        this.resolvers.push(() => executeFinally());
        this.rejecters.push(() => executeFinally());
      }
    });
  }
  /**
   * 모든 Promise가 완료될 때까지 대기
   */
  static all(promises) {
    return new _FreeLangPromise((resolve, reject) => {
      if (promises.length === 0) {
        resolve([]);
        return;
      }
      const results = [];
      let completedCount = 0;
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        if (promise.state === "resolved") {
          results[i] = promise.value;
          completedCount++;
        } else if (promise.state === "rejected") {
          reject(promise.error);
          return;
        } else {
          promise.then((value) => {
            results[i] = value;
            completedCount++;
            if (completedCount === promises.length) {
              resolve(results);
            }
          }).catch((error) => reject(error));
        }
      }
      if (completedCount === promises.length) {
        resolve(results);
      }
    });
  }
  /**
   * 첫 번째로 완료된 Promise 반환
   */
  static race(promises) {
    return new _FreeLangPromise((resolve, reject) => {
      for (const promise of promises) {
        if (promise.state === "resolved") {
          resolve(promise.value);
          return;
        } else if (promise.state === "rejected") {
          reject(promise.error);
          return;
        } else {
          promise.then((value) => resolve(value)).catch((error) => reject(error));
        }
      }
    });
  }
};
function resolvedPromise(value) {
  return new FreeLangPromise((resolve) => {
    resolve(value);
  });
}
function rejectedPromise(error) {
  return new FreeLangPromise((_, reject) => {
    reject(error);
  });
}

// src/stdlib-async.ts
function createAsyncModule(callFn) {
  return {
    // async_call fn_name args -> Promise
    // Call a function asynchronously and return a promise
    "async_call": (fnName, args = []) => {
      return new FreeLangPromise((resolve, reject) => {
        setImmediate(() => {
          try {
            const result = callFn(fnName, args);
            resolve(result);
          } catch (e) {
            reject(new Error(`async_call error: ${e.message}`));
          }
        });
      });
    },
    // await_result promise -> value|error
    // Wait for a promise to resolve and get its value
    "await_result": (promise) => {
      const state = promise.getState();
      if (state === "resolved") {
        return promise.getValue();
      } else if (state === "rejected") {
        throw promise.getError() || new Error("Promise rejected");
      } else {
        throw new Error("Promise still pending - use proper async handling");
      }
    },
    // promise_all promises -> Promise
    // Wait for all promises to resolve
    "promise_all": (promises) => {
      return new FreeLangPromise((resolve, reject) => {
        if (!Array.isArray(promises) || promises.length === 0) {
          resolve([]);
          return;
        }
        const results = [];
        let completed = 0;
        promises.forEach((p, idx) => {
          if (!(p instanceof FreeLangPromise)) {
            reject(new Error(`promise_all: element ${idx} is not a promise`));
            return;
          }
          const state = p.getState();
          if (state === "resolved") {
            results[idx] = p.getValue();
            completed++;
            if (completed === promises.length) resolve(results);
          } else if (state === "rejected") {
            reject(p.getError() || new Error(`promise_all: promise ${idx} rejected`));
          } else {
            reject(new Error(`promise_all: promise ${idx} still pending`));
          }
        });
      });
    },
    // promise_race promises -> Promise
    // Return first resolved promise
    "promise_race": (promises) => {
      return new FreeLangPromise((resolve, reject) => {
        if (!Array.isArray(promises) || promises.length === 0) {
          reject(new Error("promise_race: empty promise array"));
          return;
        }
        for (let i = 0; i < promises.length; i++) {
          const p = promises[i];
          if (!(p instanceof FreeLangPromise)) {
            reject(new Error(`promise_race: element ${i} is not a promise`));
            return;
          }
          const state = p.getState();
          if (state === "resolved") {
            resolve(p.getValue());
            return;
          } else if (state === "rejected") {
            reject(p.getError() || new Error(`promise_race: promise ${i} rejected`));
            return;
          }
        }
        reject(new Error("promise_race: all promises still pending"));
      });
    },
    // promise_delay ms -> Promise
    // Create a promise that resolves after delay
    "promise_delay": (ms) => {
      return new FreeLangPromise((resolve) => {
        setTimeout(() => resolve(null), ms);
      });
    },
    // promise_timeout ms fn_name args -> Promise
    // Call function with timeout
    "promise_timeout": (ms, fnName, args = []) => {
      return new FreeLangPromise((resolve, reject) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (!done) {
            done = true;
            reject(new Error(`promise_timeout: timed out after ${ms}ms`));
          }
        }, ms);
        try {
          const result = callFn(fnName, args);
          done = true;
          clearTimeout(timeout);
          resolve(result);
        } catch (e) {
          done = true;
          clearTimeout(timeout);
          reject(new Error(`promise_timeout: ${e.message}`));
        }
      });
    },
    // promise_resolve value -> Promise
    // Create immediately resolved promise
    "promise_resolve": (value) => {
      return resolvedPromise(value);
    },
    // promise_reject error -> Promise
    // Create immediately rejected promise
    "promise_reject": (error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      return rejectedPromise(err);
    },
    // promise_state promise -> "pending"|"resolved"|"rejected"
    // Get promise state
    "promise_state": (promise) => {
      if (!(promise instanceof FreeLangPromise)) {
        return "unknown";
      }
      return promise.getState();
    },
    // promise_then promise fn_name -> Promise
    // Chain promise with handler function
    "promise_then": (promise, fnName) => {
      if (!(promise instanceof FreeLangPromise)) {
        return rejectedPromise(new Error("promise_then: first arg is not a promise"));
      }
      return promise.then((value) => {
        try {
          return callFn(fnName, [value]);
        } catch (e) {
          throw new Error(`promise_then handler error: ${e.message}`);
        }
      });
    }
  };
}

// src/stdlib-channel.ts
var _chanIdCounter = 0;
function genId() {
  return `ch_${++_chanIdCounter}_${Date.now()}`;
}
var Channel = class {
  constructor(size = 100) {
    this.queue = [];
    this.maxSize = size;
  }
  /** 값을 채널에 보냄. 가득 차면 false 반환 */
  send(val) {
    if (this.queue.length >= this.maxSize) return false;
    this.queue.push(val);
    return true;
  }
  /** 채널에서 값을 꺼냄. 비어있으면 null 반환 */
  recv() {
    return this.queue.shift() ?? null;
  }
  size() {
    return this.queue.length;
  }
  isEmpty() {
    return this.queue.length === 0;
  }
  isFull() {
    return this.queue.length >= this.maxSize;
  }
};
var channels = /* @__PURE__ */ new Map();
function createChannelModule() {
  return {
    // (chan) or (chan 50) → channel-id
    "chan": (size) => {
      const id = genId();
      channels.set(id, new Channel(typeof size === "number" ? size : 100));
      return id;
    },
    // (chan-send ch-id value) → boolean
    "chan-send": (id, val) => {
      const ch = channels.get(id);
      if (!ch) return false;
      return ch.send(val);
    },
    // (chan-recv ch-id) → value or null
    "chan-recv": (id) => {
      const ch = channels.get(id);
      if (!ch) return null;
      return ch.recv();
    },
    // (chan-size ch-id) → number
    "chan-size": (id) => {
      const ch = channels.get(id);
      if (!ch) return 0;
      return ch.size();
    },
    // (chan-empty? ch-id) → boolean
    "chan-empty?": (id) => {
      const ch = channels.get(id);
      if (!ch) return true;
      return ch.isEmpty();
    },
    // (chan-full? ch-id) → boolean
    "chan-full?": (id) => {
      const ch = channels.get(id);
      if (!ch) return true;
      return ch.isFull();
    },
    // (chan-close ch-id) → boolean (채널 제거)
    "chan-close": (id) => {
      return channels.delete(id);
    }
  };
}

// src/stdlib-queue-helpers.ts
var import_child_process = require("child_process");
function sqliteJson(dbPath, sql) {
  const r = (0, import_child_process.spawnSync)("sqlite3", ["-json", dbPath, sql], { timeout: 1e4, encoding: "utf-8" });
  if (r.error) throw new Error(`sqlite3 error: ${r.error.message}`);
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? "";
    throw new Error(`sqlite3 exit ${r.status}: ${stderr}`);
  }
  const raw = r.stdout?.trim() ?? "";
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function escapeStr(s) {
  return String(s).replace(/'/g, "''");
}
function createQueueHelpersModule() {
  return {
    // queue_dequeue_atomic db_path topic worker_id lock_seconds
    //   -> {id, topic, payload, attempt, ...} or null
    //
    // BEGIN IMMEDIATE → 첫 queued 메시지 잡고 in_flight 로 마킹 → COMMIT.
    // 단일 sqlite3 호출이라 외부 race 없음.
    "queue_dequeue_atomic": (dbPath, topic, workerId, lockSeconds = 30) => {
      const now = Date.now();
      const lockUntil = now + lockSeconds * 1e3;
      const t = escapeStr(topic);
      const w = escapeStr(workerId);
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
    "queue_db_init": (dbPath) => {
      const sql = `
        PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=5000;
        PRAGMA synchronous=NORMAL;
      `;
      const r = (0, import_child_process.spawnSync)("sqlite3", [dbPath, sql], { timeout: 5e3 });
      return (r.status ?? 1) === 0;
    },
    // queue_recover_stuck db_path stuck_seconds -> count
    //   in_flight 상태에서 locked_until 지난 메시지를 다시 queued 로 (worker 죽은 경우 대비)
    "queue_recover_stuck": (dbPath, stuckSeconds = 60) => {
      const cutoff = Date.now();
      const sql = `
        UPDATE q_messages
        SET status='queued', worker_id=NULL,
            attempt=attempt+1,
            updated_at=datetime('now')
        WHERE status='in_flight' AND locked_until < ${cutoff};
        SELECT changes();
      `;
      const r = (0, import_child_process.spawnSync)("sqlite3", [dbPath, sql], { timeout: 5e3, encoding: "utf-8" });
      if ((r.status ?? 1) !== 0) return 0;
      const out = r.stdout?.trim() ?? "0";
      return parseInt(out, 10) || 0;
    }
  };
}

// src/immutable.ts
function stripColon(key) {
  return typeof key === "string" && key.startsWith(":") ? key.slice(1) : key;
}
function createImmutableModule() {
  return {
    // ── 맵 함수 ──────────────────────────────────────────
    /** 이뮤터블 맵 생성 */
    "imm-map": (obj) => {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return Object.freeze({});
      const normalized = {};
      for (const k of Object.keys(obj)) {
        normalized[stripColon(k)] = obj[k];
      }
      return Object.freeze(normalized);
    },
    /** 키-값 추가/업데이트 → 새 맵 반환 (원본 불변) */
    "imm-assoc": (m, key, val) => {
      const base = m && typeof m === "object" && !Array.isArray(m) ? m : {};
      return Object.freeze({ ...base, [stripColon(key)]: val });
    },
    /** 키 제거 → 새 맵 반환 */
    "imm-dissoc": (m, key) => {
      if (!m || typeof m !== "object") return Object.freeze({});
      const k = stripColon(key);
      const { [k]: _removed, ...rest } = m;
      return Object.freeze(rest);
    },
    /** 키로 값 조회 */
    "imm-get": (m, key, defaultVal) => {
      if (!m || typeof m !== "object") return defaultVal ?? null;
      const k = stripColon(key);
      const val = m[k];
      return val !== void 0 ? val : defaultVal ?? null;
    },
    /** 모든 키 목록 */
    "imm-keys": (m) => {
      if (!m || typeof m !== "object" || Array.isArray(m)) return Object.freeze([]);
      return Object.freeze(Object.keys(m));
    },
    /** 모든 값 목록 */
    "imm-vals": (m) => {
      if (!m || typeof m !== "object" || Array.isArray(m)) return Object.freeze([]);
      return Object.freeze(Object.values(m));
    },
    /** 두 맵 병합 → 새 맵 (m2가 우선) */
    "imm-merge": (m1, m2) => {
      const base = m1 && typeof m1 === "object" && !Array.isArray(m1) ? m1 : {};
      const overlay = m2 && typeof m2 === "object" && !Array.isArray(m2) ? m2 : {};
      return Object.freeze({ ...base, ...overlay });
    },
    // ── 벡터 함수 ─────────────────────────────────────────
    /** 이뮤터블 벡터 생성 */
    "imm-vec": (arr) => {
      if (!Array.isArray(arr)) return Object.freeze([]);
      return Object.freeze([...arr]);
    },
    /** 끝에 값 추가 → 새 벡터 (원본 불변) */
    "imm-conj": (v, val) => {
      if (!Array.isArray(v)) return Object.freeze([val]);
      return Object.freeze([...v, val]);
    },
    /** 인덱스로 값 조회 */
    "imm-nth": (v, idx) => {
      if (!Array.isArray(v)) return null;
      const val = v[idx];
      return val !== void 0 ? val : null;
    },
    /** 슬라이스 → 새 벡터 */
    "imm-slice": (v, start, end) => {
      if (!Array.isArray(v)) return Object.freeze([]);
      return Object.freeze(v.slice(start, end));
    },
    /** 특정 인덱스 값 교체 → 새 벡터 */
    "imm-update": (v, idx, val) => {
      if (!Array.isArray(v)) return Object.freeze([]);
      const copy = [...v];
      copy[idx] = val;
      return Object.freeze(copy);
    },
    /** 마지막 원소 제거 → 새 벡터 */
    "imm-pop": (v) => {
      if (!Array.isArray(v) || v.length === 0) return Object.freeze([]);
      return Object.freeze(v.slice(0, -1));
    },
    // ── 공통 함수 ─────────────────────────────────────────
    /** 원소 수 */
    "imm-count": (c) => {
      if (Array.isArray(c)) return c.length;
      if (c && typeof c === "object") return Object.keys(c).length;
      return 0;
    },
    /** 이뮤터블 여부 확인 */
    "imm?": (v) => Object.isFrozen(v),
    /** 비어있는지 확인 */
    "imm-empty?": (c) => {
      if (Array.isArray(c)) return c.length === 0;
      if (c && typeof c === "object") return Object.keys(c).length === 0;
      return true;
    },
    /** 소스를 타겟에 합치기 → 새 컬렉션 */
    "imm-into": (target, source) => {
      if (Array.isArray(target)) {
        const extra = Array.isArray(source) ? source : source && typeof source === "object" ? Object.values(source) : [];
        return Object.freeze([...target, ...extra]);
      }
      const base = target && typeof target === "object" ? target : {};
      const overlay = source && typeof source === "object" && !Array.isArray(source) ? source : {};
      return Object.freeze({ ...base, ...overlay });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createAsyncModule,
  createChannelModule,
  createImmutableModule,
  createQueueHelpersModule
});
