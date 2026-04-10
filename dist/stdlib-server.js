"use strict";
// FreeLang v9: HTTP Server Standard Library
// Phase 20-21: Server functions + middleware for running HTTP services in FreeLang
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServerModule = createServerModule;
const express_1 = __importDefault(require("express"));
const path = __importStar(require("path"));
/**
 * Create the HTTP server module for FreeLang v9.
 * callFn is used to invoke FreeLang functions by name when a request arrives.
 * Provides: server_get, server_post, server_put, server_delete,
 *           server_start, server_stop,
 *           server_json, server_text, server_status,
 *           server_req_body, server_req_params, server_req_query, server_req_header
 */
function createServerModule(callFn) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    let server = null;
    function handleRoute(handlerName, req, res) {
        try {
            const result = callFn(handlerName, [req]);
            if (result && typeof result === "object" && result.__fl_response === true) {
                const status = result.status ?? 200;
                if (result.type === "json") {
                    res.status(status).json(result.body);
                }
                else {
                    res.status(status).type("text").send(String(result.body ?? ""));
                }
            }
            else if (typeof result === "object" && result !== null) {
                res.json(result);
            }
            else {
                res.send(String(result ?? ""));
            }
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    return {
        // server_get path handlerName
        "server_get": (path, handlerName) => {
            app.get(path, (req, res) => handleRoute(handlerName, req, res));
            return null;
        },
        // server_post path handlerName
        "server_post": (path, handlerName) => {
            app.post(path, (req, res) => handleRoute(handlerName, req, res));
            return null;
        },
        // server_put path handlerName
        "server_put": (path, handlerName) => {
            app.put(path, (req, res) => handleRoute(handlerName, req, res));
            return null;
        },
        // server_delete path handlerName
        "server_delete": (path, handlerName) => {
            app.delete(path, (req, res) => handleRoute(handlerName, req, res));
            return null;
        },
        // server_start port -> "listening on <port>"  (event loop stays alive via HTTP server)
        "server_start": (port) => {
            server = app.listen(port);
            console.log(`[FreeLang] server listening on :${port}`);
            return `listening on ${port}`;
        },
        // server_stop -> "stopped"
        "server_stop": () => {
            if (server) {
                server.close();
                server = null;
                return "stopped";
            }
            return "not running";
        },
        // server_json body -> response descriptor
        "server_json": (body) => {
            // (list :key value ...) → plain object 변환
            if (Array.isArray(body)) {
                const obj = {};
                for (let i = 0; i < body.length; i += 2) {
                    let k = body[i];
                    const v = body[i + 1];
                    if (typeof k === "string" && k.startsWith(":"))
                        k = k.slice(1);
                    if (typeof k === "string")
                        obj[k] = v;
                }
                body = obj;
            }
            return { __fl_response: true, type: "json", status: 200, body };
        },
        // server_text body -> response descriptor
        "server_text": (body) => ({
            __fl_response: true, type: "text", status: 200, body,
        }),
        // server_status code body -> response descriptor
        "server_status": (code, body) => {
            if (Array.isArray(body)) {
                const obj = {};
                for (let i = 0; i < body.length; i += 2) {
                    let k = body[i];
                    const v = body[i + 1];
                    if (typeof k === "string" && k.startsWith(":"))
                        k = k.slice(1);
                    if (typeof k === "string")
                        obj[k] = v;
                }
                body = obj;
            }
            return { __fl_response: true, type: typeof body === "string" ? "text" : "json", status: code, body };
        },
        // server_req_body req -> body object
        "server_req_body": (req) => req?.body ?? null,
        // server_req_params req -> path params object
        "server_req_params": (req) => req?.params ?? {},
        // server_req_query req -> query string object
        "server_req_query": (req) => req?.query ?? {},
        // server_req_header req name -> string
        "server_req_header": (req, name) => req?.headers?.[name.toLowerCase()] ?? null,
        // server_req_ip req → client IP string
        "server_req_ip": (req) => String(req?.headers?.["x-forwarded-for"] ?? req?.ip ?? "unknown"),
        // server_req_method req → "GET" | "POST" | etc.
        "server_req_method": (req) => req?.method ?? "",
        // server_req_path req → "/path/to/resource"
        "server_req_path": (req) => req?.path ?? "",
        // ── Middleware ────────────────────────────────────────────
        // server_cors origins → null  (call before server_start)
        // origins: "*" | "https://example.com" | ["https://a.com","https://b.com"]
        "server_cors": (origins = "*") => {
            const allowed = Array.isArray(origins) ? origins : [origins];
            app.use((req, res, next) => {
                const origin = req.headers.origin ?? "";
                const allow = allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : "");
                if (allow) {
                    res.header("Access-Control-Allow-Origin", allow);
                    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
                    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-API-Key");
                    res.header("Access-Control-Allow-Credentials", "true");
                }
                if (req.method === "OPTIONS") {
                    res.sendStatus(204);
                    return;
                }
                next();
            });
            return null;
        },
        // server_static dirPath route? → null  (serve static files)
        "server_static": (dirPath, route = "/") => {
            app.use(route, express_1.default.static(path.resolve(dirPath)));
            return null;
        },
        // server_log_enable → null  (request logging middleware)
        "server_log_enable": () => {
            app.use((req, res, next) => {
                const start = Date.now();
                res.on("finish", () => {
                    const ms = Date.now() - start;
                    const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "-");
                    process.stdout.write(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms ${ip}\n`);
                });
                next();
            });
            return null;
        },
        // server_rate_limit max windowMs → null  (per-IP sliding window)
        "server_rate_limit": (max, windowMs) => {
            const hits = new Map();
            app.use((req, res, next) => {
                const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "unknown");
                const now = Date.now();
                const entry = hits.get(ip);
                if (!entry || now > entry.resetAt) {
                    hits.set(ip, { count: 1, resetAt: now + windowMs });
                    return next();
                }
                entry.count++;
                if (entry.count > max) {
                    res.status(429).json({ error: "Too Many Requests" });
                    return;
                }
                next();
            });
            return null;
        },
        // server_body_limit limit → null  (e.g. "5mb")
        "server_body_limit": (limit = "1mb") => {
            app.use(express_1.default.json({ limit }));
            app.use(express_1.default.urlencoded({ extended: true, limit }));
            return null;
        },
        // server_not_found handlerName → null  (404 fallback)
        "server_not_found": (handlerName) => {
            app.use((req, res) => handleRoute(handlerName, req, res));
            return null;
        },
        // server_error_handler → null  (generic 500 handler with error info)
        "server_error_handler": () => {
            app.use((err, req, res, next) => {
                console.error("[FreeLang server error]", err);
                res.status(500).json({ error: err.message ?? "Internal Server Error" });
            });
            return null;
        },
    };
}
//# sourceMappingURL=stdlib-server.js.map