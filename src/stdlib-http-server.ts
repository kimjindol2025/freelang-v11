// FreeLang v9: Pure HTTP Server (Express-free)
// Phase 4a: v9 순수 HTTP 서버 구현 (의존성 제거)
// Node.js http 모듈만 사용

import * as http from "http";
import * as url from "url";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Global registry for hot-reload: tracks the currently active HTTP server
// across Interpreter instances (each createHttpServerModule() creates a new
// closure, but this registry persists in the Node.js process).
export const __activeServer: { server: http.Server | null } = { server: null };

// WebSocket (Node.js v25 native via stdlib-ws.ts)
// RFC 6455 핸드셰이크는 아래 server.on('upgrade') 에서 처리
const WS_OPEN = 1;
const WS_CLOSING = 2;

type CallFn = (name: string, args: any[]) => any;
type CallFunctionValue = (fnValue: any, args: any[]) => any;
type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

interface Route {
  method: string;
  path: string;
  pattern: RegExp;
  params: string[];
  handler: string | any;  // string (function name) or function-value object
}

interface Request {
  __fl_request: true;
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[]>;
  // v11.1: body is auto-parsed JSON (object) when Content-Type: application/json,
  //        otherwise raw string (or undefined)
  body?: string | any;
  params: Record<string, string>;
  request_id?: string;
  timestamp?: number;
}

/**
 * Create pure HTTP server for FreeLang v9 (no Express)
 */
