type CallFn = (name: string, args: any[]) => any;
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
export declare function createHttpServerModule(callFn: CallFn): {
    server_get: (path: string, handlerName: string) => null;
    server_post: (path: string, handlerName: string) => null;
    server_put: (path: string, handlerName: string) => null;
    server_patch: (path: string, handlerName: string) => null;
    server_delete: (path: string, handlerName: string) => null;
    server_start: (port: number) => string;
    server_stop: () => null;
    server_json: (body: any) => Record<string, any>;
    server_text: (body: string) => Record<string, any>;
    server_status: (code: number, body: any) => Record<string, any>;
    server_html: (body: string) => Record<string, any>;
    server_wait_respond: (promise: Promise<any>) => Record<string, any>;
    server_req_body: (req: Request) => string;
    server_req_query: (req: Request, key?: string) => any;
    server_req_header: (req: Request, name: string) => string | null;
    server_req_param: (req: Request, name: string) => string | null;
    server_req_method: (req: Request) => string;
    server_req_path: (req: Request) => string;
    server_req_id: () => string | null;
    server_hold_response: (reqId: string) => null;
    server_send_held: (reqId: string, status: number, body: any) => boolean;
};
export {};
//# sourceMappingURL=stdlib-http-server.d.ts.map