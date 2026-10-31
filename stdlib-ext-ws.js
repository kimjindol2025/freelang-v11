var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ext-ws.ts
var ext_ws_exports = {};
__export(ext_ws_exports, {
  createWsModule: () => createWsModule,
  createWscModule: () => createWscModule
});
module.exports = __toCommonJS(ext_ws_exports);

// src/stdlib-ws.ts
var net = __toESM(require("net"));
var crypto = __toESM(require("crypto"));
function createWsModule(callFn) {
  const connections = /* @__PURE__ */ new Map();
  let tcpServer = null;
  let connCounter = 0;
  let onConnectFn = "ws_on_connect";
  let onMessageFn = "ws_on_message";
  let onCloseFn = "ws_on_close";
  let onErrorFn = "ws_on_error";
  function tryCall(fnName, args) {
    try {
      callFn(fnName, args);
    } catch {
    }
  }
  function makeId() {
    return `ws_${++connCounter}_${Date.now()}`;
  }
  function buildServerFrame(data, opcode = 1) {
    const payload = typeof data === "string" ? Buffer.from(data) : data;
    const len = payload.length;
    if (len < 126) {
      const h = Buffer.alloc(2);
      h[0] = 128 | opcode;
      h[1] = len;
      return Buffer.concat([h, payload]);
    } else if (len < 65536) {
      const h = Buffer.alloc(4);
      h[0] = 128 | opcode;
      h[1] = 126;
      h.writeUInt16BE(len, 2);
      return Buffer.concat([h, payload]);
    } else {
      const h = Buffer.alloc(10);
      h[0] = 128 | opcode;
      h[1] = 127;
      h.writeBigUInt64BE(BigInt(len), 2);
      return Buffer.concat([h, payload]);
    }
  }
  function buildCloseFrame(code = 1e3) {
    const b = Buffer.alloc(4);
    b[0] = 136;
    b[1] = 2;
    b.writeUInt16BE(code, 2);
    return b;
  }
  function buildPongFrame() {
    return Buffer.from([138, 0]);
  }
  function drainFrames(buf) {
    const complete = [];
    let offset = 0;
    while (offset + 2 <= buf.length) {
      const fin = (buf[offset] & 128) !== 0;
      const opcode = buf[offset] & 15;
      const masked = (buf[offset + 1] & 128) !== 0;
      let payloadLen = buf[offset + 1] & 127;
      let hdrLen = 2;
      if (payloadLen === 126) {
        if (offset + 4 > buf.length) break;
        payloadLen = buf.readUInt16BE(offset + 2);
        hdrLen = 4;
      } else if (payloadLen === 127) {
        if (offset + 10 > buf.length) break;
        payloadLen = Number(buf.readBigUInt64BE(offset + 2));
        hdrLen = 10;
      }
      if (masked) hdrLen += 4;
      if (offset + hdrLen + payloadLen > buf.length) break;
      let maskKey = null;
      if (masked) maskKey = buf.slice(offset + hdrLen - 4, offset + hdrLen);
      const payload = Buffer.from(buf.slice(offset + hdrLen, offset + hdrLen + payloadLen));
      if (maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }
      complete.push({ fin, opcode, payload });
      offset += hdrLen + payloadLen;
    }
    return { complete, remaining: buf.slice(offset) };
  }
  function parseHttpHeaders(data) {
    const headers = {};
    const lines = data.toString().split("\r\n");
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "") break;
      const [key, value] = lines[i].split(": ");
      if (key) headers[key.toLowerCase()] = value;
    }
    return headers;
  }
  return {
    // ws_start port → "ws listening on <port>"
    "ws_start": (port) => {
      tcpServer = net.createServer((socket) => {
        let handshakeDone = false;
        let buf = Buffer.alloc(0);
        let connId = "";
        socket.once("data", (data) => {
          const headerEnd = data.indexOf("\r\n\r\n");
          if (headerEnd === -1) {
            socket.destroy();
            return;
          }
          const headers = parseHttpHeaders(data);
          const key = headers["sec-websocket-key"];
          if (!key) {
            socket.destroy();
            return;
          }
          const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
          socket.write([
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: Upgrade",
            "Sec-WebSocket-Accept: " + accept,
            "",
            ""
          ].join("\r\n"));
          handshakeDone = true;
          connId = makeId();
          connections.set(connId, socket);
          tryCall(onConnectFn, [connId]);
          buf = Buffer.alloc(0);
          socket.on("data", (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            const { complete, remaining } = drainFrames(buf);
            buf = remaining;
            for (const frame of complete) {
              if (frame.opcode === 8) {
                connections.delete(connId);
                tryCall(onCloseFn, [connId]);
                socket.end();
                return;
              }
              if (frame.opcode === 9) {
                socket.write(buildPongFrame());
                continue;
              }
              if (frame.opcode === 1 || frame.opcode === 2) {
                tryCall(onMessageFn, [connId, frame.payload.toString()]);
              }
            }
          });
        });
        socket.on("close", () => {
          if (handshakeDone && connId) {
            connections.delete(connId);
            tryCall(onCloseFn, [connId]);
          }
        });
        socket.on("error", (err) => {
          if (handshakeDone && connId) {
            tryCall(onErrorFn, [connId, err.message]);
          }
        });
      });
      tcpServer.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`[ws] \uD3EC\uD2B8 ${port} \uC774\uBBF8 \uC0AC\uC6A9 \uC911 \u2014 PM2 \uC7AC\uC2DC\uC791 \uC704\uD574 \uC885\uB8CC`);
          process.exit(1);
        } else {
          console.error(`[ws] \uC11C\uBC84 \uC624\uB958: ${err.message}`);
          process.exit(1);
        }
      });
      tcpServer.listen(port);
      return `ws listening on ${port}`;
    },
    // ws_stop → null
    "ws_stop": () => {
      if (tcpServer) {
        tcpServer.close();
        tcpServer = null;
      }
      connections.clear();
      return null;
    },
    // ws_send connId message → boolean
    "ws_send": (connId, message) => {
      const socket = connections.get(connId);
      if (!socket || socket.destroyed) return false;
      try {
        socket.write(buildServerFrame(message));
        return true;
      } catch {
        return false;
      }
    },
    // ws_send_json connId data → boolean
    "ws_send_json": (connId, data) => {
      const socket = connections.get(connId);
      if (!socket || socket.destroyed) return false;
      try {
        socket.write(buildServerFrame(JSON.stringify(data)));
        return true;
      } catch {
        return false;
      }
    },
    // ws_broadcast message → sent count
    "ws_broadcast": (message) => {
      let count = 0;
      for (const [, socket] of connections) {
        if (!socket.destroyed) {
          try {
            socket.write(buildServerFrame(message));
            count++;
          } catch {
          }
        }
      }
      return count;
    },
    // ws_broadcast_json data → sent count
    "ws_broadcast_json": (data) => {
      const json = JSON.stringify(data);
      let count = 0;
      for (const [, socket] of connections) {
        if (!socket.destroyed) {
          try {
            socket.write(buildServerFrame(json));
            count++;
          } catch {
          }
        }
      }
      return count;
    },
    // ws_close connId [code] → null
    "ws_close": (connId, code = 1e3) => {
      const socket = connections.get(connId);
      if (socket && !socket.destroyed) {
        socket.write(buildCloseFrame(code));
        socket.end();
        connections.delete(connId);
      }
      return null;
    },
    // ws_clients → [connId, ...]
    "ws_clients": () => {
      return Array.from(connections.keys());
    },
    // ws_count → number
    "ws_count": () => {
      return connections.size;
    },
    // ws_on_connect_fn handlerName → null
    "ws_on_connect_fn": (name) => {
      onConnectFn = name;
      return null;
    },
    // ws_on_message_fn handlerName → null
    "ws_on_message_fn": (name) => {
      onMessageFn = name;
      return null;
    },
    // ws_on_close_fn handlerName → null
    "ws_on_close_fn": (name) => {
      onCloseFn = name;
      return null;
    },
    // ws_on_error_fn handlerName → null
    "ws_on_error_fn": (name) => {
      onErrorFn = name;
      return null;
    }
  };
}

