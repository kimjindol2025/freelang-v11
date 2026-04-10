import express from "express";
type CallFn = (name: string, args: any[]) => any;
/**
 * Create the HTTP server module for FreeLang v9.
 * callFn is used to invoke FreeLang functions by name when a request arrives.
 * Provides: server_get, server_post, server_put, server_delete,
 *           server_start, server_stop,
 *           server_json, server_text, server_status,
 *           server_req_body, server_req_params, server_req_query, server_req_header
 */
export declare function createServerModule(callFn: CallFn): {
    server_get: (path: string, handlerName: string) => null;
    server_post: (path: string, handlerName: string) => null;
    server_put: (path: string, handlerName: string) => null;
    server_delete: (path: string, handlerName: string) => null;
    server_start: (port: number) => string;
    server_stop: () => string;
    server_json: (body: any) => Record<string, any>;
    server_text: (body: string) => Record<string, any>;
    server_status: (code: number, body: any) => Record<string, any>;
    server_req_body: (req: express.Request) => any;
    server_req_params: (req: express.Request) => any;
    server_req_query: (req: express.Request) => any;
    server_req_header: (req: express.Request, name: string) => string | null;
    server_req_ip: (req: express.Request) => string;
    server_req_method: (req: express.Request) => string;
    server_req_path: (req: express.Request) => string;
    server_cors: (origins?: string | string[]) => null;
    server_static: (dirPath: string, route?: string) => null;
    server_log_enable: () => null;
    server_rate_limit: (max: number, windowMs: number) => null;
    server_body_limit: (limit?: string) => null;
    server_not_found: (handlerName: string) => null;
    server_error_handler: () => null;
};
export {};
//# sourceMappingURL=stdlib-server.d.ts.map