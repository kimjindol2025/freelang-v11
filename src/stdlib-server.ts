// FreeLang v9: HTTP Server Standard Library
// Phase 20: Server functions for running HTTP services in FreeLang

import express from "express";
import { Server } from "http";

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
  };
}
