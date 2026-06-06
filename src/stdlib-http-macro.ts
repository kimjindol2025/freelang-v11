// FreeLang v11: HTTP Macro Standard Library
// Phase F-3: 1줄 JSON HTTP 호출 (코드 70% 감소)
//
// 기존: (http_post url (json-stringify {:key "val"})) → body 파싱 수동
// 신규: (http_json :post url {:key "val"}) → 자동 직렬화/역직렬화

import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";

function toSerializable(obj: any): any {
  if (obj instanceof Map) {
    const result: any = {};
    for (const [k, v] of obj) result[k] = toSerializable(v);
    return result;
  }
  if (Array.isArray(obj)) return obj.map(toSerializable);
  if (obj !== null && typeof obj === "object") {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) result[k] = toSerializable(v);
    return result;
  }
  return obj;
}

function toMap(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(toMap);
  if (typeof obj === "object") {
    const m = new Map<string, any>();
    for (const [k, v] of Object.entries(obj)) m.set(k, toMap(v));
    return m;
  }
  return obj;
}

function httpJSON(
  method: string,
  url: string,
  body?: any,
  extraHeaders?: Record<string, string>,
  timeoutMs: number = 30000
): Map<string, any> {
  const result = new Map<string, any>();

  try {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const bodyStr = body !== undefined && body !== null
      ? JSON.stringify(toSerializable(body))
      : undefined;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
        ...(extraHeaders ?? {}),
      } as Record<string, any>,
      timeout: timeoutMs,
    };

    // Node.js 동기 HTTP 요청 (child_process execFileSync 활용)
    const { execFileSync } = require("child_process");
    const nodeScript = `
const ${isHttps ? "https" : "http"} = require("${isHttps ? "https" : "http"}");
const options = ${JSON.stringify(options)};
${bodyStr ? `const body = ${JSON.stringify(bodyStr)};` : "const body = null;"}
let status = 0, data = "";
const req = ${isHttps ? "https" : "http"}.request(options, res => {
  status = res.statusCode;
  res.on("data", c => data += c);
  res.on("end", () => process.stdout.write(JSON.stringify({status, data})));
});
req.on("error", e => process.stdout.write(JSON.stringify({status: 0, data: "", error: e.message})));
req.setTimeout(${timeoutMs}, () => { req.destroy(); });
if (body) req.write(body);
req.end();
`;
    const out = execFileSync(process.execPath, ["-e", nodeScript], {
      timeout: timeoutMs + 2000,
      encoding: "utf8",
    });

    const res = JSON.parse(out);
    const status = res.status ?? 0;
    let parsedBody: any = null;
    try { parsedBody = toMap(JSON.parse(res.data)); } catch { parsedBody = res.data || null; }

    result.set("ok", status >= 200 && status < 300);
    result.set("status", status);
    result.set("body", parsedBody);
    result.set("raw", res.data ?? "");
    if (res.error) result.set("error", res.error);
    else if (status < 200 || status >= 300) result.set("error", `HTTP ${status}`);

  } catch (e: any) {
    result.set("ok", false);
    result.set("status", 0);
    result.set("error", e.message);
    result.set("body", null);
  }

  return result;
}

export function createHttpMacroModule() {
  return {
    // http_json method url body? headers? -> {ok, status, body}
    // (http_json "get" "https://api.example.com/data")
    // (http_json "post" "https://..." {:key "value"})
    // (http_json "post" "https://..." {:key "v"} {"Authorization" "Bearer token"})
    "http_json": (method: string, url: string, body?: any, headers?: any): Map<string, any> => {
      const hdrs: Record<string, string> = {};
      if (headers instanceof Map) {
        for (const [k, v] of headers) hdrs[String(k)] = String(v);
      } else if (headers && typeof headers === "object") {
        for (const [k, v] of Object.entries(headers)) hdrs[String(k)] = String(v);
      }
      return httpJSON(method, url, body, hdrs);
    },

    // http_get_json url headers? -> {ok, status, body}
    "http_get_json": (url: string, headers?: any): Map<string, any> => {
      const hdrs: Record<string, string> = {};
      if (headers instanceof Map) {
        for (const [k, v] of headers) hdrs[String(k)] = String(v);
      }
      return httpJSON("GET", url, undefined, hdrs);
    },

    // http_post_json url body headers? -> {ok, status, body}
    "http_post_json": (url: string, body: any, headers?: any): Map<string, any> => {
      const hdrs: Record<string, string> = {};
      if (headers instanceof Map) {
        for (const [k, v] of headers) hdrs[String(k)] = String(v);
      }
      return httpJSON("POST", url, body, hdrs);
    },

    // http_batch requests -> [결과1, 결과2, ...]  (순차 — worker_threads 없이)
    // requests: [{method, url, body?, headers?}, ...]
    "http_batch": (requests: any[]): any[] => {
      const reqs = Array.isArray(requests) ? requests : [];
      return reqs.map((req: any) => {
        const r = req instanceof Map ? req : new Map(Object.entries(req));
        const method = String(r.get("method") ?? "GET");
        const url = String(r.get("url") ?? "");
        const body = r.get("body");
        const hdrs: Record<string, string> = {};
        const h = r.get("headers");
        if (h instanceof Map) for (const [k, v] of h) hdrs[String(k)] = String(v);
        return httpJSON(method, url, body, hdrs);
      });
    },

    // http_ok? result -> boolean
    "http_ok?": (result: any): boolean => {
      if (result instanceof Map) return result.get("ok") === true;
      return false;
    },

    // http_body result -> parsed body or null
    "http_body": (result: any): any => {
      if (result instanceof Map) return result.get("body") ?? null;
      return null;
    },

    // http_status result -> number
    "http_status": (result: any): number => {
      if (result instanceof Map) return result.get("status") ?? 0;
      return 0;
    },
  };
}
