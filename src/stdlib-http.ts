// FreeLang v11: HTTP Client Standard Library (Phase 5-2)
// 모든 http_* 함수는 구조체 반환: {:status 200 :body "..." :error nil}
// v11.6.1: curl spawnSync → Node.js fetch API (Zero-Dependency)

import { spawnSync } from "child_process";

// FL Map/Object → 일반 Record 변환
function headersToPlain(headers: any): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Map) return Object.fromEntries(headers.entries()) as Record<string, string>;
  return Object.assign({}, headers) as Record<string, string>;
}

// 단일 fetch 실행 스크립트 (stdin JSON → stdout JSON)
const FETCH_SCRIPT = `
const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{
const r=JSON.parse(Buffer.concat(c).toString());
const opts={method:r.method,headers:r.headers||{}};
if(r.body)opts.body=r.body;
const ac=new AbortController();
const t=setTimeout(()=>ac.abort(),r.timeout||10000);
fetch(r.url,{...opts,signal:ac.signal})
.then(async res=>{clearTimeout(t);const b=await res.text();process.stdout.write(JSON.stringify({status:res.status,body:b}));})
.catch(e=>{clearTimeout(t);process.stdout.write(JSON.stringify({status:0,body:'',error:e.message}));});
});
`;

// 병렬 fetch 실행 스크립트 (stdin JSON 배열 → stdout JSON 배열)
const FETCH_PARALLEL_SCRIPT = `
const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{
const reqs=JSON.parse(Buffer.concat(c).toString());
Promise.all(reqs.map(r=>{
const opts={method:r.method,headers:r.headers||{}};
if(r.body)opts.body=r.body;
const ac=new AbortController();
const t=setTimeout(()=>ac.abort(),r.timeout||10000);
return fetch(r.url,{...opts,signal:ac.signal})
.then(async res=>{clearTimeout(t);return{status:res.status,body:await res.text()};})
.catch(e=>{clearTimeout(t);return{status:0,body:'',error:e.message};});
})).then(results=>process.stdout.write(JSON.stringify(results)));
});
`;

// HEAD 전용: 특정 헤더 값 반환 스크립트
const FETCH_HEADER_SCRIPT = `
const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{
const r=JSON.parse(Buffer.concat(c).toString());
fetch(r.url,{method:'HEAD'})
.then(res=>{process.stdout.write(res.headers.get(r.header)||'');})
.catch(()=>process.stdout.write(''));
});
`;

function fetchSync(
  url: string,
  method: string = "GET",
  headers?: any,
  body?: string,
  timeout: number = 10000
): { status: number; body: string; error?: string } {
  const reqJson = JSON.stringify({ url, method, headers: headersToPlain(headers), body: body || null, timeout });
  const result = spawnSync(process.execPath, ["-e", FETCH_SCRIPT], {
    input: reqJson, timeout: timeout + 2000, encoding: "utf8"
  });
  if (result.error) return { status: 0, body: "", error: result.error.message };
  try {
    return JSON.parse(result.stdout || '{"status":0,"body":"","error":"no output"}');
  } catch (e: any) {
    return { status: 0, body: result.stdout || "", error: "json parse failed" };
  }
}

