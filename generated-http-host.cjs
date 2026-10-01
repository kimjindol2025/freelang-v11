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

// src/generated-http-host.ts
var generated_http_host_exports = {};
__export(generated_http_host_exports, {
  createGeneratedHttpHost: () => createGeneratedHttpHost
});
module.exports = __toCommonJS(generated_http_host_exports);

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
  const sseConnections = /* @__PURE__ */ new Map();
  const sseRoutes = /* @__PURE__ */ new Map();
  let sseConnIdCounter = 0;
  const wsPublicMap = /* @__PURE__ */ new Map();
  let upgradeHandler = null;
  let wsClientMessageHandler = null;
  let wsClientCloseHandler = null;
  let wssPublic = null;
  let maxBodyBytes = 1024 * 1024;
  let rawBody = false;
  let rejectUnknownOrigins = false;
  let permittedOrigins = [];
  let accessLogTarget = "stdout";
  function generateRequestId() {
    const timestamp = Date.now();
    const counter = ++requestCounter;
    return `req_${timestamp}_${counter}`;
  }
  function logAccess(method, path2, status, duration, requestId) {
    const icon = status >= 400 ? "\u274C" : "\u2705";
    if (accessLogTarget === "none") return;
    const write = accessLogTarget === "stderr" ? console.error : console.log;
    write(`${icon} [${requestId}] ${method} ${path2} ${status} ${duration}ms`);
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
      let receivedBytes = 0;
      let tooLarge = false;
      req.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxBodyBytes) {
          tooLarge = true;
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        if (tooLarge) {
          resolve2({ __fl_body_too_large: true, limit: maxBodyBytes, received: receivedBytes });
          return;
        }
        const raw = Buffer.concat(chunks);
        if (rawBody) {
          try {
            resolve2(new TextDecoder("utf-8", { fatal: true }).decode(raw));
          } catch {
            resolve2({ __fl_body_invalid_utf8: true });
          }
          return;
        }
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
    // server_body_limit max_bytes → null
    "server_body_limit": (maxBytes) => {
      maxBodyBytes = Math.max(1, Math.floor(maxBytes));
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
      const config = portOrConfig !== null && typeof portOrConfig === "object" ? portOrConfig : {};
      const option = (key) => config[key] ?? config[":" + key];
      const host = option("host");
      if (host !== void 0 && typeof host !== "string") throw new Error("server_start: host must be a string");
      rawBody = option("rawBody") === true;
      rejectUnknownOrigins = option("rejectUnknownOrigins") === true;
      const origins = option("allowedOrigins") ?? [];
      if (!Array.isArray(origins) || !origins.every((origin) => typeof origin === "string")) {
        throw new Error("server_start: allowedOrigins must be an array of strings");
      }
      permittedOrigins = origins;
      const logTarget = option("accessLog") ?? "stdout";
      if (logTarget !== "stdout" && logTarget !== "stderr" && logTarget !== "none") {
        throw new Error("server_start: accessLog must be stdout, stderr, or none");
      }
      accessLogTarget = logTarget;
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
        const reqOrigin = headers["origin"];
        if (rejectUnknownOrigins && reqOrigin !== void 0 && (typeof reqOrigin !== "string" || !permittedOrigins.includes(reqOrigin))) {
          sendResponse(res, 403, "Forbidden", "text/plain; charset=utf-8");
          logAccess(method, path2, 403, Date.now() - requestStart, requestId);
          return;
        }
        const body = await readBody(req);
        const allowedOrigins = process.env.FL_ALLOWED_ORIGINS;
        if (rejectUnknownOrigins) {
          if (typeof reqOrigin === "string" && permittedOrigins.includes(reqOrigin)) {
            res.setHeader("Access-Control-Allow-Origin", reqOrigin);
            res.setHeader("Vary", "Origin");
          }
        } else if (allowedOrigins && allowedOrigins !== "*") {
          const reqOrigin2 = req.headers["origin"] || "";
          if (allowedOrigins.split(",").map((s) => s.trim()).includes(reqOrigin2)) {
            res.setHeader("Access-Control-Allow-Origin", reqOrigin2);
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
        res.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'self' 'nonce-${cspNonce}'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:;`);
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        if (body && body.__fl_body_too_large === true) {
          const status = 413;
          sendResponse(res, status, {
            ok: false,
            data: null,
            error: { code: "PAYLOAD_TOO_LARGE", limit_bytes: body.limit },
            request_id: requestId
          });
          logAccess(method, path2, status, Date.now() - requestStart, requestId);
          return;
        }
        if (body && body.__fl_body_invalid_utf8 === true) {
          sendResponse(res, 400, "Invalid UTF-8", "text/plain; charset=utf-8");
          logAccess(method, path2, 400, Date.now() - requestStart, requestId);
          return;
        }
        if (method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }
        const clientIp = process.env.FL_TRUST_PROXY === "1" ? (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim() : req.socket.remoteAddress || "unknown";
        if (!checkRateLimit(clientIp)) {
          const rlEntry = rlStore.get(clientIp);
          const retryAfterSec = rlEntry ? Math.max(1, Math.ceil((rlEntry.resetAt - Date.now()) / 1e3)) : Math.ceil(rlWindowMs / 1e3);
          const status = 429;
          sendResponse(res, status, {
            ok: false,
            data: null,
            error: { code: "RATE_LIMITED", retry_after: retryAfterSec },
            request_id: requestId
          }, "application/json", { "Retry-After": String(retryAfterSec) });
          logAccess(method, path2, status, Date.now() - requestStart, requestId);
          return;
        }
        if (method === "GET" && sseRoutes.has(path2)) {
          const sseRoute = sseRoutes.get(path2);
          const flReq = createFlRequest(method, path2, query, headers, body, {}, requestId);
          if (sseRoute.authorize) {
            try {
              const rawDecision = callFn(sseRoute.authorize, [flReq]);
              const decision = rawDecision instanceof Promise ? await rawDecision : rawDecision;
              if (decision !== null && decision !== void 0) {
                const status = decision.status ?? 403;
                sendResponse(res, status, decision.body ?? "", decision.contentType ?? "application/json", decision.headers ?? {});
                logAccess(method, path2, status, Date.now() - requestStart, requestId);
                return;
              }
            } catch (error) {
              sendResponse(res, 500, { error: error.message ?? "SSE authorization failed" });
              return;
            }
          }
          const connId = String(++sseConnIdCounter);
          const sseHeaders = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
          };
          if (rejectUnknownOrigins) {
            if (typeof reqOrigin === "string" && permittedOrigins.includes(reqOrigin)) {
              sseHeaders["Access-Control-Allow-Origin"] = reqOrigin;
              sseHeaders["Vary"] = "Origin";
            }
          } else {
            sseHeaders["Access-Control-Allow-Origin"] = res.getHeader("Access-Control-Allow-Origin")?.toString() ?? "*";
          }
          res.writeHead(200, sseHeaders);
          res.write("retry: 3000\n\n");
          sseConnections.set(connId, res);
          res.on("close", () => sseConnections.delete(connId));
          try {
            callFn(sseRoute.handler, [connId, flReq]);
          } catch (error) {
            console.error("SSE handler failed:", error instanceof Error ? error.message : String(error));
            res.end();
            sseConnections.delete(connId);
          }
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
            const isSsePending = result && typeof result === "object" && (result instanceof Map ? result.get("__fl_sse_pending") : result.__fl_sse_pending) === true;
            if (isSsePending) {
              status = 200;
              const pendingSseHeaders = {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
              };
              if (rejectUnknownOrigins && typeof reqOrigin === "string" && permittedOrigins.includes(reqOrigin)) {
                pendingSseHeaders["Access-Control-Allow-Origin"] = reqOrigin;
                pendingSseHeaders["Vary"] = "Origin";
              }
              res.writeHead(200, pendingSseHeaders);
              res.write("retry: 3000\n\n");
              sseConnections.set(requestId, res);
              res.on("close", () => sseConnections.delete(requestId));
            } else if (pendingResponses.has(requestId)) {
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
      server.on("upgrade", (req, socket, head2) => {
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
          console.warn(`[server] \uD3EC\uD2B8 ${port} \uC774\uBBF8 \uC0AC\uC6A9 \uC911 \u2014 \uC11C\uBC84 \uC2DC\uC791 \uAC74\uB108\uB700`);
        } else {
          console.error(`[server] \uC11C\uBC84 \uC624\uB958: ${err.message}`);
        }
      });
      server.listen(port, host);
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
    },
    // ── SSE (Server-Sent Events) ────────────────────────────────────
    // server_sse path handlerName [authorizeName] → null (라우트 등록)
    "server_sse": (path2, handlerName, authorizeName) => {
      sseRoutes.set(path2, { handler: handlerName, authorize: authorizeName });
      return null;
    },
    // sse_send connId data [eventId] → boolean (특정 연결에 이벤트 전송)
    "sse_send": (connId, data, eventId) => {
      if (eventId !== void 0 && (typeof eventId !== "string" || /[\r\n\0]/.test(eventId))) return false;
      const res = sseConnections.get(connId);
      if (!res || res.destroyed) {
        sseConnections.delete(connId);
        return false;
      }
      try {
        res.write(eventId === void 0 ? `data: ${data}

` : `id: ${eventId}
data: ${data}

`);
        return true;
      } catch (_e) {
        sseConnections.delete(connId);
        return false;
      }
    },
    // sse_broadcast data → integer (모든 연결에 브로드캐스트, 전송 수 반환)
    "sse_broadcast": (data) => {
      let count = 0;
      for (const [connId, res] of sseConnections) {
        if (res.destroyed) {
          sseConnections.delete(connId);
          continue;
        }
        try {
          res.write(`data: ${data}

`);
          count++;
        } catch (_e) {
          sseConnections.delete(connId);
        }
      }
      return count;
    },
    // sse_close connId → null (특정 연결 종료)
    "sse_close": (connId) => {
      const res = sseConnections.get(connId);
      if (res && !res.destroyed) res.end();
      sseConnections.delete(connId);
      return null;
    },
    // sse_alive connId → boolean (연결 유효 여부)
    "sse_alive": (connId) => {
      const res = sseConnections.get(connId);
      return !!(res && !res.destroyed);
    },
    // sse_count → integer (현재 활성 SSE 연결 수)
    "sse_count": () => sseConnections.size
  };
}

// src/stdlib-http.ts
var import_worker_threads = require("worker_threads");
var HTTP_SYNC_WORKER_SOURCE = `
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
    port.postMessage({ ...r, requestId: msg.requestId });
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
        let received = 0;
        res.on("data", (d) => {
          received += d.length;
          if (msg.maxBytes > 0 && received > msg.maxBytes) {
            done({ status: 0, body: "", error: "response-too-large" });
            req.destroy();
            return;
          }
          chunks.push(d);
        });
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
var httpWorkerState = null;
var nextHttpRequestId = 0;
function ensureHttpWorker() {
  if (httpWorkerState) return httpWorkerState;
  const sab = new SharedArrayBuffer(8);
  const signal = new Int32Array(sab);
  const { port1, port2 } = new import_worker_threads.MessageChannel();
  const worker = new import_worker_threads.Worker(HTTP_SYNC_WORKER_SOURCE, {
    eval: true,
    workerData: { sab }
  });
  worker.on("error", (err) => {
    httpWorkerState = null;
    console.error("[FreeLang] http sync worker error:", err && err.message ? err.message : err);
  });
  worker.on("exit", () => {
    httpWorkerState = null;
  });
  worker.postMessage({ port: port2 }, [port2]);
  const ready = Atomics.wait(signal, 1, 0, 5e3);
  if (ready === "timed-out" || Atomics.load(signal, 1) !== 1) {
    try {
      worker.terminate();
    } catch {
    }
    throw new Error("http sync worker failed to start");
  }
  try {
    worker.unref();
  } catch {
  }
  httpWorkerState = { worker, port: port1, signal };
  return httpWorkerState;
}
function nodeHttpRequest(url2, method = "GET", headers, body, timeoutMs = 1e4, maxBytes = 0) {
  try {
    const headersObj = {};
    if (headers && typeof headers === "object") {
      const entries = headers instanceof Map ? Array.from(headers.entries()) : Object.entries(headers);
      for (const [k, v] of entries) {
        headersObj[String(k)] = String(v);
      }
    }
    const { port, signal } = ensureHttpWorker();
    const requestId = ++nextHttpRequestId;
    port.postMessage({
      requestId,
      url: String(url2),
      method: String(method || "GET").toUpperCase(),
      headers: headersObj,
      body: body != null ? String(body) : null,
      timeoutMs,
      maxBytes
    });
    const waitMs = Math.max(1, Number(timeoutMs) || 1e4) + 2e3;
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      Atomics.exchange(signal, 0, 0);
      let packet = (0, import_worker_threads.receiveMessageOnPort)(port);
      while (packet) {
        const result = packet.message;
        if (result.requestId === requestId) {
          return {
            status: result.status || 0,
            body: result.body || "",
            ...result.error && { error: result.error }
          };
        }
        packet = (0, import_worker_threads.receiveMessageOnPort)(port);
      }
      Atomics.wait(signal, 0, 0, Math.max(1, deadline - Date.now()));
    }
    return { status: 0, body: "", error: "timeout" };
  } catch (err) {
    return { status: 0, body: "", error: err.message };
  }
}
function createHttpModule() {
  return {
    // http_get url -> {:status 200 :body "..."}
    "http_get": (url2) => {
      const result = nodeHttpRequest(url2, "GET");
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_get_bounded url max_bytes timeout_ms -> bounded HTTP result
    "http_get_bounded": (url2, maxBytes, timeoutMs) => {
      const limit = Math.min(1048576, Math.max(1, Math.floor(Number(maxBytes) || 0)));
      const timeout = Math.min(1e4, Math.max(100, Math.floor(Number(timeoutMs) || 0)));
      return nodeHttpRequest(url2, "GET", {}, void 0, timeout, limit);
    },
    // http_post url body -> {:status 200 :body "..."}
    "http_post": (url2, body) => {
      if (body !== null && typeof body === "object") {
        const hint = `http-post body\uC5D0 map\uC774 \uC804\uB2EC\uB410\uC2B5\uB2C8\uB2E4.
  v12 \uC62C\uBC14\uB978 \uBC29\uC2DD: (http-post url (json-stringify body))
  v12\uC5D0\uC11C\uB294 \uC790\uB3D9 \uC9C1\uB82C\uD654\uAC00 \uC81C\uAC70\uB429\uB2C8\uB2E4.`;
        if (process.env.FL_V12 === "1") throw new Error(`[v12] ${hint}`);
        console.warn(`\u26A0\uFE0F  [FreeLang] ${hint}`);
        body = JSON.stringify(body);
      }
      const result = nodeHttpRequest(
        url2,
        "POST",
        { "Content-Type": "application/json" },
        body
      );
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_post_form url body -> {:status 200 :body "..."}
    "http_post_form": (url2, body) => {
      const result = nodeHttpRequest(
        url2,
        "POST",
        { "Content-Type": "application/x-www-form-urlencoded" },
        body
      );
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_get_bearer url token -> {:status 200 :body "..."}
    "http_get_bearer": (url2, token) => {
      const result = nodeHttpRequest(
        url2,
        "GET",
        { "Authorization": `Bearer ${token}` }
      );
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_get_bearer_json url token -> {:status 200 :data {...}}
    "http_get_bearer_json": (url2, token) => {
      const result = nodeHttpRequest(
        url2,
        "GET",
        { "Authorization": `Bearer ${token}` }
      );
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: JSON.parse(result.body) };
      } catch (err) {
        return { status: result.status, data: null, error: err.message };
      }
    },
    // http_put url body -> {:status 200 :body "..."}
    "http_put": (url2, body) => {
      const result = nodeHttpRequest(
        url2,
        "PUT",
        { "Content-Type": "application/json" },
        body
      );
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_patch url body -> {:status 200 :body "..."}
    "http_patch": (url2, body) => {
      const result = nodeHttpRequest(
        url2,
        "PATCH",
        { "Content-Type": "application/json" },
        body
      );
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_patch_json url data -> {:status 200 :data {...}}
    "http_patch_json": (url2, data) => {
      const body = JSON.stringify(data);
      const result = nodeHttpRequest(
        url2,
        "PATCH",
        { "Content-Type": "application/json" },
        body
      );
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...result.error && { error: result.error }
        };
      } catch (err) {
        return { status: result.status, data: null, error: err.message };
      }
    },
    // http_delete url -> {:status 200 :body "..."}
    "http_delete": (url2) => {
      const result = nodeHttpRequest(url2, "DELETE");
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_delete_json url -> {:status 200 :data {...}}
    "http_delete_json": (url2) => {
      const result = nodeHttpRequest(url2, "DELETE");
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: result.body ? JSON.parse(result.body) : null };
      } catch (err) {
        return { status: result.status, data: null, error: err.message };
      }
    },
    // http_head url -> {:status 200 :body ""}
    "http_head": (url2) => {
      const result = nodeHttpRequest(url2, "HEAD");
      return {
        status: result.status,
        body: "",
        ...result.error && { error: result.error }
      };
    },
    // http_get_key url api-key -> {:status 200 :body "..."}
    "http_get_key": (url2, apiKey) => {
      const result = nodeHttpRequest(url2, "GET", { "X-API-Key": apiKey });
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_post_key url body api-key -> {:status 200 :body "..."}
    "http_post_key": (url2, body, apiKey) => {
      const result = nodeHttpRequest(
        url2,
        "POST",
        { "Content-Type": "application/json", "X-API-Key": apiKey },
        body
      );
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_status url -> number (상태코드만)
    "http_status": (url2) => {
      const result = nodeHttpRequest(url2, "GET");
      return result.status;
    },
    // http_json url -> {:status 200 :data {...} :error nil}
    "http_json": (url2) => {
      const result = nodeHttpRequest(url2, "GET");
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: JSON.parse(result.body) };
      } catch (err) {
        return { status: result.status, data: null, error: err.message };
      }
    },
    // http_with_timeout url timeout -> {:status 200 :body "..."}
    "http_with_timeout": (url2, timeout) => {
      const ms = typeof timeout === "number" && timeout > 0 ? timeout : 1e4;
      const result = nodeHttpRequest(url2, "GET", void 0, void 0, ms);
      return { status: result.status, body: result.body, ...result.error && { error: result.error } };
    },
    // http_post_json url data -> {:status 200 :data {...}}
    "http_post_json": (url2, data) => {
      const body = JSON.stringify(data);
      const result = nodeHttpRequest(
        url2,
        "POST",
        { "Content-Type": "application/json" },
        body
      );
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...result.error && { error: result.error }
        };
      } catch (err) {
        return { status: result.status, data: null, error: err.message };
      }
    },
    // http_put_json url data -> {:status 200 :data {...}}
    "http_put_json": (url2, data) => {
      const body = JSON.stringify(data);
      const result = nodeHttpRequest(
        url2,
        "PUT",
        { "Content-Type": "application/json" },
        body
      );
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...result.error && { error: result.error }
        };
      } catch (err) {
        return { status: result.status, data: null, error: err.message };
      }
    },
    // http_request method url headers body -> {:status 200 :body "..."}
    "http_request": (method, url2, headers, body) => {
      const result = nodeHttpRequest(url2, method, headers, body);
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_request_timeout method url headers body timeout_ms -> {:status 200 :body "..." :error nil}
    // timeout_ms: 최대 대기 시간 (ms). 초과 시 status:0, error:"timeout" 반환
    "http_request_timeout": (method, url2, headers, body, timeoutMs) => {
      const ms = Number(timeoutMs) || 5e3;
      const result = nodeHttpRequest(url2, method, headers, body || void 0, ms);
      return {
        status: result.status,
        body: result.body,
        ...result.error && { error: result.error }
      };
    },
    // http_req_status method url headers body -> number
    "http_req_status": (method, url2, headers, body) => {
      const result = nodeHttpRequest(url2, method, headers, body);
      return result.status;
    },
    // http_get_json url headers -> {:status 200 :data {...}}
    "http_get_json": (url2, headers) => {
      const result = nodeHttpRequest(url2, "GET", headers);
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...result.error && { error: result.error }
        };
      } catch (err) {
        return { status: result.status, data: null, error: err.message };
      }
    },
    // http_get_json_bearer url token -> {:status 200 :data {...}}
    "http_get_json_bearer": (url2, token) => {
      const result = nodeHttpRequest(
        url2,
        "GET",
        { "Authorization": `Bearer ${token}` }
      );
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...result.error && { error: result.error }
        };
      } catch (err) {
        return { status: result.status, data: null, error: err.message };
      }
    },
    // http_post_bearer url body token -> {:status 200 :body "..."}
    "http_post_bearer": (url2, body, token) => nodeHttpRequest(
      url2,
      "POST",
      { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body
    ),
    // http_parallel requests -> [{:status N :body "..."}]
    // curl 없는 환경: sequential 실행 (FreeLang 단일스레드 제약)
    "http_parallel": (requests) => {
      const getF = (obj, key) => {
        if (!obj) return null;
        return obj instanceof Map ? obj.get(key) : obj[key] ?? obj[":" + key] ?? null;
      };
      const normReqs = Array.isArray(requests) ? requests : [requests];
      return normReqs.map((req) => {
        const url2 = String(getF(req, "url") || getF(req, ":url") || "");
        const method = String(getF(req, "method") || getF(req, ":method") || "GET").toUpperCase();
        const token = getF(req, "token") || getF(req, ":token");
        const body = getF(req, "body") || getF(req, ":body") || "";
        const hdrs = {};
        if (token) hdrs["Authorization"] = `Bearer ${token}`;
        if (body) hdrs["Content-Type"] = "application/json";
        return nodeHttpRequest(url2, method, hdrs, body || void 0);
      });
    },
    // http_retry url token retries -> {:status 200 :body "..."}
    // GET with bearer token, retry up to N times on 5xx or network error (status 0)
    "http_retry": (url2, token, retries = 3) => {
      const maxRetries = Number(retries) || 3;
      let lastResult = { status: 0, body: "" };
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const result = nodeHttpRequest(url2, "GET", { "Authorization": `Bearer ${token}` });
          lastResult = result;
          if (result.status >= 200 && result.status < 500) return result;
        } catch (err) {
          lastResult = { status: 0, body: "", error: err.message };
        }
        if (i < maxRetries) {
          const delay = 200 * (i + 1);
          const start = Date.now();
          while (Date.now() - start < delay) {
          }
        }
      }
      return lastResult;
    },
    // http_retry_post url body token retries -> {:status 200 :body "..."}
    "http_retry_post": (url2, body, token, retries = 3) => {
      const maxRetries = Number(retries) || 3;
      let lastResult = { status: 0, body: "" };
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const result = nodeHttpRequest(
            url2,
            "POST",
            { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body
          );
          lastResult = result;
          if (result.status >= 200 && result.status < 500) return result;
        } catch (err) {
          lastResult = { status: 0, body: "", error: err.message };
        }
        if (i < maxRetries) {
          const delay = 200 * (i + 1);
          const start = Date.now();
          while (Date.now() - start < delay) {
          }
        }
      }
      return lastResult;
    },
    // is_http_success status -> boolean
    "is_http_success": (status) => status >= 200 && status < 300,
    // is_http_redirect status -> boolean
    "is_http_redirect": (status) => status >= 300 && status < 400,
    // is_http_error status -> boolean
    "is_http_error": (status) => status >= 400,
    // http-get-data url -> parsed JSON data | nil  (#11 해결)
    // http_get_json의 {status,data} 구조 없이 data만 직접 반환
    "http-get-data": (url2) => {
      const result = nodeHttpRequest(url2, "GET");
      if (!result.body) return null;
      try {
        return JSON.parse(result.body);
      } catch {
        return null;
      }
    },
    // http-post-data url data -> parsed JSON data | nil  (#12 해결)
    "http-post-data": (url2, data) => {
      const body = typeof data === "string" ? data : JSON.stringify(data);
      const result = nodeHttpRequest(url2, "POST", { "Content-Type": "application/json" }, body);
      if (!result.body) return null;
      try {
        return JSON.parse(result.body);
      } catch {
        return null;
      }
    },
    // http-get-status url -> number  (#13 해결)
    // GET 요청 후 status 코드만 반환
    "http-get-status": (url2) => {
      const result = nodeHttpRequest(url2, "GET");
      return result.status;
    }
  };
}

