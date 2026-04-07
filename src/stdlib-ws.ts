// FreeLang v9: WebSocket Standard Library
// Phase 21: Real-time bidirectional communication

import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

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
export function createWsModule(callFn: CallFn) {
  const connections = new Map<string, WebSocket>();
  let wss: WebSocketServer | null = null;
  let connCounter = 0;

  // Event handler names (user sets these via ws_on_* functions)
  let onConnectFn = "ws_on_connect";
  let onMessageFn = "ws_on_message";
  let onCloseFn   = "ws_on_close";
  let onErrorFn   = "ws_on_error";

  function tryCall(fnName: string, args: any[]) {
    try { callFn(fnName, args); } catch {}
  }

  function makeId(): string {
    return `ws_${++connCounter}_${Date.now()}`;
  }

  return {
    // ws_start port → "ws listening on <port>"
    "ws_start": (port: number): string => {
      wss = new WebSocketServer({ port });

      wss.on("connection", (socket: WebSocket) => {
        const id = makeId();
        connections.set(id, socket);
        tryCall(onConnectFn, [id]);

        socket.on("message", (data: Buffer) => {
          tryCall(onMessageFn, [id, data.toString()]);
        });

        socket.on("close", () => {
          connections.delete(id);
          tryCall(onCloseFn, [id]);
        });

        socket.on("error", (err: Error) => {
          tryCall(onErrorFn, [id, err.message]);
        });
      });

      return `ws listening on ${port}`;
    },

    // ws_start_with_http httpPort → attach to existing HTTP port not supported in stdlib-server
    // Instead start standalone WS on separate port (recommended)

    // ws_stop → null
    "ws_stop": (): null => {
      if (wss) { wss.close(); wss = null; }
      connections.clear();
      return null;
    },

    // ws_send connId message → boolean
    "ws_send": (connId: string, message: string): boolean => {
      const socket = connections.get(connId);
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(message);
      return true;
    },

    // ws_send_json connId data → boolean
    "ws_send_json": (connId: string, data: any): boolean => {
      const socket = connections.get(connId);
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(data));
      return true;
    },

    // ws_broadcast message → sent count
    "ws_broadcast": (message: string): number => {
      let count = 0;
      for (const [, socket] of connections) {
        if (socket.readyState === WebSocket.OPEN) { socket.send(message); count++; }
      }
      return count;
    },

    // ws_broadcast_json data → sent count
    "ws_broadcast_json": (data: any): number => {
      const msg = JSON.stringify(data);
      let count = 0;
      for (const [, socket] of connections) {
        if (socket.readyState === WebSocket.OPEN) { socket.send(msg); count++; }
      }
      return count;
    },

    // ws_close connId → boolean
    "ws_close": (connId: string): boolean => {
      const socket = connections.get(connId);
      if (!socket) return false;
      socket.close();
      connections.delete(connId);
      return true;
    },

    // ws_clients → connId[]
    "ws_clients": (): string[] => Array.from(connections.keys()),

    // ws_count → number
    "ws_count": (): number => connections.size,

    // ws_on_connect_fn handlerName → set connect handler
    "ws_on_connect_fn": (name: string): null => { onConnectFn = name; return null; },

    // ws_on_message_fn handlerName → set message handler
    "ws_on_message_fn": (name: string): null => { onMessageFn = name; return null; },

    // ws_on_close_fn handlerName → set close handler
    "ws_on_close_fn": (name: string): null => { onCloseFn = name; return null; },

    // ws_on_error_fn handlerName → set error handler
    "ws_on_error_fn": (name: string): null => { onErrorFn = name; return null; },
  };
}