export function createHttpServerModule(callFn: CallFn, callFunctionValue?: CallFunctionValue) {
  const routes: Route[] = [];
  // server_use 미들웨어: [{pattern, handler}] — 라우트 핸들러 실행 전에 순서대로 실행
  // handler가 null/undefined 반환하면 통과, 응답 객체 반환하면 즉시 응답
  const middlewares: Array<{ pattern: RegExp; handler: string | any }> = [];
  let server: http.Server | null = null;
  let requestCounter = 0;

  // Phase 57: 비동기 응답 보류용 저장소
  const pendingResponses = new Map<string, http.ServerResponse>();
  let currentRequestId: string | null = null;

  // WebSocket 공개 클라이언트 (터널 WS 프록시용)
  const wsPublicMap = new Map<string, WebSocket>();
  let upgradeHandler: string | null = null;
  let wsClientMessageHandler: string | null = null;
  let wsClientCloseHandler: string | null = null;
  let wssPublic: WebSocketServer | null = null;

  // Request ID 생성
  function generateRequestId(): string {
    const timestamp = Date.now();
    const counter = ++requestCounter;
    return `req_${timestamp}_${counter}`;
  }

  // Access log 출력
  function logAccess(method: string, path: string, status: number, duration: number, requestId: string): void {
    const icon = status >= 400 ? "❌" : "✅";
    console.log(`${icon} [${requestId}] ${method} ${path} ${status} ${duration}ms`);
  }

  // URL 경로를 정규표현식으로 변환 (예: /users/:id → /users/(.+), /* → /.*))
  function pathToRegex(path: string): [RegExp, string[]] {
    const params: string[] = [];
    const pattern = path
      .replace(/\//g, "\\/")
      .replace(/\*/g, ".*")
      .replace(/:(\w+)/g, (_, param) => {
        params.push(param);
        return "([^\\/]+)";
      });
    return [new RegExp(`^${pattern}$`), params];
  }

  // 요청 파싱
  function parseUrl(urlStr: string): { path: string; query: Record<string, string | string[]> } {
    const parsed = url.parse(urlStr, true);
    return {
      path: parsed.pathname || "/",
      query: parsed.query as Record<string, string | string[]>,
    };
  }

  // 요청 본문 읽기 (multipart/form-data 포함)
  async function readBody(req: http.IncomingMessage): Promise<string | any> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const raw = Buffer.concat(chunks);
        const ct = (req.headers["content-type"] || "").toString();

        if (ct.includes("application/json")) {
          try { resolve(JSON.parse(raw.toString())); return; } catch { /* fall through */ }
        }

        if (ct.includes("multipart/form-data")) {
          try { resolve(parseMultipart(raw, ct)); return; } catch { /* fall through */ }
        }

        if (ct.includes("application/x-www-form-urlencoded")) {
          try {
            const params: Record<string, string> = {};
            new url.URLSearchParams(raw.toString()).forEach((v, k) => { params[k] = v; });
            resolve(params);
            return;
          } catch { /* fall through */ }
        }

        resolve(raw.toString());
      });
    });
  }

  // multipart/form-data 파서 — 파일은 /tmp/fl-uploads/ 에 저장
  function parseMultipart(raw: Buffer, contentType: string): any {
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) return {};

    const boundary = boundaryMatch[1];
    const delimiter = Buffer.from("\r\n--" + boundary);
    const fields: Record<string, string> = {};
    const files: any[] = [];

    const uploadDir = path.join(os.tmpdir(), "fl-uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // 파트 분리
    const start = Buffer.from("--" + boundary + "\r\n");
    let pos = raw.indexOf(start);
    if (pos < 0) return { fields, files };
    pos += start.length;

    while (pos < raw.length) {
      const next = raw.indexOf(delimiter, pos);
      const partEnd = next < 0 ? raw.length : next;
      const part = raw.slice(pos, partEnd);

      // 헤더/바디 분리 (\r\n\r\n)
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;

      const headerStr = part.slice(0, headerEnd).toString();
      const bodyBuf = part.slice(headerEnd + 4);

      // Content-Disposition 파싱
      const dispMatch = headerStr.match(/Content-Disposition:[^\n]*?;\s*name="([^"]+)"(?:[^\n]*?filename="([^"]+)")?/i);
      if (!dispMatch) { pos = partEnd + delimiter.length + 2; continue; }

      const fieldName = dispMatch[1];
      const fileName = dispMatch[2];

      if (fileName) {
        // 파일 파트
        const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
        const mimetype = ctMatch ? ctMatch[1].trim() : "application/octet-stream";
        const ext = path.extname(fileName) || "";
        const savedName = crypto.randomBytes(8).toString("hex") + ext;
        const savedPath = path.join(uploadDir, savedName);
        fs.writeFileSync(savedPath, bodyBuf);

        const m = new Map<string, any>();
        m.set("fieldname", fieldName);
        m.set("originalname", fileName);
        m.set("mimetype", mimetype);
        m.set("size", bodyBuf.length);
        m.set("path", savedPath);
        m.set("filename", savedName);
        files.push(m);
      } else {
        // 일반 필드
        fields[fieldName] = bodyBuf.toString().replace(/\r\n$/, "");
      }

      if (next < 0) break;
      pos = next + delimiter.length;
      if (raw.slice(pos, pos + 2).toString() === "--") break; // 종료 경계
      pos += 2; // \r\n 건너뜀
    }

    const result = new Map<string, any>();
    const fieldsMap = new Map<string, string>();
    Object.entries(fields).forEach(([k, v]) => fieldsMap.set(k, v));
    result.set("fields", fieldsMap);
    result.set("files", files);
    return result;
  }

  // 응답 작성 (extraHeaders: 터널 응답 헤더 전달용)
  function sendResponse(
    res: http.ServerResponse,
    status: number,
    body: any,
    contentType: string = "application/json",
    extraHeaders?: Record<string, string>
  ) {
    const headersToWrite: Record<string, string | string[]> = { "Content-Type": contentType };
    if (extraHeaders) {
      // hop-by-hop 헤더 제외 (프록시에서 전달 불가)
      const hopByHop = new Set([
        'connection', 'keep-alive', 'transfer-encoding', 'te',
        'trailer', 'proxy-authorization', 'proxy-authenticate',
        'upgrade', 'content-encoding'
      ]);
      for (const [k, v] of Object.entries(extraHeaders)) {
        if (!hopByHop.has(k.toLowerCase())) {
          headersToWrite[k] = v;
        }
      }
    }
    res.writeHead(status, headersToWrite);
    if (typeof body === 'string') {
      res.end(body);
    } else if (Buffer.isBuffer(body)) {
      res.end(body);
    } else if (contentType.includes("json") && typeof body === 'object') {
      // FreeLang Map 객체 자동 직렬화 (server_json {:key val} 패턴 지원)
      res.end(JSON.stringify(body, (_k, v) =>
        v instanceof Map ? Object.fromEntries(v) :
        Array.isArray(v) ? v : v
      ));
    } else {
      res.end(String(body ?? ""));
    }
  }

  // v9 요청 객체 생성
  function createFlRequest(
    method: string,
    path: string,
    query: Record<string, any>,
    headers: Record<string, any>,
    body: string,
    params: Record<string, string>,
    requestId?: string
  ): Request {
    return {
      __fl_request: true,
      method,
      path,
      query,
      headers,
      body: body || undefined,
      params,
      request_id: requestId,
      timestamp: Date.now(),
    };
  }

  // ── Rate Limiting (IP 기반 슬라이딩 윈도우) ─────────────────────────────
  const rlStore = new Map<string, { count: number; resetAt: number }>();
  let rlMax = 100;        // 윈도우당 최대 요청 수
  let rlWindowMs = 60000; // 윈도우 크기 (ms)

  function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    let entry = rlStore.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + rlWindowMs };
      rlStore.set(ip, entry);
      return true;
    }
    entry.count++;
    return entry.count <= rlMax;
  }

  // 오래된 항목 정리 (5분마다)
  setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of rlStore) {
      if (now > e.resetAt + rlWindowMs) rlStore.delete(ip);
    }
  }, 300000).unref();

  return {
    // server_use path middlewareName — 경로 패턴 매칭 시 미들웨어 실행
    // handler가 null/undefined 반환 → 다음 미들웨어/라우트 진행
    // handler가 응답 객체 반환 → 즉시 응답 (라우트 실행 안 함)
    "server_use": (path: string, handlerName: string | any): null => {
      const [pattern] = pathToRegex(path);
      middlewares.push({ pattern, handler: handlerName });
      return null;
    },

    // server_rate_limit max window_ms → null  (e.g. 100req/60s)
    "server_rate_limit": (max: number, windowMs: number): null => {
      rlMax = Math.max(1, Math.floor(max));
      rlWindowMs = Math.max(1000, Math.floor(windowMs));
      return null;
    },

    // server_get path handlerName -> null
    "server_get": (path: string, handlerName: string | any): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "GET", path, pattern, params, handler: handlerName });
      return null;
    },

    // server_post path handlerName -> null
    "server_post": (path: string, handlerName: string | any): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "POST", path, pattern, params, handler: handlerName });
      return null;
    },

    // server_put path handlerName -> null
    "server_put": (path: string, handlerName: string | any): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "PUT", path, pattern, params, handler: handlerName });
      return null;
    },

    // server_patch path handlerName -> null
    "server_patch": (path: string, handlerName: string | any): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "PATCH", path, pattern, params, handler: handlerName });
      return null;
    },

    // server_delete path handlerName -> null
    "server_delete": (path: string, handlerName: string | any): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "DELETE", path, pattern, params, handler: handlerName });
      return null;
    },

    // route method path handler → 메서드 문자열로 등록
    // (route "GET"    "/api/x" handler-fn)
    // (route "POST"   "/api/x" handler-fn)
    "route": (method: string, path: string, handlerName: string | any): null => {
      const m = String(method).toUpperCase();
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: m, path, pattern, params, handler: handlerName });
      return null;
    },

    // server_all path handler → 모든 메서드 등록 (catch-all)
    "server_all": (path: string, handlerName: string | any): null => {
      const [pattern, params] = pathToRegex(path);
      for (const m of ["GET","POST","PUT","PATCH","DELETE"]) {
        routes.push({ method: m, path, pattern, params, handler: handlerName });
      }
      return null;
    },

    // server_start port -> string
    "server_start": (port: number): string => {
      // Hot-reload: close previous server before starting new one
      if (__activeServer.server) {
        try {
          __activeServer.server.close();
        } catch (_e) { /* ignore */ }
        __activeServer.server = null;
      }
      server = http.createServer(async (req, res) => {
          const requestStart = Date.now();
          const requestId = generateRequestId();
          currentRequestId = requestId;  // Phase 57: 현재 요청 ID 저장
          const method = req.method || "GET";
          const { path, query } = parseUrl(req.url || "/");
          const headers = req.headers;
          const body = await readBody(req);

          // CORS
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
          res.setHeader("X-Request-Id", requestId);
          // 보안 헤더
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("X-Frame-Options", "SAMEORIGIN");
          res.setHeader("X-XSS-Protection", "1; mode=block");
          res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
          res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

          if (method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
          }

          // Rate Limiting
          const clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
          if (!checkRateLimit(clientIp)) {
            res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rlWindowMs / 1000)) });
            res.end(JSON.stringify({ error: "Too Many Requests", retry_after: Math.ceil(rlWindowMs / 1000) }));
            return;
          }

          // Dev mode: /__hot SSE endpoint for browser hot-reload
          // Client connects, keeps open; when server restarts the connection
          // drops and EventSource auto-reconnects → onopen fires → reload().
          if (process.env.FL_DEV === "1" && path === "/__hot" && method === "GET") {
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
              "X-Accel-Buffering": "no",
            });
            res.write("retry: 400\n\n");
            // Keep connection open until client disconnects or server restarts
            return;
          }

          // 미들웨어 실행 — 경로 매칭 시 핸들러 호출, 응답 반환 시 즉시 응답
          const baseReq = createFlRequest(method, path, query, headers, body, {}, requestId);
          for (const mw of middlewares) {
            if (!mw.pattern.exec(path)) continue;
            try {
              let mwResult;
              if (typeof mw.handler === "string") {
                mwResult = callFn(mw.handler, [baseReq]);
              } else if (mw.handler?.kind === "function-value" && callFunctionValue) {
                mwResult = callFunctionValue(mw.handler, [baseReq]);
              }
              if (mwResult instanceof Promise) mwResult = await mwResult;
              // null/undefined → 통과, 응답 객체 → 즉시 전송
              if (mwResult !== null && mwResult !== undefined) {
                // server_status()/server_json() 반환 객체: { __fl_response, status, body, contentType }
                const mwStatus = mwResult.status ?? (mwResult.__fl_status ?? 200);
                const headersObj: Record<string, string> = {};
                if (mwResult.__fl_headers) Object.assign(headersObj, mwResult.__fl_headers);
                const mwBody = mwResult.__fl_response
                  ? (typeof mwResult.body === "object" ? JSON.stringify(mwResult.body) : String(mwResult.body ?? ""))
                  : (typeof mwResult === "object" ? JSON.stringify(mwResult) : String(mwResult));
                const mwCT = mwResult.contentType ?? "application/json";
                sendResponse(res, mwStatus, mwBody, mwCT, headersObj);
                logAccess(method, path, mwStatus, Date.now() - requestStart, requestId);
                return;
              }
            } catch (mwErr: any) {
              sendResponse(res, 500, JSON.stringify({ error: mwErr.message ?? "middleware error" }));
              return;
            }
          }

          // 라우트 매칭
          let matched = false;
          for (const route of routes) {
            if (route.method !== method) continue;

            const match = route.pattern.exec(path);
            if (!match) continue;

            matched = true;
            let status = 200;
            try {
              // 경로 파라미터 추출
              const params: Record<string, string> = {};
              for (let i = 0; i < route.params.length; i++) {
                params[route.params[i]] = match[i + 1];
              }

              // v9 요청 객체 생성 (request_id 포함)
              const flReq = createFlRequest(method, path, query, headers, body, params, requestId);

              // 핸들러 호출 (Phase 57: Promise 지원 + 람다 함수 지원)
              let rawResult;
              if (typeof route.handler === 'string') {
                // 함수 이름 (문자열) → callFn으로 호출
                rawResult = callFn(route.handler, [flReq]);
              } else if (route.handler && route.handler.kind === 'function-value' && callFunctionValue) {
                // v9 람다 함수 (function-value 객체) → callFunctionValue로 호출
                rawResult = callFunctionValue(route.handler, [flReq]);
              } else {
                throw new Error(`Invalid handler: expected string or function-value, got ${typeof route.handler}`);
              }
              const result = (rawResult instanceof Promise) ? await rawResult : rawResult;

              // 응답 처리 (응답 보류 중이면 skip)
              if (pendingResponses.has(requestId)) {
                pendingResponses.delete(requestId);
              } else if (result && typeof result === "object" && result.__fl_wait_and_respond === true) {
                // Phase 57+: 비동기 응답 대기 (Promise 처리)
                const asyncResp = await result.promise;
                if (!asyncResp) {
                  sendResponse(res, 504, { error: "Gateway Timeout" });
                } else {
                  status = asyncResp.status ?? 200;
                  // encoding: 'base64'이면 binary body 디코딩
                  let respBody = asyncResp.body ?? "";
                  let contentType = asyncResp.contentType ?? "application/json";
                  const extraHeaders = asyncResp.headers ?? {};
                  if (asyncResp.encoding === 'base64' && typeof respBody === 'string') {
                    const buf = Buffer.from(respBody, 'base64');
                    // Content-Type은 에이전트가 준 것 우선
                    if (extraHeaders['content-type']) {
                      contentType = extraHeaders['content-type'] as string;
                    }
                    sendResponse(res, status, buf, contentType, extraHeaders);
                  } else {
                    if (extraHeaders['content-type']) {
                      contentType = extraHeaders['content-type'] as string;
                    }
                    sendResponse(res, status, respBody, contentType, extraHeaders);
                  }
                }
              } else {
                if (result && typeof result === "object") {
                  const getField = (obj: any, key: string) =>
                    obj instanceof Map ? (obj.get(key) ?? obj.get(":" + key)) : obj[key];
                  const resStatus = getField(result, "status");
                  const resBody = getField(result, "body");
                  if (result.__fl_response === true || (resStatus !== undefined && resBody !== undefined)) {
                    status = resStatus ?? 200;
                    const resHeaders = getField(result, "headers") ?? {};
                    const headersObj = resHeaders instanceof Map ? Object.fromEntries(resHeaders) : resHeaders;
                    const contentType = headersObj["content-type"] ?? getField(result, "contentType") ?? "application/json";
                    sendResponse(res, status, resBody ?? "", contentType, headersObj);
                  } else {
                    sendResponse(res, 200, result);
                  }
                } else {
                  sendResponse(res, 200, result ?? "");
                }
              }

              // Access log
              const duration = Date.now() - requestStart;
              logAccess(method, path, status, duration, requestId);
            } catch (err: any) {
              const status = 500;
              sendResponse(res, status, { error: err.message });
              const duration = Date.now() - requestStart;
              logAccess(method, path, status, duration, requestId);
            }
            return;
          }

          // 404
          if (!matched) {
            const status = 404;
            sendResponse(res, status, { error: "Not Found", path });
            const duration = Date.now() - requestStart;
            logAccess(method, path, status, duration, requestId);
          }
        });

      // WebSocket upgrade 지원 (RFC 6455 직접 구현)
      server.on('upgrade', (req, socket, head) => {
        if (!upgradeHandler) {
          socket.destroy();
          return;
        }

        // RFC 6455 핸드셰이크
        const key = (req.headers as any)['sec-websocket-key'];
        if (!key) {
          socket.destroy();
          return;
        }

        const accept = crypto.createHash('sha1')
          .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
          .digest('base64');

        socket.write([
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          'Sec-WebSocket-Accept: ' + accept,
          '', ''
        ].join('\r\n'));

        const sessionId = 'wsc-' + crypto.randomBytes(8).toString('hex');
        wsPublicMap.set(sessionId, socket as any);

        let buf = Buffer.alloc(0);

        socket.on('data', async (chunk: Buffer) => {
          buf = Buffer.concat([buf, chunk]);

          // RFC 6455 프레임 파싱 (간단한 구현)
          while (buf.length >= 2) {
            const fin = (buf[0] & 0x80) !== 0;
            const opcode = buf[0] & 0x0f;
            const masked = (buf[1] & 0x80) !== 0;
            let payloadLen = buf[1] & 0x7f;
            let hdrLen = 2;

            if (payloadLen === 126) {
              if (buf.length < 4) break;
              payloadLen = buf.readUInt16BE(2);
              hdrLen = 4;
            } else if (payloadLen === 127) {
              if (buf.length < 10) break;
              payloadLen = Number(buf.readBigUInt64BE(2));
              hdrLen = 10;
            }

            if (masked) hdrLen += 4;
            if (buf.length < hdrLen + payloadLen) break;

            let maskKey: Buffer | null = null;
            if (masked) maskKey = buf.slice(hdrLen - 4, hdrLen);

            const payload = Buffer.from(buf.slice(hdrLen, hdrLen + payloadLen));
            if (maskKey) {
              for (let i = 0; i < payload.length; i++) {
                payload[i] ^= maskKey[i % 4];
              }
            }

            if (opcode === 8) { // CLOSE
              wsPublicMap.delete(sessionId);
              if (wsClientCloseHandler) {
                try { await callFn(wsClientCloseHandler, [sessionId, 1000]); } catch {}
              }
              socket.end();
              return;
            }

            if (opcode === 9) { // PING
              socket.write(Buffer.from([0x8a, 0x00]));
            } else if (opcode === 0x01 || opcode === 0x02) { // TEXT or BINARY
              if (wsClientMessageHandler) {
                const isBinary = opcode === 0x02;
                const data = isBinary ? payload.toString('base64') : payload.toString('utf8');
                try {
                  await callFn(wsClientMessageHandler, [sessionId, data, isBinary]);
                } catch {}
              }
            }

            buf = buf.slice(hdrLen + payloadLen);
          }
        });

        socket.on('close', async () => {
          wsPublicMap.delete(sessionId);
          if (wsClientCloseHandler) {
            try { await callFn(wsClientCloseHandler, [sessionId, 1006]); } catch {}
          }
        });

        socket.on('error', () => { wsPublicMap.delete(sessionId); });

        // FreeLang upgrade 핸들러 호출
        const _wsUrl = new URL(req.url || '/', 'http://localhost');
        const _wsQuery: Record<string, string> = {};
        _wsUrl.searchParams.forEach((v, k) => { _wsQuery[k] = v; });
        const upgradeReq = {
          __fl_request: true,
          method: 'WS_UPGRADE',
          path: req.url || '/',
          headers: req.headers,
          query: _wsQuery,
          body: '',
          params: {},
          session_id: sessionId,
        };
        callFn(upgradeHandler!, [upgradeReq]);
      });

      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`[server] 포트 ${port} 이미 사용 중 — 서버 시작 건너뜀`);
        } else {
          console.error(`[server] 서버 오류: ${err.message}`);
        }
      });
      server.listen(port);
      __activeServer.server = server;
      // Keep process alive while server is running
      setInterval(() => {}, 10000).unref();
      return `server listening on :${port}`;
    },

    // server_stop -> null
    "server_stop": (): null => {
      if (server) {
        server.close();
        server = null;
      }
      return null;
    },

    // server_json [status] obj -> response object
    // (server_json data)        → 200 JSON
    // (server_json 201 data)    → 201 JSON
    "server_json": (statusOrBody: any, maybeBody?: any): Record<string, any> => {
      const isStatus = typeof statusOrBody === "number" && statusOrBody >= 100 && statusOrBody < 600;
      return {
        __fl_response: true,
        status: isStatus ? statusOrBody : 200,
        contentType: "application/json",
        body: isStatus ? maybeBody : statusOrBody,
      };
    },

    // server_text text -> response object
    "server_text": (body: string): Record<string, any> => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "text/plain",
        body,
      };
    },

    // server_status code body -> response object
    "server_status": (code: any, body: any): Record<string, any> => {
      return {
        __fl_response: true,
        status: Number(code),
        contentType: "application/json",
        body,
      };
    },

    // server_html body -> response object (text/html)
    // In dev mode (FL_DEV=1), injects hot-reload script before </body>
    // so browsers auto-refresh when the FreeLang source file changes.
    "server_html": (body: string): Record<string, any> => {
      let finalBody = body;
      if (process.env.FL_DEV === "1" && typeof finalBody === "string") {
        const script = `<script>(function(){let w=false;function c(){const e=new EventSource('/__hot');e.onopen=function(){if(w)location.reload();w=true;};e.onerror=function(){e.close();setTimeout(c,400);};}c();})();</script>`;
        if (finalBody.includes("</body>")) {
          finalBody = finalBody.replace("</body>", script + "</body>");
        } else {
          finalBody = finalBody + script;
        }
      }
      return {
        __fl_response: true,
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: finalBody,
      };
    },

    // server_html_cookie cookie html -> response (Set-Cookie 헤더 포함 HTML 응답)
    "server_html_cookie": (cookie: string, html: string): Record<string, any> => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: html,
        headers: { "Set-Cookie": cookie },
      };
    },

    // server_redirect url -> response (302 리다이렉트)
    "server_redirect": (url: string): Record<string, any> => {
      return {
        __fl_response: true,
        status: 302,
        contentType: "text/plain",
        body: "",
        headers: { "Location": url },
      };
    },

    // server_redirect_cookie url cookie -> response (302 리다이렉트 + Set-Cookie)
    "server_redirect_cookie": (url: string, cookie: string): Record<string, any> => {
      return {
        __fl_response: true,
        status: 302,
        contentType: "text/plain",
        body: "",
        headers: { "Location": url, "Set-Cookie": cookie },
      };
    },

    // server_header response key value -> response (헤더 추가)
    "server_header": (response: Record<string, any>, key: string, value: string): Record<string, any> => {
      const existing = response.headers || {};
      return { ...response, headers: { ...existing, [key]: value } };
    },

    // ── API 응답 헬퍼 ─────────────────────────────────────────────────
    // api_ok data              → 200 {:ok true :data ...}
    // api_ok "msg"             → 200 {:ok true :message ...}
    "api_ok": (data: any): Record<string, any> => ({
      __fl_response: true, status: 200, contentType: "application/json",
      body: typeof data === "string" ? { ok: true, message: data } : { ok: true, data },
    }),

    // api_created data         → 201 {:ok true :data ...}
    "api_created": (data: any): Record<string, any> => ({
      __fl_response: true, status: 201, contentType: "application/json",
      body: { ok: true, data },
    }),

    // api_error message [code] → 4xx/5xx {:ok false :error ...}
    // (api_error "Not found" 404)
    // (api_error "Server error")  → 500
    "api_error": (message: string, code?: number): Record<string, any> => ({
      __fl_response: true, status: code ?? 500, contentType: "application/json",
      body: { ok: false, error: message },
    }),

    // api_not_found [message]  → 404
    "api_not_found": (message?: string): Record<string, any> => ({
      __fl_response: true, status: 404, contentType: "application/json",
      body: { ok: false, error: message ?? "Not Found" },
    }),

    // api_bad_request [message] → 400
    "api_bad_request": (message?: string): Record<string, any> => ({
      __fl_response: true, status: 400, contentType: "application/json",
      body: { ok: false, error: message ?? "Bad Request" },
    }),

    // api_unauthorized [message] → 401
    "api_unauthorized": (message?: string): Record<string, any> => ({
      __fl_response: true, status: 401, contentType: "application/json",
      body: { ok: false, error: message ?? "Unauthorized" },
    }),

    // api_forbidden [message]  → 403
    "api_forbidden": (message?: string): Record<string, any> => ({
      __fl_response: true, status: 403, contentType: "application/json",
      body: { ok: false, error: message ?? "Forbidden" },
    }),

    // ── CORS 헬퍼 ────────────────────────────────────────────────────
    // server_cors response [origin] → response에 CORS 헤더 추가
    // (server_cors (server_json data))
    // (server_cors (server_json data) "https://app.example.com")
    "server_cors": (response: Record<string, any>, origin?: string): Record<string, any> => {
      const corsHeaders = {
        "Access-Control-Allow-Origin": origin ?? "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      return { ...response, headers: { ...(response.headers || {}), ...corsHeaders } };
    },

    // server_cors_all → 모든 라우트에 CORS 미들웨어 등록 (use와 함께)
    "server_cors_middleware": (): any => {
      return (req: any) => {
        if (req.method === "OPTIONS") {
          return {
            __fl_response: true, status: 204, contentType: "text/plain", body: "",
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          };
        }
        return null; // 통과
      };
    },

    // server_options response -> 204 No Content (CORS preflight 응답)
    "server_options": (allowMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"): Record<string, any> => {
      return {
        __fl_response: true,
        status: 204,
        contentType: "text/plain",
        body: "",
        headers: {
          "Access-Control-Allow-Methods": allowMethods,
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      };
    },

    // server_req_cookie req name -> string | null (쿠키 값 읽기)
    "server_req_cookie": (req: Request, name: string): string | null => {
      const cookieHeader = req.headers["cookie"] as string;
      if (!cookieHeader) return null;
      const cookies = cookieHeader.split(";").map(c => c.trim());
      for (const cookie of cookies) {
        const [k, ...rest] = cookie.split("=");
        if (k.trim() === name) return rest.join("=").trim();
      }
      return null;
    },

    // server_wait_respond promise -> response object (비동기 응답 대기)
    "server_wait_respond": (promise: Promise<any>): Record<string, any> => {
      return {
        __fl_wait_and_respond: true,
        promise,
      };
    },

    // server_req_body req -> string OR object (Content-Type 자동 가드)
    // 자잘 마찰 #1 (2026-04-25): Content-Type=application/json이면 이미 객체이므로
    // json_parse 두 번 하면 [object Object] 에러. (server_req_body req)는 string 보장.
    "server_req_body": (req: Request): string => {
      const b = req.body;
      if (b === null || b === undefined) return "";
      // 이미 객체/배열로 파싱된 경우 → 다시 string으로 (사용자가 json_parse 안전)
      if (typeof b === "object") return JSON.stringify(b);
      return String(b);
    },

    // server_req_json req -> parsed object (자동 파싱, Content-Type 무관)
    // 자잘 마찰 #1 (2026-04-25): 사용자 18세션에서 18군데 우회 헬퍼 작성
    // (if (string? raw) (json_parse raw) raw) 대신 한 줄
    "server_req_json": (req: Request): any => {
      const b = req.body;
      if (b === null || b === undefined) return null;
      if (typeof b === "object") return b; // 이미 파싱됨
      try { return JSON.parse(String(b)); } catch { return null; }
    },

    // server_req_query req [key] -> object or string
    "server_req_query": (req: Request, key?: string): any => {
      if (key === undefined) {
        return req.query;
      }
      const value = req.query[key];
      if (Array.isArray(value)) return value[0];
      return value ?? null;
    },

    // server_req_header req name -> string
    "server_req_header": (req: Request, name: string): string | null => {
      const value = req.headers[name.toLowerCase()];
      if (Array.isArray(value)) return value[0];
      return value as string | null;
    },

    // server_req_headers req -> object (전체 헤더 맵)
    "server_req_headers": (req: Request): Record<string, string> => {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        result[k] = Array.isArray(v) ? v[0] : (v as string) ?? "";
      }
      return result;
    },

    // server_req_param req name -> string
    "server_req_param": (req: Request, name: string): string | null => {
      return req.params[name] ?? null;
    },

    // server_req_params req -> object  (all URL params as an object)
    "server_req_params": (req: Request): Record<string, string> => {
      return req.params ?? {};
    },

    // server_req_method req -> string
    "server_req_method": (req: Request): string => {
      return req.method;
    },

    // server_req_path req -> string
    "server_req_path": (req: Request): string => {
      return req.path;
    },

    // Phase 57: 비동기 응답 보류 함수들
    // server_req_id -> string | null (현재 요청 ID)
    "server_req_id": (): string | null => {
      return currentRequestId;
    },

    // server_hold_response reqId -> null (응답 보류)
    "server_hold_response": (reqId: string): null => {
      // 이 함수는 특정 요청의 응답을 보류한다고 표시
      // 실제 구현은: 핸들러가 null을 반환하면 자동으로 응답을 보류
      // reqId로 응답 객체를 저장해야 하는데, 현재 인터페이스에서는 res를 얻을 수 없음
      // 대신 requestId와 매칭되는 응답 객체를 펜딩 상태로 표시
      if (currentRequestId === reqId) {
        pendingResponses.set(reqId, true as any);  // 플래그만 저장
      }
      return null;
    },

    // server_send_held reqId status body -> boolean (보류된 응답 전송)
    "server_send_held": (reqId: string, status: number, body: any): boolean => {
      const isPending = pendingResponses.has(reqId);
      if (isPending) {
        pendingResponses.delete(reqId);
        return true;
      }
      return false;
    },

    // ── WebSocket 터널 프록시 함수들 ─────────────────────────────
    // server_on_upgrade fnName -> null (WS upgrade 핸들러 등록)
    "server_on_upgrade": (fnName: string): null => {
      upgradeHandler = fnName;
      return null;
    },

    // server_on_ws_message fnName -> null (클라이언트 WS 메시지 핸들러)
    "server_on_ws_message": (fnName: string): null => {
      wsClientMessageHandler = fnName;
      return null;
    },

    // server_on_ws_close fnName -> null (클라이언트 WS 종료 핸들러)
    "server_on_ws_close": (fnName: string): null => {
      wsClientCloseHandler = fnName;
      return null;
    },

    // ws_send_to_client sessionId data [isBinary] -> boolean
    "ws_send_to_client": (sessionId: string, data: string, isBinary: boolean = false): boolean => {
      const socket = wsPublicMap.get(sessionId) as any;
      if (!socket || socket.destroyed) return false;
      try {
        // RFC 6455 프레임 빌더 (서버→클라이언트, 마스킹 없음)
        const payload = isBinary ? Buffer.from(data, 'base64') : Buffer.from(data);
        const opcode = isBinary ? 0x02 : 0x01;
        let frame: Buffer;

        if (payload.length < 126) {
          const h = Buffer.alloc(2);
          h[0] = 0x80 | opcode;
          h[1] = payload.length;
          frame = Buffer.concat([h, payload]);
        } else if (payload.length < 65536) {
          const h = Buffer.alloc(4);
          h[0] = 0x80 | opcode;
          h[1] = 126;
          h.writeUInt16BE(payload.length, 2);
          frame = Buffer.concat([h, payload]);
        } else {
          const h = Buffer.alloc(10);
          h[0] = 0x80 | opcode;
          h[1] = 127;
          h.writeBigUInt64BE(BigInt(payload.length), 2);
          frame = Buffer.concat([h, payload]);
        }

        socket.write(frame);
        return true;
      } catch {
        return false;
      }
    },

    // ws_close_client sessionId [code] -> null
    "ws_close_client": (sessionId: string, code: number = 1000): null => {
      const socket = wsPublicMap.get(sessionId) as any;
      if (socket && !socket.destroyed) {
        // RFC 6455 CLOSE 프레임
        const b = Buffer.alloc(4);
        b[0] = 0x88;
        b[1] = 0x02;
        b.writeUInt16BE(code, 2);
        socket.write(b);
        socket.end();
        wsPublicMap.delete(sessionId);
      }
      return null;
    },

    // server_req_session_id req -> string | null
    "server_req_session_id": (req: any): string | null => {
      return req?.session_id ?? null;
    },
  };
}
