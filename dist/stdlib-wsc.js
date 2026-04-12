"use strict";
// FreeLang v9: WebSocket Client Standard Library
// Phase 57: WebSocket 클라이언트 (터널 에이전트용)
// 에이전트가 릴레이 서버에 연결하는 데 사용
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWscModule = createWscModule;
const ws_1 = require("ws");
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
function createWscModule(callFn) {
    const clients = new Map();
    let clientCounter = 0;
    // Event handler names (user sets these via wsc_on_* functions)
    let onOpenFn = "wsc_on_open";
    let onMessageFn = "wsc_on_message";
    let onCloseFn = "wsc_on_close";
    let onErrorFn = "wsc_on_error";
    function tryCall(fnName, args) {
        try {
            callFn(fnName, args);
        }
        catch { }
    }
    function makeId() {
        return `wsc_${++clientCounter}_${Date.now()}`;
    }
    function setupSocket(connId, socket) {
        socket.on("open", () => {
            tryCall(onOpenFn, [connId]);
        });
        socket.on("message", (data) => {
            tryCall(onMessageFn, [connId, data.toString()]);
        });
        socket.on("close", () => {
            const client = clients.get(connId);
            if (client && !client.reconnecting) {
                clients.delete(connId);
            }
            tryCall(onCloseFn, [connId]);
        });
        socket.on("error", (err) => {
            tryCall(onErrorFn, [connId, err.message]);
        });
    }
    function connectSocket(url, token) {
        const id = makeId();
        const headers = {};
        if (token) {
            headers["authorization"] = `Bearer ${token}`;
        }
        const socket = new ws_1.WebSocket(url, {
            headers: Object.keys(headers).length > 0 ? headers : undefined,
        });
        const client = {
            socket,
            url,
            token,
            reconnecting: false,
        };
        clients.set(id, client);
        setupSocket(id, socket);
        return id;
    }
    return {
        // wsc_connect url token → connId
        "wsc_connect": (url, token = "") => {
            return connectSocket(url, token);
        },
        // wsc_send connId message → boolean
        "wsc_send": (connId, message) => {
            const client = clients.get(connId);
            if (!client || client.socket.readyState !== ws_1.WebSocket.OPEN)
                return false;
            try {
                client.socket.send(message);
                return true;
            }
            catch {
                return false;
            }
        },
        // wsc_send_json connId data → boolean
        "wsc_send_json": (connId, data) => {
            const client = clients.get(connId);
            if (!client || client.socket.readyState !== ws_1.WebSocket.OPEN)
                return false;
            try {
                client.socket.send(JSON.stringify(data));
                return true;
            }
            catch {
                return false;
            }
        },
        // wsc_close connId → boolean
        "wsc_close": (connId) => {
            const client = clients.get(connId);
            if (!client)
                return false;
            try {
                client.socket.close();
                clients.delete(connId);
                return true;
            }
            catch {
                return false;
            }
        },
        // wsc_state connId → "OPEN" | "CONNECTING" | "CLOSING" | "CLOSED"
        "wsc_state": (connId) => {
            const client = clients.get(connId);
            if (!client)
                return "CLOSED";
            const socket = client.socket;
            switch (socket.readyState) {
                case ws_1.WebSocket.CONNECTING: return "CONNECTING";
                case ws_1.WebSocket.OPEN: return "OPEN";
                case ws_1.WebSocket.CLOSING: return "CLOSING";
                case ws_1.WebSocket.CLOSED: return "CLOSED";
                default: return "UNKNOWN";
            }
        },
        // wsc_on_open_fn handlerName → set open handler
        "wsc_on_open_fn": (name) => {
            onOpenFn = name;
            return null;
        },
        // wsc_on_message_fn handlerName → set message handler
        "wsc_on_message_fn": (name) => {
            onMessageFn = name;
            return null;
        },
        // wsc_on_close_fn handlerName → set close handler
        "wsc_on_close_fn": (name) => {
            onCloseFn = name;
            return null;
        },
        // wsc_on_error_fn handlerName → set error handler
        "wsc_on_error_fn": (name) => {
            onErrorFn = name;
            return null;
        },
        // wsc_reconnect_with_backoff connId maxRetries → null
        // 지수 백오프로 자동 재연결
        "wsc_reconnect_with_backoff": (connId, maxRetries = 5) => {
            const clientRef = clients.get(connId);
            if (!clientRef)
                return null;
            clientRef.reconnecting = true;
            let attempt = 0;
            const attemptReconnect = () => {
                const client = clients.get(connId);
                if (!client)
                    return;
                if (attempt >= maxRetries) {
                    client.reconnecting = false;
                    tryCall(onErrorFn, [connId, "max reconnect attempts reached"]);
                    return;
                }
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // 최대 30초
                attempt++;
                setTimeout(() => {
                    const currentClient = clients.get(connId);
                    if (!currentClient)
                        return;
                    const newSocket = new ws_1.WebSocket(currentClient.url, {
                        headers: currentClient.token ? { authorization: `Bearer ${currentClient.token}` } : undefined,
                    });
                    currentClient.socket = newSocket;
                    setupSocket(connId, newSocket);
                    newSocket.on("open", () => {
                        const openClient = clients.get(connId);
                        if (openClient) {
                            openClient.reconnecting = false;
                            attempt = 0; // 성공 시 attempt 리셋
                            tryCall(onOpenFn, [connId]);
                        }
                    });
                    newSocket.on("close", () => {
                        const closeClient = clients.get(connId);
                        if (closeClient && closeClient.reconnecting) {
                            attemptReconnect();
                        }
                        else {
                            clients.delete(connId);
                        }
                    });
                    newSocket.on("error", (err) => {
                        tryCall(onErrorFn, [connId, err.message]);
                        const errClient = clients.get(connId);
                        if (errClient && errClient.reconnecting) {
                            attemptReconnect();
                        }
                    });
                }, delay);
            };
            attemptReconnect();
            return null;
        },
    };
}
//# sourceMappingURL=stdlib-wsc.js.map