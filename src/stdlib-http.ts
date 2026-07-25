// FreeLang v11: HTTP Client Standard Library (Phase 5-2)
// 모든 http_* 함수는 구조체 반환: {:status 200 :body "..." :error nil}
// HTTP-INPROCESS-001: spawnSync(node -e) 제거 → 상주 worker_threads + Atomics.wait
// (동기 http_* 계약 유지, 콜당 프로세스 생성 비용 제거)

import {
  Worker,
  MessageChannel,
  receiveMessageOnPort,
  type MessagePort,
} from "worker_threads";

type HttpResult = { status: number; body: string; error?: string };

/** eval worker: MessagePort 로 요청 받아 http/https 수행 후 Atomics.notify */
const HTTP_SYNC_WORKER_SOURCE = `
const { parentPort, workerData } = require("worker_threads");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const signal = new Int32Array(workerData.sab);
function handle(port, msg) {
  let settled = false;
  const done = (r) => {
    if (settled) return;
    settled = true;
    port.postMessage(r);
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  };
  try {
    const u = new URL(msg.url);
    const mod = u.protocol === "https:" ? https : http;
    const headers = Object.assign({}, msg.headers || {});
    if (msg.body != null) {
      headers["Content-Length"] = Buffer.byteLength(msg.body, "utf-8");
    }
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + (u.search || ""),
        method: msg.method || "GET",
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () =>
          done({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf-8"),
          })
        );
      }
    );
    req.on("error", (e) =>
      done({ status: 0, body: "", error: String(e && e.message ? e.message : e) })
    );
    const ms = msg.timeoutMs || 10000;
    req.setTimeout(ms, () => {
      req.destroy();
      done({ status: 0, body: "", error: "timeout" });
    });
    if (msg.body != null) req.write(msg.body, "utf-8");
    req.end();
  } catch (e) {
    done({ status: 0, body: "", error: String(e && e.message ? e.message : e) });
  }
}
parentPort.once("message", (init) => {
  const port = init.port;
  port.on("message", (msg) => handle(port, msg));
  Atomics.store(signal, 1, 1);
  Atomics.notify(signal, 1);
});
`;

type HttpWorkerState = {
  worker: Worker;
  port: MessagePort;
  signal: Int32Array;
};

let httpWorkerState: HttpWorkerState | null = null;

function ensureHttpWorker(): HttpWorkerState {
  if (httpWorkerState) return httpWorkerState;
  const sab = new SharedArrayBuffer(8);
  const signal = new Int32Array(sab);
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(HTTP_SYNC_WORKER_SOURCE, {
    eval: true,
    workerData: { sab },
  });
  worker.on("error", (err) => {
    // 워커 사망 시 다음 호출이 재생성하도록
    httpWorkerState = null;
    console.error("[FreeLang] http sync worker error:", err && err.message ? err.message : err);
  });
  worker.on("exit", () => {
    httpWorkerState = null;
  });
  worker.postMessage({ port: port2 }, [port2]);
  const ready = Atomics.wait(signal, 1, 0, 5000);
  if (ready === "timed-out" || Atomics.load(signal, 1) !== 1) {
    try {
      worker.terminate();
    } catch {
      /* ignore */
    }
    throw new Error("http sync worker failed to start");
  }
  // CLI/짧은 스크립트가 idle worker 때문에 안 죽지 않게
  try {
    worker.unref();
  } catch {
    /* ignore */
  }
  httpWorkerState = { worker, port: port1, signal };
  return httpWorkerState;
}

function nodeHttpRequest(
  url: string,
  method: string = "GET",
  headers?: any,
  body?: string,
  timeoutMs: number = 10000
): HttpResult {
  try {
    const headersObj: Record<string, string> = {};
    if (headers && typeof headers === "object") {
      const entries =
        headers instanceof Map ? Array.from(headers.entries()) : Object.entries(headers);
      for (const [k, v] of entries) {
        headersObj[String(k)] = String(v);
      }
    }

    const { port, signal } = ensureHttpWorker();
    Atomics.store(signal, 0, 0);
    port.postMessage({
      url: String(url),
      method: String(method || "GET").toUpperCase(),
      headers: headersObj,
      body: body != null ? String(body) : null,
      timeoutMs,
    });
    const waitMs = Math.max(1, Number(timeoutMs) || 10000) + 2000;
    const wr = Atomics.wait(signal, 0, 0, waitMs);
    if (wr === "timed-out") {
      return { status: 0, body: "", error: "timeout" };
    }
    const msg = receiveMessageOnPort(port);
    if (!msg || !msg.message) {
      return { status: 0, body: "", error: "no response from http worker" };
    }
    const result = msg.message as HttpResult;
    return {
      status: result.status || 0,
      body: result.body || "",
      ...(result.error && { error: result.error }),
    };
  } catch (err: any) {
    return { status: 0, body: "", error: err.message };
  }
}