export function createHttpModule() {
  return {
    // http_get url -> {:status 200 :body "..."}
    "http_get": (url: string): any => {
      const result = fetchSync(url, "GET");
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post url body -> {:status 200 :body "..."}
    "http_post": (url: string, body: string): any => {
      const result = fetchSync(url, "POST",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post_form url body -> {:status 200 :body "..."}
    "http_post_form": (url: string, body: string): any => {
      const result = fetchSync(url, "POST",
        { "Content-Type": "application/x-www-form-urlencoded" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_get_bearer url token -> {:status 200 :body "..."}
    "http_get_bearer": (url: string, token: string): any => {
      const result = fetchSync(url, "GET",
        { "Authorization": `Bearer ${token}` });
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_put url body -> {:status 200 :body "..."}
    "http_put": (url: string, body: string): any => {
      const result = fetchSync(url, "PUT",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_patch url body -> {:status 200 :body "..."}
    "http_patch": (url: string, body: string): any => {
      const result = fetchSync(url, "PATCH",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_delete url -> {:status 200 :body "..."}
    "http_delete": (url: string): any => {
      const result = fetchSync(url, "DELETE");
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_head url -> {:status 200 :body ""}
    "http_head": (url: string): any => {
      const result = fetchSync(url, "HEAD");
      return {
        status: result.status,
        body: "",
        ...(result.error && { error: result.error })
      };
    },

    // http_get_key url api-key -> {:status 200 :body "..."}
    "http_get_key": (url: string, apiKey: string): any => {
      const result = fetchSync(url, "GET", { "X-API-Key": apiKey });
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post_key url body api-key -> {:status 200 :body "..."}
    "http_post_key": (url: string, body: string, apiKey: string): any => {
      const result = fetchSync(url, "POST",
        { "Content-Type": "application/json", "X-API-Key": apiKey }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_status url -> number (상태코드만)
    "http_status": (url: string): number => {
      const result = fetchSync(url, "GET");
      return result.status;
    },

    // http_json url -> {:status 200 :data {...} :error nil}
    "http_json": (url: string): any => {
      const result = fetchSync(url, "GET");
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: JSON.parse(result.body) };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_header url header -> string (특정 헤더 값만)
    "http_header": (url: string, header: string): string => {
      try {
        const reqJson = JSON.stringify({ url, header });
        const result = spawnSync(process.execPath, ["-e", FETCH_HEADER_SCRIPT], {
          input: reqJson, timeout: 12000, encoding: "utf8"
        });
        return result.stdout || "";
      } catch {
        return "";
      }
    },

    // http_with_timeout url timeout -> {:status 200 :body "..."}
    "http_with_timeout": (url: string, timeout: number): any =>
      fetchSync(url, "GET", undefined, undefined, timeout),

    // http_post_json url data -> {:status 200 :data {...}}
    "http_post_json": (url: string, data: any): any => {
      const body = JSON.stringify(data);
      const result = fetchSync(url, "POST",
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
      const result = fetchSync(url, "PUT",
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
      const result = fetchSync(url, method, headers, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_req_status method url headers body -> number
    "http_req_status": (method: string, url: string, headers: any, body: string): number => {
      const result = fetchSync(url, method, headers, body);
      return result.status;
    },

    // http_get_json url headers -> {:status 200 :data {...}}
    "http_get_json": (url: string, headers?: any): any => {
      const result = fetchSync(url, "GET", headers);
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
      const result = fetchSync(url, "GET",
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

    // http_get_bearer url token -> {:status 200 :body "..."}
    "http_get_bearer": (url: string, token: string): any =>
      fetchSync(url, "GET", { "Authorization": `Bearer ${token}` }),

    // http_post_bearer url body token -> {:status 200 :body "..."}
    "http_post_bearer": (url: string, body: string, token: string): any =>
      fetchSync(url, "POST",
        { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body),

    // http_parallel requests -> [{:status N :body "..."}]
    // requests: [{:url "..." :method "GET" :token "..." :body "..." :headers {...}}]
    // Node.js fetch Promise.all — 단일 프로세스에서 모든 요청 동시 실행
    "http_parallel": (requests: any[]): any[] => {
      const getF = (obj: any, key: string): any => {
        if (!obj) return null;
        return obj instanceof Map ? obj.get(key) : (obj[key] ?? obj[":" + key] ?? null);
      };
      const normReqs = Array.isArray(requests) ? requests : [requests];
      const fetchReqs = normReqs.map((req: any) => {
        const url    = String(getF(req, "url")    || "");
        const method = String(getF(req, "method") || "GET").toUpperCase();
        const token  = getF(req, "token");
        const body   = getF(req, "body") ? String(getF(req, "body")) : null;
        const extra  = headersToPlain(getF(req, "headers"));
        const headers: Record<string, string> = { ...extra };
        if (token) headers["Authorization"] = `Bearer ${String(token)}`;
        if (body)  headers["Content-Type"] = "application/json";
        return { url, method, headers, body };
      });
      const result = spawnSync(process.execPath, ["-e", FETCH_PARALLEL_SCRIPT], {
        input: JSON.stringify(fetchReqs), timeout: 30000, encoding: "utf8"
      });
      if (result.error) return normReqs.map(() => ({ status: 0, body: "", error: result.error!.message }));
      try {
        return JSON.parse(result.stdout || "[]");
      } catch {
        return normReqs.map(() => ({ status: 0, body: "" }));
      }
    },

    // http_retry url token retries -> {:status 200 :body "..."}
    // GET with bearer token, retry up to N times on 5xx or network error (status 0)
    "http_retry": (url: string, token: string, retries: number = 3): any => {
      const maxRetries = Number(retries) || 3;
      let lastResult: any = { status: 0, body: "" };
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const result = fetchSync(url, "GET", { "Authorization": `Bearer ${token}` });
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
          const result = fetchSync(url, "POST",
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
  };
}