// src/stdlib-crypto.ts
var nodeCrypto = __toESM(require("crypto"));
function createCryptoModule() {
  return {
    // ── Hash ──────────────────────────────────────────────────
    // sha256 str -> string (hex digest)
    "sha256": (str) => nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex"),
    // sha256_short str -> string (first 8 chars, useful as short ID)
    "sha256_short": (str) => nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 8),
    // md5 str -> string (hex digest, for checksums only)
    "md5": (str) => nodeCrypto.createHash("md5").update(str, "utf8").digest("hex"),
    // sha1 str -> string
    "sha1": (str) => nodeCrypto.createHash("sha1").update(str, "utf8").digest("hex"),
    // hmac_sha256 key msg -> string (hex digest)
    "hmac_sha256": (key, msg) => nodeCrypto.createHmac("sha256", key).update(msg, "utf8").digest("hex"),
    // hash_eq hash1 hash2 -> boolean (timing-safe compare)
    "hash_eq": (h1, h2) => {
      if (h1.length !== h2.length) return false;
      try {
        return nodeCrypto.timingSafeEqual(Buffer.from(h1, "hex"), Buffer.from(h2, "hex"));
      } catch {
        return false;
      }
    },
    // ── Encoding ──────────────────────────────────────────────
    // base64_encode str -> string
    "base64_encode": (str) => Buffer.from(str, "utf8").toString("base64"),
    // base64_decode str -> string
    "base64_decode": (str) => Buffer.from(str, "base64").toString("utf8"),
    // base64url_encode str -> string (URL-safe, no padding)
    "base64url_encode": (str) => Buffer.from(str, "utf8").toString("base64url"),
    // base64url_decode str -> string (URL-safe Base64 → UTF-8)
    "base64url_decode": (str) => Buffer.from(str, "base64url").toString("utf8"),
    // hex_encode str -> string
    "hex_encode": (str) => Buffer.from(str, "utf8").toString("hex"),
    // hex_decode hex -> string
    "hex_decode": (hex) => Buffer.from(hex, "hex").toString("utf8"),
    // ── Random ────────────────────────────────────────────────
    // random_bytes n -> string (hex, n bytes of randomness)
    "random_bytes": (n) => nodeCrypto.randomBytes(n).toString("hex"),
    // random_int min max -> number (inclusive)
    "random_int": (min, max) => {
      const range = max - min + 1;
      return min + nodeCrypto.randomInt(range);
    },
    // random_float -> number (0.0 - 1.0)
    "random_float": () => {
      const buf = nodeCrypto.randomBytes(4);
      return buf.readUInt32BE(0) / 4294967295;
    },
    // ── UUID ──────────────────────────────────────────────────
    // uuid_v4 -> string (random UUID)
    "uuid_v4": () => nodeCrypto.randomUUID(),
    // uuid_short -> string (8-char short ID from random bytes)
    "uuid_short": () => nodeCrypto.randomBytes(4).toString("hex"),
    // uuid_from_str str -> string (deterministic ID from string content)
    "uuid_from_str": (str) => {
      const hash = nodeCrypto.createHash("sha256").update(str).digest("hex");
      return [hash.slice(0, 8), hash.slice(8, 12), "5" + hash.slice(13, 16), hash.slice(16, 20), hash.slice(20, 32)].join("-");
    },
    // is_uuid str -> boolean
    "is_uuid": (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
    // ── Regex ─────────────────────────────────────────────────
    // regex_match str pattern -> boolean
    "regex_match": (str, pattern) => {
      try {
        return new RegExp(pattern).test(str);
      } catch (e) {
        throw new Error(`regex_match: invalid pattern "${pattern}": ${e.message}`);
      }
    },
    // regex_match_i str pattern -> boolean (case insensitive)
    "regex_match_i": (str, pattern) => {
      try {
        return new RegExp(pattern, "i").test(str);
      } catch (e) {
        throw new Error(`regex_match_i: invalid pattern: ${e.message}`);
      }
    },
    // regex_find str pattern -> string|null (first match)
    "regex_find": (str, pattern) => {
      const m = str.match(new RegExp(pattern));
      return m ? m[0] : null;
    },
    // regex_find_all str pattern -> [string] (all non-overlapping matches)
    "regex_find_all": (str, pattern) => {
      const matches = str.match(new RegExp(pattern, "g"));
      return matches ?? [];
    },
    // regex_replace str pattern replacement -> string
    "regex_replace": (str, pattern, replacement) => str.replace(new RegExp(pattern, "g"), replacement),
    // regex_replace_first str pattern replacement -> string (only first match)
    "regex_replace_first": (str, pattern, replacement) => str.replace(new RegExp(pattern), replacement),
    // regex_extract str pattern -> [string] (capture groups of first match)
    "regex_extract": (str, pattern) => {
      const m = str.match(new RegExp(pattern));
      return m ? m.slice(1) : [];
    },
    // regex_extract_all str pattern -> [[string]] (all matches with groups)
    "regex_extract_all": (str, pattern) => {
      const results = [];
      const re = new RegExp(pattern, "g");
      let m;
      while ((m = re.exec(str)) !== null) {
        results.push(m.slice(1));
      }
      return results;
    },
    // regex_split str pattern -> [string]
    "regex_split": (str, pattern) => str.split(new RegExp(pattern)),
    // regex_count str pattern -> number (count of matches)
    "regex_count": (str, pattern) => {
      const m = str.match(new RegExp(pattern, "g"));
      return m ? m.length : 0;
    },
    // ── AI Text Parsing Helpers ───────────────────────────────
    // extract_json str -> any|null  (extract first JSON object/array from text)
    "extract_json": (str) => {
      const m = str.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    },
    // extract_code str lang -> string|null  (extract code block from markdown)
    "extract_code": (str, lang) => {
      const pattern = lang ? `\`\`\`${lang}\\n([\\s\\S]*?)\`\`\`` : `\`\`\`(?:\\w+)?\\n([\\s\\S]*?)\`\`\``;
      const m = str.match(new RegExp(pattern));
      return m ? m[1].trim() : null;
    },
    // extract_emails str -> [string]
    "extract_emails": (str) => str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [],
    // extract_urls str -> [string]
    "extract_urls": (str) => str.match(/https?:\/\/[^\s"'<>)]+/g) ?? [],
    // extract_numbers str -> [number]
    "extract_numbers": (str) => (str.match(/-?\d+\.?\d*/g) ?? []).map(Number),
    // is_email str -> boolean
    "is_email": (str) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str),
    // is_url str -> boolean
    "is_url": (str) => {
      try {
        new URL(str);
        return true;
      } catch {
        return false;
      }
    }
  };
}

// src/stdlib-auth.ts
var import_crypto = require("crypto");
function b64url(input) {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s) {
  return Buffer.from(s, "base64url").toString("utf8");
}
function jwtSign(payload, secret, expirySeconds) {
  const iat = Math.floor(Date.now() / 1e3);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat, exp: iat + expirySeconds }));
  const sig = b64url((0, import_crypto.createHmac)("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
function jwtVerify(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = b64url((0, import_crypto.createHmac)("sha256", secret).update(`${header}.${body}`).digest());
    const a = Buffer.from(sig + "=".repeat((4 - sig.length % 4) % 4), "base64");
    const b = Buffer.from(expected + "=".repeat((4 - expected.length % 4) % 4), "base64");
    if (a.length !== b.length || !(0, import_crypto.timingSafeEqual)(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
function createAuthModule() {
  return {
    // ── JWT ──────────────────────────────────────────────────
    // auth_jwt_sign payload secret expiry_seconds → token
    "auth_jwt_sign": (payload, secret, expiry = 3600) => {
      return jwtSign(payload, secret, expiry);
    },
    // auth_jwt_verify token secret → payload or null (null = invalid/expired)
    "auth_jwt_verify": (token, secret) => {
      return jwtVerify(token, secret);
    },
    // auth_jwt_decode token → payload (서명 미검증 — 인증 목적 사용 금지, auth_jwt_verify 사용)
    "auth_jwt_decode": (token) => {
      try {
        const [, body] = token.split(".");
        return JSON.parse(b64urlDecode(body));
      } catch {
        return null;
      }
    },
    // auth_jwt_expired token → boolean
    "auth_jwt_expired": (token) => {
      try {
        const [, body] = token.split(".");
        const { exp } = JSON.parse(b64urlDecode(body));
        return exp ? exp < Math.floor(Date.now() / 1e3) : false;
      } catch {
        return true;
      }
    },
    // ── Bearer / API Key extraction ──────────────────────────
    // auth_bearer_extract req → token string or null
    "auth_bearer_extract": (req) => {
      const auth = req?.headers?.authorization ?? req?.headers?.Authorization ?? "";
      return typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
    },
    // auth_apikey_valid req validKeys → boolean
    // Checks X-API-Key header, then ?api_key query param
    "auth_apikey_valid": (req, validKeys) => {
      const key = req?.headers?.["x-api-key"] ?? req?.query?.api_key ?? req?.body?.api_key ?? "";
      return Array.isArray(validKeys) && validKeys.includes(String(key));
    },
    // auth_apikey_get req → string (the raw key, or "")
    "auth_apikey_get": (req) => {
      return String(
        req?.headers?.["x-api-key"] ?? req?.query?.api_key ?? req?.body?.api_key ?? ""
      );
    },
    // ── Password hashing ──────────────────────────────────
    // v1: SHA256+salt (legacy, 빠른 단점)
    // v2: scrypt (RFC 7914, memory-hard, 산업 표준급)
    //
    // 신규 비밀번호는 v2 사용. 기존 v1 해시는 verify 시 성공하면 v2로 자동 마이그레이션
    // (호출 측에서 새 해시 받아 DB 업데이트).
    //
    // 형식:
    //   v1: "salt_hex:sha256_hex"
    //   v2: "$scrypt$N=16384,r=8,p=1$salt_b64$hash_b64"   (PHC 풍 식별자)
    // auth_hash_password password → "$scrypt$..." (v2)
    "auth_hash_password": (password) => {
      const N = 16384, r = 8, p = 1, keyLen = 64;
      const salt = (0, import_crypto.randomBytes)(16);
      const hash = (0, import_crypto.scryptSync)(password, salt, keyLen, { N, r, p });
      return `$scrypt$N=${N},r=${r},p=${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
    },
    // auth_verify_password password stored → boolean
    // 두 포맷 모두 자동 인식.
    "auth_verify_password": (password, stored) => {
      try {
        if (stored.startsWith("$scrypt$")) {
          const parts = stored.split("$");
          if (parts.length !== 5) return false;
          const params = Object.fromEntries(
            parts[2].split(",").map((kv) => kv.split("=").map((s) => s.trim()))
          );
          const N = Number(params.N), r = Number(params.r), p = Number(params.p);
          const salt2 = Buffer.from(parts[3], "base64");
          const expected = Buffer.from(parts[4], "base64");
          const computed2 = (0, import_crypto.scryptSync)(password, salt2, expected.length, { N, r, p });
          return expected.length === computed2.length && (0, import_crypto.timingSafeEqual)(expected, computed2);
        }
        const [salt, hash] = stored.split(":");
        const computed = (0, import_crypto.createHash)("sha256").update(salt + password).digest("hex");
        const a = Buffer.from(hash, "hex");
        const b = Buffer.from(computed, "hex");
        return a.length === b.length && (0, import_crypto.timingSafeEqual)(a, b);
      } catch {
        return false;
      }
    },
    // auth_password_needs_rehash stored → boolean
    // true면 호출 측은 새로 hash 후 DB 업데이트 (점진적 v1→v2 마이그레이션)
    "auth_password_needs_rehash": (stored) => {
      return !stored.startsWith("$scrypt$");
    },
    // ── Tokens / HMAC ────────────────────────────────────────
    // auth_random_token bytes → hex string
    "auth_random_token": (bytes = 32) => {
      return (0, import_crypto.randomBytes)(bytes).toString("hex");
    },
    // auth_hmac data secret → hex-string (소문자 hex 64자)
    // ※ secret은 UTF-8 문자열로 처리됨. SigV4 key chain에서 hex 출력을 다음 key로 재사용 가능.
    // ⚠️ SigV4 정식 구현 시 raw-bytes key 필요 → auth_hmac_raw 사용 권장 (LIR-003)
    "auth_hmac": (data, secret) => {
      return (0, import_crypto.createHmac)("sha256", secret).update(data).digest("hex");
    },
    // auth_sha256 data → hex-string (소문자 hex 64자)
    "auth_sha256": (data) => {
      return (0, import_crypto.createHash)("sha256").update(data).digest("hex");
    },
    // auth_base64 data → base64 string
    "auth_base64": (data) => Buffer.from(data).toString("base64"),
    // auth_base64_decode b64 → string
    "auth_base64_decode": (b64) => Buffer.from(b64, "base64").toString("utf8"),
    // ── CSRF 방어 ────────────────────────────────────────
    // auth_csrf_token secret → "timestamp.hmac" (60분 유효)
    "auth_csrf_token": (secret) => {
      const ts = Math.floor(Date.now() / 1e3).toString();
      const sig = (0, import_crypto.createHmac)("sha256", secret).update(ts).digest("hex").slice(0, 16);
      return `${ts}.${sig}`;
    },
    // auth_csrf_verify token secret → boolean
    "auth_csrf_verify": (token, secret) => {
      const parts = (token || "").split(".");
      if (parts.length !== 2) return false;
      const [ts, sig] = parts;
      const age = Math.floor(Date.now() / 1e3) - parseInt(ts, 10);
      if (isNaN(age) || age < 0 || age > 3600) return false;
      const expected = (0, import_crypto.createHmac)("sha256", secret).update(ts).digest("hex").slice(0, 16);
      return sig.length === expected.length && (0, import_crypto.timingSafeEqual)(Buffer.from(sig), Buffer.from(expected));
    }
  };
}

// src/stdlib-time.ts
var LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
function createTimeModule() {
  return {
    // ── Time ──────────────────────────────────────────────────
    // now -> string (ISO 8601; use now_ms for numeric timestamps)
    "now": () => (/* @__PURE__ */ new Date()).toISOString(),
    // now_ms -> number (ms since epoch, always returns number)
    "now_ms": () => Date.now(),
    // now_iso -> string (ISO 8601)
    "now_iso": () => (/* @__PURE__ */ new Date()).toISOString(),
    // now_unix -> number (seconds since epoch)
    "now_unix": () => Math.floor(Date.now() / 1e3),
    // time_diff t1 t2 -> number (ms, positive if t2 > t1)
    "time_diff": (t1, t2) => new Date(t2).getTime() - new Date(t1).getTime(),
    // time_since ts -> number (ms elapsed since ts)
    "time_since": (ts) => Date.now() - new Date(ts).getTime(),
    // time_ago ts -> string (human-readable: "3s ago", "2m ago", "1h ago")
    "time_ago": (ts) => {
      const ms = Date.now() - new Date(ts).getTime();
      if (ms < 1e3) return `${ms}ms ago`;
      if (ms < 6e4) return `${Math.floor(ms / 1e3)}s ago`;
      if (ms < 36e5) return `${Math.floor(ms / 6e4)}m ago`;
      if (ms < 864e5) return `${Math.floor(ms / 36e5)}h ago`;
      return `${Math.floor(ms / 864e5)}d ago`;
    },
    // format_date ts fmt -> string  (simple date formatting)
    // fmt tokens: YYYY MM DD HH mm ss SSS
    "format_date": (ts, fmt) => {
      const d = new Date(ts);
      return fmt.replace("YYYY", String(d.getFullYear())).replace("MM", String(d.getMonth() + 1).padStart(2, "0")).replace("DD", String(d.getDate()).padStart(2, "0")).replace("HH", String(d.getHours()).padStart(2, "0")).replace("mm", String(d.getMinutes()).padStart(2, "0")).replace("ss", String(d.getSeconds()).padStart(2, "0")).replace("SSS", String(d.getMilliseconds()).padStart(3, "0"));
    },
    // date_parts ts -> {year,month,day,hour,min,sec,ms,weekday}
    "date_parts": (ts) => {
      const d = new Date(ts);
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        min: d.getMinutes(),
        sec: d.getSeconds(),
        ms: d.getMilliseconds(),
        weekday: d.getDay()
      };
    },
    // date_add ts unit n -> number  (unit: "ms"|"s"|"m"|"h"|"d"|"days"|"hours"|"minutes"|"months"|"years"|"weeks"|"seconds")
    "date_add": (ts, unit, n) => {
      const u = String(unit).replace(/^:/, "");
      const mul = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
      if (mul[u] !== void 0) return ts + n * mul[u];
      const d = new Date(Number(ts));
      if (u === "days" || u === "day") {
        d.setDate(d.getDate() + Number(n));
        return d.getTime();
      }
      if (u === "hours" || u === "hour") {
        d.setHours(d.getHours() + Number(n));
        return d.getTime();
      }
      if (u === "minutes" || u === "minute") {
        d.setMinutes(d.getMinutes() + Number(n));
        return d.getTime();
      }
      if (u === "months" || u === "month") {
        d.setMonth(d.getMonth() + Number(n));
        return d.getTime();
      }
      if (u === "years" || u === "year") {
        d.setFullYear(d.getFullYear() + Number(n));
        return d.getTime();
      }
      if (u === "seconds" || u === "second") {
        d.setSeconds(d.getSeconds() + Number(n));
        return d.getTime();
      }
      if (u === "weeks" || u === "week") {
        d.setDate(d.getDate() + Number(n) * 7);
        return d.getTime();
      }
      throw new Error(`date_add: unknown unit "${unit}". Use: ms/s/m/h/d/days/hours/minutes/months/years/weeks`);
    },
    // date_parse str -> number  ("2026-04-23" | "2026-04-23T12:00:00Z" -> timestamp ms)
    "date_parse": (str) => {
      const ts = Date.parse(str);
      if (isNaN(ts)) throw new Error(`date_parse: invalid date string "${str}"`);
      return ts;
    },
    // sleep_ms ms -> void  (synchronous spin-wait, short durations only)
    "sleep_ms": (ms) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
      }
    },
    // ── Timer ─────────────────────────────────────────────────
    // timer_start label -> Timer
    "timer_start": (label) => ({
      start: Date.now(),
      label,
      laps: []
    }),
    // timer_lap timer label -> Timer (record a lap time)
    "timer_lap": (timer, label) => ({
      ...timer,
      laps: [...timer.laps, { label, elapsed: Date.now() - timer.start }]
    }),
    // timer_elapsed timer -> number (ms since start)
    "timer_elapsed": (timer) => Date.now() - timer.start,
    // timer_stop timer -> {label, total_ms, laps}
    "timer_stop": (timer) => ({
      label: timer.label,
      total_ms: Date.now() - timer.start,
      laps: timer.laps
    }),
    // ── Logger ────────────────────────────────────────────────
    // log_create name level -> Logger  (level = minimum level to record)
    "log_create": (name, level = "info") => ({
      name,
      entries: [],
      level
    }),
    // log_entry logger level msg data? -> Logger
    "log_entry": (logger, level, msg, data) => {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[logger.level]) return logger;
      const entry = { ts: Date.now(), level, msg };
      if (data !== void 0) entry.data = data;
      return { ...logger, entries: [...logger.entries, entry] };
    },
    // log_info logger msg -> Logger
    "log_info": (logger, msg) => {
      if (LEVEL_ORDER["info"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "info", msg }] };
    },
    // log_warn logger msg -> Logger
    "log_warn": (logger, msg) => {
      if (LEVEL_ORDER["warn"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "warn", msg }] };
    },
    // log_error logger msg -> Logger
    "log_error": (logger, msg) => ({
      ...logger,
      entries: [...logger.entries, { ts: Date.now(), level: "error", msg }]
    }),
    // log_debug logger msg -> Logger
    "log_debug": (logger, msg) => {
      if (LEVEL_ORDER["debug"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "debug", msg }] };
    },
    // log_filter logger level -> [LogEntry]  (entries at or above level)
    "log_filter": (logger, level) => logger.entries.filter((e) => LEVEL_ORDER[e.level] >= LEVEL_ORDER[level]),
    // log_count logger level -> number
    "log_count": (logger, level) => logger.entries.filter((e) => e.level === level).length,
    // log_last logger n -> [LogEntry]
    "log_last": (logger, n) => logger.entries.slice(-n),
    // log_dump logger -> void  (print all entries to stdout)
    "log_dump": (logger) => {
      const pad = (s) => s.padEnd(5);
      for (const e of logger.entries) {
        const ts = new Date(e.ts).toISOString().slice(11, 23);
        const lvl = `[${pad(e.level.toUpperCase())}]`;
        const data = e.data !== void 0 ? ` | ${JSON.stringify(e.data)}` : "";
        console.log(`${ts} ${lvl} [${logger.name}] ${e.msg}${data}`);
      }
    },
    // ── Metrics ───────────────────────────────────────────────
    // metrics_create name -> Metrics
    "metrics_create": (name) => ({
      name,
      values: {},
      counters: {},
      timers: {}
    }),
    // metrics_record metrics key value -> Metrics
    "metrics_record": (m, key, value) => ({
      ...m,
      values: { ...m.values, [key]: [...m.values[key] ?? [], value] }
    }),
    // metrics_inc metrics key -> Metrics  (increment counter by 1)
    "metrics_inc": (m, key) => ({
      ...m,
      counters: { ...m.counters, [key]: (m.counters[key] ?? 0) + 1 }
    }),
    // metrics_inc_by metrics key n -> Metrics
    "metrics_inc_by": (m, key, n) => ({
      ...m,
      counters: { ...m.counters, [key]: (m.counters[key] ?? 0) + n }
    }),
    // metrics_count metrics key -> number
    "metrics_count": (m, key) => m.counters[key] ?? 0,
    // metrics_avg metrics key -> number
    "metrics_avg": (m, key) => {
      const vals = m.values[key] ?? [];
      if (vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    },
    // metrics_min metrics key -> number
    "metrics_min": (m, key) => {
      const vals = m.values[key] ?? [];
      return vals.length ? Math.min(...vals) : 0;
    },
    // metrics_max metrics key -> number
    "metrics_max": (m, key) => {
      const vals = m.values[key] ?? [];
      return vals.length ? Math.max(...vals) : 0;
    },
    // metrics_p95 metrics key -> number  (95th percentile)
    "metrics_p95": (m, key) => {
      const vals = [...m.values[key] ?? []].sort((a, b) => a - b);
      if (vals.length === 0) return 0;
      return vals[Math.floor(vals.length * 0.95)];
    },
    // metrics_summary metrics -> {key: {count, avg, min, max}}
    "metrics_summary": (m) => {
      const result = {};
      for (const [key, vals] of Object.entries(m.values)) {
        const sorted = [...vals].sort((a, b) => a - b);
        result[key] = {
          count: vals.length,
          avg: vals.reduce((a, b) => a + b, 0) / vals.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p95: sorted[Math.floor(sorted.length * 0.95)]
        };
      }
      for (const [key, count] of Object.entries(m.counters)) {
        result[`counter.${key}`] = { count };
      }
      return result;
    }
  };
}

// src/sis-bus.ts
var E_TIMER_EXCEPTION = 1;
var E_EVENT_DROPPED = 3;
var CAP = 4096;
var ring = new Array(CAP);
var head = 0;
var tail = 0;
var emit_count = 0;
var received_count = 0;
var dropped_count = 0;
var dropped_since_notice = 0;
var drop_latch = null;
var drop_latch_seq = 0;
function ringPush(type, payload) {
  const next = (head + 1) % CAP;
  if (next === tail) return false;
  ring[head] = { ts: Date.now(), type, payload };
  head = next;
  received_count++;
  return true;
}
var QUARANTINE_THRESHOLD = 3;
var policyState = /* @__PURE__ */ new Map();
var policy_event_count = 0;
var policy_fire_count = 0;
var quarantine_count = 0;
var policy_error_count = 0;
function sisPolicyOnEvent(type, payload) {
  policy_event_count++;
  if (type !== E_TIMER_EXCEPTION) return;
  const tid = payload && payload.timer_id || 0;
  let s = policyState.get(tid);
  if (!s) {
    s = { score: 0, quarantined: false };
    policyState.set(tid, s);
  }
  s.score++;
  if (s.score >= QUARANTINE_THRESHOLD && !s.quarantined) {
    s.quarantined = true;
    quarantine_count++;
    policy_fire_count++;
    console.error(`[SIS] event=E_TIMER_EXCEPTION score=${s.score} quarantined=true action=QUARANTINE timer=${tid}`);
  }
}
function sisEmit(type, payload) {
  emit_count++;
  if (dropped_since_notice > 0 && type !== E_EVENT_DROPPED) {
    if (ringPush(E_EVENT_DROPPED, { emit_count, dropped_count })) dropped_since_notice = 0;
  }
  const ok = ringPush(type, payload);
  if (!ok) {
    dropped_count++;
    dropped_since_notice++;
    drop_latch = { emit_count, dropped_count };
    drop_latch_seq++;
  }
  try {
    sisPolicyOnEvent(type, payload);
  } catch {
    policy_error_count++;
  }
  return ok;
}
function sisStats() {
  const queued = (head + CAP - tail) % CAP;
  return {
    emit_count,
    received_count,
    dropped_count,
    queued,
    drop_latch_seq,
    drop_latch,
    invariant_ok: emit_count === received_count + dropped_count,
    // Phase 3 정책 카운터
    policy_event_count,
    policy_fire_count,
    quarantine_count,
    policy_error_count
  };
}

// src/stdlib-timer.ts
var timerRegistry = /* @__PURE__ */ new Map();
var nextTimerId = 2e3;
var intervalStats = /* @__PURE__ */ new Map();
function createTimerModule(interpreter) {
  return {
    // set_interval fn ms -> number (fn: function name string, ms: interval)
    "set_interval": (fnName, ms) => {
      try {
        const isFnObj = fnName && typeof fnName === "object" && fnName.body !== void 0;
        if (typeof fnName !== "string" && !isFnObj) {
          throw new Error(`Function name must be string or function, got ${typeof fnName}`);
        }
        if (typeof ms !== "number" || ms < 1) {
          throw new Error(`Interval must be positive number, got ${ms}`);
        }
        const timerId = nextTimerId++;
        intervalStats.set(timerId, { ticks: 0, missed: 0, lastError: null, lastErrorAt: 0 });
        const callback = () => {
          const st = intervalStats.get(timerId);
          if (st) st.ticks++;
          try {
            if (isFnObj) {
              interpreter.callFunction(fnName, []);
            } else {
              interpreter.callUserFunction(fnName, []);
            }
          } catch (err) {
            if (st) {
              st.missed++;
              st.lastError = err.message;
              st.lastErrorAt = Date.now();
            }
            sisEmit(E_TIMER_EXCEPTION, { timer_id: timerId, exception_count: st ? st.missed : 0 });
            const label = isFnObj ? "<fn>" : fnName;
            console.error(`set_interval callback error for '${label}':`, err.message);
          }
        };
        const nodeTimer = setInterval(callback, ms);
        timerRegistry.set(timerId, nodeTimer);
        return timerId;
      } catch (err) {
        throw new Error(`set_interval failed: ${err.message}`);
      }
    },
    // clear_interval timerId -> boolean (stop periodic timer)
    "clear_interval": (timerId) => {
      try {
        const nodeTimer = timerRegistry.get(timerId);
        if (nodeTimer === void 0) {
          return false;
        }
        clearInterval(nodeTimer);
        timerRegistry.delete(timerId);
        intervalStats.delete(timerId);
        return true;
      } catch (err) {
        throw new Error(`clear_interval failed: ${err.message}`);
      }
    },
    // interval_stats [timerId] -> stat | {id: stat,...}  (FL-P1 / ROS R9)
    // Exposes silently-skipped ticks. healthy = (missed === 0).
    // No arg: returns all live interval stats. Unknown id: nil.
    // A watchdog polls this and alarms when missed > 0 or ticks stop advancing.
    "interval_stats": (timerId) => {
      if (timerId === void 0 || timerId === null) {
        const out = {};
        for (const [id, st2] of intervalStats) {
          out[String(id)] = { ...st2, healthy: st2.missed === 0 };
        }
        return out;
      }
      const st = intervalStats.get(timerId);
      if (st === void 0) return null;
      return { ...st, healthy: st.missed === 0 };
    },
    // set_timeout fn ms -> number (fn: function name string, ms: delay)
    "set_timeout": (fnName, ms) => {
      try {
        if (typeof fnName !== "string") {
          throw new Error(`Function name must be string, got ${typeof fnName}`);
        }
        if (typeof ms !== "number" || ms < 1) {
          throw new Error(`Timeout must be positive number, got ${ms}`);
        }
        const timerId = nextTimerId++;
        const callback = () => {
          try {
            interpreter.callUserFunction(fnName, []);
          } catch (err) {
            console.error(`set_timeout callback error for '${fnName}':`, err.message);
          }
          timerRegistry.delete(timerId);
        };
        const nodeTimer = setTimeout(callback, ms);
        timerRegistry.set(timerId, nodeTimer);
        return timerId;
      } catch (err) {
        throw new Error(`set_timeout failed: ${err.message}`);
      }
    },
    // clear_timeout timerId -> boolean (cancel one-time timer)
    "clear_timeout": (timerId) => {
      try {
        const nodeTimer = timerRegistry.get(timerId);
        if (nodeTimer === void 0) {
          return false;
        }
        clearTimeout(nodeTimer);
        timerRegistry.delete(timerId);
        return true;
      } catch (err) {
        throw new Error(`clear_timeout failed: ${err.message}`);
      }
    },
    // timer_count -> number (returns count of active timers)
    "timer_count": () => {
      return timerRegistry.size;
    },
    // SIS Phase 2: Evidence Bus 통계 노출(검증/관측용)
    "sis_stats": () => sisStats(),
    // timer_clear_all -> boolean (clear all active timers)
    "timer_clear_all": () => {
      try {
        for (const nodeTimer of timerRegistry.values()) {
          clearInterval(nodeTimer);
          clearTimeout(nodeTimer);
        }
        timerRegistry.clear();
        return true;
      } catch (err) {
        throw new Error(`timer_clear_all failed: ${err.message}`);
      }
    }
  };
}

// src/generated-http-host.ts
function createGeneratedHttpHost(callFn) {
  const interpreter = {
    callUserFunction: callFn,
    callFunction: (fn, args) => fn(...args)
  };
  return {
    ...createHttpServerModule(callFn),
    ...createHttpModule(),
    ...createCryptoModule(),
    ...createAuthModule(),
    ...createTimeModule(),
    ...createTimerModule(interpreter)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createGeneratedHttpHost
});