/** 테스트·측정용 */
export function __nodeHttpRequestForTest(
  url: string,
  method: string = "GET",
  headers?: any,
  body?: string,
  timeoutMs: number = 10000
): HttpResult {
  return nodeHttpRequest(url, method, headers, body, timeoutMs);
}


export function createHttpModule() {
  return {
    // http_get url -> {:status 200 :body "..."}
    "http_get": (url: string): any => {
      const result = nodeHttpRequest(url, "GET");
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post url body -> {:status 200 :body "..."}
    "http_post": (url: string, body: string): any => {
      // #15: body에 map/객체 직접 전달 시 힌트 (v12: 에러, v11: 자동 직렬화 + 경고)
      if (body !== null && typeof body === "object") {
        const hint = `http-post body에 map이 전달됐습니다.\n  v12 올바른 방식: (http-post url (json-stringify body))\n  v12에서는 자동 직렬화가 제거됩니다.`;
        if (process.env.FL_V12 === "1") throw new Error(`[v12] ${hint}`);
        console.warn(`⚠️  [FreeLang] ${hint}`);
        body = JSON.stringify(body);
      }
      const result = nodeHttpRequest(url, "POST",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post_form url body -> {:status 200 :body "..."}
    "http_post_form": (url: string, body: string): any => {
      const result = nodeHttpRequest(url, "POST",
        { "Content-Type": "application/x-www-form-urlencoded" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_get_bearer url token -> {:status 200 :body "..."}
    "http_get_bearer": (url: string, token: string): any => {
      const result = nodeHttpRequest(url, "GET",
        { "Authorization": `Bearer ${token}` });
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_get_bearer_json url token -> {:status 200 :data {...}}
    "http_get_bearer_json": (url: string, token: string): any => {
      const result = nodeHttpRequest(url, "GET",
        { "Authorization": `Bearer ${token}` });
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: JSON.parse(result.body) };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_put url body -> {:status 200 :body "..."}
    "http_put": (url: string, body: string): any => {
      const result = nodeHttpRequest(url, "PUT",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_patch url body -> {:status 200 :body "..."}
    "http_patch": (url: string, body: string): any => {
      const result = nodeHttpRequest(url, "PATCH",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_patch_json url data -> {:status 200 :data {...}}
    "http_patch_json": (url: string, data: any): any => {
      const body = JSON.stringify(data);
      const result = nodeHttpRequest(url, "PATCH",
        { "Content-Type": "application/json" }, body);
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_delete url -> {:status 200 :body "..."}
    "http_delete": (url: string): any => {
      const result = nodeHttpRequest(url, "DELETE");
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_delete_json url -> {:status 200 :data {...}}
    "http_delete_json": (url: string): any => {
      const result = nodeHttpRequest(url, "DELETE");
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: result.body ? JSON.parse(result.body) : null };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_head url -> {:status 200 :body ""}
    "http_head": (url: string): any => {
      const result = nodeHttpRequest(url, "HEAD");
      return {
        status: result.status,
        body: "",
        ...(result.error && { error: result.error })
      };
    },

    // http_get_key url api-key -> {:status 200 :body "..."}
    "http_get_key": (url: string, apiKey: string): any => {
      const result = nodeHttpRequest(url, "GET", { "X-API-Key": apiKey });
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post_key url body api-key -> {:status 200 :body "..."}
    "http_post_key": (url: string, body: string, apiKey: string): any => {
      const result = nodeHttpRequest(url, "POST",
        { "Content-Type": "application/json", "X-API-Key": apiKey }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_status url -> number (상태코드만)
    "http_status": (url: string): number => {
      const result = nodeHttpRequest(url, "GET");
      return result.status;
    },

    // http_json url -> {:status 200 :data {...} :error nil}
    "http_json": (url: string): any => {
      const result = nodeHttpRequest(url, "GET");
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: JSON.parse(result.body) };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_with_timeout url timeout -> {:status 200 :body "..."}
    "http_with_timeout": (url: string, timeout: number): any => {
      const ms = typeof timeout === "number" && timeout > 0 ? timeout : 10000;
      const result = nodeHttpRequest(url, "GET", undefined, undefined, ms);
      return { status: result.status, body: result.body, ...(result.error && { error: result.error }) };
    },

    // http_post_json url data -> {:status 200 :data {...}}
    "http_post_json": (url: string, data: any): any => {
      const body = JSON.stringify(data);
      const result = nodeHttpRequest(url, "POST",
        { "Content-Type": "application/json" }, body);
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_put_json url data -> {:status 200 :data {...}}
    "http_put_json": (url: string, data: any): any => {
      const body = JSON.stringify(data);
      const result = nodeHttpRequest(url, "PUT",
        { "Content-Type": "application/json" }, body);
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_request method url headers body -> {:status 200 :body "..."}
    "http_request": (method: string, url: string, headers: any, body: string): any => {
      const result = nodeHttpRequest(url, method, headers, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_request_timeout method url headers body timeout_ms -> {:status 200 :body "..." :error nil}
    // timeout_ms: 최대 대기 시간 (ms). 초과 시 status:0, error:"timeout" 반환
    "http_request_timeout": (method: string, url: string, headers: any, body: string, timeoutMs: number): any => {
      const ms = Number(timeoutMs) || 5000;
      const result = nodeHttpRequest(url, method, headers, body || undefined, ms);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_req_status method url headers body -> number
    "http_req_status": (method: string, url: string, headers: any, body: string): number => {
      const result = nodeHttpRequest(url, method, headers, body);
      return result.status;
    },

    // http_get_json url headers -> {:status 200 :data {...}}
    "http_get_json": (url: string, headers?: any): any => {
      const result = nodeHttpRequest(url, "GET", headers);
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_get_json_bearer url token -> {:status 200 :data {...}}
    "http_get_json_bearer": (url: string, token: string): any => {
      const result = nodeHttpRequest(url, "GET",
        { "Authorization": `Bearer ${token}` });
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_post_bearer url body token -> {:status 200 :body "..."}
    "http_post_bearer": (url: string, body: string, token: string): any =>
      nodeHttpRequest(url, "POST",
        { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body),

    // http_parallel requests -> [{:status N :body "..."}]
    // curl 없는 환경: sequential 실행 (FreeLang 단일스레드 제약)
    "http_parallel": (requests: any[]): any[] => {
      const getF = (obj: any, key: string): any => {
        if (!obj) return null;
        return obj instanceof Map ? obj.get(key) : (obj[key] ?? obj[":" + key] ?? null);
      };
      const normReqs: any[] = Array.isArray(requests) ? requests : [requests];
      return normReqs.map((req: any) => {
        const url    = String(getF(req, "url")    || getF(req, ":url")    || "");
        const method = String(getF(req, "method") || getF(req, ":method") || "GET").toUpperCase();
        const token  = getF(req, "token")  || getF(req, ":token");
        const body   = getF(req, "body")   || getF(req, ":body")   || "";
        const hdrs: Record<string, string> = {};
        if (token) hdrs["Authorization"] = `Bearer ${token}`;
        if (body)  hdrs["Content-Type"] = "application/json";
        return nodeHttpRequest(url, method, hdrs, body || undefined);
      });
    },

    // http_retry url token retries -> {:status 200 :body "..."}
    // GET with bearer token, retry up to N times on 5xx or network error (status 0)
    "http_retry": (url: string, token: string, retries: number = 3): any => {
      const maxRetries = Number(retries) || 3;
      let lastResult: any = { status: 0, body: "" };
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const result = nodeHttpRequest(url, "GET", { "Authorization": `Bearer ${token}` });
          lastResult = result;
          if (result.status >= 200 && result.status < 500) return result;
          // 5xx → retry
        } catch (err: any) {
          lastResult = { status: 0, body: "", error: err.message };
        }
        if (i < maxRetries) {
          const delay = 200 * (i + 1);
          const start = Date.now();
          while (Date.now() - start < delay) { /* spin wait */ }
        }
      }
      return lastResult;
    },

    // http_retry_post url body token retries -> {:status 200 :body "..."}
    "http_retry_post": (url: string, body: string, token: string, retries: number = 3): any => {
      const maxRetries = Number(retries) || 3;
      let lastResult: any = { status: 0, body: "" };
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const result = nodeHttpRequest(url, "POST",
            { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body);
          lastResult = result;
          if (result.status >= 200 && result.status < 500) return result;
        } catch (err: any) {
          lastResult = { status: 0, body: "", error: err.message };
        }
        if (i < maxRetries) {
          const delay = 200 * (i + 1);
          const start = Date.now();
          while (Date.now() - start < delay) { /* spin wait */ }
        }
      }
      return lastResult;
    },

    // is_http_success status -> boolean
    "is_http_success": (status: number): boolean => status >= 200 && status < 300,

    // is_http_redirect status -> boolean
    "is_http_redirect": (status: number): boolean => status >= 300 && status < 400,

    // is_http_error status -> boolean
    "is_http_error": (status: number): boolean => status >= 400,

    // http-get-data url -> parsed JSON data | nil  (#11 해결)
    // http_get_json의 {status,data} 구조 없이 data만 직접 반환
    "http-get-data": (url: string): any => {
      const result = nodeHttpRequest(url, "GET");
      if (!result.body) return null;
      try { return JSON.parse(result.body); } catch { return null; }
    },

    // http-post-data url data -> parsed JSON data | nil  (#12 해결)
    "http-post-data": (url: string, data: any): any => {
      const body = typeof data === "string" ? data : JSON.stringify(data);
      const result = nodeHttpRequest(url, "POST", { "Content-Type": "application/json" }, body);
      if (!result.body) return null;
      try { return JSON.parse(result.body); } catch { return null; }
    },

    // http-get-status url -> number  (#13 해결)
    // GET 요청 후 status 코드만 반환
    "http-get-status": (url: string): number => {
      const result = nodeHttpRequest(url, "GET");
      return result.status;
    },
  };
}
