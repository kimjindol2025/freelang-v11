// FreeLang v11: WebSocket Server (RFC 6455)
// Phase 21: Real-time bidirectional communication
// Node.js v25 native implementation (의존성 제거)

import * as net from "net";
import * as crypto from "crypto";

type CallFn = (name: string, args: any[]) => any;

interface ParsedFrame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
}

/**
 * Create the WebSocket server module for FreeLang v11.
 * RFC 6455 WebSocket protocol implementation using Node.js native APIs.
 */
export function createWsModule(callFn: CallFn) {
  const connections = new Map<string, net.Socket>();
  let tcpServer: net.Server | null = null;
  let connCounter = 0;

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

  // RFC 6455 프레임 빌더 (서버→클라이언트, 마스킹 없음)
  function buildServerFrame(data: string | Buffer, opcode = 0x01): Buffer {
    const payload = typeof data === 'string' ? Buffer.from(data) : data;
    const len = payload.length;

    if (len < 126) {
      const h = Buffer.alloc(2);
      h[0] = 0x80 | opcode;
      h[1] = len;
      return Buffer.concat([h, payload]);
    } else if (len < 65536) {
      const h = Buffer.alloc(4);
      h[0] = 0x80 | opcode;
      h[1] = 126;
      h.writeUInt16BE(len, 2);
      return Buffer.concat([h, payload]);
    } else {
      const h = Buffer.alloc(10);
      h[0] = 0x80 | opcode;
      h[1] = 127;
      h.writeBigUInt64BE(BigInt(len), 2);
      return Buffer.concat([h, payload]);
    }
  }

  // RFC 6455 CLOSE 프레임
  function buildCloseFrame(code = 1000): Buffer {
    const b = Buffer.alloc(4);
    b[0] = 0x88;
    b[1] = 0x02;
    b.writeUInt16BE(code, 2);
    return b;
  }

  // RFC 6455 PONG 프레임
  function buildPongFrame(): Buffer {
    return Buffer.from([0x8a, 0x00]);
  }

  // RFC 6455 프레임 파서 (클라이언트→서버, 마스킹 있음)
  function drainFrames(buf: Buffer): { complete: ParsedFrame[]; remaining: Buffer } {
    const complete: ParsedFrame[] = [];
    let offset = 0;

    while (offset + 2 <= buf.length) {
      const fin = (buf[offset] & 0x80) !== 0;
      const opcode = buf[offset] & 0x0f;
      const masked = (buf[offset + 1] & 0x80) !== 0;
      let payloadLen = buf[offset + 1] & 0x7f;
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

      let maskKey: Buffer | null = null;
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

  // HTTP 헤더 파싱 (간단한 구현)
  function parseHttpHeaders(data: Buffer): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = data.toString().split('\r\n');
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '') break;
      const [key, value] = lines[i].split(': ');
      if (key) headers[key.toLowerCase()] = value;
    }
    return headers;
  }

  return {
    // ws_start port → "ws listening on <port>"
    "ws_start": (port: number): string => {
      tcpServer = net.createServer((socket: net.Socket) => {
        let handshakeDone = false;
        let buf = Buffer.alloc(0);
        let connId = '';

        socket.once('data', (data) => {
          // HTTP Upgrade 요청 파싱
          const headerEnd = data.indexOf('\r\n\r\n');
          if (headerEnd === -1) {
            socket.destroy();
            return;
          }

          const headers = parseHttpHeaders(data);
          const key = headers['sec-websocket-key'];
          if (!key) {
            socket.destroy();
            return;
          }

          const accept = crypto.createHash('sha1')
            .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
            .digest('base64');

          socket.write([
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            'Sec-WebSocket-Accept: ' + accept,
            '', ''
          ].join('\r\n'));

          handshakeDone = true;
          connId = makeId();
          connections.set(connId, socket);
          tryCall(onConnectFn, [connId]);

          // 이후 데이터는 WS 프레임
          buf = Buffer.alloc(0);

          socket.on('data', (chunk: Buffer) => {
            buf = Buffer.concat([buf, chunk]);
            const { complete, remaining } = drainFrames(buf);
            buf = remaining;

            for (const frame of complete) {
              if (frame.opcode === 8) { // CLOSE
                connections.delete(connId);
                tryCall(onCloseFn, [connId]);
                socket.end();
                return;
              }

              if (frame.opcode === 9) { // PING
                socket.write(buildPongFrame());
                continue;
              }

              if (frame.opcode === 0x01 || frame.opcode === 0x02) { // TEXT or BINARY
                tryCall(onMessageFn, [connId, frame.payload.toString()]);
              }
            }
          });
        });

        socket.on('close', () => {
          if (handshakeDone && connId) {
            connections.delete(connId);
            tryCall(onCloseFn, [connId]);
          }
        });

        socket.on('error', (err: Error) => {
          if (handshakeDone && connId) {
            tryCall(onErrorFn, [connId, err.message]);
          }
        });
      });

      tcpServer.listen(port);
      return `ws listening on ${port}`;
    },

    // ws_stop → null
    "ws_stop": (): null => {
      if (tcpServer) {
        tcpServer.close();
        tcpServer = null;
      }
      connections.clear();
      return null;
    },

    // ws_send connId message → boolean
    "ws_send": (connId: string, message: string): boolean => {
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
    "ws_send_json": (connId: string, data: any): boolean => {
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
    "ws_broadcast": (message: string): number => {
      let count = 0;
      for (const [, socket] of connections) {
        if (!socket.destroyed) {
          try {
            socket.write(buildServerFrame(message));
            count++;
          } catch {}
        }
      }
      return count;
    },

    // ws_broadcast_json data → sent count
    "ws_broadcast_json": (data: any): number => {
      const json = JSON.stringify(data);
      let count = 0;
      for (const [, socket] of connections) {
        if (!socket.destroyed) {
          try {
            socket.write(buildServerFrame(json));
            count++;
          } catch {}
        }
      }
      return count;
    },

    // ws_close connId [code] → null
    "ws_close": (connId: string, code: number = 1000): null => {
      const socket = connections.get(connId);
      if (socket && !socket.destroyed) {
        socket.write(buildCloseFrame(code));
        socket.end();
        connections.delete(connId);
      }
      return null;
    },

    // ws_clients → [connId, ...]
    "ws_clients": (): string[] => {
      return Array.from(connections.keys());
    },

    // ws_count → number
    "ws_count": (): number => {
      return connections.size;
    },

    // ws_on_connect_fn handlerName → null
    "ws_on_connect_fn": (name: string): null => {
      onConnectFn = name;
      return null;
    },

    // ws_on_message_fn handlerName → null
    "ws_on_message_fn": (name: string): null => {
      onMessageFn = name;
      return null;
    },

    // ws_on_close_fn handlerName → null
    "ws_on_close_fn": (name: string): null => {
      onCloseFn = name;
      return null;
    },

    // ws_on_error_fn handlerName → null
    "ws_on_error_fn": (name: string): null => {
      onErrorFn = name;
      return null;
    },
  };
}
