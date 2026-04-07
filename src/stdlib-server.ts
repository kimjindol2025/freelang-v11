// FreeLang v9: HTTP Server Standard Library
// Phase 20-21: Server functions + middleware for running HTTP services in FreeLang

import express from "express";
import { Server } from "http";
import * as path from "path";

type CallFn = (name: string, args: any[]) => any;

/**
 * Create the HTTP server module for FreeLang v9.
 * callFn is used to invoke FreeLang functions by name when a request arrives.
 * Provides: server_get, server_post, server_put, server_delete,
 *           server_start, server_stop,
 *           server_json, server_text, server_status,
 *           server_req_body, server_req_params, server_req_query, server_req_header
 */
export function createServerModule(callFn: CallFn) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  let server: Server | null = null;

  function handleRoute(handlerName: string, req: express.Request, res: express.Response) {
    try {
      const result = callFn(handlerName, [req]);
      if (result && typeof result === "object" && result.__fl_response === true) {
        const status = result.status ?? 200;
        if (result.type === "json") {
          res.status(status).json(result.body);
        } else {
          res.status(status).type("text").send(String(result.body ?? ""));
        }
      } else if (typeof result === "object" && result !== null) {
        res.json(result);
      } else {
        res.send(String(result ?? ""));
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  return {
    // server_get path handlerName
    "server_get": (path: string, handlerName: string): null => {
      app.get(path, (req, res) => handleRoute(handlerName, req, res));
      return null;
    },

    // server_post path handlerName
    "server_post": (path: string, handlerName: string): null => {
      app.post(path, (req, res) => handleRoute(handlerName, req, res));
      return null;
    },

    // server_put path handlerName
    "server_put": (path: string, handlerName: string): null => {
      app.put(path, (req, res) => handleRoute(handlerName, req, res));
      return null;
    },

    // server_delete path handlerName
    "server_delete": (path: string, handlerName: string): null => {
      app.delete(path, (req, res) => handleRoute(handlerName, req, res));
      return null;
    },

    // server_start port -> "listening on <port>"  (event loop stays alive via HTTP server)
    "server_start": (port: number): string => {
      server = app.listen(port);
      console.log(`[FreeLang] server listening on :${port}`);
      return `listening on ${port}`;
    },

    // server_stop -> "stopped"
    "server_stop": (): string => {
      if (server) {
        server.close();
        server = null;
        return "stopped";
      }
      return "not running";
    },

    // server_json body -> response descriptor
    "server_json": (body: any): Record<string, any> => ({
      __fl_response: true, type: "json", status: 200, body,
    }),

    // server_text body -> response descriptor
    "server_text": (body: string): Record<string, any> => ({
      __fl_response: true, type: "text", status: 200, body,
    }),

    // server_status code body -> response descriptor
    "server_status": (code: number, body: any): Record<string, any> => ({
      __fl_response: true,
      type: typeof body === "string" ? "text" : "json",
      status: code,
      body,
    }),

    // server_req_body req -> body object
    "server_req_body": (req: express.Request): any => req?.body ?? null,

    // server_req_params req -> path params object
    "server_req_params": (req: express.Request): any => req?.params ?? {},

    // server_req_query req -> query string object
    "server_req_query": (req: express.Request): any => req?.query ?? {},

    // server_req_header req name -> string
    "server_req_header": (req: express.Request, name: string): string | null =>
      (req?.headers?.[name.toLowerCase()] as string) ?? null,

    // server_req_ip req → client IP string
    "server_req_ip": (req: express.Request): string =>
      String(req?.headers?.["x-forwarded-for"] ?? req?.ip ?? "unknown"),

    // server_req_method req → "GET" | "POST" | etc.
    "server_req_method": (req: express.Request): string => req?.method ?? "",

    // server_req_path req → "/path/to/resource"
    "server_req_path": (req: express.Request): string => req?.path ?? "",

    // ── Middleware ────────────────────────────────────────────

    // server_cors origins → null  (call before server_start)
    // origins: "*" | "https://example.com" | ["https://a.com","https://b.com"]
    "server_cors": (origins: string | string[] = "*"): null => {
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
        if (req.method === "OPTIONS") { res.sendStatus(204); return; }
        next();
      });
      return null;
    },

    // server_static dirPath route? → null  (serve static files)
    "server_static": (dirPath: string, route: string = "/"): null => {
      app.use(route, express.static(path.resolve(dirPath)));
      return null;
    },

    // server_log_enable → null  (request logging middleware)
    "server_log_enable": (): null => {
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
    "server_rate_limit": (max: number, windowMs: number): null => {
      const hits = new Map<string, { count: number; resetAt: number }>();
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
    "server_body_limit": (limit: string = "1mb"): null => {
      app.use(express.json({ limit }));
      app.use(express.urlencoded({ extended: true, limit }));
      return null;
    },

    // server_not_found handlerName → null  (404 fallback)
    "server_not_found": (handlerName: string): null => {
      app.use((req, res) => handleRoute(handlerName, req, res));
      return null;
    },

    // server_error_handler → null  (generic 500 handler with error info)
    "server_error_handler": (): null => {
      app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error("[FreeLang server error]", err);
        res.status(500).json({ error: err.message ?? "Internal Server Error" });
      });
      return null;
    },
  };
}
