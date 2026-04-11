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
}

/**
 * Create pure HTTP server for FreeLang v9 (no Express)
 */
export function createHttpServerModule(callFn: CallFn) {
  const routes: Route[] = [];
  let server: http.Server | null = null;

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
    params: Record<string, string>
  ): Request {
    return {
      __fl_request: true,
      method,
      path,
      query,
      headers,
      body: body || undefined,
      params,
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
          const method = req.method || "GET";
          const { path, query } = parseUrl(req.url || "/");
          const headers = req.headers;
          const body = await readBody(req);

          // CORS
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
            try {
              // 경로 파라미터 추출
              const params: Record<string, string> = {};
              for (let i = 0; i < route.params.length; i++) {
                params[route.params[i]] = match[i + 1];
              }

              // v9 요청 객체 생성
              const flReq = createFlRequest(method, path, query, headers, body, params);

              // 핸들러 호출
              const result = callFn(route.handler, [flReq]);

              // 응답 처리
              if (result && typeof result === "object") {
                if (result.__fl_response === true) {
                  const status = result.status ?? 200;
                  const contentType = result.contentType ?? "application/json";
                  sendResponse(res, status, result.body ?? "", contentType);
                } else {
                  sendResponse(res, 200, result);
                }
              } else {
                sendResponse(res, 200, result ?? "");
              }
            } catch (err: any) {
              sendResponse(res, 500, { error: err.message });
            }
            return;
          }

          // 404
          if (!matched) {
            sendResponse(res, 404, { error: "Not Found", path });
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
  };
}
