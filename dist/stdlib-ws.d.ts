type CallFn = (name: string, args: any[]) => any;
/**
 * Create the WebSocket module for FreeLang v9.
 * Event handlers are FreeLang functions registered by name:
 *   ws_on_connect    connId
 *   ws_on_message    connId message
 *   ws_on_close      connId
 *   ws_on_error      connId errMsg
 *
 * Provides: ws_start, ws_stop, ws_send, ws_send_json,
 *           ws_broadcast, ws_broadcast_json,
 *           ws_close, ws_clients, ws_count,
 *           ws_on_connect_fn, ws_on_message_fn, ws_on_close_fn
 */
export declare function createWsModule(callFn: CallFn): {
    ws_start: (port: number) => string;
    ws_stop: () => null;
    ws_send: (connId: string, message: string) => boolean;
    ws_send_json: (connId: string, data: any) => boolean;
    ws_broadcast: (message: string) => number;
    ws_broadcast_json: (data: any) => number;
    ws_close: (connId: string) => boolean;
    ws_clients: () => string[];
    ws_count: () => number;
    ws_on_connect_fn: (name: string) => null;
    ws_on_message_fn: (name: string) => null;
    ws_on_close_fn: (name: string) => null;
    ws_on_error_fn: (name: string) => null;
};
export {};
//# sourceMappingURL=stdlib-ws.d.ts.map