// src/stdlib-wsc.ts
function createWscModule(callFn) {
  const clients = /* @__PURE__ */ new Map();
  let clientCounter = 0;
  let onOpenFn = "wsc_on_open";
  let onMessageFn = "wsc_on_message";
  let onCloseFn = "wsc_on_close";
  let onErrorFn = "wsc_on_error";
  function tryCall(fnName, args) {
    try {
      callFn(fnName, args);
    } catch {
    }
  }
  function makeId() {
    return `wsc_${++clientCounter}_${Date.now()}`;
  }
  function setupSocket(connId, socket) {
    socket.addEventListener("open", () => {
      tryCall(onOpenFn, [connId]);
    });
    socket.addEventListener("message", (event) => {
      const data = event.data;
      const message = typeof data === "string" ? data : data instanceof ArrayBuffer ? Buffer.from(new Uint8Array(data)).toString() : data.toString();
      tryCall(onMessageFn, [connId, message]);
    });
    socket.addEventListener("close", () => {
      const client = clients.get(connId);
      if (client && !client.reconnecting) {
        clients.delete(connId);
      }
      tryCall(onCloseFn, [connId]);
    });
    socket.addEventListener("error", (event) => {
      const msg = event.message ?? "WebSocket error";
      tryCall(onErrorFn, [connId, msg]);
    });
  }
  function connectSocket(url, token) {
    const id = makeId();
    const headers = {};
    if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }
    const socket = new globalThis.WebSocket(url, {
      headers: Object.keys(headers).length > 0 ? headers : void 0
    });
    const client = {
      socket,
      url,
      token,
      reconnecting: false
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
      if (!client || client.socket.readyState !== globalThis.WebSocket.OPEN) return false;
      try {
        client.socket.send(message);
        return true;
      } catch {
        return false;
      }
    },
    // wsc_send_json connId data → boolean
    "wsc_send_json": (connId, data) => {
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
    "wsc_close": (connId) => {
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
    "wsc_state": (connId) => {
      const client = clients.get(connId);
      if (!client) return "CLOSED";
      const socket = client.socket;
      switch (socket.readyState) {
        case globalThis.WebSocket.CONNECTING:
          return "CONNECTING";
        case globalThis.WebSocket.OPEN:
          return "OPEN";
        case globalThis.WebSocket.CLOSING:
          return "CLOSING";
        case globalThis.WebSocket.CLOSED:
          return "CLOSED";
        default:
          return "UNKNOWN";
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
        const delay = Math.min(1e3 * Math.pow(2, attempt), 3e4);
        attempt++;
        setTimeout(() => {
          const currentClient = clients.get(connId);
          if (!currentClient) return;
          const newSocket = new globalThis.WebSocket(currentClient.url, {
            headers: currentClient.token ? { authorization: `Bearer ${currentClient.token}` } : void 0
          });
          currentClient.socket = newSocket;
          setupSocket(connId, newSocket);
          newSocket.addEventListener("open", () => {
            const openClient = clients.get(connId);
            if (openClient) {
              openClient.reconnecting = false;
              attempt = 0;
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
          newSocket.addEventListener("error", (event) => {
            const msg = event.message ?? "WebSocket error";
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
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createWsModule,
  createWscModule
});
