var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/stdlib-http-server.ts
var stdlib_http_server_exports = {};
__export(stdlib_http_server_exports, {
  __activeServer: () => __activeServer,
  createHttpServerModule: () => createHttpServerModule
});
module.exports = __toCommonJS(stdlib_http_server_exports);
var http = __toESM(require("http"));
var url = __toESM(require("url"));
var crypto = __toESM(require("crypto"));
var __activeServer = { server: null };
function createHttpServerModule(callFn, callFunctionValue) {
  const routes = [];
  let server = null;
  let requestCounter = 0;
  const pendingResponses = /* @__PURE__ */ new Map();
  let currentRequestId = null;
  const wsPublicMap = /* @__PURE__ */ new Map();
  let upgradeHandler = null;
  let wsClientMessageHandler = null;
  let wsClientCloseHandler = null;
  let wssPublic = null;
  function generateRequestId() {
    const timestamp = Date.now();
    const counter = ++requestCounter;
    return `req_${timestamp}_${counter}`;
  }
  function logAccess(method, path, status, duration, requestId) {
    const icon = status >= 400 ? "\u274C" : "\u2705";
    console.log(`${icon} [${requestId}] ${method} ${path} ${status} ${duration}ms`);
  }
  function pathToRegex(path) {
    const params = [];
    const pattern = path.replace(/\//g, "\\/").replace(/\*/g, ".*").replace(/:(\w+)/g, (_, param) => {
      params.push(param);
      return "([^\\/]+)";
    });
    return [new RegExp(`^${pattern}$`), params];
  }
  function parseUrl(urlStr) {
    const parsed = url.parse(urlStr, true);
    return {
      path: parsed.pathname || "/",
      query: parsed.query
    };
  }
  async function readBody(req) {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const ct = (req.headers["content-type"] || "").toString().toLowerCase();
        if (ct.includes("application/json") && body.trim()) {
          try {
            resolve(JSON.parse(body));
            return;
          } catch {
          }
        }
        resolve(body);
      });
    });
  }
  function sendResponse(res, status, body, contentType = "application/json", extraHeaders) {
    const headersToWrite = { "Content-Type": contentType };
    if (extraHeaders) {
      const hopByHop = /* @__PURE__ */ new Set([
        "connection",
        "keep-alive",
        "transfer-encoding",
        "te",
        "trailer",
        "proxy-authorization",
        "proxy-authenticate",
        "upgrade",
        "content-encoding"
      ]);
      for (const [k, v] of Object.entries(extraHeaders)) {
        if (!hopByHop.has(k.toLowerCase())) {
          headersToWrite[k] = v;
        }
      }
    }
    res.writeHead(status, headersToWrite);
    if (typeof body === "string") {
      res.end(body);
    } else if (Buffer.isBuffer(body)) {
      res.end(body);
    } else if (contentType.includes("json") && typeof body === "object") {
      res.end(JSON.stringify(body));
    } else {
      res.end(String(body ?? ""));
    }
  }
  function createFlRequest(method, path, query, headers, body, params, requestId) {
    return {
      __fl_request: true,
      method,
      path,
      query,
      headers,
      body: body || void 0,
      params,
      request_id: requestId,
      timestamp: Date.now()
    };
  }
  return {
    // server_get path handlerName -> null
    "server_get": (path, handlerName) => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "GET", path, pattern, params, handler: handlerName });
      return null;
    },
    // server_post path handlerName -> null
    "server_post": (path, handlerName) => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "POST", path, pattern, params, handler: handlerName });
      return null;
    },
    // server_put path handlerName -> null
    "server_put": (path, handlerName) => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "PUT", path, pattern, params, handler: handlerName });
      return null;
    },
    // server_patch path handlerName -> null
    "server_patch": (path, handlerName) => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "PATCH", path, pattern, params, handler: handlerName });
      return null;
    },
    // server_delete path handlerName -> null
    "server_delete": (path, handlerName) => {
      const [pattern, params] = pathToRegex(path);
      routes.push({ method: "DELETE", path, pattern, params, handler: handlerName });
      return null;
    },
    // server_start port -> string
    "server_start": (port) => {
      if (__activeServer.server) {
        try {
          __activeServer.server.close();
        } catch (_e) {
        }
        __activeServer.server = null;
      }
      server = http.createServer(async (req, res) => {
        const requestStart = Date.now();
        const requestId = generateRequestId();
        currentRequestId = requestId;
        const method = req.method || "GET";
        const { path, query } = parseUrl(req.url || "/");
        const headers = req.headers;
        const body = await readBody(req);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("X-Request-Id", requestId);
        if (method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }
        if (process.env.FL_DEV === "1" && path === "/__hot" && method === "GET") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
          });
          res.write("retry: 400\n\n");
          return;
        }
        let matched = false;
        for (const route of routes) {
          if (route.method !== method) continue;
          const match = route.pattern.exec(path);
          if (!match) continue;
          matched = true;
          let status = 200;
          try {
            const params = {};
            for (let i = 0; i < route.params.length; i++) {
              params[route.params[i]] = match[i + 1];
            }
            const flReq = createFlRequest(method, path, query, headers, body, params, requestId);
            let rawResult;
            if (typeof route.handler === "string") {
              rawResult = callFn(route.handler, [flReq]);
            } else if (route.handler && route.handler.kind === "function-value" && callFunctionValue) {
              rawResult = callFunctionValue(route.handler, [flReq]);
            } else {
              throw new Error(`Invalid handler: expected string or function-value, got ${typeof route.handler}`);
            }
            const result = rawResult instanceof Promise ? await rawResult : rawResult;
            if (pendingResponses.has(requestId)) {
              pendingResponses.delete(requestId);
            } else if (result && typeof result === "object" && result.__fl_wait_and_respond === true) {
              const asyncResp = await result.promise;
              if (!asyncResp) {
                sendResponse(res, 504, { error: "Gateway Timeout" });
              } else {
                status = asyncResp.status ?? 200;
                let respBody = asyncResp.body ?? "";
                let contentType = asyncResp.contentType ?? "application/json";
                const extraHeaders = asyncResp.headers ?? {};
                if (asyncResp.encoding === "base64" && typeof respBody === "string") {
                  const buf = Buffer.from(respBody, "base64");
                  if (extraHeaders["content-type"]) {
                    contentType = extraHeaders["content-type"];
                  }
                  sendResponse(res, status, buf, contentType, extraHeaders);
                } else {
                  if (extraHeaders["content-type"]) {
                    contentType = extraHeaders["content-type"];
                  }
                  sendResponse(res, status, respBody, contentType, extraHeaders);
                }
              }
            } else {
              if (result && typeof result === "object") {
                if (result.__fl_response === true) {
                  status = result.status ?? 200;
                  const contentType = result.contentType ?? "application/json";
                  sendResponse(res, status, result.body ?? "", contentType, result.headers ?? {});
                } else {
                  sendResponse(res, 200, result);
                }
              } else {
                sendResponse(res, 200, result ?? "");
              }
            }
            const duration = Date.now() - requestStart;
            logAccess(method, path, status, duration, requestId);
          } catch (err) {
            const status2 = 500;
            sendResponse(res, status2, { error: err.message });
            const duration = Date.now() - requestStart;
            logAccess(method, path, status2, duration, requestId);
          }
          return;
        }
        if (!matched) {
          const status = 404;
          sendResponse(res, status, { error: "Not Found", path });
          const duration = Date.now() - requestStart;
          logAccess(method, path, status, duration, requestId);
        }
      });
      server.on("upgrade", (req, socket, head) => {
        if (!upgradeHandler) {
          socket.destroy();
          return;
        }
        const key = req.headers["sec-websocket-key"];
        if (!key) {
          socket.destroy();
          return;
        }
        const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
        socket.write([
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          "Sec-WebSocket-Accept: " + accept,
          "",
          ""
        ].join("\r\n"));
        const sessionId = "wsc-" + crypto.randomBytes(8).toString("hex");
        wsPublicMap.set(sessionId, socket);
        let buf = Buffer.alloc(0);
        socket.on("data", async (chunk) => {
          buf = Buffer.concat([buf, chunk]);
          while (buf.length >= 2) {
            const fin = (buf[0] & 128) !== 0;
            const opcode = buf[0] & 15;
            const masked = (buf[1] & 128) !== 0;
            let payloadLen = buf[1] & 127;
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
            let maskKey = null;
            if (masked) maskKey = buf.slice(hdrLen - 4, hdrLen);
            const payload = Buffer.from(buf.slice(hdrLen, hdrLen + payloadLen));
            if (maskKey) {
              for (let i = 0; i < payload.length; i++) {
                payload[i] ^= maskKey[i % 4];
              }
            }
            if (opcode === 8) {
              wsPublicMap.delete(sessionId);
              if (wsClientCloseHandler) {
                try {
                  await callFn(wsClientCloseHandler, [sessionId, 1e3]);
                } catch {
                }
              }
              socket.end();
              return;
            }
            if (opcode === 9) {
              socket.write(Buffer.from([138, 0]));
            } else if (opcode === 1 || opcode === 2) {
              if (wsClientMessageHandler) {
                const isBinary = opcode === 2;
                const data = isBinary ? payload.toString("base64") : payload.toString("utf8");
                try {
                  await callFn(wsClientMessageHandler, [sessionId, data, isBinary]);
                } catch {
                }
              }
            }
            buf = buf.slice(hdrLen + payloadLen);
          }
        });
        socket.on("close", async () => {
          wsPublicMap.delete(sessionId);
          if (wsClientCloseHandler) {
            try {
              await callFn(wsClientCloseHandler, [sessionId, 1006]);
            } catch {
            }
          }
        });
        socket.on("error", () => {
          wsPublicMap.delete(sessionId);
        });
        const upgradeReq = {
          __fl_request: true,
          method: "WS_UPGRADE",
          path: req.url || "/",
          headers: req.headers,
          query: {},
          body: "",
          params: {},
          session_id: sessionId
        };
        callFn(upgradeHandler, [upgradeReq]);
      });
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`[server] \uD3EC\uD2B8 ${port} \uC774\uBBF8 \uC0AC\uC6A9 \uC911 \u2014 \uC11C\uBC84 \uC2DC\uC791 \uAC74\uB108\uB700`);
        } else {
          console.error(`[server] \uC11C\uBC84 \uC624\uB958: ${err.message}`);
        }
      });
      server.listen(port);
      __activeServer.server = server;
      setInterval(() => {
      }, 1e4).unref();
      return `server listening on :${port}`;
    },
    // server_stop -> null
    "server_stop": () => {
      if (server) {
        server.close();
        server = null;
      }
      return null;
    },
    // server_json obj -> response object
    "server_json": (body) => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "application/json",
        body
      };
    },
    // server_text text -> response object
    "server_text": (body) => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "text/plain",
        body
      };
    },
    // server_status code body -> response object
    "server_status": (code, body) => {
      return {
        __fl_response: true,
        status: code,
        contentType: "application/json",
        body
      };
    },
    // server_html body -> response object (text/html)
    // In dev mode (FL_DEV=1), injects hot-reload script before </body>
    // so browsers auto-refresh when the FreeLang source file changes.
    "server_html": (body) => {
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
        body: finalBody
      };
    },
    // server_html_cookie cookie html -> response (Set-Cookie 헤더 포함 HTML 응답)
    "server_html_cookie": (cookie, html) => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: html,
        headers: { "Set-Cookie": cookie }
      };
    },
    // server_redirect url -> response (302 리다이렉트)
    "server_redirect": (url2) => {
      return {
        __fl_response: true,
        status: 302,
        contentType: "text/plain",
        body: "",
        headers: { "Location": url2 }
      };
    },
    // server_redirect_cookie url cookie -> response (302 리다이렉트 + Set-Cookie)
    "server_redirect_cookie": (url2, cookie) => {
      return {
        __fl_response: true,
        status: 302,
        contentType: "text/plain",
        body: "",
        headers: { "Location": url2, "Set-Cookie": cookie }
      };
    },
    // server_req_cookie req name -> string | null (쿠키 값 읽기)
    "server_req_cookie": (req, name) => {
      const cookieHeader = req.headers["cookie"];
      if (!cookieHeader) return null;
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      for (const cookie of cookies) {
        const [k, ...rest] = cookie.split("=");
        if (k.trim() === name) return rest.join("=").trim();
      }
      return null;
    },
    // server_wait_respond promise -> response object (비동기 응답 대기)
    "server_wait_respond": (promise) => {
      return {
        __fl_wait_and_respond: true,
        promise
      };
    },
    // server_req_body req -> string OR object (Content-Type 자동 가드)
    // 자잘 마찰 #1 (2026-04-25): Content-Type=application/json이면 이미 객체이므로
    // json_parse 두 번 하면 [object Object] 에러. (server_req_body req)는 string 보장.
    "server_req_body": (req) => {
      const b = req.body;
      if (b === null || b === void 0) return "";
      if (typeof b === "object") return JSON.stringify(b);
      return String(b);
    },
    // server_req_json req -> parsed object (자동 파싱, Content-Type 무관)
    // 자잘 마찰 #1 (2026-04-25): 사용자 18세션에서 18군데 우회 헬퍼 작성
    // (if (string? raw) (json_parse raw) raw) 대신 한 줄
    "server_req_json": (req) => {
      const b = req.body;
      if (b === null || b === void 0) return null;
      if (typeof b === "object") return b;
      try {
        return JSON.parse(String(b));
      } catch {
        return null;
      }
    },
    // server_req_query req [key] -> object or string
    "server_req_query": (req, key) => {
      if (key === void 0) {
        return req.query;
      }
      const value = req.query[key];
      if (Array.isArray(value)) return value[0];
      return value ?? null;
    },
    // server_req_header req name -> string
    "server_req_header": (req, name) => {
      const value = req.headers[name.toLowerCase()];
      if (Array.isArray(value)) return value[0];
      return value;
    },
    // server_req_param req name -> string
    "server_req_param": (req, name) => {
      return req.params[name] ?? null;
    },
    // server_req_params req -> object  (all URL params as an object)
    "server_req_params": (req) => {
      return req.params ?? {};
    },
    // server_req_method req -> string
    "server_req_method": (req) => {
      return req.method;
    },
    // server_req_path req -> string
    "server_req_path": (req) => {
      return req.path;
    },
    // Phase 57: 비동기 응답 보류 함수들
    // server_req_id -> string | null (현재 요청 ID)
    "server_req_id": () => {
      return currentRequestId;
    },
    // server_hold_response reqId -> null (응답 보류)
    "server_hold_response": (reqId) => {
      if (currentRequestId === reqId) {
        pendingResponses.set(reqId, true);
      }
      return null;
    },
    // server_send_held reqId status body -> boolean (보류된 응답 전송)
    "server_send_held": (reqId, status, body) => {
      const isPending = pendingResponses.has(reqId);
      if (isPending) {
        pendingResponses.delete(reqId);
        return true;
      }
      return false;
    },
    // ── WebSocket 터널 프록시 함수들 ─────────────────────────────
    // server_on_upgrade fnName -> null (WS upgrade 핸들러 등록)
    "server_on_upgrade": (fnName) => {
      upgradeHandler = fnName;
      return null;
    },
    // server_on_ws_message fnName -> null (클라이언트 WS 메시지 핸들러)
    "server_on_ws_message": (fnName) => {
      wsClientMessageHandler = fnName;
      return null;
    },
    // server_on_ws_close fnName -> null (클라이언트 WS 종료 핸들러)
    "server_on_ws_close": (fnName) => {
      wsClientCloseHandler = fnName;
      return null;
    },
    // ws_send_to_client sessionId data [isBinary] -> boolean
    "ws_send_to_client": (sessionId, data, isBinary = false) => {
      const socket = wsPublicMap.get(sessionId);
      if (!socket || socket.destroyed) return false;
      try {
        const payload = isBinary ? Buffer.from(data, "base64") : Buffer.from(data);
        const opcode = isBinary ? 2 : 1;
        let frame;
        if (payload.length < 126) {
          const h = Buffer.alloc(2);
          h[0] = 128 | opcode;
          h[1] = payload.length;
          frame = Buffer.concat([h, payload]);
        } else if (payload.length < 65536) {
          const h = Buffer.alloc(4);
          h[0] = 128 | opcode;
          h[1] = 126;
          h.writeUInt16BE(payload.length, 2);
          frame = Buffer.concat([h, payload]);
        } else {
          const h = Buffer.alloc(10);
          h[0] = 128 | opcode;
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
    "ws_close_client": (sessionId, code = 1e3) => {
      const socket = wsPublicMap.get(sessionId);
      if (socket && !socket.destroyed) {
        const b = Buffer.alloc(4);
        b[0] = 136;
        b[1] = 2;
        b.writeUInt16BE(code, 2);
        socket.write(b);
        socket.end();
        wsPublicMap.delete(sessionId);
      }
      return null;
    },
    // server_req_session_id req -> string | null
    "server_req_session_id": (req) => {
      return req?.session_id ?? null;
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  __activeServer,
  createHttpServerModule
});
