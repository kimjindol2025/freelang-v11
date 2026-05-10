// FreeLang v11: HTTP Client Standard Library (Phase 5-2)
// 모든 http_* 함수는 구조체 반환: {:status 200 :body "..." :error nil}
// curl 제거 → Node.js 네이티브 http/https (INFRA-BLOCKING-001)

import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";

function nodeHttpRequest(url: string, method: string = "GET", headers?: any, body?: string): { status: number; body: string; error?: string } {
  let tmpFile: string | null = null;
  try {
    const headersObj: Record<string, string> = {};
    if (headers && typeof headers === "object") {
      const entries = headers instanceof Map
        ? Array.from(headers.entries())
        : Object.entries(headers);
      for (const [k, v] of entries) {
        headersObj[String(k)] = String(v);
      }
    }

    tmpFile = `/tmp/fl-http-${randomUUID()}.js`;
    const encodedUrl = JSON.stringify(url);
    const encodedMethod = JSON.stringify(method.toUpperCase());
    const encodedHeaders = JSON.stringify(headersObj);
    const encodedBody = body ? JSON.stringify(body) : "null";

    const script = `
const {URL}=require('url');
const u=new URL(${encodedUrl});
const mod=u.protocol==='https:'?require('https'):require('http');
const method=${encodedMethod};
const hdrs=${encodedHeaders};
const bodyStr=${encodedBody};
const opts={hostname:u.hostname,port:u.port||undefined,path:u.pathname+(u.search||''),method,headers:hdrs};
if(bodyStr!=null)opts.headers['Content-Length']=Buffer.byteLength(bodyStr,'utf-8');
const chunks=[];
const req=mod.request(opts,res=>{
  res.on('data',d=>chunks.push(d));
  res.on('end',()=>{process.stdout.write(JSON.stringify({s:res.statusCode,b:Buffer.concat(chunks).toString('utf-8')}))});
});
req.on('error',e=>process.stdout.write(JSON.stringify({s:0,b:'',e:e.message})));
req.setTimeout(10000,()=>{req.destroy();process.stdout.write(JSON.stringify({s:0,b:'',e:'timeout'}))});
if(bodyStr!=null)req.write(bodyStr,'utf-8');
req.end();`;

    writeFileSync(tmpFile, script, "utf-8");
    const result = execSync(`node ${tmpFile}`, { encoding: "utf-8", timeout: 15000 });
    const parsed = JSON.parse(result);
    return { status: parsed.s || 0, body: parsed.b || "" };
  } catch (err: any) {
    return { status: 0, body: "", error: err.message };
  } finally {
    if (tmpFile) { try { unlinkSync(tmpFile); } catch {} }
  }
}

// 하위 호환 alias
const curlGetStatusAndBody = nodeHttpRequest;

export function createHttpModule() {
  return {
    // http_get url -> {:status 200 :body "..."}
    "http_get": (url: string): any => {
      const result = curlGetStatusAndBody(url, "GET");
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post url body -> {:status 200 :body "..."}
    "http_post": (url: string, body: string): any => {
      const result = curlGetStatusAndBody(url, "POST",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post_form url body -> {:status 200 :body "..."}
    "http_post_form": (url: string, body: string): any => {
      const result = curlGetStatusAndBody(url, "POST",
        { "Content-Type": "application/x-www-form-urlencoded" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_get_bearer url token -> {:status 200 :body "..."}
    "http_get_bearer": (url: string, token: string): any => {
      const result = curlGetStatusAndBody(url, "GET",
        { "Authorization": `Bearer ${token}` });
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_put url body -> {:status 200 :body "..."}
    "http_put": (url: string, body: string): any => {
      const result = curlGetStatusAndBody(url, "PUT",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_patch url body -> {:status 200 :body "..."}
    "http_patch": (url: string, body: string): any => {
      const result = curlGetStatusAndBody(url, "PATCH",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_delete url -> {:status 200 :body "..."}
    "http_delete": (url: string): any => {
      const result = curlGetStatusAndBody(url, "DELETE");
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_head url -> {:status 200 :body ""}
    "http_head": (url: string): any => {
      const result = curlGetStatusAndBody(url, "HEAD");
      return {
        status: result.status,
        body: "",
        ...(result.error && { error: result.error })
      };
    },

    // http_get_key url api-key -> {:status 200 :body "..."}
    "http_get_key": (url: string, apiKey: string): any => {
      const result = curlGetStatusAndBody(url, "GET", { "X-API-Key": apiKey });
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post_key url body api-key -> {:status 200 :body "..."}
    "http_post_key": (url: string, body: string, apiKey: string): any => {
      const result = curlGetStatusAndBody(url, "POST",
        { "Content-Type": "application/json", "X-API-Key": apiKey }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_status url -> number (상태코드만)
    "http_status": (url: string): number => {
      const result = curlGetStatusAndBody(url, "GET");
      return result.status;
    },

    // http_json url -> {:status 200 :data {...} :error nil}
    "http_json": (url: string): any => {
      const result = curlGetStatusAndBody(url, "GET");
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: JSON.parse(result.body) };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_header url header -> string (특정 헤더만)
    "http_header": (url: string, header: string): string => {
      try {
        const result = nodeHttpRequest(url, "HEAD");
        return result.error ? "" : "";
      } catch (err) {
        return "";
      }
    },

    // http_with_timeout url timeout -> {:status 200 :body "..."}
    "http_with_timeout": (url: string, timeout: number): any => {
      const result = nodeHttpRequest(url, "GET");
      return { status: result.status, body: result.body };
    },

    // http_post_json url data -> {:status 200 :data {...}}
    "http_post_json": (url: string, data: any): any => {
      const body = JSON.stringify(data);
      const result = curlGetStatusAndBody(url, "POST",
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
      const result = curlGetStatusAndBody(url, "PUT",
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
      const result = curlGetStatusAndBody(url, method, headers, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_req_status method url headers body -> number
    "http_req_status": (method: string, url: string, headers: any, body: string): number => {
      const result = curlGetStatusAndBody(url, method, headers, body);
      return result.status;
    },

    // http_get_json url headers -> {:status 200 :data {...}}
    "http_get_json": (url: string, headers?: any): any => {
      const result = curlGetStatusAndBody(url, "GET", headers);
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
      const result = curlGetStatusAndBody(url, "GET",
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
      curlGetStatusAndBody(url, "POST",
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
          const result = curlGetStatusAndBody(url, "GET", { "Authorization": `Bearer ${token}` });
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
          const result = curlGetStatusAndBody(url, "POST",
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
