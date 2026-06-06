// FreeLang v9: WebSocket Client Standard Library
// Phase 57: WebSocket 클라이언트 (터널 에이전트용)
// 에이전트가 릴레이 서버에 연결하는 데 사용
// Node.js v25 globalThis.WebSocket 사용 (의존성 제거)

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
export function createWscModule(callFn: CallFn) {
  interface ClientConnection {
    socket: globalThis.WebSocket;
    url: string;
    token: string;
    reconnecting: boolean;
  }

  const clients = new Map<string, ClientConnection>();
  let clientCounter = 0;

  // Event handler names (user sets these via wsc_on_* functions)
  let onOpenFn    = "wsc_on_open";
  let onMessageFn = "wsc_on_message";
  let onCloseFn   = "wsc_on_close";
  let onErrorFn   = "wsc_on_error";

  function tryCall(fnName: string, args: any[]) {
    try { callFn(fnName, args); } catch {}
  }

  function makeId(): string {
    return `wsc_${++clientCounter}_${Date.now()}`;
  }

  function setupSocket(connId: string, socket: globalThis.WebSocket) {
    socket.addEventListener("open", () => {
      tryCall(onOpenFn, [connId]);
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      const data = event.data;
      const message = typeof data === 'string' ? data :
        data instanceof ArrayBuffer ? Buffer.from(new Uint8Array(data)).toString() :
        data.toString();
      tryCall(onMessageFn, [connId, message]);
    });

    socket.addEventListener("close", () => {
      const client = clients.get(connId);
      if (client && !client.reconnecting) {
        clients.delete(connId);
      }
      tryCall(onCloseFn, [connId]);
    });

    socket.addEventListener("error", (event: Event) => {
      const msg = (event as any).message ?? 'WebSocket error';
      tryCall(onErrorFn, [connId, msg]);
    });
  }

  function connectSocket(url: string, token: string): string {
    const id = makeId();
    const headers: Record<string, string> = {};
    if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }

    const socket = new globalThis.WebSocket(url, {
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    } as any);

    const client: ClientConnection = {
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
    "wsc_connect": (url: string, token: string = ""): string => {
      return connectSocket(url, token);
    },

    // wsc_send connId message → boolean
    "wsc_send": (connId: string, message: string): boolean => {
      const client = clients.get(connId);
      if (!client || client.socket.readyState !== globalThis.WebSocket.OPEN) return false;
      try {
        client.socket.send(message);
        return true;
      } catch {
        return false;
      }
    },

    // wsc_send_json connId data → boolean
    "wsc_send_json": (connId: string, data: any): boolean => {
      const client = clients.get(connId);
      if (!client || client.socket.readyState !== globalThis.WebSocket.OPEN) return false;
      try {
        client.socket.send(JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    },

    // wsc_close connId → boolean
    "wsc_close": (connId: string): boolean => {
      const client = clients.get(connId);
      if (!client) return false;
      try {
        client.socket.close();
        clients.delete(connId);
        return true;
      } catch {
        return false;
      }
    },

    // wsc_state connId → "OPEN" | "CONNECTING" | "CLOSING" | "CLOSED"
    "wsc_state": (connId: string): string => {
      const client = clients.get(connId);
      if (!client) return "CLOSED";
      const socket = client.socket;
      switch (socket.readyState) {
        case globalThis.WebSocket.CONNECTING: return "CONNECTING";
        case globalThis.WebSocket.OPEN:       return "OPEN";
        case globalThis.WebSocket.CLOSING:    return "CLOSING";
        case globalThis.WebSocket.CLOSED:     return "CLOSED";
        default:                   return "UNKNOWN";
      }
    },

    // wsc_on_open_fn handlerName → set open handler
    "wsc_on_open_fn": (name: string): null => {
      onOpenFn = name;
      return null;
    },

    // wsc_on_message_fn handlerName → set message handler
    "wsc_on_message_fn": (name: string): null => {
      onMessageFn = name;
      return null;
    },

    // wsc_on_close_fn handlerName → set close handler
    "wsc_on_close_fn": (name: string): null => {
      onCloseFn = name;
      return null;
    },

    // wsc_on_error_fn handlerName → set error handler
    "wsc_on_error_fn": (name: string): null => {
      onErrorFn = name;
      return null;
    },

    // wsc_reconnect_with_backoff connId maxRetries → null
    // 지수 백오프로 자동 재연결
    "wsc_reconnect_with_backoff": (connId: string, maxRetries: number = 5): null => {
      const clientRef = clients.get(connId);
      if (!clientRef) return null;

      clientRef.reconnecting = true;
      let attempt = 0;

      const attemptReconnect = () => {
        const client = clients.get(connId);
        if (!client) return;

        if (attempt >= maxRetries) {
          client.reconnecting = false;
          tryCall(onErrorFn, [connId, "max reconnect attempts reached"]);
          return;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // 최대 30초
        attempt++;

        setTimeout(() => {
          const currentClient = clients.get(connId);
          if (!currentClient) return;

          const newSocket = new globalThis.WebSocket(currentClient.url, {
            headers: currentClient.token ? { authorization: `Bearer ${currentClient.token}` } : undefined,
          } as any);

          currentClient.socket = newSocket;
          setupSocket(connId, newSocket);

          newSocket.addEventListener("open", () => {
            const openClient = clients.get(connId);
            if (openClient) {
              openClient.reconnecting = false;
              attempt = 0; // 성공 시 attempt 리셋
              tryCall(onOpenFn, [connId]);
            }
          });

          newSocket.addEventListener("close", () => {
            const closeClient = clients.get(connId);
            if (closeClient && closeClient.reconnecting) {
              attemptReconnect();
            } else {
              clients.delete(connId);
            }
          });

          newSocket.addEventListener("error", (event: Event) => {
            const msg = (event as any).message ?? 'WebSocket error';
            tryCall(onErrorFn, [connId, msg]);
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
