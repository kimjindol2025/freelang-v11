type CallFn = (name: string, args: any[]) => any;
/**
 * Create the WebSocket Client module for FreeLang v9.
 * Event handlers are FreeLang functions registered by name:
 *   wsc_on_open    connId
 *   wsc_on_message connId message
 *   wsc_on_close   connId
 *   wsc_on_error   connId errMsg
 *
 * Provides: wsc_connect, wsc_send, wsc_send_json, wsc_close, wsc_state,
 *           wsc_on_open_fn, wsc_on_message_fn, wsc_on_close_fn, wsc_on_error_fn,
 *           wsc_reconnect_with_backoff
 */
export declare function createWscModule(callFn: CallFn): {
    wsc_connect: (url: string, token?: string) => string;
    wsc_send: (connId: string, message: string) => boolean;
    wsc_send_json: (connId: string, data: any) => boolean;
    wsc_close: (connId: string) => boolean;
    wsc_state: (connId: string) => string;
    wsc_on_open_fn: (name: string) => null;
    wsc_on_message_fn: (name: string) => null;
    wsc_on_close_fn: (name: string) => null;
    wsc_on_error_fn: (name: string) => null;
    wsc_reconnect_with_backoff: (connId: string, maxRetries?: number) => null;
};
export {};
//# sourceMappingURL=stdlib-wsc.d.ts.map