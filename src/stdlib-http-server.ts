// FreeLang v9: Pure HTTP Server (Express-free)
// Phase 4a: v9 순수 HTTP 서버 구현 (의존성 제거)
// Node.js http 모듈만 사용

import * as http from "http";
import * as url from "url";

type CallFn = (name: string, args: any[]) => any;
type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

interface Route {
  method: string;
  path: string;
  pattern: RegExp;
  params: string[];
  handler: string;
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
export function createHttpServerModule(callFn: CallFn) {
  const routes: Route[] = [];
  let server: http.Server | null = null;
  let requestCounter = 0;

  // Phase 57: 비동기 응답 보류용 저장소
  const pendingResponses = new Map<string, http.ServerResponse>();
  let currentRequestId: string | null = null;

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

  // URL 경로를 정규표현식으로 변환 (예: /users/:id → /users/(.+))
  function pathToRegex(path: string): [RegExp, string[]] {
    const params: string[] = [];
    const pattern = path
      .replace(/\//g, "\\/")
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

  // 응답 작성
  function sendResponse(
    res: http.ServerResponse,
    status: number,
    body: any,
    contentType: string = "application/json"
  ) {
    res.writeHead(status, { "Content-Type": contentType });
    if (contentType.includes("json")) {
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
    "server_get": (path: string, handlerName: string): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "GET", path, pattern, params, handler: handlerName });
      return null;
    },

    // server_post path handlerName -> null
    "server_post": (path: string, handlerName: string): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "POST", path, pattern, params, handler: handlerName });
      return null;
    },

    // server_put path handlerName -> null
    "server_put": (path: string, handlerName: string): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "PUT", path, pattern, params, handler: handlerName });
      return null;
    },

    // server_patch path handlerName -> null
    "server_patch": (path: string, handlerName: string): null => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "PATCH", path, pattern, params, handler: handlerName });
      return null;
    },

    // server_delete path handlerName -> null
    "server_delete": (path: string, handlerName: string): null => {
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

              // 핸들러 호출 (Phase 57: Promise 지원)
              let rawResult = callFn(route.handler, [flReq]);
              const result = (rawResult instanceof Promise) ? await rawResult : rawResult;

              // 응답 처리 (응답 보류 중이면 skip)
              if (pendingResponses.has(requestId)) {
                pendingResponses.delete(requestId);
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
      // 이 함수는 보류된 응답을 전송한다
      // 현재 아키텍처에서는 응답 객체(res)를 저장할 수 없으므로
      // relay 서버는 다른 패턴을 사용해야 함 (예: Promise 기반)
      const isPending = pendingResponses.has(reqId);
      if (isPending) {
        pendingResponses.delete(reqId);
        return true;
      }
      return false;
    },
  };
}
