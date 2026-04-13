// FreeLang v9: Pure HTTP Server (Express-free)
// Phase 4a: v9 순수 HTTP 서버 구현 (의존성 제거)
// Node.js http 모듈만 사용

import * as http from "http";
import * as url from "url";
import * as crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";

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
  body?: string;
  params: Record<string, string>;
  request_id?: string;
  timestamp?: number;
}

/**
 * Create pure HTTP server for FreeLang v9 (no Express)
 */
export function createHttpServerModule(callFn: CallFn, callFunctionValue?: CallFunctionValue) {
  const routes: Route[] = [];
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

  // 요청 본문 읽기
  async function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        resolve(body);
      });
    });
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
      res.end(JSON.stringify(body));
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

  return {
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

    // server_start port -> string
    "server_start": (port: number): string => {
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
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.setHeader("X-Request-Id", requestId);

          if (method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
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
                  if (result.__fl_response === true) {
                    status = result.status ?? 200;
                    const contentType = result.contentType ?? "application/json";
                    sendResponse(res, status, result.body ?? "", contentType);
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

      // WebSocket upgrade 지원 (터널 WS 프록시)
      wssPublic = new WebSocketServer({ noServer: true });
      server.on('upgrade', (req, socket, head) => {
        if (!upgradeHandler || !wssPublic) {
          socket.destroy();
          return;
        }
        wssPublic.handleUpgrade(req, socket, head, (ws) => {
          const sessionId = 'wsc-' + crypto.randomBytes(8).toString('hex');
          wsPublicMap.set(sessionId, ws);

          ws.on('message', async (data, isBinary) => {
            if (!wsClientMessageHandler) return;
            const payload = isBinary
              ? (data as Buffer).toString('base64')
              : data.toString('utf8');
            try {
              await callFn(wsClientMessageHandler, [sessionId, payload, isBinary]);
            } catch {}
          });

          ws.on('close', async (code, reason) => {
            wsPublicMap.delete(sessionId);
            if (wsClientCloseHandler) {
              try { await callFn(wsClientCloseHandler, [sessionId, code]); } catch {}
            }
          });

          ws.on('error', () => { wsPublicMap.delete(sessionId); });

          // FreeLang upgrade 핸들러 호출
          const upgradeReq = {
            __fl_request: true,
            method: 'WS_UPGRADE',
            path: req.url || '/',
            headers: req.headers,
            query: {},
            body: '',
            params: {},
            session_id: sessionId,
          };
          callFn(upgradeHandler!, [upgradeReq]);
        });
      });

      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`[server] 포트 ${port} 이미 사용 중 — 서버 시작 건너뜀`);
        } else {
          console.error(`[server] 서버 오류: ${err.message}`);
        }
      });
      server.listen(port);
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

    // server_json obj -> response object
    "server_json": (body: any): Record<string, any> => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "application/json",
        body,
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
    "server_status": (code: number, body: any): Record<string, any> => {
      return {
        __fl_response: true,
        status: code,
        contentType: "application/json",
        body,
      };
    },

    // server_html body -> response object (text/html)
    "server_html": (body: string): Record<string, any> => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "text/html; charset=utf-8",
        body,
      };
    },

    // server_wait_respond promise -> response object (비동기 응답 대기)
    "server_wait_respond": (promise: Promise<any>): Record<string, any> => {
      return {
        __fl_wait_and_respond: true,
        promise,
      };
    },

    // server_req_body req -> string
    "server_req_body": (req: Request): string => {
      return req.body ?? "";
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

    // server_req_param req name -> string
    "server_req_param": (req: Request, name: string): string | null => {
      return req.params[name] ?? null;
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
      const ws = wsPublicMap.get(sessionId);
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      if (isBinary) {
        ws.send(Buffer.from(data, 'base64'));
      } else {
        ws.send(data);
      }
      return true;
    },

    // ws_close_client sessionId [code] -> null
    "ws_close_client": (sessionId: string, code: number = 1000): null => {
      const ws = wsPublicMap.get(sessionId);
      if (ws) {
        ws.close(code);
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
