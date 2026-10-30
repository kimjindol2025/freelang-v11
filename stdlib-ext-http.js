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

// src/ext-http.ts
var ext_http_exports = {};
__export(ext_http_exports, {
  createHttpServerModule: () => createHttpServerModule
});
module.exports = __toCommonJS(ext_http_exports);

// src/stdlib-http-server.ts
var http = __toESM(require("http"));
var url = __toESM(require("url"));
var crypto = __toESM(require("crypto"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var __activeServer = { server: null };
function createHttpServerModule(callFn, callFunctionValue) {
  const routes = [];
  const middlewares = [];
  let server = null;
  let requestCounter = 0;
  const pendingResponses = /* @__PURE__ */ new Map();
  let currentRequestId = null;
  let currentNonce = "";
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
  function logAccess(method, path2, status, duration, requestId) {
    const icon = status >= 400 ? "\u274C" : "\u2705";
    console.log(`${icon} [${requestId}] ${method} ${path2} ${status} ${duration}ms`);
  }
  function pathToRegex(path2) {
    const params = [];
    const pattern = path2.replace(/\//g, "\\/").replace(/\*/g, ".*").replace(/:(\w+)/g, (_, param) => {
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
    return new Promise((resolve2) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const raw = Buffer.concat(chunks);
        const ct = (req.headers["content-type"] || "").toString();
        if (ct.includes("application/json")) {
          try {
            resolve2(JSON.parse(raw.toString()));
            return;
          } catch {
          }
        }
        if (ct.includes("multipart/form-data")) {
          try {
            resolve2(parseMultipart(raw, ct));
            return;
          } catch {
          }
        }
        if (ct.includes("application/x-www-form-urlencoded")) {
          try {
            const params = {};
            new url.URLSearchParams(raw.toString()).forEach((v, k) => {
              params[k] = v;
            });
            resolve2(params);
            return;
          } catch {
          }
        }
        resolve2(raw.toString());
      });
    });
  }
  function parseMultipart(raw, contentType) {
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) return {};
    const boundary = boundaryMatch[1];
    const delimiter = Buffer.from("\r\n--" + boundary);
    const fields = {};
    const files = [];
    const uploadDir = path.join(os.tmpdir(), "fl-uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const start = Buffer.from("--" + boundary + "\r\n");
    let pos = raw.indexOf(start);
    if (pos < 0) return { fields, files };
    pos += start.length;
    while (pos < raw.length) {
      const next = raw.indexOf(delimiter, pos);
      const partEnd = next < 0 ? raw.length : next;
      const part = raw.slice(pos, partEnd);
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const headerStr = part.slice(0, headerEnd).toString();
      const bodyBuf = part.slice(headerEnd + 4);
      const dispMatch = headerStr.match(/Content-Disposition:[^\n]*?;\s*name="([^"]+)"(?:[^\n]*?filename="([^"]+)")?/i);
      if (!dispMatch) {
        pos = partEnd + delimiter.length + 2;
        continue;
      }
      const fieldName = dispMatch[1];
      const fileName = dispMatch[2];
      if (fileName) {
        const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
        const mimetype = ctMatch ? ctMatch[1].trim() : "application/octet-stream";
        const ext = path.extname(fileName) || "";
        const savedName = crypto.randomBytes(8).toString("hex") + ext;
        const savedPath = path.join(uploadDir, savedName);
        fs.writeFileSync(savedPath, bodyBuf);
        const m = /* @__PURE__ */ new Map();
        m.set("fieldname", fieldName);
        m.set("originalname", fileName);
        m.set("mimetype", mimetype);
        m.set("size", bodyBuf.length);
        m.set("path", savedPath);
        m.set("filename", savedName);
        files.push(m);
      } else {
        fields[fieldName] = bodyBuf.toString().replace(/\r\n$/, "");
      }
      if (next < 0) break;
      pos = next + delimiter.length;
      if (raw.slice(pos, pos + 2).toString() === "--") break;
      pos += 2;
    }
    const result = /* @__PURE__ */ new Map();
    const fieldsMap = /* @__PURE__ */ new Map();
    Object.entries(fields).forEach(([k, v]) => fieldsMap.set(k, v));
    result.set("fields", fieldsMap);
    result.set("files", files);
    return result;
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
      if (contentType.includes("text/html") && currentNonce) {
        body = body.replace(
          /<(script|style)(?![^>]*\bnonce=)(\s|>)/gi,
          (_, tag, rest) => `<${tag} nonce="${currentNonce}"${rest}`
        );
      }
      res.end(body);
    } else if (Buffer.isBuffer(body)) {
      res.end(body);
    } else if (contentType.includes("json") && typeof body === "object") {
      res.end(JSON.stringify(
        body,
        (_k, v) => v instanceof Map ? Object.fromEntries(v) : Array.isArray(v) ? v : v
      ));
    } else {
      res.end(String(body ?? ""));
    }
  }
  function createFlRequest(method, path2, query, headers, body, params, requestId) {
    return {
      __fl_request: true,
      method,
      path: path2,
      query,
      headers,
      body: body || void 0,
      params,
      request_id: requestId,
      csp_nonce: currentNonce,
      timestamp: Date.now()
    };
  }
  const rlStore = /* @__PURE__ */ new Map();
  let rlMax = 100;
  let rlWindowMs = 6e4;
  function checkRateLimit(ip) {
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
  setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of rlStore) {
      if (now > e.resetAt + rlWindowMs) rlStore.delete(ip);
    }
  }, 3e5).unref();
  return {
    // server_use path middlewareName — 경로 패턴 매칭 시 미들웨어 실행
    // handler가 null/undefined 반환 → 다음 미들웨어/라우트 진행
    // handler가 응답 객체 반환 → 즉시 응답 (라우트 실행 안 함)
    "server_use": (path2, handlerName) => {
      const [pattern] = pathToRegex(path2);
      middlewares.push({ pattern, handler: handlerName });
      return null;
    },
    // server_rate_limit max window_ms → null  (e.g. 100req/60s)
    "server_rate_limit": (max, windowMs) => {
      rlMax = Math.max(1, Math.floor(max));
      rlWindowMs = Math.max(1e3, Math.floor(windowMs));
      return null;
    },
    // server_get path handlerName -> null
    "server_get": (path2, handlerName) => {
      const [pattern, params] = pathToRegex(path2);
      routes.push({ method: "GET", path: path2, pattern, params, handler: handlerName });
      return null;
    },
    // server_post path handlerName -> null
    "server_post": (path2, handlerName) => {
      const [pattern, params] = pathToRegex(path2);
      routes.push({ method: "POST", path: path2, pattern, params, handler: handlerName });
      return null;
    },
    // server_put path handlerName -> null
    "server_put": (path2, handlerName) => {
      const [pattern, params] = pathToRegex(path2);
      routes.push({ method: "PUT", path: path2, pattern, params, handler: handlerName });
      return null;
    },
    // server_patch path handlerName -> null
    "server_patch": (path2, handlerName) => {
      const [pattern, params] = pathToRegex(path2);
      routes.push({ method: "PATCH", path: path2, pattern, params, handler: handlerName });
      return null;
    },
    // server_delete path handlerName -> null
    "server_delete": (path2, handlerName) => {
      const [pattern, params] = pathToRegex(path2);
      routes.push({ method: "DELETE", path: path2, pattern, params, handler: handlerName });
      return null;
    },
    // route method path handler → 메서드 문자열로 등록
    // (route "GET"    "/api/x" handler-fn)
    // (route "POST"   "/api/x" handler-fn)
    "route": (method, path2, handlerName) => {
      const m = String(method).toUpperCase();
      const [pattern, params] = pathToRegex(path2);
      routes.push({ method: m, path: path2, pattern, params, handler: handlerName });
      return null;
    },
    // v12: 라우트 초기화 (hot reload 시 재등록 전 호출)
    "server-clear-routes": () => {
      routes.length = 0;
      return null;
    },
    "server_clear_routes": () => {
      routes.length = 0;
      return null;
    },
    // server_static dir [urlPrefix] -> null  정적 파일 서빙 (server-static "public" "/")
    "server_static": (dir, urlPrefix = "/") => {
      const mimeMap = {
        ".html": "text/html; charset=utf-8",
        ".htm": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".mjs": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".txt": "text/plain; charset=utf-8",
        ".pdf": "application/pdf"
      };
      const absDir = path.resolve(dir);
      const prefix = urlPrefix.endsWith("/") ? urlPrefix : urlPrefix + "/";
      const handler = (_req, res, reqPath) => {
        let rel = reqPath.startsWith(prefix) ? reqPath.slice(prefix.length - 1) : reqPath;
        if (rel === "" || rel === "/") rel = "/index.html";
        const filePath = path.join(absDir, rel);
        if (!filePath.startsWith(absDir)) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden");
          return true;
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
        const ext = path.extname(filePath).toLowerCase();
        const mime = mimeMap[ext] || "application/octet-stream";
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
          "Content-Type": mime,
          "Content-Length": content.length,
          "Cache-Control": "public, max-age=3600"
        });
        res.end(content);
        return true;
      };
      const routePath = prefix === "/" ? "/*" : prefix + "*";
      const [pattern, params] = pathToRegex(routePath);
      routes.push({
        method: "GET",
        path: routePath,
        pattern,
        params,
        handler: { __fl_static_handler: true, fn: handler }
      });
      return null;
    },
    // server_all path handler → 모든 메서드 등록 (catch-all)
    "server_all": (path2, handlerName) => {
      const [pattern, params] = pathToRegex(path2);
      for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        routes.push({ method: m, path: path2, pattern, params, handler: handlerName });
      }
      return null;
    },
    // server_start port|config -> string
    // 선언형 API: (server_start {:port 40090 :routes [...] :middleware [...]})
    // 기존 API:   (server_start 40090)
    "server_start": (portOrConfig) => {
      const port = portOrConfig !== null && typeof portOrConfig === "object" ? portOrConfig[":port"] ?? portOrConfig["port"] ?? 8080 : portOrConfig;
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
        const cspNonce = crypto.randomBytes(16).toString("base64url");
        currentNonce = cspNonce;
        const method = req.method || "GET";
        const { path: path2, query } = parseUrl(req.url || "/");
        const headers = req.headers;
        const body = await readBody(req);
        const allowedOrigins = process.env.FL_ALLOWED_ORIGINS;
        if (allowedOrigins && allowedOrigins !== "*") {
          const reqOrigin = req.headers["origin"] || "";
          if (allowedOrigins.split(",").map((s) => s.trim()).includes(reqOrigin)) {
            res.setHeader("Access-Control-Allow-Origin", reqOrigin);
            res.setHeader("Vary", "Origin");
          }
        } else {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("X-Request-Id", requestId);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader("X-XSS-Protection", "1; mode=block");
        res.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'self' 'nonce-${cspNonce}'; style-src 'self' 'nonce-${cspNonce}'`);
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        if (method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }
        const clientIp = process.env.FL_TRUST_PROXY === "1" ? (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim() : req.socket.remoteAddress || "unknown";
        if (!checkRateLimit(clientIp)) {
          res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rlWindowMs / 1e3)) });
          res.end(JSON.stringify({ error: "Too Many Requests", retry_after: Math.ceil(rlWindowMs / 1e3) }));
          return;
        }
        if (process.env.FL_DEV === "1" && path2 === "/__hot" && method === "GET") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
          });
          res.write("retry: 400\n\n");
          return;
        }
        const baseReq = createFlRequest(method, path2, query, headers, body, {}, requestId);
        for (const mw of middlewares) {
          if (!mw.pattern.exec(path2)) continue;
          try {
            let mwResult;
            if (typeof mw.handler === "string") {
              mwResult = callFn(mw.handler, [baseReq]);
            } else if (mw.handler?.kind === "function-value" && callFunctionValue) {
              mwResult = callFunctionValue(mw.handler, [baseReq]);
            }
            if (mwResult instanceof Promise) mwResult = await mwResult;
            if (mwResult !== null && mwResult !== void 0) {
              const mwStatus = mwResult.status ?? (mwResult.__fl_status ?? 200);
              const headersObj = {};
              if (mwResult.__fl_headers) Object.assign(headersObj, mwResult.__fl_headers);
              const mwBody = mwResult.__fl_response ? typeof mwResult.body === "object" ? JSON.stringify(mwResult.body) : String(mwResult.body ?? "") : typeof mwResult === "object" ? JSON.stringify(mwResult) : String(mwResult);
              const mwCT = mwResult.contentType ?? "application/json";
              sendResponse(res, mwStatus, mwBody, mwCT, headersObj);
              logAccess(method, path2, mwStatus, Date.now() - requestStart, requestId);
              return;
            }
          } catch (mwErr) {
            sendResponse(res, 500, JSON.stringify({ error: mwErr.message ?? "middleware error" }));
            return;
          }
        }
        let matched = false;
        for (const route of routes) {
          if (route.method !== method) continue;
          const match = route.pattern.exec(path2);
          if (!match) continue;
          matched = true;
          let status = 200;
          try {
            const params = {};
            for (let i = 0; i < route.params.length; i++) {
              params[route.params[i]] = match[i + 1];
            }
            const flReq = createFlRequest(method, path2, query, headers, body, params, requestId);
            let rawResult;
            if (typeof route.handler === "string") {
              rawResult = callFn(route.handler, [flReq]);
            } else if (route.handler && route.handler.__fl_static_handler === true) {
              const served = route.handler.fn(req, res, path2);
              if (served) return;
              sendResponse(res, 404, { error: "Not found" });
              return;
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
                const getField = (obj, key) => obj instanceof Map ? obj.get(key) ?? obj.get(":" + key) : obj[key];
                const resStatus = getField(result, "status");
                const resBody = getField(result, "body");
                if (result.__fl_response === true || resStatus !== void 0 && resBody !== void 0) {
                  status = resStatus ?? 200;
                  const resHeaders = getField(result, "headers") ?? {};
                  const headersObj = resHeaders instanceof Map ? Object.fromEntries(resHeaders) : resHeaders;
                  const contentType = headersObj["content-type"] ?? getField(result, "contentType") ?? "application/json";
                  sendResponse(res, status, resBody ?? "", contentType, headersObj);
                } else {
                  const hint49 = `[FreeLang #49] \uB77C\uC6B0\uD2B8 \uD578\uB4E4\uB7EC\uAC00 map\uC744 \uC9C1\uC811 \uBC18\uD658\uD588\uC2B5\uB2C8\uB2E4.
  \uC790\uB3D9\uC73C\uB85C JSON \uC9C1\uB82C\uD654\uD558\uC5EC \uC804\uC1A1\uD569\uB2C8\uB2E4.
  \uBA85\uC2DC\uC801 \uC751\uB2F5: (server-json result) \uC0AC\uC6A9\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.`;
                  if (process.env.FL_V12 === "1") {
                    sendResponse(res, 400, { error: hint49 });
                  } else {
                    console.warn(`\u26A0\uFE0F  ${hint49}`);
                    sendResponse(res, 200, result);
                  }
                }
              } else {
                sendResponse(res, 200, result ?? "");
              }
            }
            const duration = Date.now() - requestStart;
            logAccess(method, path2, status, duration, requestId);
          } catch (err) {
            const status2 = 500;
            sendResponse(res, status2, { error: err.message });
            const duration = Date.now() - requestStart;
            logAccess(method, path2, status2, duration, requestId);
          }
          return;
        }
        if (!matched) {
          const status = 404;
          sendResponse(res, status, { error: "Not Found", path: path2 });
          const duration = Date.now() - requestStart;
          logAccess(method, path2, status, duration, requestId);
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
        const _wsUrl = new URL(req.url || "/", "http://localhost");
        const _wsQuery = {};
        _wsUrl.searchParams.forEach((v, k) => {
          _wsQuery[k] = v;
        });
        const upgradeReq = {
          __fl_request: true,
          method: "WS_UPGRADE",
          path: req.url || "/",
          headers: req.headers,
          query: _wsQuery,
          body: "",
          params: {},
          session_id: sessionId
        };
        callFn(upgradeHandler, [upgradeReq]);
      });
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`[server] \uD3EC\uD2B8 ${port} \uC774\uBBF8 \uC0AC\uC6A9 \uC911 \u2014 PM2 \uC7AC\uC2DC\uC791 \uC704\uD574 \uC885\uB8CC`);
          process.exit(1);
        } else {
          console.error(`[server] \uC11C\uBC84 \uC624\uB958: ${err.message}`);
          process.exit(1);
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
    // server_json [status] obj -> response object
    // (server_json data)        → 200 JSON
    // (server_json 201 data)    → 201 JSON
    "server_json": (statusOrBody, maybeBody) => {
      const isStatus = typeof statusOrBody === "number" && statusOrBody >= 100 && statusOrBody < 600;
      return {
        __fl_response: true,
        status: isStatus ? statusOrBody : 200,
        contentType: "application/json",
        body: isStatus ? maybeBody : statusOrBody
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
      if (typeof code === "string" && typeof body === "number") {
        const hint = `server-status \uC778\uC790 \uC21C\uC11C: (server-status code body)
  \uC608: (server-status 404 "Not Found")
  \u2192 \uBC1B\uC740 \uAC12: (server-status "${code}" ${body}) \u2014 \uC22B\uC790\uC640 \uBB38\uC790\uC5F4 \uC5ED\uC804`;
        if (process.env.FL_V12 === "1") throw new Error(`[v12] ${hint}`);
        console.warn(`\u26A0\uFE0F  [FreeLang] ${hint}`);
        return { __fl_response: true, status: Number(body), contentType: "application/json", body: code };
      }
      return {
        __fl_response: true,
        status: Number(code),
        contentType: "application/json",
        body
      };
    },
    // server_html body -> response object (text/html)
    // In dev mode (FL_DEV=1), injects hot-reload script before </body>
    // so browsers auto-refresh when the FreeLang source file changes.
    "server_html": (body, statusOrUndef) => {
      const status = typeof statusOrUndef === "number" ? statusOrUndef : 200;
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
        status,
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
    // server_csp_nonce -> string (현재 요청의 CSP nonce — <script nonce=...> 등에 사용)
    "server_csp_nonce": () => currentNonce,
    // server_set_cookie name value opts -> cookie string (HttpOnly+Secure+SameSite 자동)
    "server_set_cookie": (name, value, opts = {}) => {
      let cookie = `${encodeURIComponent(String(name))}=${encodeURIComponent(String(value))}`;
      if (opts && opts["max_age"] !== void 0) cookie += `; Max-Age=${opts["max_age"]}`;
      cookie += `; Path=${opts && opts["path"] || "/"}`;
      if (opts && opts["domain"]) {
        const domain = String(opts["domain"]);
        if (!/^[a-zA-Z0-9.\-]+$/.test(domain)) throw new Error(`\uC798\uBABB\uB41C \uCFE0\uD0A4 \uB3C4\uBA54\uC778: '${domain}'`);
        cookie += `; Domain=${domain}`;
      }
      if (!opts || opts["http_only"] !== false) cookie += "; HttpOnly";
      if (!opts || opts["secure"] !== false) cookie += "; Secure";
      const ss = opts && opts["same_site"] || "Strict";
      cookie += `; SameSite=${ss}`;
      return cookie;
    },
    // server_redirect url -> response (302 리다이렉트)
    "server_redirect": (url2) => {
      return {
        __fl_response: true,
        status: 302,
        contentType: "text/plain",
        body: "",
        headers: { "Location": String(url2).replace(/[\r\n]/g, "") }
      };
    },
    // v12: 짧은 응답 별칭 — res-json / res-html / res-status / res-redirect / res-text
    "res-json": (statusOrBody, maybeBody) => {
      const isStatus = typeof statusOrBody === "number" && statusOrBody >= 100 && statusOrBody < 600;
      return {
        __fl_response: true,
        status: isStatus ? statusOrBody : 200,
        contentType: "application/json",
        body: isStatus ? maybeBody : statusOrBody
      };
    },
    "res-html": (body, status = 200) => ({
      __fl_response: true,
      status,
      contentType: "text/html; charset=utf-8",
      body
    }),
    "res-status": (code, body) => ({
      __fl_response: true,
      status: code,
      contentType: "application/json",
      body
    }),
    "res-redirect": (url2) => ({
      __fl_response: true,
      status: 302,
      contentType: "text/plain",
      body: "",
      headers: { "Location": String(url2).replace(/[\r\n]/g, "") }
    }),
    "res-text": (body, status = 200) => ({
      __fl_response: true,
      status,
      contentType: "text/plain; charset=utf-8",
      body
    }),
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
    // server_header response key value -> response (헤더 추가)
    "server_header": (response, key, value) => {
      const existing = response.headers || {};
      return { ...response, headers: { ...existing, [key]: value } };
    },
    // ── API 응답 헬퍼 ─────────────────────────────────────────────────
    // api_ok data              → 200 {:ok true :data ...}
    // api_ok "msg"             → 200 {:ok true :message ...}
    "api_ok": (data) => ({
      __fl_response: true,
      status: 200,
      contentType: "application/json",
      body: typeof data === "string" ? { ok: true, message: data } : { ok: true, data }
    }),
    // api_created data         → 201 {:ok true :data ...}
    "api_created": (data) => ({
      __fl_response: true,
      status: 201,
      contentType: "application/json",
      body: { ok: true, data }
    }),
    // api_error message [code] → 4xx/5xx {:ok false :error ...}
    // (api_error "Not found" 404)
    // (api_error "Server error")  → 500
    "api_error": (message, code) => ({
      __fl_response: true,
      status: code ?? 500,
      contentType: "application/json",
      body: { ok: false, error: message }
    }),
    // api_not_found [message]  → 404
    "api_not_found": (message) => ({
      __fl_response: true,
      status: 404,
      contentType: "application/json",
      body: { ok: false, error: message ?? "Not Found" }
    }),
    // api_bad_request [message] → 400
    "api_bad_request": (message) => ({
      __fl_response: true,
      status: 400,
      contentType: "application/json",
      body: { ok: false, error: message ?? "Bad Request" }
    }),
    // api_unauthorized [message] → 401
    "api_unauthorized": (message) => ({
      __fl_response: true,
      status: 401,
      contentType: "application/json",
      body: { ok: false, error: message ?? "Unauthorized" }
    }),
    // api_forbidden [message]  → 403
    "api_forbidden": (message) => ({
      __fl_response: true,
      status: 403,
      contentType: "application/json",
      body: { ok: false, error: message ?? "Forbidden" }
    }),
    // ── CORS 헬퍼 ────────────────────────────────────────────────────
    // server_cors response [origin] → response에 CORS 헤더 추가
    // (server_cors (server_json data))
    // (server_cors (server_json data) "https://app.example.com")
    "server_cors": (response, origin) => {
      const corsHeaders = {
        "Access-Control-Allow-Origin": origin ?? "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      };
      return { ...response, headers: { ...response.headers || {}, ...corsHeaders } };
    },
    // server_cors_all → 모든 라우트에 CORS 미들웨어 등록 (use와 함께)
    "server_cors_middleware": () => {
      return (req) => {
        if (req.method === "OPTIONS") {
          return {
            __fl_response: true,
            status: 204,
            contentType: "text/plain",
            body: "",
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
          };
        }
        return null;
      };
    },
    // server_options response -> 204 No Content (CORS preflight 응답)
    "server_options": (allowMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS") => {
      return {
        __fl_response: true,
        status: 204,
        contentType: "text/plain",
        body: "",
        headers: {
          "Access-Control-Allow-Methods": allowMethods,
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
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
    // server_req_files req -> array of multipart files
    "server_req_files": (req) => {
      const b = req.body;
      if (b instanceof Map) return b.get("files") ?? [];
      return [];
    },
    // server_req_fields req -> map of multipart text fields
    "server_req_fields": (req) => {
      const b = req.body;
      if (b instanceof Map) return b.get("fields") ?? /* @__PURE__ */ new Map();
      return null;
    },
    // server_req_header req name -> string
    "server_req_header": (req, name) => {
      const value = req.headers[name.toLowerCase()];
      if (Array.isArray(value)) return value[0];
      return value;
    },
    // server_req_headers req -> object (전체 헤더 맵)
    "server_req_headers": (req) => {
      const result = {};
      for (const [k, v] of Object.entries(req.headers)) {
        result[k] = Array.isArray(v) ? v[0] : v ?? "";
      }
      return result;
    },
    // server_req_param req name -> string
    "server_req_param": (req, name) => {
      return req.params[name] ?? null;
    },
    // server_req_params req -> object  (all URL params as an object)
    "server_req_params": (req) => {
      return req.params ?? {};
    },
    // v12: 짧은 별칭 — req-param / req-query / req-body / req-header
    "req-param": (req, name) => req.params[name] ?? null,
    "req-query": (req, key) => {
      if (key === void 0) return req.query ?? {};
      const v = (req.query ?? {})[key];
      return Array.isArray(v) ? v[0] : v ?? null;
    },
    "req-body": (req) => {
      const b = req.body;
      if (b === null || b === void 0) return null;
      if (typeof b === "object") return b;
      if (typeof b === "string") {
        try {
          return JSON.parse(b);
        } catch {
          return b;
        }
      }
      return b;
    },
    "req-header": (req, name) => {
      const v = req.headers[name.toLowerCase()];
      return Array.isArray(v) ? v[0] : v ?? null;
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
  createHttpServerModule
});
