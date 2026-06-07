var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// src/stdlib-ws.ts
var stdlib_ws_exports = {};
__export(stdlib_ws_exports, {
  createWsModule: () => createWsModule
});
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
var net, crypto;
var init_stdlib_ws = __esm({
  "src/stdlib-ws.ts"() {
    net = __toESM(require("net"));
    crypto = __toESM(require("crypto"));
  }
});

// src/stdlib-wsc.ts
var stdlib_wsc_exports = {};
__export(stdlib_wsc_exports, {
  createWscModule: () => createWscModule
});
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
  function connectSocket(url2, token) {
    const id = makeId();
    const headers = {};
    if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }
    const socket = new globalThis.WebSocket(url2, {
      headers: Object.keys(headers).length > 0 ? headers : void 0
    });
    const client = {
      socket,
      url: url2,
      token,
      reconnecting: false
    };
    clients.set(id, client);
    setupSocket(id, socket);
    return id;
  }
  return {
    // wsc_connect url token → connId
    "wsc_connect": (url2, token = "") => {
      return connectSocket(url2, token);
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
var init_stdlib_wsc = __esm({
  "src/stdlib-wsc.ts"() {
  }
});

// src/stdlib-crypto-rsa.ts
var stdlib_crypto_rsa_exports = {};
__export(stdlib_crypto_rsa_exports, {
  createCryptoRsaModule: () => createCryptoRsaModule
});
function createCryptoRsaModule() {
  return {
    // ── RSA 키 생성 ────────────────────────────────────────────
    // crypto_rsa_generate bits -> map (publicKey/privateKey PEM)
    "crypto_rsa_generate": (bits = 2048) => {
      const size = bits >= 2048 ? bits : 2048;
      const { publicKey, privateKey } = (0, import_crypto.generateKeyPairSync)("rsa", {
        modulusLength: size,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
      });
      return { publicKey, privateKey };
    },
    // ── RS256 서명 / 검증 ─────────────────────────────────────
    // crypto_rsa_sign private_pem data -> string (base64url 서명)
    "crypto_rsa_sign": (privateKeyPem, data) => {
      const signer = (0, import_crypto.createSign)("RSA-SHA256");
      signer.update(data);
      signer.end();
      return signer.sign(privateKeyPem).toString("base64url");
    },
    // crypto_rsa_verify public_pem data signature_b64url -> boolean
    "crypto_rsa_verify": (publicKeyPem, data, sigB64Url) => {
      try {
        const verifier = (0, import_crypto.createVerify)("RSA-SHA256");
        verifier.update(data);
        verifier.end();
        const sigBuf = Buffer.from(sigB64Url, "base64url");
        return verifier.verify(publicKeyPem, sigBuf);
      } catch {
        return false;
      }
    },
    // ── JWK 직렬화 (RFC 7517) ─────────────────────────────────
    // pkce_s256 verifier -> string (PKCE S256 challenge: base64url(SHA256(verifier_bytes)))
    "pkce_s256": (verifier) => {
      return (0, import_crypto.createHash)("sha256").update(verifier, "utf8").digest("base64url");
    },
    // crypto_rsa_public_to_jwk public_pem kid -> map (kty/n/e/kid/alg/use)
    "crypto_rsa_public_to_jwk": (publicKeyPem, kid) => {
      const key = (0, import_crypto.createPublicKey)(publicKeyPem);
      const jwk = key.export({ format: "jwk" });
      return {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        kid,
        alg: "RS256",
        use: "sig"
      };
    }
  };
}
var import_crypto;
var init_stdlib_crypto_rsa = __esm({
  "src/stdlib-crypto-rsa.ts"() {
    import_crypto = require("crypto");
  }
});

// src/stdlib-totp.ts
var stdlib_totp_exports = {};
__export(stdlib_totp_exports, {
  createTotpModule: () => createTotpModule
});
function base32Encode(buf) {
  let bits = 0, value = 0, output = "";
  for (let i = 0; i < buf.length; i++) {
    value = value << 8 | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHA[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHA[value << 5 - bits & 31];
  return output;
}
function base32Decode(str) {
  const clean = str.replace(/=+$/, "").toUpperCase();
  let bits = 0, value = 0;
  const out = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHA.indexOf(clean[i]);
    if (idx === -1) throw new Error(`invalid base32 char: ${clean[i]}`);
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      out.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function hotp(secret, counter, digits = 6) {
  const ctrBuf = Buffer.alloc(8);
  const high = Math.floor(counter / 4294967296);
  const low = counter >>> 0;
  ctrBuf.writeUInt32BE(high, 0);
  ctrBuf.writeUInt32BE(low, 4);
  const hmac = (0, import_crypto2.createHmac)("sha1", secret).update(ctrBuf).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const truncated = (hmac[offset] & 127) << 24 | (hmac[offset + 1] & 255) << 16 | (hmac[offset + 2] & 255) << 8 | hmac[offset + 3] & 255;
  const code = truncated % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}
function totpCounter(unixSeconds, step = 30) {
  return Math.floor(unixSeconds / step);
}
function createTotpModule() {
  return {
    // totp_secret_generate bytes -> string (base32, default 20 bytes = 160 bits = 32 chars)
    "totp_secret_generate": (bytes = 20) => {
      const buf = (0, import_crypto2.randomBytes)(bytes);
      return base32Encode(buf);
    },
    // totp_now secret_b32 -> string (현재 시각의 6자리 코드, 디버그·등록용)
    "totp_now": (secretB32) => {
      const secret = base32Decode(secretB32);
      const counter = totpCounter(Math.floor(Date.now() / 1e3));
      return hotp(secret, counter, 6);
    },
    // totp_verify secret_b32 code window_steps -> boolean
    // window=1 → 현재 ±1 step (총 90초 윈도우) 허용 (시계 오차 보정)
    "totp_verify": (secretB32, code, window = 1) => {
      try {
        if (!/^\d+$/.test(code)) return false;
        const secret = base32Decode(secretB32);
        const now = totpCounter(Math.floor(Date.now() / 1e3));
        const expected = Buffer.from(code);
        for (let i = -window; i <= window; i++) {
          const candidate = Buffer.from(hotp(secret, now + i, code.length));
          if (candidate.length === expected.length && (0, import_crypto2.timingSafeEqual)(candidate, expected)) {
            return true;
          }
        }
        return false;
      } catch {
        return false;
      }
    },
    // totp_uri label issuer secret_b32 -> string (otpauth://totp/... QR 코드 표준)
    "totp_uri": (label, issuer, secretB32) => {
      const enc = (s) => encodeURIComponent(s);
      return `otpauth://totp/${enc(issuer)}:${enc(label)}?secret=${secretB32}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
    }
  };
}
var import_crypto2, BASE32_ALPHA;
var init_stdlib_totp = __esm({
  "src/stdlib-totp.ts"() {
    import_crypto2 = require("crypto");
    BASE32_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  }
});

// src/stdlib-mail.ts
var stdlib_mail_exports = {};
__export(stdlib_mail_exports, {
  createMailModule: () => createMailModule
});
function createMailModule() {
  return {
    // mail_outbox_write dir to subject body -> string (파일 경로)
    "mail_outbox_write": (dir, to, subject, body) => {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
      }
      const id = `${Date.now()}-${(0, import_crypto3.randomBytes)(6).toString("hex")}.json`;
      const file = path2.join(dir, id);
      const payload = {
        id,
        to,
        subject,
        body,
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        status: "queued"
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
      return file;
    },
    // mail_outbox_list dir -> array (JSON 배열, 큐된 메시지)
    "mail_outbox_list": (dir) => {
      try {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
        return files.map((f) => {
          try {
            return JSON.parse(fs.readFileSync(path2.join(dir, f), "utf8"));
          } catch {
            return null;
          }
        }).filter((x) => x !== null);
      } catch {
        return [];
      }
    },
    // mail_outbox_count dir -> number
    "mail_outbox_count": (dir) => {
      try {
        return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
      } catch {
        return 0;
      }
    },
    // ── SMTP TLS (port 465, SMTPS) ─────────────────────────
    // smtp_send_tls host port user pass from to subject body -> {ok, log}
    //
    // 동기적 비동기 — Node tls 콜백 기반이지만 Promise 인터페이스로 노출.
    // 호출 측은 await 또는 then. FL의 async_call 헬퍼로 호출 가능.
    "smtp_send_tls": (host, port, user, pass, from, to, subject, body) => {
      return new Promise((resolve3) => {
        const log = [];
        const socket = tls.connect({ host, port, servername: host }, () => {
        });
        socket.setEncoding("utf8");
        let buf = "";
        let stage = 0;
        const send = (line) => {
          log.push(`> ${line.trim()}`);
          socket.write(line);
        };
        const fail = (msg) => {
          log.push(`! ${msg}`);
          try {
            socket.end();
          } catch {
          }
          resolve3({ ok: false, log: log.join("\n"), error: msg });
        };
        socket.on("data", (chunk) => {
          buf += chunk.toString();
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            log.push(`< ${line}`);
            const code = parseInt(line.slice(0, 3), 10);
            if (line[3] !== " " && line[3] !== void 0) continue;
            try {
              switch (stage) {
                case 0:
                  if (code !== 220) return fail(`banner: ${line}`);
                  send(`EHLO ${host}\r
`);
                  stage = 1;
                  break;
                case 1:
                  if (code !== 250) return fail(`ehlo: ${line}`);
                  send("AUTH LOGIN\r\n");
                  stage = 2;
                  break;
                case 2:
                  if (code !== 334) return fail(`auth start: ${line}`);
                  send(Buffer.from(user).toString("base64") + "\r\n");
                  stage = 3;
                  break;
                case 3:
                  if (code !== 334) return fail(`auth user: ${line}`);
                  send(Buffer.from(pass).toString("base64") + "\r\n");
                  stage = 4;
                  break;
                case 4:
                  if (code !== 235) return fail(`auth pass: ${line}`);
                  send(`MAIL FROM:<${from}>\r
`);
                  stage = 5;
                  break;
                case 5:
                  if (code !== 250) return fail(`mail from: ${line}`);
                  send(`RCPT TO:<${to}>\r
`);
                  stage = 6;
                  break;
                case 6:
                  if (code !== 250) return fail(`rcpt to: ${line}`);
                  send("DATA\r\n");
                  stage = 7;
                  break;
                case 7:
                  if (code !== 354) return fail(`data: ${line}`);
                  const headers = [
                    `From: ${from}`,
                    `To: ${to}`,
                    `Subject: ${subject}`,
                    `MIME-Version: 1.0`,
                    `Content-Type: text/plain; charset=utf-8`,
                    ""
                  ].join("\r\n");
                  send(headers + "\r\n" + body + "\r\n.\r\n");
                  stage = 8;
                  break;
                case 8:
                  if (code !== 250) return fail(`accept: ${line}`);
                  send("QUIT\r\n");
                  stage = 9;
                  break;
                case 9:
                  resolve3({ ok: true, log: log.join("\n") });
                  try {
                    socket.end();
                  } catch {
                  }
                  return;
              }
            } catch (e) {
              return fail(`exception: ${e.message}`);
            }
          }
        });
        socket.on("error", (e) => fail(`socket: ${e.message}`));
        socket.setTimeout(15e3, () => fail("timeout"));
      });
    },
    // ── Mailgun API HTTP 메일 전송 ─────────────────────────
    // mailgun_send api_key domain from to subject text -> {ok, id, error}
    // Mailgun REST API v3 사용 (npm 0, Node https만 사용)
    "mailgun_send": (api_key, domain, from, to, subject, text) => {
      return new Promise((resolve3) => {
        try {
          const https = require("https");
          const querystring = require("querystring");
          const auth = Buffer.from(`api:${api_key}`).toString("base64");
          const postData = querystring.stringify({
            from,
            to,
            subject,
            text
          });
          const options = {
            hostname: "api.mailgun.net",
            port: 443,
            path: `/v3/${domain}/messages`,
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(postData)
            }
          };
          const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              try {
                const json = JSON.parse(data);
                if (res.statusCode === 200) {
                  resolve3({
                    ok: true,
                    id: json.id,
                    message: "\uBA54\uC77C \uC804\uC1A1 \uC644\uB8CC"
                  });
                } else {
                  resolve3({
                    ok: false,
                    error: json.message || "Mailgun API \uC624\uB958"
                  });
                }
              } catch (e) {
                resolve3({
                  ok: false,
                  error: `\uD30C\uC2F1 \uC2E4\uD328: ${e.message}`
                });
              }
            });
          });
          req.on("error", (e) => {
            resolve3({
              ok: false,
              error: `\uC694\uCCAD \uC2E4\uD328: ${e.message}`
            });
          });
          req.write(postData);
          req.end();
        } catch (e) {
          resolve3({
            ok: false,
            error: `\uC608\uC678: ${e.message}`
          });
        }
      });
    }
  };
}
var fs, path2, import_crypto3, tls;
var init_stdlib_mail = __esm({
  "src/stdlib-mail.ts"() {
    fs = __toESM(require("fs"));
    path2 = __toESM(require("path"));
    import_crypto3 = require("crypto");
    tls = require("tls");
  }
});

// src/stdlib-webauthn.ts
var stdlib_webauthn_exports = {};
__export(stdlib_webauthn_exports, {
  createWebauthnModule: () => createWebauthnModule
});
function cborDecode(buf, offset = 0) {
  const ib = buf[offset];
  const major = ib >> 5;
  const minor = ib & 31;
  let val;
  let pos = offset + 1;
  if (minor < 24) val = minor;
  else if (minor === 24) {
    val = buf[pos];
    pos += 1;
  } else if (minor === 25) {
    val = buf.readUInt16BE(pos);
    pos += 2;
  } else if (minor === 26) {
    val = buf.readUInt32BE(pos);
    pos += 4;
  } else if (minor === 27) {
    val = Number(buf.readBigUInt64BE(pos));
    pos += 8;
  } else throw new Error(`cbor: unsupported minor ${minor}`);
  switch (major) {
    case 0:
      return { value: val, next: pos };
    case 1:
      return { value: -1 - val, next: pos };
    case 2: {
      const bytes = buf.slice(pos, pos + val);
      return { value: bytes, next: pos + val };
    }
    case 3: {
      const text = buf.slice(pos, pos + val).toString("utf8");
      return { value: text, next: pos + val };
    }
    case 4: {
      const arr = [];
      for (let i = 0; i < val; i++) {
        const r = cborDecode(buf, pos);
        arr.push(r.value);
        pos = r.next;
      }
      return { value: arr, next: pos };
    }
    case 5: {
      const map = {};
      for (let i = 0; i < val; i++) {
        const k = cborDecode(buf, pos);
        pos = k.next;
        const v = cborDecode(buf, pos);
        pos = v.next;
        map[String(k.value)] = v.value;
      }
      return { value: map, next: pos };
    }
    default:
      throw new Error(`cbor: unsupported major ${major}`);
  }
}
function parseAuthData(authData) {
  if (authData.length < 37) throw new Error("authData too short");
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const signCount = authData.readUInt32BE(33);
  const result = { rpIdHash, flags, signCount };
  if (flags & 64) {
    if (authData.length < 55) throw new Error("authData AT but too short");
    result.aaguid = authData.slice(37, 53);
    const credIdLen = authData.readUInt16BE(53);
    result.credentialId = authData.slice(55, 55 + credIdLen);
    const cosePart = authData.slice(55 + credIdLen);
    const decoded = cborDecode(cosePart);
    result.credentialPublicKey = decoded.value;
  }
  return result;
}
function cosePublicKeyToJwk(cose) {
  if (cose["1"] !== 2) throw new Error("COSE: not EC2");
  if (cose["3"] !== -7) throw new Error("COSE: not ES256");
  if (cose["-1"] !== 1) throw new Error("COSE: not P-256");
  const x = cose["-2"];
  const y = cose["-3"];
  return {
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    x: x.toString("base64url"),
    y: y.toString("base64url")
  };
}
function createWebauthnModule() {
  return {
    // webauthn_challenge bytes -> base64url string (32 bytes)
    "webauthn_challenge": (bytes = 32) => {
      return (0, import_crypto4.randomBytes)(bytes).toString("base64url");
    },
    // webauthn_parse_attestation b64url_attestation_object -> {fmt, authData_parsed, jwk, credential_id, sign_count, aaguid_hex}
    // attestation="none" 또는 "packed" self-attestation 만 처리.
    "webauthn_parse_attestation": (attestationObjectB64Url) => {
      const buf = Buffer.from(attestationObjectB64Url, "base64url");
      const decoded = cborDecode(buf).value;
      const fmt = decoded.fmt;
      const authDataBuf = decoded.authData;
      const auth = parseAuthData(authDataBuf);
      if (!auth.credentialId || !auth.credentialPublicKey) {
        throw new Error("attestation: AT flag missing");
      }
      const jwk = cosePublicKeyToJwk(auth.credentialPublicKey);
      return {
        fmt,
        flags: auth.flags,
        sign_count: auth.signCount,
        rp_id_hash_hex: auth.rpIdHash.toString("hex"),
        aaguid_hex: auth.aaguid?.toString("hex") ?? "",
        credential_id: auth.credentialId.toString("base64url"),
        public_jwk: jwk
      };
    },
    // webauthn_verify_assertion args -> boolean
    //   args = {jwk, authenticator_data, client_data_json_b64url, signature_b64url, expected_challenge, expected_origin, expected_rp_id, prev_sign_count}
    // 반환: {ok, sign_count} 또는 {ok:false, error}
    "webauthn_verify_assertion": (args) => {
      try {
        const jwk = args.jwk;
        const authenticatorData = Buffer.from(args.authenticator_data_b64url, "base64url");
        const clientDataJson = Buffer.from(args.client_data_json_b64url, "base64url");
        const signature = Buffer.from(args.signature_b64url, "base64url");
        const clientData = JSON.parse(clientDataJson.toString("utf8"));
        if (clientData.type !== "webauthn.get") return { ok: false, error: "type!=webauthn.get" };
        if (clientData.challenge !== args.expected_challenge) return { ok: false, error: "challenge mismatch" };
        if (clientData.origin !== args.expected_origin) return { ok: false, error: "origin mismatch" };
        const auth = parseAuthData(authenticatorData);
        const expectedRpHash = (0, import_crypto4.createHash)("sha256").update(args.expected_rp_id).digest();
        if (Buffer.compare(auth.rpIdHash, expectedRpHash) !== 0) return { ok: false, error: "rp_id_hash mismatch" };
        if (!(auth.flags & 1)) return { ok: false, error: "user not present" };
        if (auth.signCount !== 0 && auth.signCount <= (args.prev_sign_count ?? 0)) {
          return { ok: false, error: `signCount regression (${auth.signCount} <= ${args.prev_sign_count})` };
        }
        const cdHash = (0, import_crypto4.createHash)("sha256").update(clientDataJson).digest();
        const signedData = Buffer.concat([authenticatorData, cdHash]);
        const pub = (0, import_crypto4.createPublicKey)({ key: jwk, format: "jwk" });
        const verifier = (0, import_crypto4.createVerify)("SHA256");
        verifier.update(signedData);
        verifier.end();
        const ok = verifier.verify(pub, signature);
        return ok ? { ok: true, sign_count: auth.signCount } : { ok: false, error: "signature invalid" };
      } catch (e) {
        return { ok: false, error: `exception: ${e.message}` };
      }
    }
  };
}
var import_crypto4;
var init_stdlib_webauthn = __esm({
  "src/stdlib-webauthn.ts"() {
    import_crypto4 = require("crypto");
  }
});

// src/stdlib-queue-helpers.ts
var stdlib_queue_helpers_exports = {};
__export(stdlib_queue_helpers_exports, {
  createQueueHelpersModule: () => createQueueHelpersModule
});
function sqliteJson(dbPath, sql) {
  const r = (0, import_child_process.spawnSync)("sqlite3", ["-json", dbPath, sql], { timeout: 1e4, encoding: "utf-8" });
  if (r.error) throw new Error(`sqlite3 error: ${r.error.message}`);
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? "";
    throw new Error(`sqlite3 exit ${r.status}: ${stderr}`);
  }
  const raw = r.stdout?.trim() ?? "";
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function escapeStr(s) {
  return String(s).replace(/'/g, "''");
}
function createQueueHelpersModule() {
  return {
    // queue_dequeue_atomic db_path topic worker_id lock_seconds
    //   -> {id, topic, payload, attempt, ...} or null
    //
    // BEGIN IMMEDIATE → 첫 queued 메시지 잡고 in_flight 로 마킹 → COMMIT.
    // 단일 sqlite3 호출이라 외부 race 없음.
    "queue_dequeue_atomic": (dbPath, topic, workerId, lockSeconds = 30) => {
      const now = Date.now();
      const lockUntil = now + lockSeconds * 1e3;
      const t = escapeStr(topic);
      const w = escapeStr(workerId);
      const sql = `
        UPDATE q_messages
        SET status='in_flight',
            locked_until=${lockUntil},
            worker_id='${w}',
            updated_at=datetime('now')
        WHERE id = (
          SELECT id FROM q_messages
          WHERE topic='${t}' AND status='queued' AND next_run_at <= ${now}
          ORDER BY id ASC LIMIT 1
        )
        RETURNING id, topic, payload, attempt, next_run_at;
      `;
      const rows = sqliteJson(dbPath, sql);
      return rows.length === 0 ? null : rows[0];
    },
    // queue_db_init db_path -> bool  (WAL 모드 + busy_timeout 활성화)
    "queue_db_init": (dbPath) => {
      const sql = `
        PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=5000;
        PRAGMA synchronous=NORMAL;
      `;
      const r = (0, import_child_process.spawnSync)("sqlite3", [dbPath, sql], { timeout: 5e3 });
      return (r.status ?? 1) === 0;
    },
    // queue_recover_stuck db_path stuck_seconds -> count
    //   in_flight 상태에서 locked_until 지난 메시지를 다시 queued 로 (worker 죽은 경우 대비)
    "queue_recover_stuck": (dbPath, stuckSeconds = 60) => {
      const cutoff = Date.now();
      const sql = `
        UPDATE q_messages
        SET status='queued', worker_id=NULL,
            attempt=attempt+1,
            updated_at=datetime('now')
        WHERE status='in_flight' AND locked_until < ${cutoff};
        SELECT changes();
      `;
      const r = (0, import_child_process.spawnSync)("sqlite3", [dbPath, sql], { timeout: 5e3, encoding: "utf-8" });
      if ((r.status ?? 1) !== 0) return 0;
      const out = r.stdout?.trim() ?? "0";
      return parseInt(out, 10) || 0;
    }
  };
}
var import_child_process;
var init_stdlib_queue_helpers = __esm({
  "src/stdlib-queue-helpers.ts"() {
    import_child_process = require("child_process");
  }
});

// src/stdlib-time.ts
function createTimeModule() {
  return {
    // ── Time ──────────────────────────────────────────────────
    // now -> number (current timestamp ms)
    "now": () => Date.now(),
    // now_ms -> number (ms since epoch, always returns number)
    "now_ms": () => Date.now(),
    // now_iso -> string (ISO 8601)
    "now_iso": () => (/* @__PURE__ */ new Date()).toISOString(),
    // now_unix -> number (seconds since epoch)
    "now_unix": () => Math.floor(Date.now() / 1e3),
    // time_diff t1 t2 -> number (ms, positive if t2 > t1)
    "time_diff": (t1, t2) => t2 - t1,
    // time_since ts -> number (ms elapsed since ts)
    "time_since": (ts) => Date.now() - ts,
    // time_ago ts -> string (human-readable: "3s ago", "2m ago", "1h ago")
    "time_ago": (ts) => {
      const ms = Date.now() - ts;
      if (ms < 1e3) return `${ms}ms ago`;
      if (ms < 6e4) return `${Math.floor(ms / 1e3)}s ago`;
      if (ms < 36e5) return `${Math.floor(ms / 6e4)}m ago`;
      if (ms < 864e5) return `${Math.floor(ms / 36e5)}h ago`;
      return `${Math.floor(ms / 864e5)}d ago`;
    },
    // format_date ts fmt -> string  (simple date formatting)
    // fmt tokens: YYYY MM DD HH mm ss SSS
    "format_date": (ts, fmt) => {
      const d = new Date(ts);
      return fmt.replace("YYYY", String(d.getFullYear())).replace("MM", String(d.getMonth() + 1).padStart(2, "0")).replace("DD", String(d.getDate()).padStart(2, "0")).replace("HH", String(d.getHours()).padStart(2, "0")).replace("mm", String(d.getMinutes()).padStart(2, "0")).replace("ss", String(d.getSeconds()).padStart(2, "0")).replace("SSS", String(d.getMilliseconds()).padStart(3, "0"));
    },
    // date_parts ts -> {year,month,day,hour,min,sec,ms,weekday}
    "date_parts": (ts) => {
      const d = new Date(ts);
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        min: d.getMinutes(),
        sec: d.getSeconds(),
        ms: d.getMilliseconds(),
        weekday: d.getDay()
      };
    },
    // date_add ts unit n -> number  (unit: "ms"|"s"|"m"|"h"|"d"|"days"|"hours"|"minutes"|"months"|"years"|"weeks"|"seconds")
    "date_add": (ts, unit, n) => {
      const u = String(unit).replace(/^:/, "");
      const mul = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
      if (mul[u] !== void 0) return ts + n * mul[u];
      const d = new Date(Number(ts));
      if (u === "days" || u === "day") {
        d.setDate(d.getDate() + Number(n));
        return d.getTime();
      }
      if (u === "hours" || u === "hour") {
        d.setHours(d.getHours() + Number(n));
        return d.getTime();
      }
      if (u === "minutes" || u === "minute") {
        d.setMinutes(d.getMinutes() + Number(n));
        return d.getTime();
      }
      if (u === "months" || u === "month") {
        d.setMonth(d.getMonth() + Number(n));
        return d.getTime();
      }
      if (u === "years" || u === "year") {
        d.setFullYear(d.getFullYear() + Number(n));
        return d.getTime();
      }
      if (u === "seconds" || u === "second") {
        d.setSeconds(d.getSeconds() + Number(n));
        return d.getTime();
      }
      if (u === "weeks" || u === "week") {
        d.setDate(d.getDate() + Number(n) * 7);
        return d.getTime();
      }
      throw new Error(`date_add: unknown unit "${unit}". Use: ms/s/m/h/d/days/hours/minutes/months/years/weeks`);
    },
    // date_parse str -> number  ("2026-04-23" | "2026-04-23T12:00:00Z" -> timestamp ms)
    "date_parse": (str) => {
      const ts = Date.parse(str);
      if (isNaN(ts)) throw new Error(`date_parse: invalid date string "${str}"`);
      return ts;
    },
    // sleep_ms ms -> void  (synchronous spin-wait, short durations only)
    "sleep_ms": (ms) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
      }
    },
    // ── Timer ─────────────────────────────────────────────────
    // timer_start label -> Timer
    "timer_start": (label) => ({
      start: Date.now(),
      label,
      laps: []
    }),
    // timer_lap timer label -> Timer (record a lap time)
    "timer_lap": (timer, label) => ({
      ...timer,
      laps: [...timer.laps, { label, elapsed: Date.now() - timer.start }]
    }),
    // timer_elapsed timer -> number (ms since start)
    "timer_elapsed": (timer) => Date.now() - timer.start,
    // timer_stop timer -> {label, total_ms, laps}
    "timer_stop": (timer) => ({
      label: timer.label,
      total_ms: Date.now() - timer.start,
      laps: timer.laps
    }),
    // ── Logger ────────────────────────────────────────────────
    // log_create name level -> Logger  (level = minimum level to record)
    "log_create": (name, level = "info") => ({
      name,
      entries: [],
      level
    }),
    // log_entry logger level msg data? -> Logger
    "log_entry": (logger, level, msg, data) => {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[logger.level]) return logger;
      const entry = { ts: Date.now(), level, msg };
      if (data !== void 0) entry.data = data;
      return { ...logger, entries: [...logger.entries, entry] };
    },
    // log_info logger msg -> Logger
    "log_info": (logger, msg) => {
      if (LEVEL_ORDER["info"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "info", msg }] };
    },
    // log_warn logger msg -> Logger
    "log_warn": (logger, msg) => {
      if (LEVEL_ORDER["warn"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "warn", msg }] };
    },
    // log_error logger msg -> Logger
    "log_error": (logger, msg) => ({
      ...logger,
      entries: [...logger.entries, { ts: Date.now(), level: "error", msg }]
    }),
    // log_debug logger msg -> Logger
    "log_debug": (logger, msg) => {
      if (LEVEL_ORDER["debug"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "debug", msg }] };
    },
    // log_filter logger level -> [LogEntry]  (entries at or above level)
    "log_filter": (logger, level) => logger.entries.filter((e) => LEVEL_ORDER[e.level] >= LEVEL_ORDER[level]),
    // log_count logger level -> number
    "log_count": (logger, level) => logger.entries.filter((e) => e.level === level).length,
    // log_last logger n -> [LogEntry]
    "log_last": (logger, n) => logger.entries.slice(-n),
    // log_dump logger -> void  (print all entries to stdout)
    "log_dump": (logger) => {
      const pad = (s) => s.padEnd(5);
      for (const e of logger.entries) {
        const ts = new Date(e.ts).toISOString().slice(11, 23);
        const lvl = `[${pad(e.level.toUpperCase())}]`;
        const data = e.data !== void 0 ? ` | ${JSON.stringify(e.data)}` : "";
        console.log(`${ts} ${lvl} [${logger.name}] ${e.msg}${data}`);
      }
    },
    // ── Metrics ───────────────────────────────────────────────
    // metrics_create name -> Metrics
    "metrics_create": (name) => ({
      name,
      values: {},
      counters: {},
      timers: {}
    }),
    // metrics_record metrics key value -> Metrics
    "metrics_record": (m, key, value) => ({
      ...m,
      values: { ...m.values, [key]: [...m.values[key] ?? [], value] }
    }),
    // metrics_inc metrics key -> Metrics  (increment counter by 1)
    "metrics_inc": (m, key) => ({
      ...m,
      counters: { ...m.counters, [key]: (m.counters[key] ?? 0) + 1 }
    }),
    // metrics_inc_by metrics key n -> Metrics
    "metrics_inc_by": (m, key, n) => ({
      ...m,
      counters: { ...m.counters, [key]: (m.counters[key] ?? 0) + n }
    }),
    // metrics_count metrics key -> number
    "metrics_count": (m, key) => m.counters[key] ?? 0,
    // metrics_avg metrics key -> number
    "metrics_avg": (m, key) => {
      const vals = m.values[key] ?? [];
      if (vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    },
    // metrics_min metrics key -> number
    "metrics_min": (m, key) => {
      const vals = m.values[key] ?? [];
      return vals.length ? Math.min(...vals) : 0;
    },
    // metrics_max metrics key -> number
    "metrics_max": (m, key) => {
      const vals = m.values[key] ?? [];
      return vals.length ? Math.max(...vals) : 0;
    },
    // metrics_p95 metrics key -> number  (95th percentile)
    "metrics_p95": (m, key) => {
      const vals = [...m.values[key] ?? []].sort((a, b) => a - b);
      if (vals.length === 0) return 0;
      return vals[Math.floor(vals.length * 0.95)];
    },
    // metrics_summary metrics -> {key: {count, avg, min, max}}
    "metrics_summary": (m) => {
      const result = {};
      for (const [key, vals] of Object.entries(m.values)) {
        const sorted = [...vals].sort((a, b) => a - b);
        result[key] = {
          count: vals.length,
          avg: vals.reduce((a, b) => a + b, 0) / vals.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p95: sorted[Math.floor(sorted.length * 0.95)]
        };
      }
      for (const [key, count] of Object.entries(m.counters)) {
        result[`counter.${key}`] = { count };
      }
      return result;
    }
  };
}
var LEVEL_ORDER;
var init_stdlib_time = __esm({
  "src/stdlib-time.ts"() {
    LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
  }
});

// src/stdlib-agent.ts
function createAgentModule() {
  return {
    // ── Agent Lifecycle ──────────────────────────────────────
    // agent_create name -> AgentState
    "agent_create": (name) => ({
      name,
      state: {},
      history: [],
      tools: {},
      steps: 0,
      status: "running"
    }),
    // agent_set agent key value -> AgentState (immutable update)
    "agent_set": (agent, key, value) => ({
      ...agent,
      state: { ...agent.state, [key]: value }
    }),
    // agent_get agent key -> any
    "agent_get": (agent, key) => {
      return agent.state[key] ?? null;
    },
    // agent_update agent updates -> AgentState (merge multiple keys)
    "agent_update": (agent, updates) => ({
      ...agent,
      state: { ...agent.state, ...updates }
    }),
    // agent_steps agent -> number
    "agent_steps": (agent) => agent.steps,
    // agent_status agent -> string
    "agent_status": (agent) => agent.status,
    // agent_done agent -> boolean
    "agent_done": (agent) => agent.status === "done" || agent.status === "error" || agent.status === "max_steps",
    // ── Tool Registry ────────────────────────────────────────
    // agent_add_tool agent toolName fn -> AgentState
    "agent_add_tool": (agent, toolName, fn) => ({
      ...agent,
      tools: { ...agent.tools, [toolName]: fn }
    }),
    // agent_call_tool agent toolName ...args -> any
    "agent_call_tool": (agent, toolName, ...args) => {
      const tool = agent.tools[toolName];
      if (!tool) throw new Error(`Tool not found: "${toolName}". Available: ${Object.keys(agent.tools).join(", ")}`);
      return tool(...args);
    },
    // agent_tools agent -> [string] (list registered tool names)
    "agent_tools": (agent) => Object.keys(agent.tools),
    // ── History ──────────────────────────────────────────────
    // agent_push_history agent entry -> AgentState
    "agent_push_history": (agent, entry) => ({
      ...agent,
      history: [...agent.history, { ...entry, step: agent.steps, timestamp: Date.now() }]
    }),
    // agent_history agent -> [AgentHistoryEntry]
    "agent_history": (agent) => agent.history,
    // agent_history_last agent n -> [AgentHistoryEntry] (last n entries)
    "agent_history_last": (agent, n) => agent.history.slice(-n),
    // agent_history_type agent type -> [AgentHistoryEntry] (filter by type)
    "agent_history_type": (agent, type) => agent.history.filter((e) => e.type === type),
    // ── Loop Execution ───────────────────────────────────────
    // agent_loop agent goalFn stepFn maxSteps -> AgentState
    // goalFn(state) -> boolean: return true to stop
    // stepFn(agent) -> AgentState: perform one step, return updated agent
    "agent_loop": (agent, goalFn, stepFn, maxSteps) => {
      let cur = agent;
      while (cur.steps < maxSteps) {
        if (goalFn(cur.state)) {
          return { ...cur, status: "done" };
        }
        try {
          cur = stepFn({ ...cur, steps: cur.steps + 1 });
        } catch (err) {
          return {
            ...cur,
            status: "error",
            state: { ...cur.state, _error: err.message }
          };
        }
      }
      return { ...cur, status: "max_steps" };
    },
    // agent_run_until state condition action maxSteps -> final_state
    // Simpler version: just a value + condition + transform loop
    "agent_run_until": (state, condition, action, maxSteps) => {
      let cur = state;
      let steps = 0;
      while (!condition(cur) && steps < maxSteps) {
        cur = action(cur);
        steps++;
      }
      return cur;
    },
    // ── Plan Tracking ─────────────────────────────────────────
    // plan_create steps -> Plan
    "plan_create": (steps) => ({
      steps,
      current: 0,
      done: false,
      results: {}
    }),
    // plan_next plan -> string | null (current step or null if done)
    "plan_next": (plan) => {
      if (plan.done || plan.current >= plan.steps.length) return null;
      return plan.steps[plan.current];
    },
    // plan_advance plan result -> Plan (mark current step done, move to next)
    "plan_advance": (plan, result) => {
      const step = plan.steps[plan.current];
      const newCurrent = plan.current + 1;
      return {
        ...plan,
        current: newCurrent,
        done: newCurrent >= plan.steps.length,
        results: { ...plan.results, [step]: result }
      };
    },
    // plan_done plan -> boolean
    "plan_done": (plan) => plan.done || plan.current >= plan.steps.length,
    // plan_progress plan -> number (0.0 - 1.0)
    "plan_progress": (plan) => {
      if (plan.steps.length === 0) return 1;
      return plan.current / plan.steps.length;
    },
    // plan_results plan -> {step: result}
    "plan_results": (plan) => plan.results,
    // ── Observation / Context ────────────────────────────────
    // observe key value context -> context (accumulate observations)
    "observe": (key, value, context) => ({
      ...context,
      [key]: value
    }),
    // summarize context -> string (human/AI readable summary of context)
    "summarize": (context) => {
      return Object.entries(context).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
    },
    // context_create -> {} (empty context)
    "context_create": () => ({}),
    // context_merge ctx1 ctx2 -> context
    "context_merge": (ctx1, ctx2) => ({
      ...ctx1,
      ...ctx2
    })
  };
}
var init_stdlib_agent = __esm({
  "src/stdlib-agent.ts"() {
  }
});

// src/stdlib-crypto.ts
function createCryptoModule() {
  return {
    // ── Hash ──────────────────────────────────────────────────
    // sha256 str -> string (hex digest)
    "sha256": (str) => nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex"),
    // sha256_short str -> string (first 8 chars, useful as short ID)
    "sha256_short": (str) => nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 8),
    // md5 str -> string (hex digest, for checksums only)
    "md5": (str) => nodeCrypto.createHash("md5").update(str, "utf8").digest("hex"),
    // sha1 str -> string
    "sha1": (str) => nodeCrypto.createHash("sha1").update(str, "utf8").digest("hex"),
    // hmac_sha256 key msg -> string (hex digest)
    "hmac_sha256": (key, msg) => nodeCrypto.createHmac("sha256", key).update(msg, "utf8").digest("hex"),
    // hash_eq hash1 hash2 -> boolean (timing-safe compare)
    "hash_eq": (h1, h2) => {
      if (h1.length !== h2.length) return false;
      try {
        return nodeCrypto.timingSafeEqual(Buffer.from(h1, "hex"), Buffer.from(h2, "hex"));
      } catch {
        return false;
      }
    },
    // ── Encoding ──────────────────────────────────────────────
    // base64_encode str -> string
    "base64_encode": (str) => Buffer.from(str, "utf8").toString("base64"),
    // base64_decode str -> string
    "base64_decode": (str) => Buffer.from(str, "base64").toString("utf8"),
    // base64url_encode str -> string (URL-safe, no padding)
    "base64url_encode": (str) => Buffer.from(str, "utf8").toString("base64url"),
    // base64url_decode str -> string (URL-safe Base64 → UTF-8)
    "base64url_decode": (str) => Buffer.from(str, "base64url").toString("utf8"),
    // hex_encode str -> string
    "hex_encode": (str) => Buffer.from(str, "utf8").toString("hex"),
    // hex_decode hex -> string
    "hex_decode": (hex) => Buffer.from(hex, "hex").toString("utf8"),
    // ── Random ────────────────────────────────────────────────
    // random_bytes n -> string (hex, n bytes of randomness)
    "random_bytes": (n) => nodeCrypto.randomBytes(n).toString("hex"),
    // random_int min max -> number (inclusive)
    "random_int": (min, max) => {
      const range = max - min + 1;
      return min + nodeCrypto.randomInt(range);
    },
    // random_float -> number (0.0 - 1.0)
    "random_float": () => {
      const buf = nodeCrypto.randomBytes(4);
      return buf.readUInt32BE(0) / 4294967295;
    },
    // ── UUID ──────────────────────────────────────────────────
    // uuid_v4 -> string (random UUID)
    "uuid_v4": () => nodeCrypto.randomUUID(),
    // uuid_short -> string (8-char short ID from random bytes)
    "uuid_short": () => nodeCrypto.randomBytes(4).toString("hex"),
    // uuid_from_str str -> string (deterministic ID from string content)
    "uuid_from_str": (str) => {
      const hash = nodeCrypto.createHash("sha256").update(str).digest("hex");
      return [hash.slice(0, 8), hash.slice(8, 12), "5" + hash.slice(13, 16), hash.slice(16, 20), hash.slice(20, 32)].join("-");
    },
    // is_uuid str -> boolean
    "is_uuid": (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
    // ── Regex ─────────────────────────────────────────────────
    // regex_match str pattern -> boolean
    "regex_match": (str, pattern) => {
      try {
        return new RegExp(pattern).test(str);
      } catch (e) {
        throw new Error(`regex_match: invalid pattern "${pattern}": ${e.message}`);
      }
    },
    // regex_match_i str pattern -> boolean (case insensitive)
    "regex_match_i": (str, pattern) => {
      try {
        return new RegExp(pattern, "i").test(str);
      } catch (e) {
        throw new Error(`regex_match_i: invalid pattern: ${e.message}`);
      }
    },
    // regex_find str pattern -> string|null (first match)
    "regex_find": (str, pattern) => {
      const m = str.match(new RegExp(pattern));
      return m ? m[0] : null;
    },
    // regex_find_all str pattern -> [string] (all non-overlapping matches)
    "regex_find_all": (str, pattern) => {
      const matches = str.match(new RegExp(pattern, "g"));
      return matches ?? [];
    },
    // regex_replace str pattern replacement -> string
    "regex_replace": (str, pattern, replacement) => str.replace(new RegExp(pattern, "g"), replacement),
    // regex_replace_first str pattern replacement -> string (only first match)
    "regex_replace_first": (str, pattern, replacement) => str.replace(new RegExp(pattern), replacement),
    // regex_extract str pattern -> [string] (capture groups of first match)
    "regex_extract": (str, pattern) => {
      const m = str.match(new RegExp(pattern));
      return m ? m.slice(1) : [];
    },
    // regex_extract_all str pattern -> [[string]] (all matches with groups)
    "regex_extract_all": (str, pattern) => {
      const results = [];
      const re = new RegExp(pattern, "g");
      let m;
      while ((m = re.exec(str)) !== null) {
        results.push(m.slice(1));
      }
      return results;
    },
    // regex_split str pattern -> [string]
    "regex_split": (str, pattern) => str.split(new RegExp(pattern)),
    // regex_count str pattern -> number (count of matches)
    "regex_count": (str, pattern) => {
      const m = str.match(new RegExp(pattern, "g"));
      return m ? m.length : 0;
    },
    // ── AI Text Parsing Helpers ───────────────────────────────
    // extract_json str -> any|null  (extract first JSON object/array from text)
    "extract_json": (str) => {
      const m = str.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    },
    // extract_code str lang -> string|null  (extract code block from markdown)
    "extract_code": (str, lang) => {
      const pattern = lang ? `\`\`\`${lang}\\n([\\s\\S]*?)\`\`\`` : `\`\`\`(?:\\w+)?\\n([\\s\\S]*?)\`\`\``;
      const m = str.match(new RegExp(pattern));
      return m ? m[1].trim() : null;
    },
    // extract_emails str -> [string]
    "extract_emails": (str) => str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [],
    // extract_urls str -> [string]
    "extract_urls": (str) => str.match(/https?:\/\/[^\s"'<>)]+/g) ?? [],
    // extract_numbers str -> [number]
    "extract_numbers": (str) => (str.match(/-?\d+\.?\d*/g) ?? []).map(Number),
    // is_email str -> boolean
    "is_email": (str) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str),
    // is_url str -> boolean
    "is_url": (str) => {
      try {
        new URL(str);
        return true;
      } catch {
        return false;
      }
    }
  };
}
var nodeCrypto;
var init_stdlib_crypto = __esm({
  "src/stdlib-crypto.ts"() {
    nodeCrypto = __toESM(require("crypto"));
  }
});

// src/stdlib-checkpoint.ts
function saveCheckpoint(filePath, data) {
  try {
    const dir = path3.dirname(filePath);
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
    const toSerializable2 = (obj) => {
      if (obj instanceof Map) return Object.fromEntries(obj);
      if (Array.isArray(obj)) return obj.map(toSerializable2);
      if (typeof obj === "object" && obj !== null) {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
          result[k] = toSerializable2(v);
        }
        return result;
      }
      return obj;
    };
    fs2.writeFileSync(filePath, JSON.stringify(toSerializable2(data), null, 2), "utf-8");
  } catch (err) {
    console.error(`[Checkpoint] Failed to save: ${err.message}`);
    throw err;
  }
}
function loadCheckpoint(filePath) {
  try {
    if (!fs2.existsSync(filePath)) {
      return null;
    }
    const content = fs2.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return data;
  } catch (err) {
    console.error(`[Checkpoint] Failed to load: ${err.message}`);
    return null;
  }
}
function deleteCheckpoint(filePath) {
  try {
    if (fs2.existsSync(filePath)) {
      fs2.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[Checkpoint] Failed to delete: ${err.message}`);
  }
}
var fs2, path3;
var init_stdlib_checkpoint = __esm({
  "src/stdlib-checkpoint.ts"() {
    fs2 = __toESM(require("fs"));
    path3 = __toESM(require("path"));
  }
});

// src/stdlib-workflow.ts
var stdlib_workflow_exports = {};
__export(stdlib_workflow_exports, {
  createWorkflowModule: () => createWorkflowModule
});
function categorizeError(message) {
  const msg = message.toLowerCase();
  if (msg.includes("timeout")) return "TIMEOUT";
  if (msg.includes("enoent") || msg.includes("not found")) return "NOT_FOUND";
  if (msg.includes("eacces") || msg.includes("permission")) return "PERMISSION";
  if (msg.includes("econnrefused") || msg.includes("connection refused")) return "CONNECTION";
  if (msg.includes("econnreset") || msg.includes("connection reset")) return "CONNECTION";
  if (msg.includes("parse") || msg.includes("json")) return "PARSE_ERROR";
  if (msg.includes("type") || msg.includes("typeof")) return "TYPE_ERROR";
  if (msg.includes("null") || msg.includes("undefined")) return "NULL_ERROR";
  if (msg.includes("network") || msg.includes("http")) return "NETWORK";
  if (msg.includes("io error")) return "IO_ERROR";
  return "UNKNOWN";
}
function createWorkflowModule() {
  return {
    // ── Workflow Definition ───────────────────────────────────
    // workflow_create name steps -> Workflow object
    "workflow_create": (name, steps) => ({
      id: X.uuid_from_str(name + Date.now()),
      name,
      steps,
      created_at: T.now()
    }),
    // workflow_step name fn options -> WorkflowStep  (helper for defining steps)
    "workflow_step": (name, fn, options = {}) => ({
      name,
      fn,
      retry: options.retry ?? 0,
      required: options.required ?? true,
      on_error: options.on_error,
      on_timeout: options.on_timeout,
      fallback: options.fallback,
      timeout_ms: options.timeout_ms,
      if: options.if,
      parallel_tasks: options.parallel_tasks,
      merge_strategy: options.merge_strategy,
      compensate: options.compensate,
      on_partial: options.on_partial,
      distributed: options.distributed
    }),
    // ── Workflow Execution ────────────────────────────────────
    // workflow_run workflow initial_ctx options -> WorkflowResult (P0, no parallel support)
    // Use workflow_run_async for P1-1 parallel task support
    "workflow_run": (workflow, initialCtx = {}, options) => {
      const startMs = T.now();
      const runId = X.uuid_short();
      const checkpointPath = options?.checkpoint_path;
      const checkpointEvery = options?.checkpoint_every ?? 0;
      const autoResume = options?.auto_resume ?? true;
      let startFromStep = 0;
      let ctx = { ...initialCtx, _workflow: workflow.name, _run_id: runId };
      if (autoResume && checkpointPath) {
        const checkpoint = loadCheckpoint(checkpointPath);
        if (checkpoint && checkpoint.workflow_id === workflow.id) {
          startFromStep = checkpoint.step_index;
          ctx = { ...checkpoint.context, _workflow: workflow.name, _run_id: runId };
          console.log(`[Checkpoint] Resuming from step ${startFromStep} (${checkpoint.step_names.length} completed)`);
        }
      }
      const log = [];
      const errors = [];
      let stepsOk = 0;
      let stepsFailed = 0;
      const steps = workflow.steps;
      const completedStepNames = [];
      for (let stepIndex = startFromStep; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];
        if (step.parallel_tasks && step.parallel_tasks.length > 0) {
          return {
            id: runId,
            name: workflow.name,
            status: "failed",
            context: ctx,
            steps_run: stepsOk + stepsFailed,
            steps_ok: stepsOk,
            steps_failed: stepsFailed,
            total_ms: T.now() - startMs,
            log,
            errors: ["Parallel tasks detected. Use workflow_run_async() instead of workflow_run()"]
          };
        }
        if (step.if !== void 0) {
          try {
            const shouldRun = step.if(ctx);
            if (!shouldRun) {
              log.push({
                step: step.name,
                status: "skipped",
                ms: 0,
                trace_id: traceId,
                metrics: { wall_time_ms: 0 }
              });
              continue;
            }
          } catch (condErr) {
            errors.push(`[${step.name}] Condition failed: ${condErr.message}`);
            if (step.required !== false) {
              return {
                id: runId,
                name: workflow.name,
                status: "failed",
                context: ctx,
                steps_run: stepsOk + stepsFailed,
                steps_ok: stepsOk,
                steps_failed: stepsFailed,
                total_ms: T.now() - startMs,
                log,
                errors
              };
            }
            continue;
          }
        }
        const stepStart = T.now();
        let success = false;
        let lastErr = "";
        const maxAttempts = (step.retry ?? 0) + 1;
        let stepResult = void 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            stepResult = step.fn(ctx);
            ctx = { ...ctx, ...stepResult };
            success = true;
            break;
          } catch (err) {
            lastErr = err.message;
            if (attempt < maxAttempts - 1) {
              const wait = 50 * (attempt + 1);
              const end = Date.now() + wait;
              while (Date.now() < end) {
              }
            }
          }
        }
        const stepMs = T.now() - stepStart;
        if (success) {
          stepsOk++;
          completedStepNames.push(step.name);
          log.push({ step: step.name, status: "ok", ms: stepMs });
          ctx[`_step_${step.name}_ms`] = stepMs;
          if (checkpointPath && checkpointEvery > 0 && completedStepNames.length % checkpointEvery === 0) {
            const checkpoint = {
              workflow_id: workflow.id,
              workflow_name: workflow.name,
              step_index: stepIndex + 1,
              context: ctx,
              timestamp: T.now(),
              step_names: completedStepNames,
              steps_completed: completedStepNames.length
            };
            saveCheckpoint(checkpointPath, checkpoint);
          }
        } else {
          stepsFailed++;
          let fallbackValue = void 0;
          const errorCategory = categorizeError(lastErr);
          if (step.on_error) {
            try {
              fallbackValue = step.on_error({ error: lastErr, attempts: maxAttempts, step_name: step.name });
              ctx = { ...ctx, ...fallbackValue };
              success = true;
              errors.push(`[${step.name}] ${lastErr} (handled by on_error)`);
              log.push({
                step: step.name,
                status: "error_handled",
                ms: stepMs,
                error: lastErr,
                category: errorCategory,
                attempted: maxAttempts
              });
              stepsOk++;
              stepsFailed--;
              ctx[`_step_${step.name}_ms`] = stepMs;
              continue;
            } catch (handlerErr) {
              errors.push(`[${step.name}] ${lastErr} \u2192 on_error handler also failed: ${handlerErr.message}`);
            }
          }
          if (step.fallback !== void 0) {
            try {
              fallbackValue = typeof step.fallback === "function" ? step.fallback() : step.fallback;
              ctx = { ...ctx, ...fallbackValue };
              success = true;
              errors.push(`[${step.name}] ${lastErr} (fallback used)`);
              log.push({
                step: step.name,
                status: "fallback_used",
                ms: stepMs,
                error: lastErr,
                category: errorCategory,
                attempted: maxAttempts
              });
              stepsOk++;
              stepsFailed--;
              ctx[`_step_${step.name}_ms`] = stepMs;
              continue;
            } catch (fallbackErr) {
              errors.push(`[${step.name}] ${lastErr} \u2192 fallback also failed: ${fallbackErr.message}`);
            }
          }
          if (!success) {
            errors.push(`[${step.name}] ${lastErr}`);
            log.push({
              step: step.name,
              status: "failed",
              ms: stepMs,
              error: lastErr,
              category: errorCategory,
              attempted: maxAttempts
            });
            if (step.required !== false) {
              return {
                id: runId,
                name: workflow.name,
                status: "failed",
                context: ctx,
                steps_run: stepsOk + stepsFailed,
                steps_ok: stepsOk,
                steps_failed: stepsFailed,
                total_ms: T.now() - startMs,
                log,
                errors
              };
            }
          }
        }
      }
      const totalMs = T.now() - startMs;
      const status = stepsFailed === 0 ? "success" : "partial";
      if ((status === "success" || status === "partial") && checkpointPath) {
        deleteCheckpoint(checkpointPath);
      }
      return {
        id: runId,
        name: workflow.name,
        status,
        context: ctx,
        steps_run: stepsOk + stepsFailed,
        steps_ok: stepsOk,
        steps_failed: stepsFailed,
        total_ms: totalMs,
        log,
        errors
      };
    },
    // workflow_run_async workflow initial_ctx options -> Promise<WorkflowResult>
    // P1-1 async version supporting parallel tasks
    // P1-4: Enhanced observability with trace_id and metrics
    // options: {checkpoint_path, checkpoint_every, auto_resume}
    "workflow_run_async": async (workflow, initialCtx = {}, options) => {
      const startMs = T.now();
      const runId = X.uuid_short();
      const traceId2 = X.uuid_short();
      const checkpointPath = options?.checkpoint_path;
      const checkpointEvery = options?.checkpoint_every ?? 0;
      const autoResume = options?.auto_resume ?? true;
      let startFromStep = 0;
      let ctx = { ...initialCtx, _workflow: workflow.name, _run_id: runId };
      if (autoResume && checkpointPath) {
        const checkpoint = loadCheckpoint(checkpointPath);
        if (checkpoint && checkpoint.workflow_id === workflow.id) {
          startFromStep = checkpoint.step_index;
          ctx = { ...checkpoint.context, _workflow: workflow.name, _run_id: runId };
          console.log(`[Checkpoint] Resuming from step ${startFromStep} (${checkpoint.step_names.length} completed)`);
        }
      }
      const log = [];
      const errors = [];
      let stepsOk = 0;
      let stepsFailed = 0;
      const steps = workflow.steps;
      const completedStepNames = [];
      const completedSteps = [];
      const compensations = [];
      const executeStep = async (step, currentCtx) => {
        const stepStart = T.now();
        let success = false;
        let lastErr = "";
        const maxAttempts = (step.retry ?? 0) + 1;
        let stepResult = void 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            stepResult = step.fn(currentCtx);
            success = true;
            break;
          } catch (err) {
            lastErr = err.message;
            if (attempt < maxAttempts - 1) {
              const wait = 50 * (attempt + 1);
              const end = Date.now() + wait;
              while (Date.now() < end) {
              }
            }
          }
        }
        const stepMs = T.now() - stepStart;
        return { success, result: stepResult, error: lastErr, ms: stepMs };
      };
      const executeParallelTasks = async (parallelTasks, mergeStrategy, currentCtx) => {
        const taskExecutions = parallelTasks.map((task) => executeStep(task, currentCtx));
        const taskResults = await Promise.all(taskExecutions);
        const mergedResults = {};
        const taskErrors = [];
        let allSuccess = true;
        let anySuccess = false;
        taskResults.forEach((result, index) => {
          const taskName = parallelTasks[index].name;
          if (result.success) {
            mergedResults[taskName] = result.result;
            anySuccess = true;
          } else {
            taskErrors.push(`${taskName}: ${result.error}`);
            allSuccess = false;
          }
        });
        let strategySuccess = false;
        if (mergeStrategy === "all-success") {
          strategySuccess = allSuccess;
        } else if (mergeStrategy === "first-success") {
          strategySuccess = anySuccess;
        } else if (mergeStrategy === "any-partial") {
          strategySuccess = true;
        } else {
          strategySuccess = allSuccess;
        }
        return { success: strategySuccess, results: mergedResults, errors: taskErrors };
      };
      const applyCompensations = async (completedSteps2, currentCtx) => {
        for (let i = completedSteps2.length - 1; i >= 0; i--) {
          const step = completedSteps2[i];
          if (step.compensate) {
            try {
              const compensationResult = await step.compensate(currentCtx);
              compensations.push({
                step: step.name,
                action: "applied",
                result: compensationResult
              });
            } catch (compErr) {
              compensations.push({
                step: step.name,
                action: "pending",
                error: compErr.message
              });
            }
          }
        }
      };
      for (let stepIndex = startFromStep; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];
        if (step.if !== void 0) {
          try {
            const shouldRun = step.if(ctx);
            if (!shouldRun) {
              log.push({
                step: step.name,
                status: "skipped",
                ms: 0,
                trace_id: traceId2,
                metrics: { wall_time_ms: 0 }
              });
              continue;
            }
          } catch (condErr) {
            errors.push(`[${step.name}] Condition failed: ${condErr.message}`);
            if (step.required !== false) {
              await applyCompensations(completedSteps, ctx);
              return {
                id: runId,
                name: workflow.name,
                status: "failed",
                context: ctx,
                steps_run: stepsOk + stepsFailed,
                steps_ok: stepsOk,
                steps_failed: stepsFailed,
                total_ms: T.now() - startMs,
                log,
                errors,
                compensations
              };
            }
            continue;
          }
        }
        const stepStart = T.now();
        let success = false;
        let lastErr = "";
        let stepResult = void 0;
        let stepMs = 0;
        if (step.parallel_tasks && step.parallel_tasks.length > 0) {
          const mergeStrategy = step.merge_strategy ?? "all-success";
          const parallelResult = await executeParallelTasks(step.parallel_tasks, mergeStrategy, ctx);
          stepMs = T.now() - stepStart;
          if (parallelResult.success) {
            success = true;
            stepResult = { [step.name]: parallelResult.results };
            ctx = { ...ctx, ...stepResult };
            stepsOk++;
            completedStepNames.push(step.name);
            completedSteps.push(step);
            log.push({
              step: step.name,
              status: "ok",
              ms: stepMs,
              trace_id: traceId2,
              metrics: { wall_time_ms: stepMs }
            });
            ctx[`_step_${step.name}_ms`] = stepMs;
          } else {
            stepsFailed++;
            lastErr = parallelResult.errors.join("; ");
            const errorCategory = categorizeError(lastErr);
            if (step.fallback !== void 0) {
              try {
                const fallbackValue = typeof step.fallback === "function" ? step.fallback() : step.fallback;
                ctx = { ...ctx, ...fallbackValue };
                success = true;
                errors.push(`[${step.name}] Parallel tasks failed (fallback used)`);
                log.push({ step: step.name, status: "fallback_used", ms: stepMs, error: lastErr, category: errorCategory });
                stepsOk++;
                stepsFailed--;
                completedSteps.push(step);
                ctx[`_step_${step.name}_ms`] = stepMs;
              } catch (fallbackErr) {
                errors.push(`[${step.name}] Parallel tasks failed: ${lastErr}`);
                log.push({ step: step.name, status: "failed", ms: stepMs, error: lastErr, category: errorCategory });
                if (step.required !== false) {
                  await applyCompensations(completedSteps, ctx);
                  return {
                    id: runId,
                    name: workflow.name,
                    status: "failed",
                    context: ctx,
                    steps_run: stepsOk + stepsFailed,
                    steps_ok: stepsOk,
                    steps_failed: stepsFailed,
                    total_ms: T.now() - startMs,
                    log,
                    errors,
                    compensations
                  };
                }
              }
            } else {
              errors.push(`[${step.name}] Parallel tasks failed: ${lastErr}`);
              log.push({ step: step.name, status: "failed", ms: stepMs, error: lastErr, category: categorizeError(lastErr) });
              if (step.required !== false) {
                await applyCompensations(completedSteps, ctx);
                return {
                  id: runId,
                  name: workflow.name,
                  status: "failed",
                  context: ctx,
                  steps_run: stepsOk + stepsFailed,
                  steps_ok: stepsOk,
                  steps_failed: stepsFailed,
                  total_ms: T.now() - startMs,
                  log,
                  errors,
                  compensations
                };
              }
            }
          }
        } else {
          const execResult = await executeStep(step, ctx);
          stepMs = execResult.ms;
          success = execResult.success;
          lastErr = execResult.error;
          stepResult = execResult.result;
          if (success) {
            stepsOk++;
            completedStepNames.push(step.name);
            completedSteps.push(step);
            log.push({
              step: step.name,
              status: "ok",
              ms: stepMs,
              trace_id: traceId2,
              metrics: { wall_time_ms: stepMs }
            });
            ctx = { ...ctx, ...stepResult };
            ctx[`_step_${step.name}_ms`] = stepMs;
            if (checkpointPath && checkpointEvery > 0 && completedStepNames.length % checkpointEvery === 0) {
              const checkpoint = {
                workflow_id: workflow.id,
                workflow_name: workflow.name,
                step_index: stepIndex + 1,
                context: ctx,
                timestamp: T.now(),
                step_names: completedStepNames,
                steps_completed: completedStepNames.length
              };
              saveCheckpoint(checkpointPath, checkpoint);
            }
          } else {
            stepsFailed++;
            let fallbackValue = void 0;
            const errorCategory = categorizeError(lastErr);
            if (step.on_error) {
              try {
                fallbackValue = step.on_error({ error: lastErr, attempts: 1, step_name: step.name });
                ctx = { ...ctx, ...fallbackValue };
                success = true;
                errors.push(`[${step.name}] ${lastErr} (handled by on_error)`);
                log.push({
                  step: step.name,
                  status: "error_handled",
                  ms: stepMs,
                  error: lastErr,
                  category: errorCategory,
                  attempted: 1
                });
                stepsOk++;
                stepsFailed--;
                completedSteps.push(step);
                ctx[`_step_${step.name}_ms`] = stepMs;
                continue;
              } catch (handlerErr) {
                errors.push(`[${step.name}] ${lastErr} \u2192 on_error handler also failed: ${handlerErr.message}`);
              }
            }
            if (step.fallback !== void 0) {
              try {
                fallbackValue = typeof step.fallback === "function" ? step.fallback() : step.fallback;
                ctx = { ...ctx, ...fallbackValue };
                success = true;
                errors.push(`[${step.name}] ${lastErr} (fallback used)`);
                log.push({
                  step: step.name,
                  status: "fallback_used",
                  ms: stepMs,
                  error: lastErr,
                  category: errorCategory,
                  attempted: 1
                });
                stepsOk++;
                stepsFailed--;
                completedSteps.push(step);
                ctx[`_step_${step.name}_ms`] = stepMs;
                continue;
              } catch (fallbackErr) {
                errors.push(`[${step.name}] ${lastErr} \u2192 fallback also failed: ${fallbackErr.message}`);
              }
            }
            if (!success) {
              errors.push(`[${step.name}] ${lastErr}`);
              log.push({
                step: step.name,
                status: "failed",
                ms: stepMs,
                error: lastErr,
                category: errorCategory,
                attempted: 1
              });
              if (step.required !== false) {
                await applyCompensations(completedSteps, ctx);
                return {
                  id: runId,
                  name: workflow.name,
                  status: "failed",
                  context: ctx,
                  steps_run: stepsOk + stepsFailed,
                  steps_ok: stepsOk,
                  steps_failed: stepsFailed,
                  total_ms: T.now() - startMs,
                  log,
                  errors,
                  compensations
                };
              }
            }
          }
        }
      }
      const totalMs = T.now() - startMs;
      const status = stepsFailed === 0 ? "success" : "partial";
      if ((status === "success" || status === "partial") && checkpointPath) {
        deleteCheckpoint(checkpointPath);
      }
      const normalizedLog = log.map((entry) => ({
        ...entry,
        trace_id: entry.trace_id || traceId2,
        metrics: entry.metrics || { wall_time_ms: entry.ms || 0 }
      }));
      const parallelStepsCount = completedSteps.filter((s) => s.parallel_tasks && s.parallel_tasks.length > 0).length;
      const totalSteps = stepsOk + stepsFailed;
      const totalCompensations = compensations?.length ?? 0;
      return {
        id: runId,
        name: workflow.name,
        status,
        context: ctx,
        steps_run: stepsOk + stepsFailed,
        steps_ok: stepsOk,
        steps_failed: stepsFailed,
        total_ms: totalMs,
        log: normalizedLog,
        errors,
        compensations,
        // P1-2: Include compensation results
        // P1-4: Observability metrics
        metrics: {
          total_ms: totalMs,
          parallel_ratio: totalSteps > 0 ? parallelStepsCount / totalSteps : 0,
          error_ratio: totalSteps > 0 ? stepsFailed / totalSteps : 0,
          compensation_ratio: totalSteps > 0 ? Math.min(totalCompensations / totalSteps, 1) : 0
        }
      };
    },
    // ── P0-1: Error Handling Helpers ──────────────────────────
    // step-with-error step handler-fn -> WorkflowStep (add error handler)
    "step-with-error": (step, handler) => ({
      ...step,
      on_error: handler
    }),
    // step-with-fallback step value-or-fn -> WorkflowStep (add fallback)
    "step-with-fallback": (step, value) => ({
      ...step,
      fallback: value
    }),
    // step-with-timeout step ms -> WorkflowStep (add timeout)
    "step-with-timeout": (step, ms) => ({
      ...step,
      timeout_ms: ms
    }),
    // ── P0-2: Conditional Execution Helpers ──────────────────
    // step-when step condition-fn -> WorkflowStep (add conditional)
    "step-when": (step, condition) => ({
      ...step,
      if: condition
    }),
    // ── Result Inspection ─────────────────────────────────────
    // workflow_ok result -> boolean
    "workflow_ok": (result) => result.status !== "failed",
    // workflow_get result key -> any  (get value from result context)
    "workflow_get": (result, key) => result.context[key] ?? null,
    // workflow_summary result -> string  (human/AI readable summary)
    "workflow_summary": (result) => {
      const lines = [
        `Workflow: ${result.name} [${result.status.toUpperCase()}]`,
        `Run ID:   ${result.id}`,
        `Steps:    ${result.steps_ok}/${result.steps_run} ok, ${result.steps_failed} failed`,
        `Time:     ${result.total_ms}ms`
      ];
      if (result.errors.length > 0) {
        lines.push(`Errors:`);
        result.errors.forEach((e) => lines.push(`  - ${e}`));
      }
      lines.push(`Step log:`);
      result.log.forEach((l) => {
        const err = l.error ? ` \u2014 ${l.error}` : "";
        lines.push(`  [${l.status.padEnd(6)}] ${l.step} (${l.ms}ms)${err}`);
      });
      return lines.join("\n");
    },
    // ── Task Tracker ──────────────────────────────────────────
    // task_create goal -> Task
    "task_create": (goal) => ({
      id: X.uuid_v4(),
      goal,
      status: "pending",
      subtasks: [],
      completed: [],
      result: null,
      created_at: T.now()
    }),
    // task_add_subtask task name -> task
    "task_add_subtask": (task, name) => ({
      ...task,
      subtasks: [...task.subtasks, name]
    }),
    // task_complete_subtask task name result -> task
    "task_complete_subtask": (task, name, result) => ({
      ...task,
      completed: [...task.completed, name],
      [`result_${name}`]: result
    }),
    // task_finish task result -> task
    "task_finish": (task, result) => ({
      ...task,
      status: "done",
      result,
      finished_at: T.now(),
      duration_ms: T.now() - task.created_at
    }),
    // task_progress task -> number (0.0-1.0)
    "task_progress": (task) => {
      if (task.subtasks.length === 0) return task.status === "done" ? 1 : 0;
      return task.completed.length / task.subtasks.length;
    },
    // ── Report Builder ────────────────────────────────────────
    // report_create title -> Report
    "report_create": (title) => ({
      title,
      sections: [],
      created_at: T.now_iso()
    }),
    // report_add report section_name data -> Report
    "report_add": (report, sectionName, data) => ({
      ...report,
      sections: [...report.sections, { name: sectionName, data }]
    }),
    // report_render report -> string  (formatted text report)
    "report_render": (report) => {
      const divider = "\u2500".repeat(50);
      const lines = [
        divider,
        `  ${report.title}`,
        `  Generated: ${report.created_at}`,
        divider
      ];
      for (const section of report.sections) {
        lines.push(`
## ${section.name}`);
        const d = section.data;
        if (typeof d === "string") {
          lines.push(d);
        } else if (Array.isArray(d)) {
          d.forEach((item, i) => {
            lines.push(`  ${i + 1}. ${typeof item === "object" ? JSON.stringify(item) : item}`);
          });
        } else if (typeof d === "object") {
          Object.entries(d).forEach(([k, v]) => {
            lines.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
          });
        } else {
          lines.push(String(d));
        }
      }
      lines.push("\n" + divider);
      return lines.join("\n");
    }
  };
}
var T, A, X;
var init_stdlib_workflow = __esm({
  "src/stdlib-workflow.ts"() {
    init_stdlib_time();
    init_stdlib_agent();
    init_stdlib_crypto();
    init_stdlib_checkpoint();
    T = createTimeModule();
    A = createAgentModule();
    X = createCryptoModule();
  }
});

// src/stdlib-resource.ts
var stdlib_resource_exports = {};
__export(stdlib_resource_exports, {
  createResourceModule: () => createResourceModule
});
function run(cmd, timeout = 1e4) {
  try {
    return (0, import_child_process2.execSync)(cmd, { encoding: "utf-8", timeout, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}
function runLines(cmd) {
  const out = run(cmd);
  return out ? out.split("\n").map((l) => l.trim()).filter(Boolean) : [];
}
function parseKv(lines, sep = ":") {
  const obj = {};
  for (const line of lines) {
    const idx = line.indexOf(sep);
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      obj[k] = v;
    }
  }
  return obj;
}
function createResourceModule() {
  return {
    // ── CPU ─────────────────────────────────────────────────────
    // res_cpu_load -> [1m, 5m, 15m]
    "res_cpu_load": () => {
      return os.loadavg();
    },
    // res_cpu_count -> number
    "res_cpu_count": () => {
      return os.cpus().length;
    },
    // res_cpu_model -> string
    "res_cpu_model": () => {
      const cpus2 = os.cpus();
      return cpus2.length > 0 ? cpus2[0].model : "unknown";
    },
    // res_cpu_pct -> number (1-min loadavg based, avoids busy wait)
    "res_cpu_pct": () => {
      const load = os.loadavg()[0];
      const cpus2 = os.cpus().length;
      return Math.min(100, Math.round(load / cpus2 * 100));
    },
    // ── Memory ──────────────────────────────────────────────────
    // res_mem -> {total_mb, used_mb, free_mb, buffers_mb, cached_mb, available_mb}
    "res_mem": () => {
      const total = Math.round(os.totalmem() / 1024 / 1024);
      const free = Math.round(os.freemem() / 1024 / 1024);
      const used = total - free;
      const lines = runLines("cat /proc/meminfo");
      const kv = parseKv(lines);
      const parseKb = (k) => Math.round(parseInt((kv[k] || "0 kB").split(" ")[0]) / 1024);
      return {
        total_mb: total,
        used_mb: used,
        free_mb: free,
        available_mb: parseKb("MemAvailable"),
        buffers_mb: parseKb("Buffers"),
        cached_mb: parseKb("Cached"),
        swap_total_mb: parseKb("SwapTotal"),
        swap_used_mb: parseKb("SwapTotal") - parseKb("SwapFree")
      };
    },
    // res_mem_pct -> number (used %)
    "res_mem_pct": () => {
      const total = os.totalmem();
      const free = os.freemem();
      return total > 0 ? Math.round((1 - free / total) * 100) : 0;
    },
    // ── Disk ────────────────────────────────────────────────────
    // res_disk -> DiskInfo[]
    "res_disk": () => {
      const lines = runLines("df -BG --output=source,target,size,used,avail,pcent 2>/dev/null | tail -n +2");
      return lines.filter((l) => l.startsWith("/")).map((line) => {
        const [device, mount, total, used, avail, pct] = line.split(/\s+/);
        return {
          device,
          mount,
          total_gb: parseInt(total) || 0,
          used_gb: parseInt(used) || 0,
          avail_gb: parseInt(avail) || 0,
          use_pct: parseInt(pct) || 0
        };
      });
    },
    // res_disk_usage path -> {total_gb, used_gb, avail_gb, use_pct}
    "res_disk_usage": (path7) => {
      const line = run(`df -BG --output=size,used,avail,pcent "${path7}" 2>/dev/null | tail -1`);
      if (!line) return { total_gb: 0, used_gb: 0, avail_gb: 0, use_pct: 0 };
      const [total, used, avail, pct] = line.trim().split(/\s+/);
      return {
        total_gb: parseInt(total) || 0,
        used_gb: parseInt(used) || 0,
        avail_gb: parseInt(avail) || 0,
        use_pct: parseInt(pct) || 0
      };
    },
    // ── Processes ───────────────────────────────────────────────
    // res_procs -> ProcessInfo[]  (top 20 by CPU)
    "res_procs": () => {
      const lines = runLines("ps axo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu 2>/dev/null | head -21 | tail -20");
      return lines.map((line) => {
        const parts = line.split(/\s+/);
        return {
          pid: parseInt(parts[0]) || 0,
          user: parts[1] || "",
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          state: parts[4] || "",
          name: parts[5] || "",
          cmd: parts.slice(6).join(" ")
        };
      });
    },
    // res_find_proc name -> ProcessInfo[]  (search by name substring)
    "res_find_proc": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const lines = runLines(`ps axo pid,user,pcpu,pmem,stat,comm,args 2>/dev/null | grep -i "${safeName}" | grep -v grep`);
      return lines.map((line) => {
        const parts = line.split(/\s+/);
        return {
          pid: parseInt(parts[0]) || 0,
          user: parts[1] || "",
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          state: parts[4] || "",
          name: parts[5] || "",
          cmd: parts.slice(6).join(" ")
        };
      });
    },
    // res_proc_exists name -> boolean
    "res_proc_exists": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const result = (0, import_child_process2.spawnSync)("sh", ["-c", `pgrep -f "${safeName}" > /dev/null 2>&1`]);
      return (result.status ?? 1) === 0;
    },
    // res_proc_pid name -> number | null
    "res_proc_pid": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const out = run(`pgrep -f "${safeName}" | head -1`);
      const pid = parseInt(out);
      return isNaN(pid) ? null : pid;
    },
    // res_proc_count name -> number  (how many instances running)
    "res_proc_count": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const out = run(`pgrep -fc "${safeName}" 2>/dev/null || echo 0`);
      return parseInt(out) || 0;
    },
    // ── Ports ───────────────────────────────────────────────────
    // res_ports -> PortInfo[]  (all listening ports)
    "res_ports": () => {
      const lines = runLines("ss -tlnp 2>/dev/null | tail -n +2");
      return lines.map((line) => {
        const parts = line.split(/\s+/);
        const state = parts[0] || "";
        const local = parts[3] || "";
        const proc = line.match(/pid=(\d+)/)?.[1];
        const name = line.match(/\"([^\"]+)\"/)?.[1] || "";
        const colonIdx = local.lastIndexOf(":");
        const addr = local.slice(0, colonIdx);
        const port = parseInt(local.slice(colonIdx + 1)) || 0;
        return {
          port,
          protocol: "tcp",
          state,
          pid: proc ? parseInt(proc) : null,
          name,
          addr
        };
      }).filter((p) => p.port > 0);
    },
    // res_port_used port -> boolean
    "res_port_used": (port) => {
      const result = (0, import_child_process2.spawnSync)("sh", ["-c", `ss -tlnp 2>/dev/null | grep -q ":${port} "`]);
      return (result.status ?? 1) === 0;
    },
    // res_port_info port -> PortInfo | null
    "res_port_info": (port) => {
      const line = run(`ss -tlnp 2>/dev/null | grep ":${port} "`);
      if (!line) return null;
      const parts = line.split(/\s+/);
      const proc = line.match(/pid=(\d+)/)?.[1];
      const name = line.match(/\"([^\"]+)\"/)?.[1] || "";
      return {
        port,
        protocol: "tcp",
        state: parts[0] || "LISTEN",
        pid: proc ? parseInt(proc) : null,
        name,
        addr: parts[3]?.split(":").slice(0, -1).join(":") || ""
      };
    },
    // res_find_free_port start end -> number | null  (first free port in range)
    "res_find_free_port": (start, end) => {
      const usedLine = run(`ss -tlnp 2>/dev/null | awk '{print $4}' | grep -oP ':\\d+' | tr -d ':'`);
      const used = new Set(usedLine.split("\n").map((s) => parseInt(s)).filter((n) => !isNaN(n)));
      for (let p = start; p <= end; p++) {
        if (!used.has(p)) return p;
      }
      return null;
    },
    // ── Network ─────────────────────────────────────────────────
    // res_net -> NetInterface[]
    "res_net": () => {
      const ifaces = os.networkInterfaces();
      const result = [];
      for (const [name, addrs] of Object.entries(ifaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
          if (addr.family === "IPv4") {
            result.push({
              name,
              addr: addr.address,
              mac: addr.mac,
              up: true
            });
          }
        }
      }
      return result;
    },
    // res_hostname -> string
    "res_hostname": () => os.hostname(),
    // res_uptime_s -> number  (system uptime in seconds)
    "res_uptime_s": () => os.uptime(),
    // ── Services ────────────────────────────────────────────────
    // res_pm2_list -> ServiceInfo[]
    "res_pm2_list": () => {
      const out = run("pm2 jlist 2>/dev/null");
      if (!out) return [];
      try {
        const list = JSON.parse(out);
        return list.map((svc) => ({
          name: svc.name,
          status: svc.pm2_env?.status || "unknown",
          pid: svc.pid || null,
          uptime: svc.pm2_env?.pm_uptime ? `${Math.round((Date.now() - svc.pm2_env.pm_uptime) / 1e3)}s` : "0s",
          manager: "pm2"
        }));
      } catch {
        return [];
      }
    },
    // res_pm2_find name -> ServiceInfo | null
    "res_pm2_find": (name) => {
      const out = run("pm2 jlist 2>/dev/null");
      if (!out) return null;
      try {
        const list = JSON.parse(out);
        const svc = list.find((s) => s.name === name);
        if (!svc) return null;
        return {
          name: svc.name,
          status: svc.pm2_env?.status || "unknown",
          pid: svc.pid || null,
          uptime: svc.pm2_env?.pm_uptime ? `${Math.round((Date.now() - svc.pm2_env.pm_uptime) / 1e3)}s` : "0s",
          manager: "pm2"
        };
      } catch {
        return null;
      }
    },
    // res_systemd_status name -> ServiceInfo
    "res_systemd_status": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const active = run(`systemctl is-active "${safeName}" 2>/dev/null`);
      const pid = run(`systemctl show "${safeName}" -p MainPID --value 2>/dev/null`);
      return {
        name: safeName,
        status: active || "unknown",
        pid: parseInt(pid) || null,
        uptime: run(`systemctl show "${safeName}" -p ActiveEnterTimestamp --value 2>/dev/null`),
        manager: "systemd"
      };
    },
    // ── kimdb integration ────────────────────────────────────────
    // res_kimdb_project name -> Record | null  (query local kimdb)
    "res_kimdb_project": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-]/g, "");
      try {
        const out = run(`curl -sf "http://localhost:40000/api/c/projects/${safeName}" 2>/dev/null`, 3e3);
        if (!out) return null;
        const parsed = JSON.parse(out);
        return parsed.data ?? parsed ?? null;
      } catch {
        return null;
      }
    },
    // res_kimdb_projects -> Record[]  (all projects)
    "res_kimdb_projects": () => {
      try {
        const out = run(`curl -sf "http://localhost:40000/api/c/projects" 2>/dev/null`, 5e3);
        if (!out) return [];
        const parsed = JSON.parse(out);
        return Array.isArray(parsed) ? parsed : parsed.data ?? [];
      } catch {
        return [];
      }
    },
    // res_kimdb_health -> boolean
    "res_kimdb_health": () => {
      const out = run(`curl -sf "http://localhost:40000/health" 2>/dev/null`, 2e3);
      return out.includes("ok") || out.includes("healthy") || out.length > 0;
    },
    // ── Full Snapshot ────────────────────────────────────────────
    // res_snapshot -> ResourceSnapshot  (complete server state, ~1s)
    "res_snapshot": () => {
      const memInfo = (() => {
        const total = Math.round(os.totalmem() / 1024 / 1024);
        const free = Math.round(os.freemem() / 1024 / 1024);
        const lines = runLines("cat /proc/meminfo");
        const kv = parseKv(lines);
        const parseKb = (k) => Math.round(parseInt((kv[k] || "0 kB").split(" ")[0]) / 1024);
        return { total, free, used: total - free, swapTotal: parseKb("SwapTotal"), swapFree: parseKb("SwapFree") };
      })();
      const diskLines = runLines("df -BG --output=source,target,size,used,avail,pcent 2>/dev/null | tail -n +2");
      const disk = diskLines.filter((l) => l.startsWith("/")).map((line) => {
        const [device, mount, total, used, avail, pct] = line.split(/\s+/);
        return { device, mount, total_gb: parseInt(total) || 0, used_gb: parseInt(used) || 0, avail_gb: parseInt(avail) || 0, use_pct: parseInt(pct) || 0 };
      });
      const procLines = runLines("ps axo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu 2>/dev/null | head -6 | tail -5");
      const top_procs = procLines.map((line) => {
        const p = line.split(/\s+/);
        return { pid: parseInt(p[0]) || 0, user: p[1] || "", cpu: parseFloat(p[2]) || 0, mem: parseFloat(p[3]) || 0, state: p[4] || "", name: p[5] || "", cmd: p.slice(6).join(" ") };
      });
      const portLines = runLines("ss -tlnp 2>/dev/null | tail -n +2");
      const ports_listening = portLines.map((line) => {
        const parts = line.split(/\s+/);
        const local = parts[3] || "";
        const colonIdx = local.lastIndexOf(":");
        const port = parseInt(local.slice(colonIdx + 1)) || 0;
        const proc = line.match(/pid=(\d+)/)?.[1];
        return { port, protocol: "tcp", state: parts[0] || "", pid: proc ? parseInt(proc) : null, name: line.match(/\"([^\"]+)\"/)?.[1] || "", addr: local.slice(0, colonIdx) };
      }).filter((p) => p.port > 0);
      return {
        ts: Date.now(),
        hostname: os.hostname(),
        uptime_s: os.uptime(),
        cpu_load: os.loadavg(),
        mem_total_mb: memInfo.total,
        mem_used_mb: memInfo.used,
        mem_free_mb: memInfo.free,
        swap_total_mb: memInfo.swapTotal,
        swap_used_mb: memInfo.swapTotal - memInfo.swapFree,
        disk,
        top_procs,
        ports_listening
      };
    },
    // res_snapshot_report snapshot -> string  (human/AI readable)
    "res_snapshot_report": (snap) => {
      const mem_pct = snap.mem_total_mb > 0 ? Math.round(snap.mem_used_mb / snap.mem_total_mb * 100) : 0;
      const upd = new Date(snap.ts).toISOString();
      const lines = [
        `\u2550\u2550\u2550 Server Resource Snapshot \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,
        `Host:    ${snap.hostname}  |  Time: ${upd}`,
        `Uptime:  ${Math.round(snap.uptime_s / 3600)}h ${Math.round(snap.uptime_s % 3600 / 60)}m`,
        ``,
        `\u2500\u2500 CPU Load \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        `1m: ${snap.cpu_load[0].toFixed(2)}  5m: ${snap.cpu_load[1].toFixed(2)}  15m: ${snap.cpu_load[2].toFixed(2)}`,
        ``,
        `\u2500\u2500 Memory \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        `Used: ${snap.mem_used_mb}MB / ${snap.mem_total_mb}MB  (${mem_pct}%)`,
        `Swap: ${snap.swap_used_mb}MB / ${snap.swap_total_mb}MB`,
        ``,
        `\u2500\u2500 Disk \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        ...snap.disk.map((d) => `${d.mount.padEnd(12)} ${d.used_gb}G/${d.total_gb}G (${d.use_pct}%)  [${d.device}]`),
        ``,
        `\u2500\u2500 Top Processes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        ...snap.top_procs.map((p) => `PID ${String(p.pid).padEnd(7)} CPU:${String(p.cpu).padEnd(6)} MEM:${String(p.mem).padEnd(5)} ${p.name}`),
        ``,
        `\u2500\u2500 Listening Ports \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        ...snap.ports_listening.slice(0, 15).map((p) => `${String(p.port).padEnd(7)} ${p.name || "(unknown)"}`),
        ...snap.ports_listening.length > 15 ? [`... ${snap.ports_listening.length - 15} more`] : [],
        `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`
      ];
      return lines.join("\n");
    },
    // res_health_check -> {ok, warnings, errors}
    "res_health_check": () => {
      const warnings = [];
      const errors = [];
      const mem_pct = Math.round((1 - os.freemem() / os.totalmem()) * 100);
      if (mem_pct > 95) errors.push(`Memory critical: ${mem_pct}%`);
      else if (mem_pct > 80) warnings.push(`Memory high: ${mem_pct}%`);
      const load = os.loadavg();
      const cpus2 = os.cpus().length;
      if (load[0] > cpus2 * 2) errors.push(`CPU load critical: ${load[0].toFixed(2)} (${cpus2} cores)`);
      else if (load[0] > cpus2 * 0.8) warnings.push(`CPU load high: ${load[0].toFixed(2)} (${cpus2} cores)`);
      const diskLines = runLines("df -BG --output=target,pcent 2>/dev/null | tail -n +2");
      for (const line of diskLines) {
        const [mount, pct] = line.split(/\s+/);
        const pctNum = parseInt(pct);
        if (pctNum > 95) errors.push(`Disk ${mount} critical: ${pct}`);
        else if (pctNum > 85) warnings.push(`Disk ${mount} high: ${pct}`);
      }
      return {
        ok: errors.length === 0,
        warnings,
        errors,
        mem_pct,
        cpu_load_1m: load[0],
        cpu_cores: cpus2
      };
    }
  };
}
var import_child_process2, os;
var init_stdlib_resource = __esm({
  "src/stdlib-resource.ts"() {
    import_child_process2 = require("child_process");
    os = __toESM(require("os"));
  }
});

// src/stdlib-mariadb.ts
var stdlib_mariadb_exports = {};
__export(stdlib_mariadb_exports, {
  createMariadbModule: () => createMariadbModule
});
function resolveSocket() {
  if (cachedSock) return cachedSock;
  if (process.env.MARIADB_SOCK) return cachedSock = process.env.MARIADB_SOCK;
  const fs6 = require("fs");
  const candidates = [
    "/data/data/com.termux/files/usr/tmp/mysqld.sock",
    "/var/run/mysqld/mysqld.sock",
    "/var/lib/mysql/mysql.sock",
    "/tmp/mysqld.sock",
    "/tmp/mysql.sock"
  ];
  for (const s of candidates) {
    try {
      if (fs6.existsSync(s)) return cachedSock = s;
    } catch {
    }
  }
  return cachedSock = "/tmp/mysqld.sock";
}
function buildArgs(db, sql) {
  const sock = resolveSocket();
  const user = process.env.MARIADB_USER || "root";
  const pass = process.env.MARIADB_PASS || "";
  const host = process.env.MARIADB_HOST;
  const port = process.env.MARIADB_PORT;
  const args = ["-u", user];
  if (host) {
    args.push("-h", host);
    if (port) args.push("-P", port);
  } else {
    args.push("--socket=" + sock);
  }
  if (pass) args.push("-p" + pass);
  if (db) args.push(db);
  args.push("--batch", "-e", sql);
  return args;
}
function resolveMariadBin() {
  if (resolvedMariadbBin) return resolvedMariadbBin;
  const fs6 = require("fs");
  const path7 = require("path");
  for (const dir of MARIADB_SEARCH_PATHS) {
    const full = path7.join(dir, "mariadb");
    try {
      if (fs6.existsSync(full)) return resolvedMariadbBin = full;
    } catch {
    }
  }
  return resolvedMariadbBin = "mariadb";
}
function validateNoMultiStatement(sql) {
  const trimmed = sql.trim().toUpperCase();
  if (/^(BEGIN|COMMIT|ROLLBACK)(\s|;|$)/.test(trimmed)) return;
  if (sql.includes(";")) {
    throw new Error("CLI \uBC29\uC2DD: \uBA40\uD2F0\uC2A4\uD14C\uC774\uD2B8\uBA3C\uD2B8(;) \uCC28\uB2E8. \uD480 \uBC29\uC2DD(mariadb_pool_*)\uC744 \uC0AC\uC6A9\uD558\uAC70\uB098 \uB2E8\uC77C \uCFFC\uB9AC\uB85C \uBD84\uB9AC\uD558\uC138\uC694.");
  }
}
function runMariadb(db, sql) {
  validateNoMultiStatement(sql);
  const bin = resolveMariadBin();
  const extraPath = MARIADB_SEARCH_PATHS.join(":");
  const env = { ...process.env, PATH: `${extraPath}:${process.env.PATH ?? ""}` };
  const r = (0, import_child_process3.spawnSync)(bin, buildArgs(db, sql), { timeout: 15e3, encoding: "utf-8", env });
  const isProd = process.env.NODE_ENV === "production";
  const sqlHint = isProd ? "" : `
SQL: ${sql.slice(0, 200)}`;
  if (r.error) {
    const hint = r.error.message.includes("ENOENT") ? `
\uD78C\uD2B8: mariadb CLI\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD655\uC778\uD55C \uACBD\uB85C: ${MARIADB_SEARCH_PATHS.join(", ")}` : "";
    throw new Error(`mariadb CLI \uC2E4\uD328: ${r.error.message}${hint}
DB: ${db}${sqlHint}`);
  }
  if ((r.status ?? 1) !== 0) {
    const stderr = r.stderr?.trim() ?? `mariadb exit ${r.status}`;
    throw new Error(`MariaDB \uC624\uB958: ${stderr}
DB: ${db}${sqlHint}`);
  }
  return r.stdout?.toString() ?? "";
}
function parseRows(raw) {
  const lines = raw.split("\n").filter((l) => l.length > 0);
  if (lines.length < 1) return [];
  const headers = lines[0].split("	");
  return lines.slice(1).map((line) => {
    const vals = line.split("	");
    const obj = {};
    headers.forEach((h, i) => {
      const v = vals[i];
      if (v === void 0 || v === "NULL") obj[h] = null;
      else if (/^-?\d+$/.test(v)) obj[h] = parseInt(v, 10);
      else if (/^-?\d+\.\d+$/.test(v)) obj[h] = parseFloat(v);
      else obj[h] = v;
    });
    return obj;
  });
}
function escapeString(s) {
  return s.replace(/\\/g, "\\\\").replace(/\0/g, "\\0").replace(/'/g, "''").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\x1a/g, "\\Z");
}
function bindParams(sql, params) {
  if (!params || params.length === 0) return sql;
  return params.reduce((s, p) => {
    if (p === null || p === void 0) return s.replace("?", "NULL");
    if (typeof p === "boolean") return s.replace("?", p ? "1" : "0");
    if (typeof p === "number") {
      if (!isFinite(p) || isNaN(p))
        throw new Error(`SQL \uD30C\uB77C\uBBF8\uD130 \uC624\uB958: \uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC22B\uC790 (${p})`);
      return s.replace("?", String(p));
    }
    if (Array.isArray(p)) {
      const items = p.map((item) => {
        if (item === null || item === void 0) return "NULL";
        if (typeof item === "number") return String(item);
        if (typeof item === "boolean") return item ? "1" : "0";
        return `'${escapeString(String(item))}'`;
      });
      return s.replace("?", items.join(", "));
    }
    if (p instanceof Date) {
      return s.replace("?", `'${p.toISOString()}'`);
    }
    if (typeof p === "object") {
      throw new Error(`SQL \uD30C\uB77C\uBBF8\uD130 \uC624\uB958: \uAC1D\uCCB4\uB294 \uD30C\uB77C\uBBF8\uD130\uB85C \uC0AC\uC6A9 \uBD88\uAC00 (\uBC1B\uC740 \uAC12: ${JSON.stringify(p).slice(0, 80)})
\uD78C\uD2B8: (json-stringify \uAC12) \uC73C\uB85C \uBB38\uC790\uC5F4 \uBCC0\uD658 \uD6C4 \uC0BD\uC785\uD558\uC138\uC694`);
    }
    return s.replace("?", `'${escapeString(String(p))}'`);
  }, sql);
}
function ensureWorker() {
  if (poolWorker) return;
  const { Worker } = require("worker_threads");
  controlBuf = new SharedArrayBuffer(4);
  dataBuf = new SharedArrayBuffer(DATA_BUF_SIZE);
  Atomics.store(new Int32Array(controlBuf), 0, 0);
  poolWorker = new Worker(WORKER_CODE, {
    eval: true,
    workerData: { controlBuf, dataBuf }
  });
  poolWorker.on("error", (e) => {
    console.error("[MariaDB Pool Worker Error]", e.message);
    poolWorker = null;
  });
}
function poolCall(req) {
  ensureWorker();
  const control = new Int32Array(controlBuf);
  const data = Buffer.from(dataBuf);
  const reqStr = JSON.stringify(req);
  if (reqStr.length + 4 > DATA_BUF_SIZE) throw new Error("MariaDB pool: request too large");
  data.writeInt32LE(reqStr.length, 0);
  data.write(reqStr, 4, "utf8");
  Atomics.store(control, 0, 1);
  Atomics.notify(control, 0);
  const result = Atomics.wait(control, 0, 1, 15e3);
  if (result === "timed-out") throw new Error("MariaDB pool timeout");
  const respLen = data.readInt32LE(0);
  const resp = JSON.parse(data.toString("utf8", 4, 4 + respLen));
  Atomics.store(control, 0, 0);
  if (!resp.ok) throw new Error(resp.error || "MariaDB pool error");
  return resp;
}
function isSqliteConfig(db) {
  if (!db || typeof db !== "object") return false;
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return m.get("type") === "sqlite" || m.get("path") && !m.get("host");
}
function getSqlitePath(db) {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return String(m.get("path") ?? ":memory:");
}
function getMariadbName(db) {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  return String(m.get("database") ?? m.get("db") ?? "");
}
function getSqliteDb(path) {
  if (!_sqliteCache.has(path)) {
    const { DatabaseSync } = eval("require")("node:sqlite");
    _sqliteCache.set(path, new DatabaseSync(path));
  }
  return _sqliteCache.get(path);
}
function sqliteQuery(path7, sql, params) {
  const db = getSqliteDb(path7);
  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => {
    const m = /* @__PURE__ */ new Map();
    for (const [k, v] of Object.entries(r)) m.set(k, v);
    return m;
  });
}
function sqliteExec(path7, sql, params) {
  const db = getSqliteDb(path7);
  const result = db.prepare(sql).run(...params);
  const m = /* @__PURE__ */ new Map();
  m.set("affectedRows", result.changes ?? 0);
  m.set("insertId", Number(result.lastInsertRowid ?? 0));
  return m;
}
function mariadbConfigToPoolId(db) {
  const m = db instanceof Map ? db : new Map(Object.entries(db));
  const config = {
    host: m.get("host") ?? "localhost",
    user: m.get("user") ?? process.env.MARIADB_USER ?? "root",
    password: m.get("password") ?? m.get("pass") ?? process.env.MARIADB_PASS ?? "",
    database: m.get("database") ?? m.get("db") ?? "",
    port: m.get("port") ?? 3306
  };
  const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  poolCall({ type: "connect", poolId, config });
  return poolId;
}
function createMariadbModule(callFn) {
  function callFlFn(fn) {
    if (typeof fn === "function") return fn();
    if (typeof fn?.body === "function") return fn.body();
    if (callFn) return callFn(fn, []);
    throw new Error("db-transaction: fn \uC778\uC790\uAC00 \uD638\uCD9C \uAC00\uB2A5\uD55C \uD568\uC218\uAC00 \uC544\uB2D9\uB2C8\uB2E4");
  }
  return {
    // ── CLI 방식 (기존) — pool_* prefix → pool 자동 라우팅 ──────────────────
    "mariadb_exec": (db, sql, params = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        const r = poolCall({ type: "exec", poolId: db, sql, params });
        return { affectedRows: r.affectedRows, insertId: r.insertId };
      }
      return runMariadb(db, bindParams(sql, params));
    },
    "mariadb_query": (db, sql, params = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        return poolCall({ type: "query", poolId: db, sql, params }).rows ?? [];
      }
      return parseRows(runMariadb(db, bindParams(sql, params)));
    },
    "mariadb_one": (db, sql, params = []) => {
      if (typeof db === "string" && db.startsWith("pool_")) {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      const rows = parseRows(runMariadb(db, bindParams(sql, params)));
      const row = rows[0];
      return row === void 0 || row === null ? null : row;
    },
    // db_query_one db sql [params] → row or nil
    // db: CLI connection string (string) or pool ID (number) — auto-detect
    "db_query_one": (db, sql, params = []) => {
      if (typeof db === "number") {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      return parseRows(runMariadb(String(db), bindParams(sql, params)))[0] ?? null;
    },
    "db-query-one": (db, sql, params = []) => {
      if (typeof db === "number") {
        return poolCall({ type: "one", poolId: db, sql, params }).row ?? null;
      }
      return parseRows(runMariadb(String(db), bindParams(sql, params)))[0] ?? null;
    },
    // mariadb_transaction db [{sql params}] → {ok count} or {ok:false error}
    // 단일 연결에서 BEGIN/COMMIT/ROLLBACK 보장
    "mariadb_transaction": (db, stmts) => {
      if (!Array.isArray(stmts) || stmts.length === 0)
        return { ok: false, error: "empty statements" };
      const sqls = stmts.map((s) => bindParams(s.sql, s.params ?? []));
      const combined = "SET autocommit=0;\nBEGIN;\n" + sqls.join(";\n") + ";\nCOMMIT;";
      try {
        runMariadb(db, combined);
        return { ok: true, count: stmts.length };
      } catch (e) {
        try {
          runMariadb(db, "ROLLBACK");
        } catch {
        }
        return { ok: false, error: e.message };
      }
    },
    // mariadb_batch db [{sql params type}] → [{ok result}]
    "mariadb_batch": (db, queries) => {
      if (!Array.isArray(queries) || queries.length === 0) return [];
      const allExec = queries.every((q) => q.type === "exec" || !q.type);
      if (allExec && queries.length > 1) {
        const sqls = queries.map((q) => bindParams(q.sql, q.params ?? []));
        const combined = "SET autocommit=0;\nBEGIN;\n" + sqls.join(";\n") + ";\nCOMMIT;";
        try {
          runMariadb(db, combined);
          return queries.map(() => ({ ok: true }));
        } catch (e) {
          try {
            runMariadb(db, "ROLLBACK");
          } catch {
          }
          return queries.map(() => ({ ok: false, error: e.message }));
        }
      }
      return queries.map((q) => {
        const bound = bindParams(q.sql, q.params ?? []);
        try {
          if (q.type === "exec") return { ok: true, result: runMariadb(db, bound) };
          if (q.type === "one") return { ok: true, result: parseRows(runMariadb(db, bound))[0] ?? null };
          return { ok: true, result: parseRows(runMariadb(db, bound)) };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      });
    },
    // ── mariadb_connect — 맵/positional 양방향 지원 ──────────────────────────
    // (mariadb_connect {:host "h" :user "u" :password "p" :database "d"})
    // (mariadb_connect "host" "user" "password" "database" [port])  ← #67 해결
    "mariadb_connect": (...args) => {
      let config = args[0];
      if (typeof config === "string") {
        config = {
          host: args[0] ?? "localhost",
          user: args[1] ?? "",
          password: args[2] ?? "",
          database: args[3] ?? "",
          port: typeof args[4] === "number" ? args[4] : 3306
        };
      }
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },
    "mariadb-connect": (...args) => {
      let config = args[0];
      if (typeof config === "string") {
        config = {
          host: args[0] ?? "localhost",
          user: args[1] ?? "",
          password: args[2] ?? "",
          database: args[3] ?? "",
          port: typeof args[4] === "number" ? args[4] : 3306
        };
      }
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },
    // ── 풀 방식 (영구 연결) ───────────────────────────────────────────────────
    // mariadb_pool_connect config → poolId
    "mariadb_pool_connect": (config) => {
      const poolId = `pool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      poolCall({ type: "connect", poolId, config });
      return poolId;
    },
    // mariadb_pool_query poolId sql [params] → rows[] (nil 불가, 항상 배열)
    "mariadb_pool_query": (poolId, sql, params = []) => poolCall({ type: "query", poolId, sql, params }).rows ?? [],
    // mariadb_pool_one poolId sql [params] → row or null
    "mariadb_pool_one": (poolId, sql, params = []) => poolCall({ type: "one", poolId, sql, params }).row,
    // mariadb_pool_exec poolId sql [params] → {affectedRows insertId}
    "mariadb_pool_exec": (poolId, sql, params = []) => {
      const r = poolCall({ type: "exec", poolId, sql, params });
      return { affectedRows: r.affectedRows, insertId: r.insertId };
    },
    // mariadb_pool_transaction poolId [{sql params}] → {ok results} or {ok:false error}
    // 진짜 트랜잭션: BEGIN + 커밋/롤백 자동
    "mariadb_pool_transaction": (poolId, stmts) => poolCall({ type: "transaction", poolId, stmts }),
    // mariadb_pool_close poolId → null
    "mariadb_pool_close": (poolId) => {
      poolCall({ type: "close", poolId });
      return null;
    },
    // ── 유틸 ─────────────────────────────────────────────────────────────────
    "mariadb_health": () => {
      const args = [
        "-u",
        process.env.MARIADB_USER || "root",
        "--socket=" + resolveSocket(),
        "ping"
      ];
      const r = (0, import_child_process3.spawnSync)("mariadb-admin", args, { timeout: 3e3, encoding: "utf-8" });
      return (r.status ?? 1) === 0;
    },
    "mariadb_databases": () => parseRows(runMariadb("", "SHOW DATABASES")).map((r) => r.Database),
    "mariadb_tables": (db) => parseRows(runMariadb(db, "SHOW TABLES")).map((r) => Object.values(r)[0]),
    // ── Universal db-query / db-exec / db-transaction ────────────────────────
    // db: {:host ...} → MariaDB  |  {:path ...} → SQLite  |  "pool_..." → pool
    "db-query": (db, sql, params = []) => {
      if (isSqliteConfig(db)) return sqliteQuery(getSqlitePath(db), sql, params);
      if (typeof db === "string" && db.startsWith("pool_"))
        return poolCall({ type: "query", poolId: db, sql, params }).rows ?? [];
      const dbName = getMariadbName(db);
      const m = db instanceof Map ? db : new Map(Object.entries(db));
      const savedUser = process.env.MARIADB_USER;
      const savedPass = process.env.MARIADB_PASS;
      const savedHost = process.env.MARIADB_HOST;
      const savedPort = process.env.MARIADB_PORT;
      if (m.get("user")) process.env.MARIADB_USER = String(m.get("user"));
      if (m.get("password")) process.env.MARIADB_PASS = String(m.get("password"));
      if (m.get("host")) process.env.MARIADB_HOST = String(m.get("host"));
      if (m.get("port")) process.env.MARIADB_PORT = String(m.get("port"));
      try {
        cachedSock = null;
        const rows = parseRows(runMariadb(dbName, bindParams(sql, params)));
        return rows.map((r) => {
          const rm = /* @__PURE__ */ new Map();
          for (const [k, v] of Object.entries(r)) rm.set(k, v);
          return rm;
        });
      } finally {
        if (savedUser !== void 0) process.env.MARIADB_USER = savedUser;
        else delete process.env.MARIADB_USER;
        if (savedPass !== void 0) process.env.MARIADB_PASS = savedPass;
        else delete process.env.MARIADB_PASS;
        if (savedHost !== void 0) process.env.MARIADB_HOST = savedHost;
        else delete process.env.MARIADB_HOST;
        if (savedPort !== void 0) process.env.MARIADB_PORT = savedPort;
        else delete process.env.MARIADB_PORT;
        cachedSock = null;
      }
    },
    "db-exec": (db, sql, params = []) => {
      if (isSqliteConfig(db)) return sqliteExec(getSqlitePath(db), sql, params);
      if (typeof db === "string" && db.startsWith("pool_")) {
        const r = poolCall({ type: "exec", poolId: db, sql, params });
        const m = /* @__PURE__ */ new Map();
        m.set("affectedRows", r.affectedRows ?? 0);
        m.set("insertId", r.insertId ?? 0);
        return m;
      }
      const dbName = getMariadbName(db);
      const m2 = db instanceof Map ? db : new Map(Object.entries(db));
      const savedUser = process.env.MARIADB_USER;
      const savedPass = process.env.MARIADB_PASS;
      const savedHost = process.env.MARIADB_HOST;
      const savedPort = process.env.MARIADB_PORT;
      if (m2.get("user")) process.env.MARIADB_USER = String(m2.get("user"));
      if (m2.get("password")) process.env.MARIADB_PASS = String(m2.get("password"));
      if (m2.get("host")) process.env.MARIADB_HOST = String(m2.get("host"));
      if (m2.get("port")) process.env.MARIADB_PORT = String(m2.get("port"));
      try {
        cachedSock = null;
        runMariadb(dbName, bindParams(sql, params));
        try {
          const meta = parseRows(runMariadb(dbName, "SELECT ROW_COUNT() as ar, LAST_INSERT_ID() as lid"));
          const rm = /* @__PURE__ */ new Map();
          rm.set("affectedRows", Number(meta[0]?.ar ?? 0));
          rm.set("insertId", Number(meta[0]?.lid ?? 0));
          return rm;
        } catch {
          const rm = /* @__PURE__ */ new Map();
          rm.set("affectedRows", 0);
          rm.set("insertId", 0);
          return rm;
        }
      } finally {
        if (savedUser !== void 0) process.env.MARIADB_USER = savedUser;
        else delete process.env.MARIADB_USER;
        if (savedPass !== void 0) process.env.MARIADB_PASS = savedPass;
        else delete process.env.MARIADB_PASS;
        if (savedHost !== void 0) process.env.MARIADB_HOST = savedHost;
        else delete process.env.MARIADB_HOST;
        if (savedPort !== void 0) process.env.MARIADB_PORT = savedPort;
        else delete process.env.MARIADB_PORT;
        cachedSock = null;
      }
    },
    "db-transaction": (db, fn) => {
      if (isSqliteConfig(db)) {
        const sqliteDb = getSqliteDb(getSqlitePath(db));
        sqliteDb.exec("BEGIN");
        try {
          const result = callFlFn(fn);
          sqliteDb.exec("COMMIT");
          return result;
        } catch (e) {
          try {
            sqliteDb.exec("ROLLBACK");
          } catch {
          }
          throw e;
        }
      }
      if (typeof db === "string" && db.startsWith("pool_")) {
        if (Array.isArray(fn)) return poolCall({ type: "transaction", poolId: db, stmts: fn });
      }
      return null;
    }
  };
}
var import_child_process3, cachedSock, MARIADB_SEARCH_PATHS, resolvedMariadbBin, DATA_BUF_SIZE, WORKER_CODE, poolWorker, controlBuf, dataBuf, _sqliteCache;
var init_stdlib_mariadb = __esm({
  "src/stdlib-mariadb.ts"() {
    import_child_process3 = require("child_process");
    cachedSock = null;
    MARIADB_SEARCH_PATHS = [
      "/data/data/com.termux/files/usr/bin",
      // Termux
      "/usr/bin",
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/opt/local/bin"
    ];
    resolvedMariadbBin = null;
    DATA_BUF_SIZE = 4 * 1024 * 1024;
    WORKER_CODE = `
const { workerData } = require('worker_threads');
const { spawnSync } = require('child_process');
const control = new Int32Array(workerData.controlBuf);
const data = Buffer.from(workerData.dataBuf);
const pools = new Map(); // poolId -> config

function buildArgs(config) {
  const args = ['-u', config.user || 'root'];
  if (config.socketPath) {
    args.push('--socket=' + config.socketPath);
  } else {
    args.push('-h', config.host || '127.0.0.1', '-P', String(config.port || 3306));
  }
  if (config.password) args.push('-p' + config.password);
  if (config.database) args.push(config.database);
  return args;
}

function runSql(config, sql) {
  const args = [...buildArgs(config), '--batch', '--column-names', '-e', sql];
  const r = spawnSync('mysql', args, { timeout: 15000, encoding: 'utf8' });
  if (r.error) throw new Error('mysql: ' + r.error.message);
  if (r.status !== 0) throw new Error((r.stderr || '').trim() || 'mysql exit ' + r.status);
  return r.stdout || '';
}

function parseRows(text) {
  const lines = text.trim().split('\\n').filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split('\\t');
  return lines.slice(1).map(line => {
    const vals = line.split('\\t');
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] === 'NULL' ? null : vals[i]; });
    return row;
  });
}

function bindParams(sql, params) {
  if (!params || !params.length) return sql;
  let i = 0;
  return sql.replace(/\\?/g, () => {
    const p = params[i++];
    if (p === null || p === undefined) return 'NULL';
    if (typeof p === 'boolean') return p ? '1' : '0';
    if (typeof p === 'number') return String(p);
    return "'" + String(p)
      .replace(/\\\\/g, '\\\\\\\\')
      .replace(/\\0/g, '\\\\0')
      .replace(/'/g, "''")
      .replace(/\\n/g, '\\\\n')
      .replace(/\\r/g, '\\\\r')
      .replace(/\\x1a/g, '\\\\Z') + "'";
  });
}

function handle(req) {
  if (req.type === 'connect') {
    pools.set(req.poolId, req.config);
    return { ok: true };
  }
  if (req.type === 'close') {
    pools.delete(req.poolId);
    return { ok: true };
  }
  const config = pools.get(req.poolId);
  if (!config) return { ok: false, error: 'pool ' + req.poolId + ' not found' };

  try {
    const sql = bindParams(req.sql, req.params || []);
    if (req.type === 'query') {
      return { ok: true, rows: parseRows(runSql(config, sql)) };
    }
    if (req.type === 'one') {
      return { ok: true, row: parseRows(runSql(config, sql))[0] || null };
    }
    if (req.type === 'exec') {
      runSql(config, sql);
      // affectedRows/insertId \uADFC\uC0AC\uCE58 \u2014 CLI\uB294 \uC9C1\uC811 \uC9C0\uC6D0 \uC548\uD568
      try {
        const meta = parseRows(runSql(config, 'SELECT ROW_COUNT() as ar, LAST_INSERT_ID() as lid'));
        return { ok: true, affectedRows: Number(meta[0]?.ar || 0), insertId: Number(meta[0]?.lid || 0) };
      } catch { return { ok: true, affectedRows: 0, insertId: 0 }; }
    }
    if (req.type === 'transaction') {
      const sqls = req.stmts.map(s => bindParams(s.sql, s.params || []));
      const txSql = 'START TRANSACTION;\\n' + sqls.join(';\\n') + ';\\nCOMMIT;';
      runSql(config, txSql);
      return { ok: true, results: req.stmts.map(() => ({ ok: true, affectedRows: 0, insertId: 0 })) };
    }
    return { ok: false, error: 'unknown type: ' + req.type };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

function loop() {
  while (true) {
    Atomics.wait(control, 0, 0);
    const flag = Atomics.load(control, 0);
    if (flag === -1) break;
    const reqLen = data.readInt32LE(0);
    const reqStr = data.toString('utf8', 4, 4 + reqLen);
    let resp;
    try { resp = handle(JSON.parse(reqStr)); }
    catch(e) { resp = { ok: false, error: e.message }; }
    const respStr = JSON.stringify(resp);
    data.writeInt32LE(respStr.length, 0);
    data.write(respStr, 4, 'utf8');
    Atomics.store(control, 0, 2);
    Atomics.notify(control, 0);
    Atomics.wait(control, 0, 2);
  }
}
loop();
`;
    poolWorker = null;
    controlBuf = null;
    dataBuf = null;
    _sqliteCache = /* @__PURE__ */ new Map();
  }
});

// src/stdlib-mongodb.ts
var stdlib_mongodb_exports = {};
__export(stdlib_mongodb_exports, {
  createMongodbModule: () => createMongodbModule
});
function createMongodbModule() {
  const helperPath = path4.join(__dirname, "_mongodb_helper.js");
  function callHelper(req) {
    try {
      const toSerializable2 = (obj) => {
        if (obj instanceof Map) return Object.fromEntries(obj);
        if (Array.isArray(obj)) return obj.map(toSerializable2);
        if (typeof obj === "object" && obj !== null) {
          const result2 = {};
          for (const [k, v] of Object.entries(obj)) {
            result2[k] = toSerializable2(v);
          }
          return result2;
        }
        return obj;
      };
      const result = (0, import_child_process4.execFileSync)("node", [helperPath, JSON.stringify(toSerializable2(req))], {
        timeout: req.timeout ? req.timeout + 2e3 : 15e3,
        encoding: "utf-8"
      });
      return JSON.parse(result);
    } catch (err) {
      return { ok: false, error: err.message || "Helper execution failed" };
    }
  }
  function parseConn(connId) {
    if (!connId) return { host: "localhost", port: 27017 };
    const atIdx = connId.indexOf("@");
    if (atIdx !== -1) {
      const [creds, rest] = [connId.slice(0, atIdx), connId.slice(atIdx + 1)];
      const colonIdx = creds.indexOf(":");
      const user = creds.slice(0, colonIdx);
      const pass = creds.slice(colonIdx + 1);
      const slashIdx = rest.indexOf("/");
      const hostPort = slashIdx !== -1 ? rest.slice(0, slashIdx) : rest;
      const authDb = slashIdx !== -1 ? rest.slice(slashIdx + 1) : "admin";
      const [host2, portStr2] = hostPort.split(":");
      return { host: host2, port: parseInt(portStr2 || "27017", 10), user, pass, authDb };
    }
    const [host, portStr] = connId.split(":");
    return { host, port: parseInt(portStr || "27017", 10) };
  }
  return {
    // ── 연결 ─────────────────────────────────────────────────
    // mongo_connect "localhost" 27017 → connId ("localhost:27017")
    "mongo_connect": (host, port = 27017) => {
      const r = callHelper({ method: "ping", host, port });
      return r.ok ? `${host}:${port}` : null;
    },
    // mongo_connect_auth "localhost" 27017 "user" "pass" "admin" → connId
    "mongo_connect_auth": (host, port, user, pass, authDb = "admin") => {
      const r = callHelper({ method: "ping", host, port, user, pass, authDb });
      return r.ok ? `${user}:${pass}@${host}:${port}/${authDb}` : null;
    },
    // ── 단건 조회 ─────────────────────────────────────────────
    // mongo_find_one connId "db" "col" {:_id "..."} → doc or nil
    "mongo_find_one": (connId, db, col, filter = {}) => {
      const r = callHelper({ method: "find_one", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? r.doc ?? null : null;
    },
    // ── 다건 조회 ─────────────────────────────────────────────
    // mongo_find connId "db" "col" filter options → [docs]
    // options: {:limit 10 :skip 0 :sort {:name 1}}
    "mongo_find": (connId, db, col, filter = {}, opts = {}) => {
      const r = callHelper({
        method: "find_many",
        ...parseConn(connId),
        db,
        collection: col,
        filter,
        limit: opts.limit,
        skip: opts.skip,
        sort: opts.sort,
        projection: opts.projection
      });
      return r.ok ? r.docs ?? [] : [];
    },
    // ── 카운트 ────────────────────────────────────────────────
    "mongo_count": (connId, db, col, filter = {}) => {
      const r = callHelper({ method: "count", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? r.count ?? 0 : 0;
    },
    // ── 단건 삽입 ─────────────────────────────────────────────
    // mongo_insert_one connId "db" "col" doc → inserted_id or nil
    "mongo_insert_one": (connId, db, col, doc) => {
      const r = callHelper({ method: "insert_one", ...parseConn(connId), db, collection: col, doc });
      return r.ok ? r.inserted_id ?? null : null;
    },
    // ── 다건 삽입 ─────────────────────────────────────────────
    "mongo_insert_many": (connId, db, col, docs) => {
      const r = callHelper({ method: "insert_many", ...parseConn(connId), db, collection: col, docs });
      return r.ok ? { count: r.inserted_count, ids: r.inserted_ids } : null;
    },
    // ── 단건 수정 ─────────────────────────────────────────────
    // mongo_update_one connId "db" "col" filter update → {:matched 1 :modified 1}
    "mongo_update_one": (connId, db, col, filter, update, opts = {}) => {
      const r = callHelper({ method: "update_one", ...parseConn(connId), db, collection: col, filter, update, options: opts });
      return r.ok ? { matched: r.matched, modified: r.modified } : null;
    },
    // ── 다건 수정 ─────────────────────────────────────────────
    "mongo_update_many": (connId, db, col, filter, update, opts = {}) => {
      const r = callHelper({ method: "update_many", ...parseConn(connId), db, collection: col, filter, update, options: opts });
      return r.ok ? { matched: r.matched, modified: r.modified } : null;
    },
    // ── 단건 삭제 ─────────────────────────────────────────────
    "mongo_delete_one": (connId, db, col, filter) => {
      const r = callHelper({ method: "delete_one", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? r.deleted ?? 0 : 0;
    },
    // ── 다건 삭제 ─────────────────────────────────────────────
    "mongo_delete_many": (connId, db, col, filter) => {
      const r = callHelper({ method: "delete_many", ...parseConn(connId), db, collection: col, filter });
      return r.ok ? r.deleted ?? 0 : 0;
    },
    // ── Aggregation ───────────────────────────────────────────
    // mongo_aggregate connId "db" "col" pipeline → [docs]
    "mongo_aggregate": (connId, db, col, pipeline) => {
      const r = callHelper({ method: "aggregate", ...parseConn(connId), db, collection: col, pipeline });
      return r.ok ? r.docs ?? [] : [];
    },
    // ── 트랜잭션 ──────────────────────────────────────────────
    // mongo_transaction connId "db" ops → {:committed true :results [...]}
    // ops: [{:method "insert_one" :collection "..." :doc {...}} ...]
    // MongoDB Replica Set 필요 (트랜잭션은 standalone 미지원)
    "mongo_transaction": (connId, db, ops) => {
      const r = callHelper({ method: "transaction", ...parseConn(connId), db, ops });
      return r;
    },
    // ── 인덱스 생성 ───────────────────────────────────────────
    // mongo_create_index connId "db" "col" {:field 1} {:unique true} → name
    "mongo_create_index": (connId, db, col, keys, opts = {}) => {
      const r = callHelper({ method: "create_index", ...parseConn(connId), db, collection: col, filter: keys, options: opts });
      return r.ok ? r.name ?? null : null;
    },
    // ── 컬렉션 목록 ───────────────────────────────────────────
    "mongo_collections": (connId, db) => {
      const r = callHelper({ method: "list_collections", ...parseConn(connId), db });
      return r.ok ? r.collections ?? [] : [];
    },
    // ── 하위 호환 (deprecated) ────────────────────────────────
    "mongodb_connect": (host, port = 27017) => {
      const r = callHelper({ method: "ping", host, port });
      return r.ok ? `${host}:${port}` : null;
    },
    "mongodb_close": (_connId) => true,
    "mongodb_is_connected": (connId) => {
      const { host, port } = parseConn(connId);
      return callHelper({ method: "ping", host, port, timeout: 1e3 }).ok === true;
    }
  };
}
var import_child_process4, path4;
var init_stdlib_mongodb = __esm({
  "src/stdlib-mongodb.ts"() {
    import_child_process4 = require("child_process");
    path4 = __toESM(require("path"));
  }
});

// src/async-runtime.ts
function resolvedPromise(value) {
  return new FreeLangPromise((resolve3) => {
    resolve3(value);
  });
}
function rejectedPromise(error) {
  return new FreeLangPromise((_, reject) => {
    reject(error);
  });
}
var FreeLangPromise;
var init_async_runtime = __esm({
  "src/async-runtime.ts"() {
    FreeLangPromise = class _FreeLangPromise {
      constructor(executor) {
        this.state = "pending";
        this.value = void 0;
        this.error = null;
        this.resolvers = [];
        this.rejecters = [];
        try {
          executor(this.resolve.bind(this), this.reject.bind(this));
        } catch (e) {
          this.reject(e);
        }
      }
      /**
       * Promise 상태 확인
       */
      getState() {
        return this.state;
      }
      /**
       * Promise 값 추출 (resolved 상태일 때만)
       */
      getValue() {
        if (this.state === "resolved") {
          return this.value;
        }
        throw new Error("Cannot get value from non-resolved Promise");
      }
      /**
       * Promise 에러 추출 (rejected 상태일 때만)
       */
      getError() {
        if (this.state === "rejected") {
          return this.error;
        }
        return null;
      }
      /**
       * resolve 핸들러 호출
       */
      resolve(value) {
        if (this.state !== "pending") return;
        this.state = "resolved";
        this.value = value;
        for (const resolver of this.resolvers) {
          try {
            resolver(value);
          } catch (e) {
          }
        }
        this.resolvers = [];
      }
      /**
       * reject 핸들러 호출
       */
      reject(error) {
        if (this.state !== "pending") return;
        this.state = "rejected";
        this.error = error;
        for (const rejecter of this.rejecters) {
          try {
            rejecter(error);
          } catch (e) {
          }
        }
        this.rejecters = [];
      }
      /**
       * Promise 체이닝: then 메서드
       * onFulfilled가 성공했을 때 호출되고, 새로운 Promise 반환
       */
      then(onFulfilled) {
        return new _FreeLangPromise((resolve3, reject) => {
          if (this.state === "resolved") {
            try {
              const result = onFulfilled(this.value);
              resolve3(result);
            } catch (e) {
              reject(e);
            }
          } else if (this.state === "rejected") {
            reject(this.error);
          } else {
            this.resolvers.push((value) => {
              try {
                const result = onFulfilled(value);
                resolve3(result);
              } catch (e) {
                reject(e);
              }
            });
          }
        });
      }
      /**
       * Promise 에러 처리: catch 메서드
       * onRejected가 에러일 때 호출되고, 새로운 Promise 반환
       */
      catch(onRejected) {
        return new _FreeLangPromise((resolve3, reject) => {
          if (this.state === "rejected") {
            try {
              const result = onRejected(this.error);
              resolve3(result);
            } catch (e) {
              reject(e);
            }
          } else if (this.state === "resolved") {
            resolve3(this.value);
          } else {
            this.rejecters.push((error) => {
              try {
                const result = onRejected(error);
                resolve3(result);
              } catch (e) {
                reject(e);
              }
            });
          }
        });
      }
      /**
       * finally 메서드: 성공/실패 상관없이 항상 실행
       */
      finally(onFinally) {
        return new _FreeLangPromise((resolve3, reject) => {
          const executeFinally = () => {
            try {
              onFinally();
            } catch (e) {
              reject(e);
              return;
            }
            if (this.state === "resolved") {
              resolve3(this.value);
            } else if (this.state === "rejected") {
              reject(this.error);
            }
          };
          if (this.state !== "pending") {
            executeFinally();
          } else {
            this.resolvers.push(() => executeFinally());
            this.rejecters.push(() => executeFinally());
          }
        });
      }
      /**
       * 모든 Promise가 완료될 때까지 대기
       */
      static all(promises) {
        return new _FreeLangPromise((resolve3, reject) => {
          if (promises.length === 0) {
            resolve3([]);
            return;
          }
          const results = [];
          let completedCount = 0;
          for (let i = 0; i < promises.length; i++) {
            const promise = promises[i];
            if (promise.state === "resolved") {
              results[i] = promise.value;
              completedCount++;
            } else if (promise.state === "rejected") {
              reject(promise.error);
              return;
            } else {
              promise.then((value) => {
                results[i] = value;
                completedCount++;
                if (completedCount === promises.length) {
                  resolve3(results);
                }
              }).catch((error) => reject(error));
            }
          }
          if (completedCount === promises.length) {
            resolve3(results);
          }
        });
      }
      /**
       * 첫 번째로 완료된 Promise 반환
       */
      static race(promises) {
        return new _FreeLangPromise((resolve3, reject) => {
          for (const promise of promises) {
            if (promise.state === "resolved") {
              resolve3(promise.value);
              return;
            } else if (promise.state === "rejected") {
              reject(promise.error);
              return;
            } else {
              promise.then((value) => resolve3(value)).catch((error) => reject(error));
            }
          }
        });
      }
    };
  }
});

// src/stdlib-async.ts
var stdlib_async_exports = {};
__export(stdlib_async_exports, {
  createAsyncModule: () => createAsyncModule
});
function createAsyncModule(callFn) {
  return {
    // async_call fn_name args -> Promise
    // Call a function asynchronously and return a promise
    "async_call": (fnName, args = []) => {
      return new FreeLangPromise((resolve3, reject) => {
        setImmediate(() => {
          try {
            const result = callFn(fnName, args);
            resolve3(result);
          } catch (e) {
            reject(new Error(`async_call error: ${e.message}`));
          }
        });
      });
    },
    // await_result promise -> value|error
    // Wait for a promise to resolve and get its value
    "await_result": (promise) => {
      const state = promise.getState();
      if (state === "resolved") {
        return promise.getValue();
      } else if (state === "rejected") {
        throw promise.getError() || new Error("Promise rejected");
      } else {
        throw new Error("Promise still pending - use proper async handling");
      }
    },
    // promise_all promises -> Promise
    // Wait for all promises to resolve
    "promise_all": (promises) => {
      return new FreeLangPromise((resolve3, reject) => {
        if (!Array.isArray(promises) || promises.length === 0) {
          resolve3([]);
          return;
        }
        const results = [];
        let completed = 0;
        promises.forEach((p, idx) => {
          if (!(p instanceof FreeLangPromise)) {
            reject(new Error(`promise_all: element ${idx} is not a promise`));
            return;
          }
          const state = p.getState();
          if (state === "resolved") {
            results[idx] = p.getValue();
            completed++;
            if (completed === promises.length) resolve3(results);
          } else if (state === "rejected") {
            reject(p.getError() || new Error(`promise_all: promise ${idx} rejected`));
          } else {
            reject(new Error(`promise_all: promise ${idx} still pending`));
          }
        });
      });
    },
    // promise_race promises -> Promise
    // Return first resolved promise
    "promise_race": (promises) => {
      return new FreeLangPromise((resolve3, reject) => {
        if (!Array.isArray(promises) || promises.length === 0) {
          reject(new Error("promise_race: empty promise array"));
          return;
        }
        for (let i = 0; i < promises.length; i++) {
          const p = promises[i];
          if (!(p instanceof FreeLangPromise)) {
            reject(new Error(`promise_race: element ${i} is not a promise`));
            return;
          }
          const state = p.getState();
          if (state === "resolved") {
            resolve3(p.getValue());
            return;
          } else if (state === "rejected") {
            reject(p.getError() || new Error(`promise_race: promise ${i} rejected`));
            return;
          }
        }
        reject(new Error("promise_race: all promises still pending"));
      });
    },
    // promise_delay ms -> Promise
    // Create a promise that resolves after delay
    "promise_delay": (ms) => {
      return new FreeLangPromise((resolve3) => {
        setTimeout(() => resolve3(null), ms);
      });
    },
    // promise_timeout ms fn_name args -> Promise
    // Call function with timeout
    "promise_timeout": (ms, fnName, args = []) => {
      return new FreeLangPromise((resolve3, reject) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (!done) {
            done = true;
            reject(new Error(`promise_timeout: timed out after ${ms}ms`));
          }
        }, ms);
        try {
          const result = callFn(fnName, args);
          done = true;
          clearTimeout(timeout);
          resolve3(result);
        } catch (e) {
          done = true;
          clearTimeout(timeout);
          reject(new Error(`promise_timeout: ${e.message}`));
        }
      });
    },
    // promise_resolve value -> Promise
    // Create immediately resolved promise
    "promise_resolve": (value) => {
      return resolvedPromise(value);
    },
    // promise_reject error -> Promise
    // Create immediately rejected promise
    "promise_reject": (error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      return rejectedPromise(err);
    },
    // promise_state promise -> "pending"|"resolved"|"rejected"
    // Get promise state
    "promise_state": (promise) => {
      if (!(promise instanceof FreeLangPromise)) {
        return "unknown";
      }
      return promise.getState();
    },
    // promise_then promise fn_name -> Promise
    // Chain promise with handler function
    "promise_then": (promise, fnName) => {
      if (!(promise instanceof FreeLangPromise)) {
        return rejectedPromise(new Error("promise_then: first arg is not a promise"));
      }
      return promise.then((value) => {
        try {
          return callFn(fnName, [value]);
        } catch (e) {
          throw new Error(`promise_then handler error: ${e.message}`);
        }
      });
    }
  };
}
var init_stdlib_async = __esm({
  "src/stdlib-async.ts"() {
    init_async_runtime();
  }
});

// src/stdlib-channel.ts
var stdlib_channel_exports = {};
__export(stdlib_channel_exports, {
  Channel: () => Channel,
  createChannelModule: () => createChannelModule
});
function genId() {
  return `ch_${++_chanIdCounter}_${Date.now()}`;
}
function createChannelModule() {
  return {
    // (chan) or (chan 50) → channel-id
    "chan": (size) => {
      const id = genId();
      channels.set(id, new Channel(typeof size === "number" ? size : 100));
      return id;
    },
    // (chan-send ch-id value) → boolean
    "chan-send": (id, val) => {
      const ch = channels.get(id);
      if (!ch) return false;
      return ch.send(val);
    },
    // (chan-recv ch-id) → value or null
    "chan-recv": (id) => {
      const ch = channels.get(id);
      if (!ch) return null;
      return ch.recv();
    },
    // (chan-size ch-id) → number
    "chan-size": (id) => {
      const ch = channels.get(id);
      if (!ch) return 0;
      return ch.size();
    },
    // (chan-empty? ch-id) → boolean
    "chan-empty?": (id) => {
      const ch = channels.get(id);
      if (!ch) return true;
      return ch.isEmpty();
    },
    // (chan-full? ch-id) → boolean
    "chan-full?": (id) => {
      const ch = channels.get(id);
      if (!ch) return true;
      return ch.isFull();
    },
    // (chan-close ch-id) → boolean (채널 제거)
    "chan-close": (id) => {
      return channels.delete(id);
    }
  };
}
var _chanIdCounter, Channel, channels;
var init_stdlib_channel = __esm({
  "src/stdlib-channel.ts"() {
    _chanIdCounter = 0;
    Channel = class {
      constructor(size = 100) {
        this.queue = [];
        this.maxSize = size;
      }
      /** 값을 채널에 보냄. 가득 차면 false 반환 */
      send(val) {
        if (this.queue.length >= this.maxSize) return false;
        this.queue.push(val);
        return true;
      }
      /** 채널에서 값을 꺼냄. 비어있으면 null 반환 */
      recv() {
        return this.queue.shift() ?? null;
      }
      size() {
        return this.queue.length;
      }
      isEmpty() {
        return this.queue.length === 0;
      }
      isFull() {
        return this.queue.length >= this.maxSize;
      }
    };
    channels = /* @__PURE__ */ new Map();
  }
});

// src/immutable.ts
var immutable_exports = {};
__export(immutable_exports, {
  createImmutableModule: () => createImmutableModule
});
function stripColon(key) {
  return typeof key === "string" && key.startsWith(":") ? key.slice(1) : key;
}
function createImmutableModule() {
  return {
    // ── 맵 함수 ──────────────────────────────────────────
    /** 이뮤터블 맵 생성 */
    "imm-map": (obj) => {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return Object.freeze({});
      const normalized = {};
      for (const k of Object.keys(obj)) {
        normalized[stripColon(k)] = obj[k];
      }
      return Object.freeze(normalized);
    },
    /** 키-값 추가/업데이트 → 새 맵 반환 (원본 불변) */
    "imm-assoc": (m, key, val) => {
      const base = m && typeof m === "object" && !Array.isArray(m) ? m : {};
      return Object.freeze({ ...base, [stripColon(key)]: val });
    },
    /** 키 제거 → 새 맵 반환 */
    "imm-dissoc": (m, key) => {
      if (!m || typeof m !== "object") return Object.freeze({});
      const k = stripColon(key);
      const { [k]: _removed, ...rest } = m;
      return Object.freeze(rest);
    },
    /** 키로 값 조회 */
    "imm-get": (m, key, defaultVal) => {
      if (!m || typeof m !== "object") return defaultVal ?? null;
      const k = stripColon(key);
      const val = m[k];
      return val !== void 0 ? val : defaultVal ?? null;
    },
    /** 모든 키 목록 */
    "imm-keys": (m) => {
      if (!m || typeof m !== "object" || Array.isArray(m)) return Object.freeze([]);
      return Object.freeze(Object.keys(m));
    },
    /** 모든 값 목록 */
    "imm-vals": (m) => {
      if (!m || typeof m !== "object" || Array.isArray(m)) return Object.freeze([]);
      return Object.freeze(Object.values(m));
    },
    /** 두 맵 병합 → 새 맵 (m2가 우선) */
    "imm-merge": (m1, m2) => {
      const base = m1 && typeof m1 === "object" && !Array.isArray(m1) ? m1 : {};
      const overlay = m2 && typeof m2 === "object" && !Array.isArray(m2) ? m2 : {};
      return Object.freeze({ ...base, ...overlay });
    },
    // ── 벡터 함수 ─────────────────────────────────────────
    /** 이뮤터블 벡터 생성 */
    "imm-vec": (arr) => {
      if (!Array.isArray(arr)) return Object.freeze([]);
      return Object.freeze([...arr]);
    },
    /** 끝에 값 추가 → 새 벡터 (원본 불변) */
    "imm-conj": (v, val) => {
      if (!Array.isArray(v)) return Object.freeze([val]);
      return Object.freeze([...v, val]);
    },
    /** 인덱스로 값 조회 */
    "imm-nth": (v, idx) => {
      if (!Array.isArray(v)) return null;
      const val = v[idx];
      return val !== void 0 ? val : null;
    },
    /** 슬라이스 → 새 벡터 */
    "imm-slice": (v, start, end) => {
      if (!Array.isArray(v)) return Object.freeze([]);
      return Object.freeze(v.slice(start, end));
    },
    /** 특정 인덱스 값 교체 → 새 벡터 */
    "imm-update": (v, idx, val) => {
      if (!Array.isArray(v)) return Object.freeze([]);
      const copy = [...v];
      copy[idx] = val;
      return Object.freeze(copy);
    },
    /** 마지막 원소 제거 → 새 벡터 */
    "imm-pop": (v) => {
      if (!Array.isArray(v) || v.length === 0) return Object.freeze([]);
      return Object.freeze(v.slice(0, -1));
    },
    // ── 공통 함수 ─────────────────────────────────────────
    /** 원소 수 */
    "imm-count": (c) => {
      if (Array.isArray(c)) return c.length;
      if (c && typeof c === "object") return Object.keys(c).length;
      return 0;
    },
    /** 이뮤터블 여부 확인 */
    "imm?": (v) => Object.isFrozen(v),
    /** 비어있는지 확인 */
    "imm-empty?": (c) => {
      if (Array.isArray(c)) return c.length === 0;
      if (c && typeof c === "object") return Object.keys(c).length === 0;
      return true;
    },
    /** 소스를 타겟에 합치기 → 새 컬렉션 */
    "imm-into": (target, source) => {
      if (Array.isArray(target)) {
        const extra = Array.isArray(source) ? source : source && typeof source === "object" ? Object.values(source) : [];
        return Object.freeze([...target, ...extra]);
      }
      const base = target && typeof target === "object" ? target : {};
      const overlay = source && typeof source === "object" && !Array.isArray(source) ? source : {};
      return Object.freeze({ ...base, ...overlay });
    }
  };
}
var init_immutable = __esm({
  "src/immutable.ts"() {
  }
});

// src/stdlib-ai-native.ts
var stdlib_ai_native_exports = {};
__export(stdlib_ai_native_exports, {
  createAiNativeModule: () => createAiNativeModule
});
function createAiNativeModule() {
  return {
    // ── AI 모델 직접 호출 ────────────────────────────────────────────
    "ai-call": async (model, prompt) => {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      const apiKey = anthropicKey || openaiKey;
      const promptStr = typeof prompt === "string" ? prompt : typeof prompt === "object" && prompt !== null ? String(prompt.prompt || JSON.stringify(prompt)) : String(prompt);
      if (!apiKey) {
        return `[AI Mock Response] Model: ${model}, Prompt: ${promptStr.slice(0, 50)}...`;
      }
      if (anthropicKey && (model.startsWith("claude") || model.startsWith("anthropic"))) {
        try {
          const contextStr = typeof prompt === "object" && prompt !== null && prompt.context ? `

Context:
${JSON.stringify(prompt.context)}` : "";
          const maxTokens = typeof prompt === "object" && prompt !== null ? Number(prompt["max-tokens"] || prompt.maxTokens || 1024) : 1024;
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify(toSerializable({
              model: model === "claude-3" ? "claude-3-haiku-20240307" : model,
              max_tokens: maxTokens,
              messages: [
                { role: "user", content: promptStr + contextStr }
              ]
            }))
          });
          if (res.ok) {
            const data = await res.json();
            return data?.content?.[0]?.text ?? "[AI: empty response]";
          }
        } catch (e) {
          return `[AI Error] ${String(e)}`;
        }
      }
      if (openaiKey && (model.startsWith("gpt") || model.startsWith("openai"))) {
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`
            },
            body: JSON.stringify(toSerializable({
              model: model === "gpt-4" ? "gpt-4-turbo-preview" : model,
              messages: [{ role: "user", content: promptStr }]
            }))
          });
          if (res.ok) {
            const data = await res.json();
            return data?.choices?.[0]?.message?.content ?? "[AI: empty response]";
          }
        } catch (e) {
          return `[AI Error] ${String(e)}`;
        }
      }
      return `[AI Mock Response] Model: ${model}, Prompt: ${promptStr.slice(0, 50)}...`;
    },
    // ── RAG 검색 ────────────────────────────────────────────────────
    "rag-search": (query, opts) => {
      const kb = opts?.kb ?? opts?.["kb"] ?? "default";
      const limit = Number(opts?.limit ?? opts?.["limit"] ?? 5);
      const mockResults = [
        { content: `Mock RAG result for: ${query}`, score: 0.95, source: String(kb) },
        { content: `Related: ${query} \u2014 context from ${kb}`, score: 0.82, source: String(kb) },
        { content: `Additional info about ${query}`, score: 0.74, source: String(kb) },
        { content: `Background: ${query} overview`, score: 0.61, source: String(kb) },
        { content: `Reference: ${query} documentation`, score: 0.53, source: String(kb) }
      ];
      return mockResults.slice(0, limit);
    },
    // ── 임베딩 생성 ─────────────────────────────────────────────────
    "embed": async (text) => {
      const gptPort = process.env.FREELANG_GPT_PORT ?? "30113";
      try {
        const res = await fetch(`http://localhost:${gptPort}/api/embed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSerializable({ text })),
          signal: AbortSignal.timeout ? AbortSignal.timeout(3e3) : void 0
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.embedding)) return data.embedding;
        }
      } catch {
      }
      return Array.from(
        { length: 10 },
        (_, i) => Math.sin((text.charCodeAt(i % text.length) + i * 7) * 0.1)
      );
    },
    // ── 코사인 유사도 ────────────────────────────────────────────────
    "similarity": (v1, v2) => {
      if (!Array.isArray(v1) || !Array.isArray(v2)) return 0;
      const len = Math.min(v1.length, v2.length);
      if (len === 0) return 0;
      let dot = 0, n1 = 0, n2 = 0;
      for (let i = 0; i < len; i++) {
        dot += v1[i] * v2[i];
        n1 += v1[i] ** 2;
        n2 += v2[i] ** 2;
      }
      const denom = Math.sqrt(n1) * Math.sqrt(n2);
      if (denom === 0) return 0;
      return dot / denom;
    },
    // ── 텍스트 청킹 (RAG 준비용) ─────────────────────────────────────
    "chunk-text": (text, size = 512, overlap = 50) => {
      if (typeof text !== "string" || text.length === 0) return [];
      const step = Math.max(1, size - overlap);
      const chunks = [];
      for (let i = 0; i < text.length; i += step) {
        chunks.push(text.slice(i, i + size));
        if (i + size >= text.length) break;
      }
      return chunks;
    },
    // ── 프롬프트 템플릿 변수 치환 ────────────────────────────────────
    "prompt-template": (template, vars) => {
      if (typeof template !== "string") return String(template);
      return template.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ""));
    }
  };
}
var toSerializable;
var init_stdlib_ai_native = __esm({
  "src/stdlib-ai-native.ts"() {
    toSerializable = (obj) => {
      if (obj instanceof Map) return Object.fromEntries(obj);
      if (Array.isArray(obj)) return obj.map(toSerializable);
      if (typeof obj === "object" && obj !== null) {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
          result[k] = toSerializable(v);
        }
        return result;
      }
      return obj;
    };
  }
});

// src/token.ts
var init_token = __esm({
  "src/token.ts"() {
  }
});

// src/lexer.ts
function getKeywordTokenType(text) {
  return KEYWORDS.get(text) ?? null;
}
function lex(source) {
  const tokens = [];
  let i = 0, line = 1, col = 1;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      if (ch === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
      continue;
    }
    if (ch === ";") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
      const startCol = col;
      i += 3;
      col += 3;
      let value = "";
      while (i < source.length) {
        if (source[i] === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
          i += 3;
          col += 3;
          break;
        }
        if (source[i] === "\n") {
          line++;
          col = 1;
        } else {
          col++;
        }
        value += source[i];
        i++;
      }
      tokens.push({ type: "String" /* String */, value, line, col: startCol });
      continue;
    }
    if (ch === '"') {
      const start = i;
      const startCol = col;
      i++;
      col++;
      let value = "";
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && i + 1 < source.length) {
          i++;
          col++;
          const esc = source[i];
          switch (esc) {
            case "n":
              value += "\n";
              break;
            case "t":
              value += "	";
              break;
            case "r":
              value += "\r";
              break;
            case "\\":
              value += "\\";
              break;
            case '"':
              value += '"';
              break;
            case "x": {
              const hex = source.slice(i + 1, i + 3);
              if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                value += String.fromCharCode(parseInt(hex, 16));
                i += 2;
                col += 2;
              } else {
                value += "x";
              }
              break;
            }
            default:
              value += esc;
          }
          i++;
          col++;
        } else {
          if (source[i] === "\n") {
            line++;
            col = 1;
          } else {
            col++;
          }
          value += source[i];
          i++;
        }
      }
      if (i >= source.length) {
        throw new Error(`Unterminated string at line ${line}, col ${startCol}`);
      }
      i++;
      col++;
      tokens.push({ type: "String" /* String */, value, line, col: startCol });
      continue;
    }
    if (ch === "[") {
      tokens.push({ type: "LBracket" /* LBracket */, value: "[", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "RBracket" /* RBracket */, value: "]", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LParen" /* LParen */, value: "(", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RParen" /* RParen */, value: ")", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "{") {
      tokens.push({ type: "LBrace" /* LBrace */, value: "{", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "}") {
      tokens.push({ type: "RBrace" /* RBrace */, value: "}", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "|") {
      const startCol = col;
      if (i + 1 < source.length && source[i + 1] === ">") {
        tokens.push({ type: "Symbol" /* Symbol */, value: "|>", line, col: startCol });
        i += 2;
        col += 2;
      } else {
        tokens.push({ type: "Symbol" /* Symbol */, value: "|", line, col: startCol });
        i++;
        col++;
      }
      continue;
    }
    if (ch === ":") {
      const startCol = col;
      tokens.push({ type: "Colon" /* Colon */, value: ":", line, col: startCol });
      i++;
      col++;
      continue;
    }
    if (ch === "^") {
      const startCol = col;
      i++;
      col++;
      let hint = "";
      while (i < source.length && /[a-zA-Z0-9_\-?]/.test(source[i])) {
        hint += source[i];
        i++;
        col++;
      }
      tokens.push({ type: "Symbol" /* Symbol */, value: "^" + hint, line, col: startCol });
      continue;
    }
    if (ch === "@") {
      const startCol = col;
      i++;
      col++;
      let varname = "";
      while (i < source.length && /[a-zA-Z0-9_\-?!]/.test(source[i])) {
        varname += source[i];
        i++;
        col++;
      }
      if (varname.length === 0) throw new Error(`Expected atom name after @ at line ${line}, col ${startCol}`);
      tokens.push({ type: "LParen" /* LParen */, value: "(", line, col: startCol });
      tokens.push({ type: "Symbol" /* Symbol */, value: "deref", line, col: startCol });
      tokens.push({ type: "Symbol" /* Symbol */, value: varname, line, col: startCol });
      tokens.push({ type: "RParen" /* RParen */, value: ")", line, col: startCol });
      continue;
    }
    if (ch === "$") {
      const start = i;
      const startCol = col;
      i++;
      col++;
      let varname = "";
      while (i < source.length && /[a-zA-Z0-9_\-?]/.test(source[i])) {
        varname += source[i];
        i++;
        col++;
      }
      if (varname.length === 0) {
        throw new Error(`Expected variable name after $ at line ${line}, col ${startCol}`);
      }
      tokens.push({ type: "Variable" /* Variable */, value: varname, line, col: startCol });
      continue;
    }
    if (/\d/.test(ch) || ch === "-" && i + 1 < source.length && /\d/.test(source[i + 1])) {
      const start = i;
      const startCol = col;
      if (ch === "-") {
        i++;
        col++;
      }
      while (i < source.length && /[\d.]/.test(source[i])) {
        i++;
        col++;
      }
      const value = source.slice(start, i);
      tokens.push({ type: "Number" /* Number */, value, line, col: startCol });
      continue;
    }
    if (/[a-zA-Z_<>=!+\-*&/%?]/.test(ch)) {
      const start = i;
      const startCol = col;
      while (i < source.length && /[a-zA-Z0-9_<>=!+\-*/?&.%]/.test(source[i])) {
        i++;
        col++;
      }
      const value = source.slice(start, i);
      const keywordType = getKeywordTokenType(value);
      const tokenType = keywordType ?? "Symbol" /* Symbol */;
      tokens.push({ type: tokenType, value, line, col: startCol });
      continue;
    }
    throw new Error(`Unexpected character '${ch}' at line ${line}, col ${col}`);
  }
  tokens.push({ type: "EOF" /* EOF */, value: "", line, col });
  return tokens;
}
var KEYWORDS;
var init_lexer = __esm({
  "src/lexer.ts"() {
    init_token();
    KEYWORDS = /* @__PURE__ */ new Map([
      ["MODULE", "Module" /* Module */],
      ["TYPECLASS", "TypeClass" /* TypeClass */],
      ["INSTANCE", "Instance" /* Instance */],
      // import는 일반 함수로 처리 (파서 등록 불필요)
      ["open", "Open" /* Open */],
      // Phase 9a: Search functionality keywords
      ["search", "Search" /* Search */],
      ["fetch", "Fetch" /* Fetch */],
      // Phase 9b: Learning functionality keywords
      ["learn", "Learn" /* Learn */],
      ["recall", "Recall" /* Recall */],
      ["remember", "Remember" /* Remember */],
      ["forget", "Forget" /* Forget */],
      // Phase 9c: Reasoning functionality keywords
      ["observe", "Observe" /* Observe */],
      ["analyze", "Analyze" /* Analyze */],
      ["decide", "Decide" /* Decide */],
      ["act", "Act" /* Act */],
      ["verify", "Verify" /* Verify */],
      // Phase 9c: Conditional branching keywords
      ["if", "If" /* If */],
      ["when", "When" /* When */],
      ["then", "Then" /* Then */],
      ["else", "Else" /* Else */],
      // Phase 9c: Loop control keywords
      ["repeat", "Repeat" /* Repeat */],
      ["until", "Until" /* Until */],
      ["while", "While" /* While */],
      // Phase 11: Web DSL keywords
      ["PAGE", "Page" /* Page */],
      ["API", "Api" /* Api */],
      ["ROUTE", "Route" /* Route */],
      ["COMPONENT", "Component" /* Component */],
      ["FORM", "Form" /* Form */],
      ["STATE", "State" /* State */],
      ["COMPUTED", "Computed" /* Computed */],
      ["WATCH", "Watch" /* Watch */],
      ["METHOD", "Method" /* Method */],
      ["RENDER", "Render" /* Render */],
      ["HANDLER", "Handler" /* Handler */],
      ["VALIDATION", "Validation" /* Validation */],
      ["LAYOUT", "Layout" /* Layout */],
      ["MIDDLEWARE", "Middleware" /* Middleware */],
      ["SUSPENSE", "Suspense" /* Suspense */],
      ["SLOT", "Slot" /* Slot */],
      ["METADATA", "Metadata" /* Metadata */],
      // Phase 11: Enterprise backend keywords
      ["SERVICE", "Service" /* Service */],
      ["CONTROLLER", "Controller" /* Controller */],
      ["GUARD", "Guard" /* Guard */],
      ["PIPE", "Pipe" /* Pipe */],
      // Phase 11: Database ORM keywords
      ["MODEL", "Model" /* Model */],
      ["QUERY", "Query" /* Query */],
      ["MIGRATION", "Migration" /* Migration */],
      ["REPOSITORY", "Repository" /* Repository */],
      ["DATABASE", "Database" /* Database */],
      // Phase 11: Cache & Messaging keywords
      ["CACHE", "Cache" /* Cache */],
      ["CACHED", "Cached" /* Cached */],
      ["KAFKA", "Kafka" /* Kafka */],
      ["PRODUCER", "Producer" /* Producer */],
      ["CONSUMER", "Consumer" /* Consumer */],
      ["QUEUE", "Queue" /* Queue */],
      ["RABBITMQ", "RabbitMQ" /* RabbitMQ */],
      // Phase 11: Authentication keywords
      ["JWT", "JWT" /* JWT */],
      ["OAUTH", "OAuth" /* OAuth */],
      // Phase 11: Deployment keywords
      ["DOCKERFILE", "Dockerfile" /* Dockerfile */],
      ["DOCKER-COMPOSE", "DockerCompose" /* DockerCompose */],
      ["K8S-DEPLOYMENT", "K8sDeployment" /* K8sDeployment */],
      ["K8S-SERVICE", "K8sService" /* K8sService */],
      ["K8S-INGRESS", "K8sIngress" /* K8sIngress */],
      // Phase 11: Cloud keywords
      ["AWS", "AWS" /* AWS */],
      ["AWS-S3", "AwsS3" /* AwsS3 */],
      ["AWS-LAMBDA", "AwsLambda" /* AwsLambda */],
      ["AWS-RDS", "AwsRds" /* AwsRds */],
      ["AWS-SQS", "AwsSqs" /* AwsSqs */],
      ["GCP", "GCP" /* GCP */],
      ["GCP-CLOUD-RUN", "GcpCloudRun" /* GcpCloudRun */],
      ["GCP-BIGQUERY", "GcpBigquery" /* GcpBigquery */],
      ["AZURE", "Azure" /* Azure */],
      ["AZURE-FUNCTION", "AzureFunction" /* AzureFunction */],
      ["AZURE-COSMOS", "AzureCosmos" /* AzureCosmos */]
      // Note: browse, cache are treated as regular symbols, not keywords
    ]);
  }
});

// src/ast.ts
function makeLiteral(type, value, line) {
  return { kind: "literal", type, value, line };
}
function makeTemplateString(value, line) {
  return { kind: "template-string", value, line };
}
function makeVariable(name, line) {
  return { kind: "variable", name, line };
}
function makeSExpr(op, args, line) {
  return { kind: "sexpr", op, args, line };
}
function makeKeyword(name) {
  return { kind: "keyword", name };
}
function makeBlock(type, name, fields, line) {
  return { kind: "block", type, name, fields, line };
}
function makeTypeAnnotation(name, generic, union, optional) {
  return { kind: "type", name, generic, union, optional };
}
function makeLiteralPattern(type, value) {
  return { kind: "literal-pattern", type, value };
}
function makeVariablePattern(name) {
  return { kind: "variable-pattern", name };
}
function makeWildcardPattern() {
  return { kind: "wildcard-pattern" };
}
function makeListPattern(elements, restElement) {
  return { kind: "list-pattern", elements, restElement };
}
function makeStructPattern(fields, asBinding) {
  return { kind: "struct-pattern", fields, asBinding };
}
function makeRangePattern(min, max) {
  return { kind: "range-pattern", min, max };
}
function makeOrPattern(alternatives) {
  return { kind: "or-pattern", alternatives };
}
function makeMatchCase(pattern, body, guard) {
  return { pattern, guard, body };
}
function makePatternMatch(value, cases, defaultCase) {
  return { kind: "pattern-match", value, cases, defaultCase };
}
function makeImportBlock(moduleName, source, selective, alias) {
  return { kind: "import", moduleName, source, selective, alias };
}
function makeOpenBlock(moduleName, source) {
  return { kind: "open", moduleName, source };
}
function makeTryBlock(body, catchClauses, finallyBlock) {
  return { kind: "try-block", body, catchClauses, finallyBlock };
}
function makeCatchClause(handler, pattern, variable) {
  return { kind: "catch-clause", pattern, variable, handler };
}
function makeThrowExpression(argument) {
  return { kind: "throw", argument };
}
function makePageNode(name, title, route, component, metadata, line) {
  return { kind: "page", name, title, route, component, metadata, line };
}
function makeRouteNode(name, path7, method, handler, middleware, validation, line) {
  return { kind: "route", name, path: path7, method, handler, middleware, validation, line };
}
function makeComponentNode(name, render, state, computed, watch, methods, slots, line) {
  return { kind: "component", name, render, state, computed, watch, methods, slots, line };
}
function makeFormNode(name, fields, validation, submit, handlers, line) {
  return { kind: "form", name, fields, validation, submit, handlers, line };
}
var init_ast = __esm({
  "src/ast.ts"() {
  }
});

// src/parser.ts
function parse(tokens) {
  const parser = new Parser(tokens);
  return parser.parse();
}
var ParserError, ERROR_HINTS, Parser;
var init_parser = __esm({
  "src/parser.ts"() {
    init_token();
    init_ast();
    ParserError = class extends Error {
      constructor(message, line, col, hint, code, stage = "parse") {
        const codeStr = code ? `[${code}]` : "";
        const loc = `[${line}:${col}]`;
        const hintLine = hint ? `
  \uD78C\uD2B8: ${hint}` : "";
        super(`${codeStr} ${loc} ${message}${hintLine}`);
        this.line = line;
        this.col = col;
        this.hint = hint;
        this.code = code;
        this.stage = stage;
      }
      toJSON() {
        return {
          code: this.code || "E_PARSE_SYNTAX_ERROR",
          stage: this.stage,
          message: this.message,
          file: void 0,
          line: this.line,
          column: this.col,
          symbol: void 0,
          cause: void 0,
          hint: this.hint
        };
      }
    };
    ERROR_HINTS = {
      "Expected RParen, got Symbol": "\uAD04\uD638\uAC00 \uB2EB\uD788\uC9C0 \uC54A\uC558\uAC70\uB098 \uC640\uC77C\uB4DC\uCE74\uB4DC \uD328\uD134\uC5D0 \uAD04\uD638\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4: _ expr \u2192 (_ expr)",
      "Expected RParen, got EOF": "\uAD04\uD638\uAC00 \uB2EB\uD788\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC5EC\uB294 ( \uC640 \uB2EB\uB294 ) \uC218\uB97C \uD655\uC778\uD558\uC138\uC694.",
      "Expected operator": "S-expression\uC758 \uCCAB \uC694\uC18C\uB294 \uD568\uC218\uBA85\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4: (\uD568\uC218\uBA85 \uC778\uC790...)",
      "Expected ':' keyword in map literal": "\uB9F5 \uB9AC\uD130\uB7F4\uC758 \uD0A4\uB294 :\uC73C\uB85C \uC2DC\uC791\uD574\uC57C \uD569\uB2C8\uB2E4: {:key value}",
      "Unexpected token: Colon": "\uCF5C\uB860 \uD0A4\uC6CC\uB4DC (:key)\uB294 \uB9F5 \uB9AC\uD130\uB7F4 \uB610\uB294 \uBE14\uB85D \uD544\uB4DC\uC5D0\uC11C\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
      "Expected block type": "\uBE14\uB85D\uC740 [FUNC name :params [...] :body ...] \uD615\uC2DD\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.",
      "Unterminated string": '\uBB38\uC790\uC5F4\uC774 \uB2EB\uD788\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uB2EB\uB294 " \uB97C \uCD94\uAC00\uD558\uC138\uC694.'
    };
    Parser = class {
      constructor(tokens) {
        this.pos = 0;
        // 자잘 #4 (2026-04-25): paren matching info — opening LParen 위치 추적
        this.parenStack = [];
        this.tokens = tokens;
      }
      parse() {
        const nodes = [];
        while (!this.isAtEnd()) {
          if (this.check("EOF" /* EOF */)) break;
          if (this.check("LBracket" /* LBracket */)) {
            const nextIdx = this.pos + 1;
            const knownBlockTypes = ["FUNC", "INTENT", "PROMPT", "PIPE", "AGENT", "LOAD", "RULE", "MODULE", "TYPECLASS", "INSTANCE", "SERVER", "ROUTE", "MIDDLEWARE", "WEBSOCKET", "ERROR-HANDLER", "PAGE", "COMPONENT", "FORM", "SERVICE", "CONTROLLER", "GUARD", "MODEL", "QUERY", "MIGRATION", "REPOSITORY", "DATABASE", "CACHE", "CACHED", "KAFKA", "PRODUCER", "CONSUMER", "QUEUE", "RABBITMQ", "JWT", "OAUTH", "DOCKERFILE", "DOCKER-COMPOSE", "K8S-DEPLOYMENT", "K8S-SERVICE", "K8S-INGRESS", "AWS", "AWS-S3", "AWS-LAMBDA", "AWS-RDS", "AWS-SQS", "GCP", "GCP-CLOUD-RUN", "GCP-BIGQUERY", "AZURE", "AZURE-FUNCTION", "AZURE-COSMOS"];
            if (nextIdx < this.tokens.length) {
              const nextToken = this.tokens[nextIdx];
              const isBlockKeyword = nextToken.type === "Module" /* Module */ || nextToken.type === "TypeClass" /* TypeClass */ || nextToken.type === "Instance" /* Instance */ || nextToken.type === "Page" /* Page */ || nextToken.type === "Api" /* Api */ || nextToken.type === "Component" /* Component */ || nextToken.type === "Form" /* Form */ || nextToken.type === "Route" /* Route */ || nextToken.type === "Service" /* Service */ || nextToken.type === "Controller" /* Controller */ || nextToken.type === "Guard" /* Guard */ || nextToken.type === "Model" /* Model */ || nextToken.type === "Query" /* Query */ || nextToken.type === "Migration" /* Migration */ || nextToken.type === "Repository" /* Repository */ || nextToken.type === "Database" /* Database */ || nextToken.type === "Cached" /* Cached */ || nextToken.type === "Kafka" /* Kafka */ || nextToken.type === "JWT" /* JWT */ || nextToken.type === "OAuth" /* OAuth */ || nextToken.type === "Dockerfile" /* Dockerfile */ || nextToken.type === "K8sDeployment" /* K8sDeployment */ || nextToken.type === "AWS" /* AWS */ || nextToken.type === "GCP" /* GCP */ || nextToken.type === "Azure" /* Azure */;
              const isKnownBlockType = nextToken.type === "Symbol" /* Symbol */ && knownBlockTypes.includes(nextToken.value);
              const hasKeywordAfter = nextIdx + 1 < this.tokens.length && (this.tokens[nextIdx + 1].type === "Keyword" /* Keyword */ || this.tokens[nextIdx + 1].type === "Colon" /* Colon */);
              if (isBlockKeyword || isKnownBlockType || hasKeywordAfter) {
                nodes.push(this.parseBlock());
              } else {
                nodes.push(this.parseArray());
              }
            } else {
              nodes.push(this.parseBlock());
            }
          } else if (this.check("LParen" /* LParen */)) {
            nodes.push(this.parseSExpr());
          } else {
            throw this.error(
              `Expected block or S-expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        return nodes;
      }
      // [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
      // Phase 6: BLOCK_TYPE can be Symbol (old) or keyword token (MODULE, TYPECLASS, INSTANCE)
      parseBlock() {
        const lbracket = this.expect("LBracket" /* LBracket */);
        const blockLine = lbracket.line;
        const typeToken = this.advance();
        let blockType;
        if (typeToken.type === "Symbol" /* Symbol */) {
          blockType = typeToken.value;
          if (blockType === "FUNC" && !process.env.FL_NO_DEPRECATION_WARN) {
            process.stderr.write(`\x1B[33m[deprecated]\x1B[0m [FUNC ...] \uBB38\uBC95\uC740 deprecated\uC785\uB2C8\uB2E4. (defn ...) \uC744 \uC0AC\uC6A9\uD558\uC138\uC694. (line ${typeToken.line})
`);
          }
        } else if (typeToken.type === "Module" /* Module */) {
          blockType = "MODULE";
        } else if (typeToken.type === "TypeClass" /* TypeClass */) {
          blockType = "TYPECLASS";
        } else if (typeToken.type === "Instance" /* Instance */) {
          blockType = "INSTANCE";
        } else if (typeToken.type === "Page" /* Page */) {
          blockType = "PAGE";
        } else if (typeToken.type === "Api" /* Api */) {
          blockType = "API";
        } else if (typeToken.type === "Route" /* Route */) {
          blockType = "ROUTE";
        } else if (typeToken.type === "Component" /* Component */) {
          blockType = "COMPONENT";
        } else if (typeToken.type === "Form" /* Form */) {
          blockType = "FORM";
        } else if (typeToken.type === "Service" /* Service */) {
          blockType = "SERVICE";
        } else if (typeToken.type === "Controller" /* Controller */) {
          blockType = "CONTROLLER";
        } else if (typeToken.type === "Guard" /* Guard */) {
          blockType = "GUARD";
        } else if (typeToken.type === "Model" /* Model */) {
          blockType = "MODEL";
        } else {
          throw this.error(`Expected block type (symbol or keyword), got ${typeToken.type}`, typeToken);
        }
        let blockName;
        if (blockType === "FUNC" && (this.check("Colon" /* Colon */) || this.check("Keyword" /* Keyword */))) {
          blockName = `__anon_func_${this.pos}`;
        } else {
          const nameToken = this.advance();
          if (nameToken.type !== "Symbol" /* Symbol */) {
            throw this.error(`Expected block name (symbol), got ${nameToken.type}`, nameToken);
          }
          blockName = nameToken.value;
        }
        const fields = /* @__PURE__ */ new Map();
        const typeAnnotations = /* @__PURE__ */ new Map();
        let generics;
        while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
          let keyName;
          const startToken = this.peek();
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(
                `Expected symbol after ':', got ${this.peek().type}`,
                this.peek()
              );
            }
            const keyToken = this.advance();
            keyName = keyToken.value;
          } else if (this.check("Keyword" /* Keyword */)) {
            const keyToken = this.advance();
            keyName = keyToken.value;
            if (keyName.startsWith(":")) {
              keyName = keyName.substring(1);
            }
          } else {
            throw this.error(
              `Expected keyword field (starting with :), got ${this.peek().type}`,
              this.peek()
            );
          }
          const values = [];
          if (!this.check("Keyword" /* Keyword */) && !this.check("Colon" /* Colon */) && !this.check("RBracket" /* RBracket */)) {
            values.push(this.parseValue());
          }
          while (!this.check("Keyword" /* Keyword */) && !this.check("Colon" /* Colon */) && !this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
            values.push(this.parseValue());
          }
          if (values.length === 0) {
            throw this.error(`Expected at least one value for keyword ${keyName}`, startToken);
          } else if (values.length === 1) {
            fields.set(keyName, values[0]);
          } else {
            fields.set(keyName, values);
          }
          if (keyName === "return" && values.length === 1) {
            const returnValue = values[0];
            if (returnValue.kind === "literal" && returnValue.type === "symbol") {
              const typeName = returnValue.value;
              typeAnnotations.set("return", makeTypeAnnotation(typeName));
            }
          }
          if (keyName === "generics" && values.length === 1) {
            const genericsValue = values[0];
            if (genericsValue.kind === "block" && genericsValue.type === "Array") {
              const arrayItems = genericsValue.fields?.get("items");
              if (Array.isArray(arrayItems)) {
                const gen = [];
                for (const item of arrayItems) {
                  if (item.kind === "literal" && item.type === "symbol") {
                    gen.push(item.value);
                  }
                }
                if (gen.length > 0) {
                  generics = gen;
                }
              }
            }
          }
          if (keyName === "params" && values.length === 1) {
            const paramsValue = values[0];
            if (paramsValue.kind === "literal" && paramsValue.type === "symbol") {
            } else if (paramsValue.kind === "block" && paramsValue.type === "Array") {
              const arrayItems = paramsValue.fields?.get("items");
              if (Array.isArray(arrayItems)) {
                const paramTypes = [];
                for (const item of arrayItems) {
                  if (item.kind === "block" && item.type === "Array") {
                    const pairItems = item.fields?.get("items");
                    if (Array.isArray(pairItems) && pairItems.length === 2) {
                      const typeNode = pairItems[1];
                      if (typeNode.kind === "literal" && typeNode.type === "symbol") {
                        const typeName = typeNode.value;
                        paramTypes.push(makeTypeAnnotation(typeName));
                      }
                    }
                  }
                }
                if (paramTypes.length > 0) {
                  typeAnnotations.set("params", paramTypes);
                }
              }
            }
          }
        }
        this.expect("RBracket" /* RBracket */);
        if (blockType === "MODULE") {
          const block2 = makeBlock(blockType, blockName, fields, blockLine);
          return this.convertBlockToModuleBlock(block2);
        }
        if (blockType === "TYPECLASS") {
          const block2 = makeBlock(blockType, blockName, fields, blockLine);
          return this.convertBlockToTypeClass(block2);
        }
        if (blockType === "INSTANCE") {
          const block2 = makeBlock(blockType, blockName, fields, blockLine);
          return this.convertBlockToInstance(block2);
        }
        const enterpriseBlocks = ["PAGE", "ROUTE", "COMPONENT", "FORM", "SERVICE", "CONTROLLER", "GUARD", "MODEL", "QUERY", "MIGRATION", "REPOSITORY", "DATABASE", "CACHE", "CACHED", "KAFKA", "PRODUCER", "CONSUMER", "QUEUE", "RABBITMQ", "JWT", "OAUTH", "DOCKERFILE", "DOCKER-COMPOSE", "K8S-DEPLOYMENT", "K8S-SERVICE", "K8S-INGRESS", "AWS", "AWS-S3", "AWS-LAMBDA", "AWS-RDS", "AWS-SQS", "GCP", "GCP-CLOUD-RUN", "GCP-BIGQUERY", "AZURE", "AZURE-FUNCTION", "AZURE-COSMOS"];
        if (enterpriseBlocks.includes(blockType)) {
          const block2 = makeBlock(blockType, blockName, fields, blockLine);
          return block2;
        }
        const block = makeBlock(blockType, blockName, fields, blockLine);
        if (blockType === "FUNC" || typeAnnotations.size > 0) {
          block.typeAnnotations = typeAnnotations;
        }
        if (generics && generics.length > 0) {
          block.generics = generics;
        }
        return block;
      }
      // Phase 6: Convert Block to ModuleBlock
      convertBlockToModuleBlock(block) {
        const exports2 = [];
        const bodyNodes = [];
        const exportsField = block.fields?.get("exports");
        if (exportsField) {
          if (exportsField.kind === "block" && exportsField.type === "Array") {
            const items = exportsField.fields?.get("items");
            if (Array.isArray(items)) {
              items.forEach((item) => {
                if (item.kind === "literal" && item.type === "symbol") {
                  exports2.push(item.value);
                }
              });
            }
          } else if (exportsField.kind === "literal" && exportsField.type === "symbol") {
            exports2.push(exportsField.value);
          }
        }
        const bodyField = block.fields?.get("body");
        if (bodyField) {
          if (bodyField.kind === "block" && bodyField.type === "Array") {
            const items = bodyField.fields?.get("items");
            if (Array.isArray(items)) {
              bodyNodes.push(...items);
            }
          } else if (Array.isArray(bodyField)) {
            bodyNodes.push(...bodyField);
          } else {
            bodyNodes.push(bodyField);
          }
        }
        return {
          kind: "module",
          name: block.name,
          exports: exports2,
          body: bodyNodes,
          path: void 0
        };
      }
      // Phase 5: Convert Block to TypeClass
      convertBlockToTypeClass(block) {
        const methods = /* @__PURE__ */ new Map();
        let typeParams = [];
        const typeParamsField = block.fields?.get("typeParams");
        if (typeParamsField) {
          if (typeParamsField.kind === "block" && typeParamsField.type === "Array") {
            const items = typeParamsField.fields?.get("items");
            if (Array.isArray(items)) {
              items.forEach((item) => {
                if (item.kind === "literal" && item.type === "symbol") {
                  typeParams.push(item.value);
                }
              });
            }
          } else if (typeParamsField.kind === "literal" && typeParamsField.type === "symbol") {
            typeParams.push(typeParamsField.value);
          } else if (Array.isArray(typeParamsField)) {
            typeParamsField.forEach((param) => {
              if (param.kind === "literal" && param.type === "symbol") {
                typeParams.push(param.value);
              }
            });
          }
        }
        const methodsField = block.fields?.get("methods");
        if (methodsField) {
          if (methodsField.kind === "block" && methodsField.type === "Array") {
            const items = methodsField.fields?.get("items");
            if (Array.isArray(items)) {
              items.forEach((item) => {
                if (item.kind === "block" && item.type === "Array") {
                  const subItems = item.fields?.get("items");
                  if (Array.isArray(subItems) && subItems.length === 2) {
                    const nameNode = subItems[0];
                    const typeNode = subItems[1];
                    if (nameNode.kind === "literal" && nameNode.type === "symbol") {
                      const methodName = nameNode.value;
                      methods.set(methodName, {
                        name: methodName,
                        type: typeNode
                      });
                    }
                  }
                }
              });
            }
          }
        }
        return {
          kind: "type-class",
          name: block.name,
          typeParams,
          methods
        };
      }
      // Phase 5: Convert Block to TypeClassInstance
      convertBlockToInstance(block) {
        let className = "";
        const concreteType = block.name;
        const implementations = /* @__PURE__ */ new Map();
        const typeClassField = block.fields?.get("typeclass");
        if (typeClassField) {
          if (typeClassField.kind === "literal" && typeClassField.type === "symbol") {
            className = typeClassField.value;
          }
        }
        block.fields?.forEach((value, key) => {
          if (key !== "typeclass") {
            implementations.set(key, value);
          }
        });
        return {
          kind: "type-class-instance",
          className,
          concreteType,
          implementations
        };
      }
      // Parse any value: literal, variable, block, S-expr, pattern-match, or array
      parseValue() {
        if (this.check("LParen" /* LParen */)) {
          return this.parseSExpr();
        }
        if (this.check("Number" /* Number */)) {
          const token = this.advance();
          return makeLiteral("number", parseFloat(token.value));
        }
        if (this.check("String" /* String */)) {
          const token = this.advance();
          if (token.value.includes("${")) {
            return makeTemplateString(token.value);
          }
          return makeLiteral("string", token.value);
        }
        if (this.check("Variable" /* Variable */)) {
          const token = this.advance();
          return makeVariable(token.value, token.line);
        }
        if (this.check("Keyword" /* Keyword */)) {
          const token = this.advance();
          return makeKeyword(token.value);
        }
        if (this.check("Else" /* Else */) || this.check("Then" /* Then */) || this.check("When" /* When */) || this.check("Repeat" /* Repeat */) || this.check("Until" /* Until */) || this.check("While" /* While */)) {
          const token = this.advance();
          return makeLiteral("symbol", token.value);
        }
        if (this.check("Colon" /* Colon */)) {
          this.advance();
          const next = this.tokens[this.pos];
          if (next) {
            if (next.type === "Variable" /* Variable */ && next.value) {
              this.advance();
              return makeLiteral("string", "$" + next.value);
            }
            if (next.value && /^[a-zA-Z_][a-zA-Z0-9_\-]*$/.test(next.value)) {
              return makeLiteral("string", this.advance().value);
            }
          }
          return makeLiteral("string", ":");
        }
        if (this.check("LBrace" /* LBrace */)) {
          return this.parseMap();
        }
        if (this.check("LBracket" /* LBracket */)) {
          const nextIdx = this.pos + 1;
          const knownBlockTypes = ["FUNC", "INTENT", "PROMPT", "PIPE", "AGENT", "LOAD", "RULE", "MODULE", "TYPECLASS", "INSTANCE", "SERVER", "ROUTE", "MIDDLEWARE", "WEBSOCKET", "ERROR-HANDLER", "PAGE", "COMPONENT", "FORM", "SERVICE", "CONTROLLER", "GUARD"];
          if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === "Symbol" /* Symbol */) {
            const potentialType = this.tokens[nextIdx].value;
            const isKnownType = knownBlockTypes.includes(potentialType);
            const nextNextIdx = nextIdx + 1;
            const isAllCaps = /^[A-Z][A-Z0-9_\-]*$/.test(potentialType);
            const hasKeywordAfterName = isAllCaps && nextNextIdx < this.tokens.length && (this.tokens[nextNextIdx].type === "Keyword" /* Keyword */ || this.tokens[nextNextIdx].type === "Colon" /* Colon */);
            if (isKnownType || hasKeywordAfterName) {
              return this.parseBlock();
            } else {
              return this.parseArray();
            }
          } else if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === "Module" /* Module */) {
            const result = this.parseBlock();
            if (result.kind === "module") {
              return result;
            }
            throw this.error(`Expected ModuleBlock from parseBlock with MODULE token`, this.peek());
          } else if (nextIdx < this.tokens.length && (this.tokens[nextIdx].type === "TypeClass" /* TypeClass */ || this.tokens[nextIdx].type === "Instance" /* Instance */)) {
            return this.parseBlock();
          } else if (nextIdx < this.tokens.length && (this.tokens[nextIdx].type === "Page" /* Page */ || this.tokens[nextIdx].type === "Api" /* Api */ || this.tokens[nextIdx].type === "Component" /* Component */ || this.tokens[nextIdx].type === "Form" /* Form */ || this.tokens[nextIdx].type === "Route" /* Route */)) {
            return this.parseBlock();
          } else if (nextIdx < this.tokens.length && (this.tokens[nextIdx].type === "Service" /* Service */ || this.tokens[nextIdx].type === "Controller" /* Controller */ || this.tokens[nextIdx].type === "Guard" /* Guard */ || this.tokens[nextIdx].type === "Model" /* Model */ || this.tokens[nextIdx].type === "Query" /* Query */ || this.tokens[nextIdx].type === "Migration" /* Migration */ || this.tokens[nextIdx].type === "Repository" /* Repository */ || this.tokens[nextIdx].type === "Database" /* Database */ || this.tokens[nextIdx].type === "Cached" /* Cached */ || this.tokens[nextIdx].type === "Kafka" /* Kafka */ || this.tokens[nextIdx].type === "Producer" /* Producer */ || this.tokens[nextIdx].type === "Consumer" /* Consumer */ || this.tokens[nextIdx].type === "Queue" /* Queue */ || this.tokens[nextIdx].type === "RabbitMQ" /* RabbitMQ */ || this.tokens[nextIdx].type === "JWT" /* JWT */ || this.tokens[nextIdx].type === "OAuth" /* OAuth */ || this.tokens[nextIdx].type === "Dockerfile" /* Dockerfile */ || this.tokens[nextIdx].type === "DockerCompose" /* DockerCompose */ || this.tokens[nextIdx].type === "K8sDeployment" /* K8sDeployment */ || this.tokens[nextIdx].type === "K8sService" /* K8sService */ || this.tokens[nextIdx].type === "K8sIngress" /* K8sIngress */ || this.tokens[nextIdx].type === "AWS" /* AWS */ || this.tokens[nextIdx].type === "GCP" /* GCP */ || this.tokens[nextIdx].type === "Azure" /* Azure */)) {
            return this.parseBlock();
          } else {
            return this.parseArray();
          }
        }
        if (this.check("Symbol" /* Symbol */)) {
          const token = this.advance();
          if (token.value === "true") {
            return makeLiteral("boolean", true);
          }
          if (token.value === "false") {
            return makeLiteral("boolean", false);
          }
          return makeLiteral("symbol", token.value);
        }
        throw this.error(`Unexpected token: ${this.peek().type}`, this.peek());
      }
      // Parse array: [val1 val2 val3 ...]
      parseArray() {
        this.expect("LBracket" /* LBracket */);
        const values = [];
        while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
          values.push(this.parseValue());
        }
        this.expect("RBracket" /* RBracket */);
        const arrayFields = /* @__PURE__ */ new Map();
        arrayFields.set("items", values);
        return makeBlock("Array", "$array", arrayFields);
      }
      // Parse map literal: {:key1 value1 :key2 value2 ...} or {"key1" value1 "key2" value2 ...}
      parseMap() {
        this.expect("LBrace" /* LBrace */);
        const mapFields = /* @__PURE__ */ new Map();
        while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
          let key;
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const keyTok = this.peek();
            if (keyTok.type === "RBrace" /* RBrace */ || this.isAtEnd()) {
              throw this.error(`Expected key after ':' in map literal`, keyTok);
            }
            if (keyTok.type === "Variable" /* Variable */) {
              this.advance();
              key = "$" + keyTok.value;
            } else {
              key = this.advance().value;
            }
          } else if (this.check("String" /* String */)) {
            key = this.advance().value;
          } else {
            throw this.error(`Map key must be :keyword or "string"`, this.peek());
          }
          const value = this.parseValue();
          mapFields.set(key, value);
        }
        this.expect("RBrace" /* RBrace */);
        return makeBlock("Map", "$map", mapFields);
      }
      // Check if next is an array literal (not generic function type args)
      // Array literal: [$x ...] or [1 2 3] or [value ...]
      // Generic syntax: [int string] (all symbols)
      isArrayLiteralStart() {
        if (!this.check("LBracket" /* LBracket */)) return false;
        const peekPos = this.pos + 1;
        if (peekPos >= this.tokens.length) return false;
        const nextToken = this.tokens[peekPos];
        if (nextToken.type === "Symbol" /* Symbol */) {
          const v = nextToken.value;
          const isGenericType = v.length <= 2 && v === v.toUpperCase() && /^[A-Z]/.test(v);
          return !isGenericType;
        }
        return nextToken.type === "Variable" /* Variable */ || nextToken.type === "Number" /* Number */ || nextToken.type === "String" /* String */ || nextToken.type === "RBracket" /* RBracket */ || nextToken.type === "LBracket" /* LBracket */ || nextToken.type === "LParen" /* LParen */ || nextToken.type === "LBrace" /* LBrace */ || nextToken.type === "Keyword" /* Keyword */ || nextToken.type === "Colon" /* Colon */;
      }
      // Parse S-expression: (op arg1 arg2 ...) or (op[T] arg1 arg2 ...) for generic functions
      // Also handles match expressions: (match value (pattern body) ...)
      // Phase 6: Also handles import and open expressions
      // Phase 9a: Also handles search and fetch expressions
      // Phase 9b: Also handles learn and recall expressions
      parseSExpr() {
        this.expect("LParen" /* LParen */);
        let op;
        const opToken = this.advance();
        if (opToken.type === "Open" /* Open */) {
          op = "open";
        } else if (opToken.type === "Search" /* Search */) {
          op = "search";
        } else if (opToken.type === "Fetch" /* Fetch */) {
          op = "fetch";
        } else if (opToken.type === "Learn" /* Learn */) {
          op = "learn";
        } else if (opToken.type === "Recall" /* Recall */) {
          op = "recall";
        } else if (opToken.type === "Remember" /* Remember */) {
          op = "remember";
        } else if (opToken.type === "Forget" /* Forget */) {
          op = "forget";
        } else if (opToken.type === "Observe" /* Observe */) {
          op = "observe";
        } else if (opToken.type === "Analyze" /* Analyze */) {
          op = "analyze";
        } else if (opToken.type === "Decide" /* Decide */) {
          op = "decide";
        } else if (opToken.type === "Act" /* Act */) {
          op = "act";
        } else if (opToken.type === "Verify" /* Verify */) {
          op = "verify";
        } else if (opToken.type === "If" /* If */) {
          op = "if";
        } else if (opToken.type === "When" /* When */) {
          op = "when";
        } else if (opToken.type === "Then" /* Then */) {
          op = "then";
        } else if (opToken.type === "Else" /* Else */) {
          op = "else";
        } else if (opToken.type === "Repeat" /* Repeat */) {
          op = "repeat";
        } else if (opToken.type === "Until" /* Until */) {
          op = "until";
        } else if (opToken.type === "While" /* While */) {
          op = "while";
        } else if (opToken.type === "LParen" /* LParen */) {
          this.pos--;
          const exprs = [];
          while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
            exprs.push(this.parseValue());
          }
          this.expect("RParen" /* RParen */);
          if (exprs.length === 1) return exprs[0];
          return { kind: "sexpr", op: "do", args: exprs };
        } else if (opToken.type === "Variable" /* Variable */) {
          op = opToken.value.startsWith("$") ? opToken.value : "$" + opToken.value;
        } else if (opToken.type !== "Symbol" /* Symbol */) {
          throw this.error(`Expected operator (symbol or keyword) in S-expression, got ${opToken.type}`, opToken);
        } else {
          op = opToken.value;
        }
        if (op === "import") {
          const importBlock = this.parseImportExpression();
          this.expect("RParen" /* RParen */);
          return importBlock;
        }
        if (op === "open") {
          const openBlock = this.parseOpenExpression();
          this.expect("RParen" /* RParen */);
          return openBlock;
        }
        if (op === "search") {
          const searchBlock = this.parseSearchExpression();
          this.expect("RParen" /* RParen */);
          return searchBlock;
        }
        if (op === "fetch") {
          const searchBlock = this.parseFetchExpression();
          this.expect("RParen" /* RParen */);
          return searchBlock;
        }
        if (op === "learn") {
          const learnBlock = this.parseLearnExpression();
          this.expect("RParen" /* RParen */);
          return learnBlock;
        }
        if (op === "recall") {
          const learnBlock = this.parseRecallExpression();
          this.expect("RParen" /* RParen */);
          return learnBlock;
        }
        if (op === "observe" || opToken.type === "Observe" /* Observe */) {
          const reasoningBlock = this.parseReasoningExpression("observe");
          this.expect("RParen" /* RParen */);
          return reasoningBlock;
        }
        if (op === "analyze" || opToken.type === "Analyze" /* Analyze */) {
          const reasoningBlock = this.parseReasoningExpression("analyze");
          this.expect("RParen" /* RParen */);
          return reasoningBlock;
        }
        if (op === "decide" || opToken.type === "Decide" /* Decide */) {
          const reasoningBlock = this.parseReasoningExpression("decide");
          this.expect("RParen" /* RParen */);
          return reasoningBlock;
        }
        if (op === "act" || opToken.type === "Act" /* Act */) {
          const reasoningBlock = this.parseReasoningExpression("act");
          this.expect("RParen" /* RParen */);
          return reasoningBlock;
        }
        if (op === "verify" || opToken.type === "Verify" /* Verify */) {
          const reasoningBlock = this.parseReasoningExpression("verify");
          this.expect("RParen" /* RParen */);
          return reasoningBlock;
        }
        if (op === "reasoning-sequence") {
          const reasoningSeq = this.parseReasoningSequenceExpression();
          this.expect("RParen" /* RParen */);
          return reasoningSeq;
        }
        if (op === "try") {
          const tryBlock = this.parseTryExpression();
          this.expect("RParen" /* RParen */);
          return tryBlock;
        }
        if (op === "throw") {
          const throwExpr = this.parseThrowExpression();
          this.expect("RParen" /* RParen */);
          return throwExpr;
        }
        if (op === "match") {
          const matchExpr = this.parsePatternMatch();
          this.expect("RParen" /* RParen */);
          return matchExpr;
        }
        const specialFormsForbiddingGeneric = /* @__PURE__ */ new Set([
          "fn",
          "let",
          "if",
          "cond",
          "match",
          "do",
          "try",
          "catch",
          "let*",
          "letrec",
          "define",
          "async",
          "await",
          "loop",
          "recur",
          "import",
          "export"
        ]);
        if (!specialFormsForbiddingGeneric.has(op) && this.check("LBracket" /* LBracket */) && !this.isArrayLiteralStart()) {
          this.advance();
          const typeArgs = [];
          while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
            const typeToken = this.advance();
            if (typeToken.type === "Symbol" /* Symbol */) {
              typeArgs.push(typeToken.value);
            }
            if (this.check("Symbol" /* Symbol */) && this.peek().value === ",") {
              this.advance();
            }
          }
          this.expect("RBracket" /* RBracket */);
          if (typeArgs.length > 0) {
            op = `${op}[${typeArgs.join(", ")}]`;
          }
        }
        const args = [];
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          args.push(this.parseValue());
        }
        this.expect("RParen" /* RParen */);
        return makeSExpr(op, args, opToken.line);
      }
      // Parse type annotation: int, string, bool, array<T>, map<K,V>, T?
      parseTypeAnnotation() {
        const token = this.advance();
        if (token.type !== "Symbol" /* Symbol */) {
          throw this.error(`Expected type annotation (symbol), got ${token.type}`, token);
        }
        let typeName = token.value;
        let generic = void 0;
        let optional = false;
        if (this.check("Symbol" /* Symbol */) && this.peek().value === "?") {
          this.advance();
          optional = true;
        }
        if (typeName.includes("<") && typeName.includes(">")) {
          const match = typeName.match(/<(.+)>/);
          if (match) {
            const innerTypeName = match[1];
            generic = makeTypeAnnotation(innerTypeName);
            typeName = typeName.substring(0, typeName.indexOf("<"));
          }
        }
        return makeTypeAnnotation(typeName, generic, void 0, optional);
      }
      // ===== Pattern Matching (Phase 4 Week 3-4) =====
      // Parse pattern: literal, variable, wildcard, list, struct, or or-pattern
      parsePattern() {
        const firstPattern = this.parseAtomicPattern();
        if (this.check("Symbol" /* Symbol */) && this.peek().value === "|") {
          const alternatives = [firstPattern];
          while (this.check("Symbol" /* Symbol */) && this.peek().value === "|") {
            this.advance();
            alternatives.push(this.parseAtomicPattern());
          }
          return makeOrPattern(alternatives);
        }
        return firstPattern;
      }
      // Parse atomic pattern (without or-alternatives)
      parseAtomicPattern() {
        if (this.check("Symbol" /* Symbol */) && this.peek().value === "_") {
          this.advance();
          return makeWildcardPattern();
        }
        if (this.check("Variable" /* Variable */)) {
          const varToken = this.advance();
          return makeVariablePattern(varToken.value);
        }
        if (this.check("Symbol" /* Symbol */) && !["&", "|"].includes(this.peek().value)) {
          const nameToken = this.advance();
          return makeVariablePattern(nameToken.value);
        }
        if (this.check("Number" /* Number */)) {
          const token = this.advance();
          return makeLiteralPattern("number", parseFloat(token.value));
        }
        if (this.check("String" /* String */)) {
          const token = this.advance();
          return makeLiteralPattern("string", token.value);
        }
        if (this.check("LParen" /* LParen */)) {
          this.advance();
          if (this.check("Symbol" /* Symbol */) && this.peek().value === "range") {
            this.advance();
            const minToken = this.advance();
            const maxToken = this.advance();
            this.expect("RParen" /* RParen */);
            return makeRangePattern(parseFloat(minToken.value), parseFloat(maxToken.value));
          }
          const pattern = this.parsePattern();
          this.expect("RParen" /* RParen */);
          return pattern;
        }
        if (this.check("LBracket" /* LBracket */)) {
          this.advance();
          const elements = [];
          let restElement;
          while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
            if (this.check("Symbol" /* Symbol */) && this.peek().value === "&") {
              this.advance();
              if (this.check("Symbol" /* Symbol */)) {
                const nameToken = this.advance();
                restElement = nameToken.value;
              }
              break;
            }
            elements.push(this.parsePattern());
          }
          this.expect("RBracket" /* RBracket */);
          return makeListPattern(elements, restElement);
        }
        if (this.check("LBrace" /* LBrace */)) {
          this.advance();
          const fields = /* @__PURE__ */ new Map();
          let asBinding;
          while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
            let fieldName;
            if (this.check("Colon" /* Colon */)) {
              this.advance();
              if (!this.check("Symbol" /* Symbol */)) break;
              const keyToken = this.advance();
              fieldName = keyToken.value;
            } else if (this.check("Keyword" /* Keyword */)) {
              const keyToken = this.advance();
              fieldName = keyToken.value.startsWith(":") ? keyToken.value.slice(1) : keyToken.value;
            } else {
              break;
            }
            if (fieldName === "as") {
              if (this.check("Variable" /* Variable */)) {
                asBinding = this.advance().value;
              }
              continue;
            }
            const pattern = this.parsePattern();
            fields.set(fieldName, pattern);
          }
          this.expect("RBrace" /* RBrace */);
          if (!asBinding && this.check("Colon" /* Colon */)) {
            const savedPos = this.pos;
            this.advance();
            if (this.check("Symbol" /* Symbol */) && this.peek().value === "as") {
              this.advance();
              if (this.check("Variable" /* Variable */)) {
                asBinding = this.advance().value;
              }
            } else {
              this.pos = savedPos;
            }
          }
          return makeStructPattern(fields, asBinding);
        }
        if (this.check("Keyword" /* Keyword */)) {
          const fields = /* @__PURE__ */ new Map();
          let asBinding;
          while (this.check("Keyword" /* Keyword */) && !this.isAtEnd()) {
            const keyToken = this.advance();
            const fieldName = keyToken.value.startsWith(":") ? keyToken.value.slice(1) : keyToken.value;
            if (fieldName === "as") {
              if (this.check("Variable" /* Variable */)) {
                asBinding = this.advance().value;
              }
              break;
            }
            const pattern = this.parsePattern();
            fields.set(fieldName, pattern);
          }
          return makeStructPattern(fields, asBinding);
        }
        throw this.error(`Expected pattern, got ${this.peek().type}`, this.peek());
      }
      // Parse match expression: (match value (pattern body) (pattern body) ... [default])
      // Note: Opening paren '(' already consumed by parseSExpr
      parsePatternMatch() {
        const value = this.parseValue();
        const cases = [];
        let defaultCase;
        while (this.check("LParen" /* LParen */) && !this.isAtEnd()) {
          this.advance();
          if (this.check("Symbol" /* Symbol */) && this.peek().value === "default") {
            this.advance();
            defaultCase = this.parseValue();
            this.expect("RParen" /* RParen */);
            break;
          }
          const pattern = this.parsePattern();
          let guard;
          if (this.check("LParen" /* LParen */) && (this.peekNext()?.value === "if" || this.peekNext()?.value === "when")) {
            const savedPos = this.pos;
            this.advance();
            const guardKeyword = this.advance().value;
            const possibleGuard = this.parseValue();
            if (this.check("RParen" /* RParen */)) {
              this.advance();
              guard = possibleGuard;
            } else if (guardKeyword === "when") {
              this.pos = savedPos;
            } else {
              this.pos = savedPos;
            }
          }
          const body = this.parseValue();
          cases.push(makeMatchCase(pattern, body, guard));
          this.expect("RParen" /* RParen */);
        }
        return makePatternMatch(value, cases, defaultCase);
      }
      // ===== Utility Methods =====
      peek() {
        if (this.pos >= this.tokens.length) {
          return this.tokens[this.tokens.length - 1];
        }
        return this.tokens[this.pos];
      }
      peekNext() {
        if (this.pos + 1 >= this.tokens.length) return null;
        return this.tokens[this.pos + 1];
      }
      advance() {
        if (this.pos < this.tokens.length) this.pos++;
        return this.tokens[this.pos - 1];
      }
      check(type) {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
      }
      expect(type) {
        if (this.check(type)) {
          const tok = this.advance();
          if (type === "LParen" /* LParen */ || type === "LBracket" /* LBracket */ || type === "LBrace" /* LBrace */) {
            this.parenStack.push({ type, line: tok.line, col: tok.col });
          } else if (type === "RParen" /* RParen */ || type === "RBracket" /* RBracket */ || type === "RBrace" /* RBrace */) {
            this.parenStack.pop();
          }
          return tok;
        }
        const token = this.peek();
        let extraHint = "";
        if ((type === "RParen" /* RParen */ || type === "RBracket" /* RBracket */ || type === "RBrace" /* RBrace */) && this.parenStack.length > 0) {
          const opening = this.parenStack[this.parenStack.length - 1];
          const openSym = opening.type === "LParen" /* LParen */ ? "(" : opening.type === "LBracket" /* LBracket */ ? "[" : "{";
          const wantSym = type === "RParen" /* RParen */ ? ")" : type === "RBracket" /* RBracket */ ? "]" : "}";
          extraHint = ` (\uAC00\uC7A5 \uCD5C\uADFC opening '${openSym}' at line ${opening.line}:${opening.col} \u2014 '${wantSym}' \uB204\uB77D \uB610\uB294 \uC911\uCCA9 \uC624\uB958)`;
        }
        throw this.error(`Expected ${type}, got ${token.type}${extraHint}`, token);
      }
      isAtEnd() {
        return this.pos >= this.tokens.length;
      }
      error(message, token) {
        let hint = Object.entries(ERROR_HINTS).find(([k]) => message.includes(k))?.[1];
        if (this.parenStack.length > 0 && (token.type === "EOF" /* EOF */ || message.includes("Expected R") || message.includes("Unexpected"))) {
          const stackInfo = this.parenStack.map((opening, idx) => {
            const openSym = opening.type === "LParen" /* LParen */ ? "(" : opening.type === "LBracket" /* LBracket */ ? "[" : "{";
            const depth = idx + 1;
            return `  [${depth}] '${openSym}' at line ${opening.line}:${opening.col}`;
          }).join("\n");
          const closeSeq = this.parenStack.map((o) => o.type === "LParen" /* LParen */ ? ")" : o.type === "LBracket" /* LBracket */ ? "]" : "}").reverse().join("");
          const nextOpening = this.parenStack[this.parenStack.length - 1];
          const nextExpected = nextOpening.type === "LParen" /* LParen */ ? ")" : nextOpening.type === "LBracket" /* LBracket */ ? "]" : "}";
          const parenHint = `\uBBF8\uB2EB\uD798 \uAD04\uD638 \uC2A4\uD0DD (\uAE4A\uC774: ${this.parenStack.length}):
${stackInfo}

\uD544\uC694\uD55C \uB2EB\uD798 \uAD04\uD638 \uC2DC\uD000\uC2A4: ${closeSeq}

\uB2E4\uC74C \uD1A0\uD070\uC744 \uC608\uC0C1: '${nextExpected}'`;
          hint = hint ? `${hint}

${parenHint}` : parenHint;
        }
        let code = "E_PARSE_SYNTAX_ERROR";
        if (message.includes("Expected") || message.includes("Unexpected")) {
          code = "E_PARSE_UNEXPECTED_TOKEN";
        } else if (message.includes("Unterminated")) {
          code = "E_PARSE_UNCLOSED_PAREN";
        } else if (message.includes("Expected block")) {
          code = "E_PARSE_SYNTAX_ERROR";
        }
        return new ParserError(message, token.line, token.col, hint, code, "parse");
      }
      // Synchronization for error recovery
      synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
          if (this.check("LBracket" /* LBracket */)) return;
          this.advance();
        }
      }
      // Phase 6: Parse import expression (import math :from "./math.fl" :as m :only [add])
      parseImportExpression() {
        const moduleName = this.parseQualifiedIdentifier();
        let source;
        let selective;
        let alias;
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(
                `Expected symbol after ':', got ${this.peek().type}`,
                this.peek()
              );
            }
            const clauseName = this.advance().value;
            switch (clauseName) {
              case "from":
                if (!this.check("String" /* String */)) {
                  throw this.error(`Expected string after :from, got ${this.peek().type}`, this.peek());
                }
                source = this.advance().value;
                break;
              case "only":
                if (!this.check("LBracket" /* LBracket */)) {
                  throw this.error(`Expected [ after :only, got ${this.peek().type}`, this.peek());
                }
                selective = this.parseSelectiveImport();
                break;
              case "as":
                if (!this.check("Symbol" /* Symbol */)) {
                  throw this.error(`Expected symbol after :as, got ${this.peek().type}`, this.peek());
                }
                alias = this.advance().value;
                break;
              default:
                throw this.error(`Unknown import clause: ${clauseName}`, this.peek());
            }
          } else {
            throw this.error(`Expected ':' in import expression, got ${this.peek().type}`, this.peek());
          }
        }
        return makeImportBlock(moduleName, source, selective, alias);
      }
      // Phase 6: Parse open expression (open math :from "./math.fl")
      parseOpenExpression() {
        const moduleName = this.parseQualifiedIdentifier();
        let source;
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(
                `Expected symbol after ':', got ${this.peek().type}`,
                this.peek()
              );
            }
            const clauseName = this.advance().value;
            if (clauseName === "from") {
              if (!this.check("String" /* String */)) {
                throw this.error(`Expected string after :from, got ${this.peek().type}`, this.peek());
              }
              source = this.advance().value;
            } else {
              throw this.error(`Unknown open clause: ${clauseName}`, this.peek());
            }
          } else {
            throw this.error(`Expected ':' in open expression, got ${this.peek().type}`, this.peek());
          }
        }
        return makeOpenBlock(moduleName, source);
      }
      // Phase 9a: Parse search expression
      // (search query :source "web"|"api"|"kb" :cache true|false :limit 5)
      parseSearchExpression() {
        let query = "";
        const queryNode = this.parseValue();
        if (queryNode.kind === "literal" && queryNode.type === "string") {
          query = queryNode.value;
        } else {
          throw this.error(`Expected string query in search expression`, this.peek());
        }
        let source = "web";
        let cache = false;
        let limit = 10;
        let name;
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
            }
            const clauseName = this.advance().value;
            switch (clauseName) {
              case "source":
                if (!this.check("String" /* String */)) {
                  throw this.error(`Expected string after :source`, this.peek());
                }
                const sourceVal = this.advance().value;
                if (sourceVal === "web" || sourceVal === "api" || sourceVal === "kb") {
                  source = sourceVal;
                } else {
                  throw this.error(`Invalid source: ${sourceVal}`, this.peek());
                }
                break;
              case "cache":
                const cacheVal = this.parseValue();
                if (cacheVal.kind === "literal") {
                  cache = cacheVal.value === "true" || cacheVal.value === true;
                }
                break;
              case "limit":
                const limitVal = this.parseValue();
                if (limitVal.kind === "literal" && limitVal.type === "number") {
                  limit = limitVal.value;
                }
                break;
              case "name":
                if (!this.check("Symbol" /* Symbol */)) {
                  throw this.error(`Expected symbol after :name`, this.peek());
                }
                name = this.advance().value;
                break;
              default:
                throw this.error(`Unknown search clause: ${clauseName}`, this.peek());
            }
          } else {
            throw this.error(`Expected ':' in search expression, got ${this.peek().type}`, this.peek());
          }
        }
        return {
          kind: "search-block",
          query,
          source,
          cache,
          limit,
          name
        };
      }
      // Phase 9a: Parse fetch expression
      // (fetch url :cache true|false)
      parseFetchExpression() {
        let query = "";
        const urlNode = this.parseValue();
        if (urlNode.kind === "literal" && urlNode.type === "string") {
          query = urlNode.value;
        } else {
          throw this.error(`Expected string URL in fetch expression`, this.peek());
        }
        let cache = false;
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
            }
            const clauseName = this.advance().value;
            if (clauseName === "cache") {
              const cacheVal = this.parseValue();
              if (cacheVal.kind === "literal") {
                cache = cacheVal.value === "true" || cacheVal.value === true;
              }
            } else {
              throw this.error(`Unknown fetch clause: ${clauseName}`, this.peek());
            }
          } else {
            throw this.error(`Expected ':' in fetch expression, got ${this.peek().type}`, this.peek());
          }
        }
        return {
          kind: "search-block",
          query,
          source: "api",
          cache
        };
      }
      // Phase 9b: Parse learn expression
      // (learn key data :source "search" :confidence 0.95)
      parseLearnExpression() {
        let key = "";
        const keyNode = this.parseValue();
        if (keyNode.kind === "literal" && (keyNode.type === "string" || keyNode.type === "symbol")) {
          key = keyNode.value;
        } else if (keyNode.kind === "variable") {
          key = keyNode.name;
        } else {
          throw this.error(`Expected symbol/string key in learn expression`, this.peek());
        }
        let data = null;
        if (!this.check("Colon" /* Colon */) && !this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          data = this.parseValue();
        }
        let source = "search";
        let confidence;
        let timestamp;
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
            }
            const clauseName = this.advance().value;
            switch (clauseName) {
              case "source":
                const sourceVal = this.parseValue();
                if (sourceVal.kind === "literal" && sourceVal.type === "string") {
                  const srcStr = sourceVal.value;
                  if (srcStr === "search" || srcStr === "feedback" || srcStr === "analysis") {
                    source = srcStr;
                  }
                }
                break;
              case "confidence":
                const confVal = this.parseValue();
                if (confVal.kind === "literal" && confVal.type === "number") {
                  confidence = confVal.value;
                }
                break;
              case "timestamp":
                const timeVal = this.parseValue();
                if (timeVal.kind === "literal" && timeVal.type === "string") {
                  timestamp = timeVal.value;
                }
                break;
              default:
                throw this.error(`Unknown learn clause: ${clauseName}`, this.peek());
            }
          } else {
            throw this.error(`Expected ':' in learn expression, got ${this.peek().type}`, this.peek());
          }
        }
        return {
          kind: "learn-block",
          key,
          data,
          source,
          confidence,
          timestamp
        };
      }
      // Phase 9b: Parse recall expression
      // (recall key) - retrieves learned data by key
      parseRecallExpression() {
        let key = "";
        const keyNode = this.parseValue();
        if (keyNode.kind === "literal" && (keyNode.type === "string" || keyNode.type === "symbol")) {
          key = keyNode.value;
        } else if (keyNode.kind === "variable") {
          key = keyNode.name;
        } else {
          throw this.error(`Expected symbol/string key in recall expression`, this.peek());
        }
        return {
          kind: "learn-block",
          key,
          data: null,
          // null indicates this is a recall operation
          source: "search"
        };
      }
      // Phase 9c: Parse reasoning expression
      // (observe "facts" :confidence 0.9)
      // (analyze :angle1 "perf" :angle2 "security" :selected "angle1")
      // (decide :choice "angle2" :reason "best performance")
      // (act :action "implement" :parameters {...})
      // (verify :result success :evidence [...])
      parseReasoningExpression(stage) {
        const data = /* @__PURE__ */ new Map();
        const metadata = {
          startTime: (/* @__PURE__ */ new Date()).toISOString()
        };
        let observations;
        let analysis;
        let decisions;
        let actions;
        let verifications;
        switch (stage) {
          case "observe": {
            if (!this.check("RParen" /* RParen */) && !this.check("Colon" /* Colon */)) {
              const obs = this.parseValue();
              observations = [obs];
              data.set("observation", obs);
            }
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                if (clauseName === "confidence") {
                  if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                    data.set(clauseName, clauseValue.value);
                  }
                } else {
                  data.set(clauseName, clauseValue);
                }
              } else {
                throw this.error(`Expected ':' in observe expression, got ${this.peek().type}`, this.peek());
              }
            }
            break;
          }
          case "analyze": {
            const angles = /* @__PURE__ */ new Map();
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                if (clauseName === "selected") {
                  const selected = this.parseValue();
                  data.set("selected", selected);
                } else {
                  const angleValue = this.parseValue();
                  angles.set(clauseName, angleValue);
                }
              } else {
                throw this.error(`Expected ':' in analyze expression, got ${this.peek().type}`, this.peek());
              }
            }
            data.set("angles", angles);
            analysis = Array.from(angles.values());
            break;
          }
          case "decide": {
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                data.set(clauseName, clauseValue);
              } else {
                throw this.error(`Expected ':' in decide expression, got ${this.peek().type}`, this.peek());
              }
            }
            decisions = [data.get("choice")];
            break;
          }
          case "act": {
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                data.set(clauseName, clauseValue);
              } else {
                throw this.error(`Expected ':' in act expression, got ${this.peek().type}`, this.peek());
              }
            }
            actions = [data.get("action")];
            break;
          }
          case "verify": {
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                if (clauseName === "confidence") {
                  if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                    metadata.confidence = clauseValue.value;
                  }
                } else {
                  data.set(clauseName, clauseValue);
                }
              } else {
                throw this.error(`Expected ':' in verify expression, got ${this.peek().type}`, this.peek());
              }
            }
            verifications = [data.get("result")];
            break;
          }
        }
        metadata.endTime = (/* @__PURE__ */ new Date()).toISOString();
        return {
          kind: "reasoning-block",
          stage,
          data,
          observations,
          analysis,
          decisions,
          actions,
          verifications,
          metadata
        };
      }
      // Phase 9c Extension: Parse reasoning-sequence expression
      // (reasoning-sequence (observe ...) (analyze ...) (decide ...) (act ...) (verify ...))
      // Phase 9a/9b: Support search and learn blocks in sequences
      parseReasoningSequenceExpression() {
        const stages = [];
        const startTime = (/* @__PURE__ */ new Date()).toISOString();
        let feedbackLoop = void 0;
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
            }
            const keyword = this.advance().value;
            if (keyword === "feedback") {
              feedbackLoop = {
                enabled: false,
                fromStage: "verify",
                toStage: "analyze",
                maxIterations: 3,
                confidenceDamping: 0.1
              };
              while (!this.check("RParen" /* RParen */) && !this.isAtEnd() && this.check("Colon" /* Colon */)) {
                this.advance();
                const feedbackKey = this.advance().value;
                switch (feedbackKey) {
                  case "enabled":
                    const enabledVal = this.parseValue();
                    feedbackLoop.enabled = enabledVal.kind === "literal" && enabledVal.value === true;
                    break;
                  case "from":
                    const fromVal = this.parseValue();
                    if (fromVal.kind === "literal" && fromVal.type === "string") {
                      feedbackLoop.fromStage = fromVal.value;
                    }
                    break;
                  case "to":
                    const toVal = this.parseValue();
                    if (toVal.kind === "literal" && toVal.type === "string") {
                      feedbackLoop.toStage = toVal.value;
                    }
                    break;
                  case "max-iterations":
                    const maxVal = this.parseValue();
                    if (maxVal.kind === "literal" && maxVal.type === "number") {
                      feedbackLoop.maxIterations = maxVal.value;
                    }
                    break;
                  case "damping":
                    const dampVal = this.parseValue();
                    if (dampVal.kind === "literal" && dampVal.type === "number") {
                      feedbackLoop.confidenceDamping = dampVal.value;
                    }
                    break;
                  case "condition":
                    feedbackLoop.condition = this.parseValue();
                    break;
                  default:
                    throw this.error(`Unknown feedback option: ${feedbackKey}`, this.peek());
                }
              }
            } else {
              throw this.error(`Unknown option: ${keyword}`, this.peek());
            }
          } else if (this.check("LParen" /* LParen */)) {
            if (this.pos + 1 < this.tokens.length) {
              const nextToken = this.tokens[this.pos + 1];
              if (nextToken.type === "If" /* If */) {
                const conditionalBlock = this.parseConditionalReasoningBlock();
                stages.push(conditionalBlock);
                continue;
              }
              if (nextToken.type === "When" /* When */) {
                const whenBlock = this.parseWhenReasoningBlock();
                stages.push(whenBlock);
                continue;
              }
              if (nextToken.type === "Repeat" /* Repeat */ || nextToken.type === "While" /* While */) {
                const loopBlock = this.parseLoopReasoningBlock();
                stages.push(loopBlock);
                continue;
              }
              if (nextToken.type === "Search" /* Search */) {
                const searchBlock = this.parseSearchReasoningBlock();
                stages.push(searchBlock);
                continue;
              }
              if (nextToken.type === "Learn" /* Learn */) {
                const learnBlock = this.parseLearnReasoningBlock();
                stages.push(learnBlock);
                continue;
              }
            }
            this.advance();
            const stageToken = this.peek();
            const isReasoningStage = stageToken.type === "Observe" /* Observe */ || stageToken.type === "Analyze" /* Analyze */ || stageToken.type === "Decide" /* Decide */ || stageToken.type === "Act" /* Act */ || stageToken.type === "Verify" /* Verify */ || stageToken.type === "Symbol" /* Symbol */ && (stageToken.value === "observe" || stageToken.value === "analyze" || stageToken.value === "decide" || stageToken.value === "act" || stageToken.value === "verify");
            if (!isReasoningStage) {
              throw this.error(
                `Expected reasoning stage (observe/analyze/decide/act/verify), got ${stageToken.value}`,
                stageToken
              );
            }
            const stageName = stageToken.type === "Observe" /* Observe */ ? "observe" : stageToken.type === "Analyze" /* Analyze */ ? "analyze" : stageToken.type === "Decide" /* Decide */ ? "decide" : stageToken.type === "Act" /* Act */ ? "act" : stageToken.type === "Verify" /* Verify */ ? "verify" : stageToken.value;
            this.advance();
            const reasoningBlock = this.parseReasoningExpressionInternal(
              stageName
            );
            stages.push(reasoningBlock);
            this.expect("RParen" /* RParen */);
          } else if (this.check("If" /* If */)) {
            const conditionalBlock = this.parseConditionalReasoningBlock();
            stages.push(conditionalBlock);
          } else if (this.check("When" /* When */)) {
            const whenBlock = this.parseWhenReasoningBlock();
            stages.push(whenBlock);
          } else if (this.check("Repeat" /* Repeat */) || this.check("While" /* While */)) {
            const loopBlock = this.parseLoopReasoningBlock();
            stages.push(loopBlock);
          } else {
            throw this.error(
              `Expected '(' before reasoning block, 'if', 'when', 'repeat', 'while', or ':feedback', got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        const endTime = (/* @__PURE__ */ new Date()).toISOString();
        return {
          kind: "reasoning-sequence",
          stages,
          metadata: {
            startTime,
            endTime,
            // Phase 9a/9b: Support search/learn blocks in execution path
            executionPath: stages.map((s) => {
              if ("stage" in s) return s.stage;
              if (s.kind === "search-block") return "search";
              if (s.kind === "learn-block") return "learn";
              return "unknown";
            })
          },
          feedbackLoop: feedbackLoop?.enabled ? feedbackLoop : void 0
        };
      }
      // Phase 11: Parse try-catch-finally expressions
      // (try body (catch [pattern] handler) (finally cleanup))
      // STRICT MODE: body는 최대 1개 표현식만 허용. 여러 개는 do로 감싸야 함.
      parseTryExpression() {
        const bodyExprs = [];
        if (this.check("LParen" /* LParen */) && this.pos + 1 < this.tokens.length) {
          const nextToken = this.tokens[this.pos + 1];
          if (!(nextToken.type === "Symbol" /* Symbol */ && (nextToken.value === "catch" || nextToken.value === "finally"))) {
            bodyExprs.push(this.parseValue());
            if (this.check("LParen" /* LParen */) && this.pos + 1 < this.tokens.length) {
              const afterBodyToken = this.tokens[this.pos + 1];
              if (!(afterBodyToken.type === "Symbol" /* Symbol */ && (afterBodyToken.value === "catch" || afterBodyToken.value === "finally"))) {
                const line = afterBodyToken.line || 0;
                throw new SyntaxError(
                  `Strict try-catch syntax: after body expression, expected 'catch' or 'finally', got '${afterBodyToken.value}' at line ${line}. For multiple body expressions, wrap with (do ...)`
                );
              }
            } else if (!this.check("RParen" /* RParen */)) {
              throw new SyntaxError(
                `Strict try-catch syntax: expected 'catch', 'finally', or ')' after try body. Got unexpected token at line ${this.peek().line || 0}`
              );
            }
          }
        }
        const body = bodyExprs.length === 1 ? bodyExprs[0] : makeSExpr("do", bodyExprs);
        const catchClauses = [];
        let finallyBlock;
        while (this.check("LParen" /* LParen */) && !this.isAtEnd()) {
          const clauseToken = this.peek();
          if (this.pos + 1 < this.tokens.length) {
            const nextToken = this.tokens[this.pos + 1];
            if (nextToken.type === "Symbol" /* Symbol */ && nextToken.value === "catch") {
              this.advance();
              this.advance();
              let pattern;
              let variable;
              if (this.check("LBracket" /* LBracket */)) {
                this.advance();
                if (this.check("Symbol" /* Symbol */)) {
                  const patternName = this.advance().value;
                  variable = patternName;
                  pattern = makeVariablePattern(patternName);
                }
                this.expect("RBracket" /* RBracket */);
              } else if (this.check("Symbol" /* Symbol */) || this.check("Variable" /* Variable */)) {
                const paramToken = this.advance();
                variable = paramToken.value;
                pattern = makeVariablePattern(paramToken.value);
              }
              const handlerExprs = [];
              while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
                handlerExprs.push(this.parseValue());
              }
              const handler = handlerExprs.length === 1 ? handlerExprs[0] : makeSExpr("do", handlerExprs);
              catchClauses.push(makeCatchClause(handler, pattern, variable));
              this.expect("RParen" /* RParen */);
            } else if (nextToken.type === "Symbol" /* Symbol */ && nextToken.value === "finally") {
              this.advance();
              this.advance();
              const finallyExprs = [];
              while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
                finallyExprs.push(this.parseValue());
              }
              finallyBlock = finallyExprs.length === 1 ? finallyExprs[0] : makeSExpr("do", finallyExprs);
              this.expect("RParen" /* RParen */);
              break;
            } else {
              break;
            }
          } else {
            break;
          }
        }
        return makeTryBlock(body, catchClauses.length > 0 ? catchClauses : void 0, finallyBlock);
      }
      // Phase 11: Parse throw expressions
      // (throw error-value)
      parseThrowExpression() {
        const argument = this.parseValue();
        return makeThrowExpression(argument);
      }
      // Phase B-1: Parse loop expressions
      // (loop [($var init) condition update] body)
      parseLoopExpression() {
        const startLine = this.peek().line || 0;
        this.expect("LBracket" /* LBracket */);
        const init = this.parseValue();
        const condition = this.parseValue();
        const update = this.parseValue();
        this.expect("RBracket" /* RBracket */);
        const bodyExprs = [];
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          bodyExprs.push(this.parseValue());
        }
        const body = bodyExprs.length === 1 ? bodyExprs[0] : makeSExpr("do", bodyExprs);
        return {
          kind: "loop",
          init,
          condition,
          update,
          body,
          line: startLine
        };
      }
      // Phase 9c: Internal helper for parsing reasoning expressions (used by parseReasoningExpression and parseReasoningSequenceExpression)
      parseReasoningExpressionInternal(stage) {
        const data = /* @__PURE__ */ new Map();
        let observations = [];
        let analysis = [];
        let decisions = [];
        let actions = [];
        let verifications = [];
        const metadata = { startTime: (/* @__PURE__ */ new Date()).toISOString() };
        switch (stage) {
          case "observe": {
            if (!this.check("RParen" /* RParen */)) {
              const firstArg = this.parseValue();
              if (firstArg.kind === "literal" && firstArg.type === "string") {
                data.set("observation", firstArg.value);
                observations.push(firstArg.value);
              }
            }
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                if (!this.check("Symbol" /* Symbol */)) {
                  throw this.error(
                    `Expected symbol after ':', got ${this.peek().type}`,
                    this.peek()
                  );
                }
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                if (clauseName === "confidence") {
                  if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                    metadata.confidence = clauseValue.value;
                  }
                } else {
                  data.set(clauseName, clauseValue);
                }
              } else {
                throw this.error(
                  `Expected ':' in observe expression, got ${this.peek().type}`,
                  this.peek()
                );
              }
            }
            break;
          }
          case "analyze": {
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                data.set(clauseName, clauseValue);
                if (clauseName === "selected") {
                  analysis.push(clauseValue);
                }
              } else {
                throw this.error(
                  `Expected ':' in analyze expression, got ${this.peek().type}`,
                  this.peek()
                );
              }
            }
            break;
          }
          case "decide": {
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                data.set(clauseName, clauseValue);
              } else {
                throw this.error(
                  `Expected ':' in decide expression, got ${this.peek().type}`,
                  this.peek()
                );
              }
            }
            decisions = [data.get("choice")];
            break;
          }
          case "act": {
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                data.set(clauseName, clauseValue);
              } else {
                throw this.error(
                  `Expected ':' in act expression, got ${this.peek().type}`,
                  this.peek()
                );
              }
            }
            actions = [data.get("action")];
            break;
          }
          case "verify": {
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              if (this.check("Colon" /* Colon */)) {
                this.advance();
                const clauseName = this.advance().value;
                const clauseValue = this.parseValue();
                if (clauseName === "confidence") {
                  if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                    metadata.confidence = clauseValue.value;
                  }
                } else {
                  data.set(clauseName, clauseValue);
                }
              } else {
                throw this.error(
                  `Expected ':' in verify expression, got ${this.peek().type}`,
                  this.peek()
                );
              }
            }
            verifications = [data.get("result")];
            break;
          }
        }
        metadata.endTime = (/* @__PURE__ */ new Date()).toISOString();
        return {
          kind: "reasoning-block",
          stage,
          data,
          observations,
          analysis,
          decisions,
          actions,
          verifications,
          metadata
        };
      }
      // Phase 6: Parse qualified identifier (math or math:add or utils:double:helper)
      // IMPORTANT: Stop when encountering keyword colons like :from, :as, :only
      parseQualifiedIdentifier() {
        if (!this.check("Symbol" /* Symbol */)) {
          throw this.error(`Expected symbol, got ${this.peek().type}`, this.peek());
        }
        const parts = [];
        parts.push(this.advance().value);
        const keywordColons = /* @__PURE__ */ new Set(["from", "as", "only", "to", "body", "params", "exports"]);
        while (this.check("Colon" /* Colon */)) {
          const peekPos = this.pos + 1;
          if (peekPos >= this.tokens.length) break;
          const nextToken = this.tokens[peekPos];
          if (nextToken.type === "Symbol" /* Symbol */ && keywordColons.has(nextToken.value)) {
            break;
          }
          this.advance();
          if (!this.check("Symbol" /* Symbol */)) {
            throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
          }
          parts.push(this.advance().value);
        }
        return parts.join(":");
      }
      // Phase 6: Parse selective import list: [func1 func2 ...]
      parseSelectiveImport() {
        this.expect("LBracket" /* LBracket */);
        const names = [];
        while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
          if (!this.check("Symbol" /* Symbol */)) {
            throw this.error(`Expected symbol in import list, got ${this.peek().type}`, this.peek());
          }
          names.push(this.advance().value);
        }
        this.expect("RBracket" /* RBracket */);
        return names;
      }
      // Phase 9c: Parse if/then/else conditional reasoning block
      // Format: (if condition (thenBlock) (elseBlock)?)
      parseConditionalReasoningBlock() {
        this.expect("LParen" /* LParen */);
        this.expect("If" /* If */);
        const condition = this.parseValue();
        if (!this.check("LParen" /* LParen */)) {
          throw this.error(`Expected '(' for then block, got ${this.peek().type}`, this.peek());
        }
        this.advance();
        const thenStageToken = this.peek();
        const thenStageName = this.getReasoningStageName(thenStageToken);
        if (!thenStageName) {
          throw this.error(
            `Expected reasoning stage in then block, got ${thenStageToken.value}`,
            thenStageToken
          );
        }
        this.advance();
        const thenBlock = this.parseReasoningExpressionInternal(
          thenStageName
        );
        this.expect("RParen" /* RParen */);
        let elseBlock = void 0;
        if (this.check("LParen" /* LParen */)) {
          const nextIdx = this.pos + 1;
          if (nextIdx < this.tokens.length) {
            const nextToken = this.tokens[nextIdx];
            const elseStageName = this.getReasoningStageName(nextToken);
            if (elseStageName) {
              this.advance();
              this.advance();
              elseBlock = this.parseReasoningExpressionInternal(
                elseStageName
              );
              this.expect("RParen" /* RParen */);
            }
          }
        }
        this.expect("RParen" /* RParen */);
        return {
          ...thenBlock,
          conditional: { condition, thenBlock, elseBlock }
        };
      }
      // Phase 9c: Parse when guard clause
      // Format: (when condition (block))
      parseWhenReasoningBlock() {
        this.expect("LParen" /* LParen */);
        this.expect("When" /* When */);
        const condition = this.parseValue();
        if (!this.check("LParen" /* LParen */)) {
          throw this.error(`Expected '(' for when block, got ${this.peek().type}`, this.peek());
        }
        this.advance();
        const stageToken = this.peek();
        const stageName = this.getReasoningStageName(stageToken);
        if (!stageName) {
          throw this.error(`Expected reasoning stage in when block, got ${stageToken.value}`, stageToken);
        }
        this.advance();
        const block = this.parseReasoningExpressionInternal(
          stageName
        );
        this.expect("RParen" /* RParen */);
        this.expect("RParen" /* RParen */);
        return {
          ...block,
          whenGuard: condition
        };
      }
      // Phase 9c: Parse loop control (repeat-until or repeat-while)
      // Format: (repeat-until condition (block))
      //         (repeat-while condition (block))
      // Phase 9a: Parse search block in reasoning sequence
      // (search query :source "web"|"api"|"kb" :cache true|false :limit 5)
      parseSearchReasoningBlock() {
        this.expect("LParen" /* LParen */);
        this.expect("Search" /* Search */);
        const searchBlock = this.parseSearchExpression();
        this.expect("RParen" /* RParen */);
        return searchBlock;
      }
      // Phase 9b: Parse learn block in reasoning sequence
      // (learn key data :source "search"|"feedback"|"analysis" :confidence 0.95)
      parseLearnReasoningBlock() {
        this.expect("LParen" /* LParen */);
        this.expect("Learn" /* Learn */);
        const learnBlock = this.parseLearnExpression();
        this.expect("RParen" /* RParen */);
        return learnBlock;
      }
      parseLoopReasoningBlock() {
        this.expect("LParen" /* LParen */);
        const loopTypeToken = this.peek();
        const isRepeat = loopTypeToken.type === "Repeat" /* Repeat */;
        const isWhile = loopTypeToken.type === "While" /* While */;
        if (!isRepeat && !isWhile) {
          throw this.error(
            `Expected 'repeat' or 'while' in loop, got ${loopTypeToken.type}`,
            loopTypeToken
          );
        }
        this.advance();
        let loopType;
        if (isRepeat) {
          this.expect("Until" /* Until */);
          loopType = "repeat-until";
        } else {
          loopType = "repeat-while";
        }
        const condition = this.parseValue();
        if (!this.check("LParen" /* LParen */)) {
          throw this.error(`Expected '(' for loop block, got ${this.peek().type}`, this.peek());
        }
        this.advance();
        const stageToken = this.peek();
        const stageName = this.getReasoningStageName(stageToken);
        if (!stageName) {
          throw this.error(`Expected reasoning stage in loop block, got ${stageToken.value}`, stageToken);
        }
        this.advance();
        const block = this.parseReasoningExpressionInternal(
          stageName
        );
        this.expect("RParen" /* RParen */);
        this.expect("RParen" /* RParen */);
        return {
          ...block,
          loopControl: {
            type: loopType,
            condition
          }
        };
      }
      // Phase 11: Parse PAGE block - [PAGE name :path "/" :render "<h1>...</h1>" :title "..." :component ComponentName]
      parsePage(name, fields, line) {
        const path7 = this.extractStringField(fields, "path");
        const title = this.extractStringField(fields, "title");
        const render = this.extractStringField(fields, "render");
        const component = this.extractSymbolField(fields, "component");
        const metadata = this.extractMapField(fields, "metadata");
        const pageNode = makePageNode(name, title, path7, component, metadata, line);
        if (render) {
          pageNode.fields = pageNode.fields || /* @__PURE__ */ new Map();
          pageNode.fields.set("render", { kind: "literal", type: "string", value: render });
        }
        return pageNode;
      }
      // Phase 11: Parse ROUTE block - [ROUTE name :path "/api/users/:id" :method "GET" :handler handlerName]
      parseRoute(name, fields, line) {
        const path7 = this.extractStringField(fields, "path");
        const method = this.extractStringField(fields, "method");
        const handler = this.extractSymbolField(fields, "handler");
        const middleware = this.extractSymbolArrayField(fields, "middleware");
        const validation = this.extractSymbolField(fields, "validation");
        return makeRouteNode(name, path7, method, handler, middleware, validation, line);
      }
      // Phase 11: Parse COMPONENT block - [COMPONENT name :render renderFn :state stateName :methods [...]]
      parseComponent(name, fields, line) {
        const render = this.extractSymbolField(fields, "render");
        const state = this.extractSymbolField(fields, "state");
        const computed = this.extractSymbolArrayField(fields, "computed");
        const watch = this.extractWatchField(fields, "watch");
        const methods = this.extractMethodsField(fields, "methods");
        const slots = this.extractSymbolArrayField(fields, "slots");
        return makeComponentNode(name, render, state, computed, watch, methods, slots, line);
      }
      // Phase 11: Parse FORM block - [FORM name :fields [...] :validation validationFn :submit submitFn]
      parseForm(name, fields, line) {
        const formFields = this.extractMapField(fields, "fields");
        const validation = this.extractSymbolField(fields, "validation");
        const submit = this.extractSymbolField(fields, "submit");
        const handlers = this.extractHandlersField(fields, "handlers");
        return makeFormNode(name, formFields, validation, submit, handlers, line);
      }
      // Helper: Extract string field from block fields
      extractStringField(fields, key) {
        const value = fields.get(key);
        if (!value) return void 0;
        if (Array.isArray(value)) {
          const first = value[0];
          if (first.kind === "literal" && first.type === "string") {
            return first.value;
          }
        } else if (value.kind === "literal" && value.type === "string") {
          return value.value;
        }
        return void 0;
      }
      // Helper: Extract symbol field from block fields
      extractSymbolField(fields, key) {
        const value = fields.get(key);
        if (!value) return void 0;
        if (Array.isArray(value)) {
          const first = value[0];
          if (first.kind === "literal" && first.type === "symbol") {
            return first.value;
          }
        } else if (value.kind === "literal" && value.type === "symbol") {
          return value.value;
        }
        return void 0;
      }
      // Helper: Extract array of symbols from block fields
      extractSymbolArrayField(fields, key) {
        const value = fields.get(key);
        if (!value) return void 0;
        const items = [];
        let arrayItems = [];
        if (Array.isArray(value)) {
          arrayItems = value;
        } else if (value.kind === "block" && value.type === "Array") {
          const innerItems = value.fields?.get("items");
          if (Array.isArray(innerItems)) {
            arrayItems = innerItems;
          }
        }
        for (const item of arrayItems) {
          if (item.kind === "literal" && item.type === "symbol") {
            items.push(item.value);
          }
        }
        return items.length > 0 ? items : void 0;
      }
      // Helper: Extract map field from block fields
      extractMapField(fields, key) {
        const value = fields.get(key);
        if (!value) return void 0;
        const result = /* @__PURE__ */ new Map();
        if (value.kind === "block" && value.type === "Map") {
          const innerFields = value.fields;
          if (innerFields) {
            for (const [k, v] of innerFields) {
              result.set(k, v);
            }
          }
        }
        return result.size > 0 ? result : void 0;
      }
      // Helper: Extract watch field from block fields (map of property names to handler names)
      extractWatchField(fields, key) {
        const value = fields.get(key);
        if (!value) return void 0;
        const result = /* @__PURE__ */ new Map();
        if (value.kind === "block" && value.type === "Map") {
          const innerFields = value.fields;
          if (innerFields) {
            for (const [k, v] of innerFields) {
              if (v.kind === "literal" && v.type === "symbol") {
                result.set(k, v.value);
              }
            }
          }
        }
        return result.size > 0 ? result : void 0;
      }
      // Helper: Extract methods field from block fields (map of method names to function names)
      extractMethodsField(fields, key) {
        const value = fields.get(key);
        if (!value) return void 0;
        const result = /* @__PURE__ */ new Map();
        if (value.kind === "block" && value.type === "Map") {
          const innerFields = value.fields;
          if (innerFields) {
            for (const [k, v] of innerFields) {
              if (v.kind === "literal" && v.type === "symbol") {
                result.set(k, v.value);
              }
            }
          }
        }
        return result.size > 0 ? result : void 0;
      }
      // Helper: Extract handlers field from block fields (map of event names to handler names)
      extractHandlersField(fields, key) {
        const value = fields.get(key);
        if (!value) return void 0;
        const result = /* @__PURE__ */ new Map();
        if (value.kind === "block" && value.type === "Map") {
          const innerFields = value.fields;
          if (innerFields) {
            for (const [k, v] of innerFields) {
              if (v.kind === "literal" && v.type === "symbol") {
                result.set(k, v.value);
              }
            }
          }
        }
        return result.size > 0 ? result : void 0;
      }
      // Helper: Get reasoning stage name from token
      getReasoningStageName(token) {
        if (token.type === "Observe" /* Observe */) return "observe";
        if (token.type === "Analyze" /* Analyze */) return "analyze";
        if (token.type === "Decide" /* Decide */) return "decide";
        if (token.type === "Act" /* Act */) return "act";
        if (token.type === "Verify" /* Verify */) return "verify";
        if (token.type === "Symbol" /* Symbol */) {
          if (token.value === "observe") return "observe";
          if (token.value === "analyze") return "analyze";
          if (token.value === "decide") return "decide";
          if (token.value === "act") return "act";
          if (token.value === "verify") return "verify";
        }
        return null;
      }
    };
  }
});

// src/runtime-helpers.ts
function generateRuntimePreamble() {
  return `
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// FreeLang v11 Runtime Helpers (Enhanced 2026-04-30)
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

// \u2500 \uC0B0\uC220 \uBC0F \uB17C\uB9AC \uC5F0\uC0B0\uC790 (stdlib) \u2500
function _plus(...args) { if (args.length === 0) return 0; if (args.length === 1) return args[0]; return args.reduce((a, b) => a + b); }
function _minus(...args) { if (args.length === 0) return 0; if (args.length === 1) return -args[0]; return args.reduce((a, b) => a - b); }
function _star(...args) { if (args.length === 0) return 1; if (args.length === 1) return args[0]; return args.reduce((a, b) => a * b); }
function _slash(...args) { if (args.length === 0) return 1; if (args.length === 1) return 1/args[0]; return args.reduce((a, b) => a / b); }
function _gt(a, b) { return a > b; }
function _lt(a, b) { return a < b; }
function _eq(a, b) { return a === b; }
function _gt_eq(a, b) { return a >= b; }
function _lt_eq(a, b) { return a <= b; }
function _not(a) { return !a; }
function _and(...args) { for(let a of args) if(!a) return false; return args.length > 0 ? args[args.length-1] : true; }
function _or(...args) { for(let a of args) if(a) return a; return false; }
function _concat(...args) { 
  if (args.length === 0) return "";
  if (Array.isArray(args[0])) return [].concat(...args);
  return args.join("");
}

// \u2500 \uD0C0\uC785 \uCCB4\uD06C \u2500
function _fl_null_q(v) { return v === null || v === undefined; }
function _fl_true_q(v) { return v === true; }
function _fl_false_q(v) { return v === false; }
function _fl_number_q(v) { return typeof v === 'number'; }
function _fl_string_q(v) { return typeof v === 'string'; }
function _fl_list_q(v) { return Array.isArray(v); }
function _fl_array_q(v) { return Array.isArray(v); }
function _fl_map_q(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function _fl_fn_q(v) { return typeof v === 'function'; }

// \u2500 \uB370\uC774\uD130 \uC811\uADFC \uBC0F \uC870\uC791 \u2500
function _fl_length(v) { if(v==null) return 0; return v.length !== undefined ? v.length : 0; }
function _fl_get(obj, key, dflt) {
  if (obj === null || obj === undefined) return dflt || null;
  if (obj instanceof Map) return obj.has(key) ? obj.get(key) : (dflt || null);
  
  let k = (typeof key === "object" && key !== null) ? (key.name || key.value || String(key)) : String(key);
  if (k.startsWith(":")) k = k.slice(1);

  if (Array.isArray(obj)) {
    if (typeof key === "number") return obj[key] !== undefined ? obj[key] : (dflt || null);
    if (k === "length") return obj.length;
    let idx = parseInt(k);
    if (!isNaN(idx)) return obj[idx] !== undefined ? obj[idx] : (dflt || null);
  }
  
  if (typeof obj === "object") {
    if (obj[k] !== undefined) return obj[k];
    if (obj[":" + k] !== undefined) return obj[":" + k];
  }
  return dflt || null;
}
function _fl_first(l) { return (l && l.length > 0) ? l[0] : null; }
function _fl_last(l) { return (l && l.length > 0) ? l[l.length - 1] : null; }
function _fl_rest(l) { return (l && l.length > 0) ? l.slice(1) : []; }
function _fl_append(l, x) { return [...(l || []), x]; }
function _fl_concat(a, b) { return Array.isArray(a) && Array.isArray(b) ? [...a, ...b] : String(a || "") + String(b || ""); }
function _fl_keys(o) { return o ? Object.keys(o) : []; }
function _fl_values(o) { return o ? Object.values(o) : []; }
var _fl_entries = (o) => o ? Object.entries(o).map(([k,v]) => [k,v]) : [];
function _fl_map_set(o, ...args) { const result = {...(o || {})}; for (let i = 0; i + 1 < args.length; i += 2) { result[args[i]] = args[i + 1]; } return result; }
function _fl_has_key_q(o, k) { return o ? (String(k) in o) : false; }

// \u2500 \uBB38\uC790\uC5F4 \uC870\uC791 \u2500
function _fl_str(...xs) { return xs.map(x => x === null || x === undefined ? "" : (typeof x === "object" ? JSON.stringify(x) : String(x))).join(""); }
function _fl_char_at(s, i) { return (s && s[i]) || null; }
function _fl_substring(s, a, b) { return s ? (b === undefined ? s.slice(a) : s.slice(a, b)) : ""; }
function _fl_lower(s) { return String(s || "").toLowerCase(); }
function _fl_upper(s) { return String(s || "").toUpperCase(); }
function _fl_trim(s) { return String(s || "").trim(); }
function _fl_replace(s, a, b) { return String(s || "").split(a).join(b); }
function _fl_str_index_of(s, sub) { return (s || "").indexOf(sub); }
function _fl_contains_q(s, sub) { return (s || "").includes(sub); }
function _fl_str_to_num(s) { const n = Number(s); return isNaN(n) ? null : n; }
function _fl_join(arr, sep) { return (arr || []).join(sep !== undefined ? sep : ""); }
function _fl_split(s, sep) { return (s || "").split(sep !== undefined ? sep : ""); }
function _fl_repeat(s, n) { return (s || "").repeat(n || 0); }
function _fl_range(a, b, s) { let r = []; let start = b === undefined ? 0 : a; let end = b === undefined ? a : b; let step = s || 1; if (step > 0) { for (let i = start; i < end; i += step) r.push(i); } else { for (let i = start; i > end; i += step) r.push(i); } return r; }

// \u2500 \uACE0\uCC28 \uD568\uC218 (Null-safe & Spread) \u2500
function _fl_map(arr, fn) { return (arr || []).map(x => fn(x)); }
function _fl_filter(arr, fn) { return (arr || []).filter(x => { const r = fn(x); return r !== false && r !== null; }); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce((a, x) => fn(a, x), init); }

// \u2500 \uB370\uC774\uD130 \uC811\uADFC \uBC0F \uC870\uC791 \uBCF4\uC870 \u2500
function _fl_slice(l, a, b) { return (l || []).slice(a, b); }

// \u2500 \uC2DC\uC2A4\uD15C \uBC0F I/O \u2500
function _fl_print(v) { console.log(v); return v; }
function _fl_get_argv() { return (typeof process !== "undefined" ? process.argv.slice(2) : []); }
function _fl_file_read(p) { return require("fs").readFileSync(p, "utf8"); }
function _fl_file_write(p, c) { return require("fs").writeFileSync(p, c); }
function _fl_file_exists(p) { return require("fs").existsSync(p); }
function _fl_file_delete(p) { try { require("fs").unlinkSync(p); } catch(e) {} }
function _fl_file_append(p, c) { require("fs").appendFileSync(p, String(c)); }
function _fl_file_copy(s, d) { require("fs").copyFileSync(s, d); }
function _fl_file_rename(o, n) { require("fs").renameSync(o, n); }
function _fl_file_size(p) { try { return require("fs").statSync(p).size; } catch(e) { return 0; } }
function _fl_file_modified(p) { try { return require("fs").statSync(p).mtimeMs; } catch(e) { return 0; } }
function _fl_file_mkdir(p) { try { require("fs").mkdirSync(p, { recursive: true }); } catch(e) {} }
function _fl_file_rmdir(p) { try { require("fs").rmSync(p, { recursive: true, force: true }); } catch(e) {} }
function _fl_file_list(p) { try { return require("fs").readdirSync(p); } catch(e) { return []; } }
function _fl_process_run(cmd) { try { const {execSync}=require("child_process"); return execSync(cmd,{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_run_args(cmd, args) { try { const {execSync}=require("child_process"); return execSync(cmd+" "+(args||[]).join(" "),{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_exec(cmd) { try { const {execSync}=require("child_process"); return execSync(cmd,{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_exec_args(cmd, args) { try { const {execSync}=require("child_process"); return execSync(cmd+" "+(args||[]).join(" "),{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_spawn(cmd, args) { try { const {spawnSync}=require("child_process"); const r=spawnSync(cmd,args||[],{encoding:"utf8"}); return r.stdout||""; } catch(e) { return ""; } }
function _fl_run_inherit(cmd) { require("child_process").spawnSync(cmd,{shell:true,stdio:"inherit"}); }
function _fl_process_kill(pid) { try { process.kill(pid); } catch(e) {} }
function _fl_process_wait(pid) { return null; }
function _fl_env_get(k) { return process.env[k] || null; }
function _fl_env_set(k, v) { process.env[k] = String(v); }
function _fl_env_all() { return process.env; }
function _fl_file_is_file(p) { try { return require("fs").statSync(p).isFile(); } catch(e) { return false; } }
function _fl_file_is_dir(p) { try { return require("fs").statSync(p).isDirectory(); } catch(e) { return false; } }
function _fl_process_exists(pid) { try { process.kill(pid, 0); return true; } catch(e) { return false; } }
function _fl_process_getcwd() { return process.cwd(); }
function _fl_process_chdir(p) { try { process.chdir(p); } catch(e) {} }
function _fl_process_pid() { return process.pid; }
function _fl_process_ppid() { return process.ppid || null; }
function _fl_readline(prompt) {
  if (prompt) process.stdout.write(prompt);
  try {
    const fs = require("fs");
    const parts = [];
    const b = Buffer.alloc(1);
    while (true) {
      const n = fs.readSync(process.stdin.fd, b, 0, 1);
      if (n === 0) return parts.length === 0 ? null : parts.join("");
      const c = b[0];
      if (c === 10) break;
      if (c !== 13) parts.push(String.fromCharCode(c));
    }
    return parts.join("");
  } catch(e) { return null; }
}
function _fl_shell_capture(cmd) {
  try {
    const {execSync} = require("child_process");
    return {stdout: execSync(cmd, {encoding: "utf8"}), stderr: "", code: 0, ok: true};
  } catch(e) {
    return {stdout: "", stderr: String(e), code: 1, ok: false};
  }
}

// \u2500 \uD0C0\uC785 \u2500
function _fl_type_of(v) { if (v === null || v === undefined) return "nil"; if (Array.isArray(v)) return "list"; return typeof v; }

// \u2500 \uAE30\uD0C0 \u2500
function _while(condFn, bodyFn) { while(condFn()) { bodyFn(); } }

// \u2500 \uC2DC\uAC04 \u2500
const now_ms = () => Date.now();
const now_iso = () => new Date().toISOString();
const now_unix = () => Math.floor(Date.now() / 1000);

// \u2500 \uC178 \uC2E4\uD589 \u2500
const shell_exec = (cmd, inp) => { try { const {execSync} = require("child_process"); const opts = {encoding: "utf8"}; if (inp) opts["input"] = inp; return execSync(cmd, opts); } catch(e) { return ""; } };

// \u2500 \uC218\uD559 \u2500
var math_sqrt = (n) => Math.sqrt(n);
var math_pow = (a, b) => Math.pow(a, b);
var math_pi = Math.PI;
var round = (n) => Math.round(n);
var floor = (n) => Math.floor(n);
var ceil = (n) => Math.ceil(n);
var abs = (n) => Math.abs(n);
var min = (...args) => Math.min(...args);
var max = (...args) => Math.max(...args);

// \u2500 \uCEEC\uB809\uC158 \uD655\uC7A5 \u2500
function _fl_take(n, arr) { return (arr || []).slice(0, n); }
function _fl_drop(n, arr) { return (arr || []).slice(n); }
function _fl_zip(a, b) { const r = []; const l = Math.min((a || []).length, (b || []).length); for (let i = 0; i < l; i++) r.push([a[i], b[i]]); return r; }
function _fl_flatten(arr) { return (arr || []).flat(); }
function _fl_reverse(arr) { return Array.isArray(arr) ? [...arr].reverse() : arr; }
function _fl_sort(arr, fn) { return fn ? [...(arr || [])].sort((a, b) => fn(a, b) ? -1 : 1) : [...(arr || [])].sort(); }

// \u2500 \uBB38\uC790\uC5F4 \uACF5\uAC1C \uBCC4\uCE6D \u2500
var str_upper = (s) => String(s || "").toUpperCase();
var str_lower = (s) => String(s || "").toLowerCase();
var str_contains = (s, sub) => String(s || "").includes(String(sub || ""));
var str_replace = (s, a, b) => { if (s == null) return ""; return String(s).split(String(a || "")).join(String(b || "")); };
var str_starts_with = (s, p) => String(s || "").startsWith(String(p || ""));
var str_ends_with = (s, sf) => String(s || "").endsWith(String(sf || ""));
var str_trim = (s) => String(s || "").trim();
var str_length = (s) => String(s || "").length;
var str_split = (s, sep) => String(s || "").split(sep);

// \u2500 \uD0C0\uC785 \uD655\uC7A5 \u2500
var list_q = (v) => Array.isArray(v);
var map_q = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var fn_q = (v) => typeof v === "function";

// \u2500 IIFE \uD3F4\uBC31 \u2500
var unknown = (...a) => a[a.length - 1];

// \u2500 \uAE00\uB85C\uBC8C \uBC14\uC778\uB529 \u2500
let __argv__ = _fl_get_argv();

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
`.trim();
}
var HELPER_FUNCTIONS, HELPER_COUNT;
var init_runtime_helpers = __esm({
  "src/runtime-helpers.ts"() {
    HELPER_FUNCTIONS = [
      "_plus",
      "_minus",
      "_star",
      "_slash",
      "_gt",
      "_lt",
      "_eq",
      "_gt_eq",
      "_lt_eq",
      "_not",
      "_and",
      "_or",
      "_concat",
      "_fl_null_q",
      "_fl_true_q",
      "_fl_false_q",
      "_fl_number_q",
      "_fl_string_q",
      "_fl_list_q",
      "_fl_array_q",
      "_fl_map_q",
      "_fl_fn_q",
      "_fl_length",
      "_fl_get",
      "_fl_first",
      "_fl_last",
      "_fl_rest",
      "_fl_append",
      "_fl_concat",
      "_fl_keys",
      "_fl_values",
      "_fl_entries",
      "_fl_map_set",
      "_fl_has_key_q",
      "_fl_str",
      "_fl_char_at",
      "_fl_substring",
      "_fl_lower",
      "_fl_upper",
      "_fl_trim",
      "_fl_replace",
      "_fl_str_index_of",
      "_fl_contains_q",
      "_fl_str_to_num",
      "_fl_join",
      "_fl_split",
      "_fl_repeat",
      "_fl_range",
      "_fl_map",
      "_fl_filter",
      "_fl_reduce",
      "_fl_slice",
      "_fl_print",
      "_fl_get_argv",
      "_fl_file_read",
      "_fl_file_write",
      "_fl_file_exists",
      "_fl_shell_capture",
      "_fl_take",
      "_fl_drop",
      "_fl_zip",
      "_fl_flatten",
      "_fl_reverse",
      "_fl_sort"
    ];
    HELPER_COUNT = HELPER_FUNCTIONS.length;
  }
});

// src/codegen-js.ts
function flNameToJs(name) {
  if (BUILTIN_MAP[name]) {
    return BUILTIN_MAP[name];
  }
  const cleanName = name.replace(/^\$/, "");
  const encoded = cleanName.replace(/\?$/g, "_q").replace(/!/g, "_bang").replace(/>/g, "_gt").replace(/</g, "_lt").replace(/=/g, "_eq").replace(/\+/g, "_plus").replace(/\*/g, "_star").replace(/\//g, "_slash").replace(/-/g, "_");
  if (JS_RESERVED.has(encoded)) {
    return `_${encoded}`;
  }
  return encoded;
}
var DEFAULT_OPTIONS, FL_RUNTIME, BUILTIN_MAP, JS_RESERVED, JSCodegen;
var init_codegen_js = __esm({
  "src/codegen-js.ts"() {
    init_runtime_helpers();
    DEFAULT_OPTIONS = {
      module: "commonjs",
      runtime: false,
      minify: false,
      target: "node"
    };
    FL_RUNTIME = `
function _fl_map(arr, fn) { return (arr || []).map(fn); }
function _fl_filter(arr, fn) { return (arr || []).filter(fn); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce(fn, init); }
function _fl_print(v) { console.log(v); return v; }
`.trim();
    BUILTIN_MAP = {
      // 타입 체크
      "null?": "_fl_null_q",
      "nil?": "_fl_null_q",
      "cli-args": "_fl_get_argv",
      "file_read": "_fl_file_read",
      "file-read": "_fl_file_read",
      "file_write": "_fl_file_write",
      "file-write": "_fl_file_write",
      "file-exists": "_fl_file_exists",
      "file_exists": "_fl_file_exists",
      "readline": "_fl_readline",
      "read-line": "_fl_readline",
      "char_at": "_fl_char_at",
      "char-at": "_fl_char_at",
      "substring": "_fl_substring",
      "str-slice": "_fl_substring",
      "true?": "_fl_true_q",
      "false?": "_fl_false_q",
      "string?": "_fl_string_q",
      "number?": "_fl_number_q",
      "list?": "_fl_list_q",
      "array?": "_fl_array_q",
      "map?": "_fl_map_q",
      "fn?": "_fl_fn_q",
      "boolean?": "_fl_boolean_q",
      "type-of": "_fl_type_of",
      "empty?": "_fl_empty_q",
      // 문자 검증 (lexer 헬퍼)
      "is-digit?": "_fl_is_digit_q",
      "is-alpha?": "_fl_is_alpha_q",
      "is-alnum?": "_fl_is_alnum_q",
      "is-space?": "_fl_is_space_q",
      "is-symbol-char?": "_fl_is_symbol_char_q",
      // 기본 연산
      "map": "_fl_map",
      "filter": "_fl_filter",
      "reduce": "_fl_reduce",
      "first": "_fl_first",
      "last": "_fl_last",
      "rest": "_fl_rest",
      "append": "_fl_append",
      "concat": "_fl_concat",
      "slice": "_fl_slice",
      "take": "_fl_take",
      "drop": "_fl_drop",
      "zip": "_fl_zip",
      "flatten": "_fl_flatten",
      "reverse": "_fl_reverse",
      "sort": "_fl_sort",
      "length": "_fl_length",
      "range": "_fl_range",
      // 문자열
      "str": "_fl_str",
      "contains?": "_fl_contains_q",
      "str-contains": "_fl_contains_q",
      "str-includes": "_fl_contains_q",
      "str-to-num": "_fl_str_to_num",
      "parse-num": "_fl_str_to_num",
      "assoc": "_fl_map_set",
      "upper": "_fl_upper",
      "str-upper": "_fl_upper",
      "lower": "_fl_lower",
      "str-lower": "_fl_lower",
      "trim": "_fl_trim",
      "replace": "_fl_replace",
      "str-replace": "_fl_replace",
      "str-index-of": "_fl_str_index_of",
      "str_index_of": "_fl_str_index_of",
      "join": "_fl_join",
      "str-join": "_fl_join",
      "split": "_fl_split",
      "str-split": "_fl_split",
      "repeat": "_fl_repeat",
      "str-repeat": "_fl_repeat",
      // 맵/객체
      "get": "_fl_get",
      "json-parse": "JSON.parse",
      "json-stringify": "JSON.stringify",
      "json_parse": "JSON.parse",
      "json_stringify": "JSON.stringify",
      "keys": "_fl_keys",
      "json_keys": "_fl_keys",
      "values": "_fl_values",
      "map-keys": "_fl_keys",
      "map-values": "_fl_values",
      "map-set": "_fl_map_set",
      "json-set": "_fl_map_set",
      "json_set": "_fl_map_set",
      "has-key?": "_fl_has_key_q"
    };
    JS_RESERVED = /* @__PURE__ */ new Set([
      "abstract",
      "arguments",
      "await",
      "boolean",
      "break",
      "byte",
      "case",
      "catch",
      "char",
      "class",
      "const",
      "continue",
      "debugger",
      "default",
      "delete",
      "do",
      "double",
      "else",
      "enum",
      "eval",
      "export",
      "extends",
      "false",
      "final",
      "finally",
      "float",
      "for",
      "function",
      "goto",
      "if",
      "implements",
      "import",
      "in",
      "instanceof",
      "int",
      "interface",
      "let",
      "long",
      "native",
      "new",
      "null",
      "package",
      "private",
      "protected",
      "public",
      "return",
      "short",
      "static",
      "super",
      "switch",
      "synchronized",
      "this",
      "throw",
      "throws",
      "transient",
      "true",
      "try",
      "typeof",
      "var",
      "void",
      "volatile",
      "while",
      "with",
      "yield"
    ]);
    JSCodegen = class {
      constructor() {
        this.exportedNames = [];
        this.opts = { ...DEFAULT_OPTIONS };
      }
      generate(nodes, opts) {
        this.opts = { ...DEFAULT_OPTIONS, ...opts };
        this.exportedNames = [];
        const parts = [];
        parts.push(generateRuntimePreamble());
        parts.push("");
        if (this.opts.runtime) {
          parts.push(FL_RUNTIME);
          parts.push("");
        }
        const bodyParts = [];
        for (const node of nodes) {
          const code = this.genNode(node);
          if (code !== "") {
            bodyParts.push(code.endsWith(";") ? code : code + ";");
          }
        }
        parts.push(...bodyParts);
        if (this.exportedNames.length > 0) {
          if (this.opts.module === "commonjs") {
            const exports2 = this.exportedNames.map((n) => `  ${n}: ${n}`).join(",\n");
            parts.push(`module.exports = {
${exports2}
};`);
          } else if (this.opts.module === "esm") {
            const exports2 = this.exportedNames.join(", ");
            parts.push(`export { ${exports2} };`);
          }
        } else {
          if (this.opts.module === "commonjs") {
            if (bodyParts.some((p) => p.startsWith("function "))) {
              const funcNames = bodyParts.filter((p) => p.startsWith("function ")).map((p) => {
                const m = p.match(/^function\s+(\w+)/);
                return m ? m[1] : null;
              }).filter(Boolean);
              if (funcNames.length > 0) {
                const exportsStr = funcNames.map((n) => `  ${n}: ${n}`).join(",\n");
                parts.push(`module.exports = {
${exportsStr}
};`);
              }
            }
          }
        }
        const result = parts.join("\n");
        return this.opts.minify ? this.minify(result) : result;
      }
      genNode(node) {
        switch (node.kind) {
          case "literal":
            return this.genLiteral(node);
          case "template-string":
            return this.genTemplateString(node);
          case "variable":
            return this.genVariable(node);
          case "sexpr":
            return this.genSExpr(node);
          case "block":
            return this.genBlock(node);
          case "keyword":
            return this.genKeyword(node);
          case "try-block":
            return this.genTryBlock(node);
          default:
            return `/* unsupported: ${node.kind} */`;
        }
      }
      genLiteral(node) {
        if (node.type === "string") {
          return JSON.stringify(node.value);
        } else if (node.type === "boolean") {
          return node.value ? "true" : "false";
        } else if (node.type === "null") {
          return "null";
        } else if (node.type === "symbol") {
          if (node.value === "nil" || node.value === "null") {
            return "null";
          }
          const cleanName = String(node.value).replace(/^\$/, "");
          return flNameToJs(cleanName);
        } else {
          return String(node.value);
        }
      }
      genTemplateString(node) {
        const value = node.value;
        let jsCode = "`";
        let i = 0;
        while (i < value.length) {
          if (value[i] === "$" && value[i + 1] === "{") {
            const start = i + 2;
            const end = value.indexOf("}", start);
            if (end > start) {
              const expr = value.slice(start, end).trim();
              const jsExpr = this.genNode({ kind: "variable", name: expr });
              jsCode += "${" + jsExpr + "}";
              i = end + 1;
              continue;
            }
          }
          if (value[i] === "`") {
            jsCode += "\\`";
          } else if (value[i] === "\\") {
            jsCode += "\\\\";
          } else {
            jsCode += value[i];
          }
          i++;
        }
        jsCode += "`";
        return jsCode;
      }
      genVariable(node) {
        const cleanName = node.name.replace(/^\$/, "");
        return flNameToJs(cleanName);
      }
      genKeyword(node) {
        return JSON.stringify(node.name);
      }
      genSExpr(node) {
        const { op, args } = node;
        if (op === "and") {
          if (args.length === 0) return "true";
          return "(" + args.map((a) => this.genNode(a)).join(" && ") + ")";
        }
        if (op === "or") {
          if (args.length === 0) return "false";
          return "(" + args.map((a) => this.genNode(a)).join(" || ") + ")";
        }
        if (op === "cond") return this.genCond(args);
        if (op === "while") return this.genWhile(args);
        if (op === "->") {
          if (args.length === 0) return "null";
          let acc = this.genNode(args[0]);
          for (let i = 1; i < args.length; i++) {
            const step = args[i];
            if (step.kind === "sexpr") {
              const { op: fn, args: fnArgs } = step;
              const fnJs = flNameToJs(fn);
              const rest = fnArgs.map((a) => this.genNode(a));
              acc = `${fnJs}(${[acc, ...rest].join(", ")})`;
            } else {
              acc = `${this.genNode(step)}(${acc})`;
            }
          }
          return acc;
        }
        if (op === "->>") {
          if (args.length === 0) return "null";
          let acc = this.genNode(args[0]);
          for (let i = 1; i < args.length; i++) {
            const step = args[i];
            if (step.kind === "sexpr") {
              const { op: fn, args: fnArgs } = step;
              const fnJs = flNameToJs(fn);
              const rest = fnArgs.map((a) => this.genNode(a));
              acc = `${fnJs}(${[...rest, acc].join(", ")})`;
            } else {
              acc = `${this.genNode(step)}(${acc})`;
            }
          }
          return acc;
        }
        if (op === "recur") {
          const argStrs = args.map((a) => this.genNode(a));
          return `{ __recur: true, a: [${argStrs.join(", ")}] }`;
        }
        if (op === "loop") {
          const bindingsArg = args[0];
          const bodyExprs = args.slice(1);
          let items = [];
          if (bindingsArg.kind === "block" && bindingsArg.type === "Array") {
            items = bindingsArg.fields.get("items") || [];
          }
          const inits = [];
          const names = [];
          for (let i = 0; i < items.length; i += 2) {
            const nameNode = items[i];
            const valNode = items[i + 1];
            if (!nameNode) continue;
            const name = this.extractVarName(nameNode);
            const val = valNode ? this.genNode(valNode) : "null";
            const tmpName = `__fl_loop_${i}`;
            inits.push(`let ${tmpName} = ${val}; let ${name} = ${tmpName};`);
            names.push(name);
          }
          const bodyParts = bodyExprs.map((e) => this.genNode(e).trim()).filter((s) => s !== "");
          let bodyCode = "";
          if (bodyParts.length === 0) {
            bodyCode = "return null;";
          } else if (bodyParts.length === 1) {
            bodyCode = `return ${bodyParts[0]};`;
          } else {
            const stmts = bodyParts.slice(0, -1).map((s) => s.endsWith(";") ? s : s + ";");
            bodyCode = `${stmts.join(" ")} return ${bodyParts[bodyParts.length - 1]};`;
          }
          return `((() => { ${inits.join(" ")} while (true) { const __r = (() => { ${bodyCode} })(); if (__r && __r.__recur) { [${names.join(", ")}] = __r.a; continue; } return __r; } })())`;
        }
        if (op === "let") {
          if (args.length >= 2) {
            const bindingsArg = args[0];
            let bindings = [];
            if (bindingsArg.kind === "block" && bindingsArg.type === "Array") {
              bindings = bindingsArg.fields.get("items") || [];
            } else if (bindingsArg.kind === "sexpr") {
              bindings = bindingsArg.args;
            }
            const bindingStmts = [];
            const isNested = bindings.length > 0 && bindings[0].kind === "block" && bindings[0].type === "Array";
            if (isNested) {
              for (const binding of bindings) {
                if (binding.kind === "block" && binding.type === "Array") {
                  const pairItems = binding.fields.get("items") || [];
                  if (pairItems.length >= 2) {
                    const varName = this.extractVarName(pairItems[0]);
                    const value = this.genNode(pairItems[1]);
                    bindingStmts.push(`let ${varName} = ${value};`);
                  }
                }
              }
            } else {
              for (let i = 0; i < bindings.length; i += 2) {
                if (!bindings[i]) continue;
                const varName = this.extractVarName(bindings[i]);
                const value = bindings[i + 1] ? this.genNode(bindings[i + 1]) : "null";
                bindingStmts.push(`let ${varName} = ${value};`);
              }
            }
            const bodyParts = args.slice(1).map((a) => this.genNode(a).trim()).filter((s) => s !== "");
            let bodyCode = "";
            if (bodyParts.length === 0) {
              bodyCode = "return null;";
            } else if (bodyParts.length === 1) {
              bodyCode = `return ${bodyParts[0]};`;
            } else {
              const stmts = bodyParts.slice(0, -1).map((s) => s.endsWith(";") ? s : s + ";");
              bodyCode = `${stmts.join(" ")} return ${bodyParts[bodyParts.length - 1]};`;
            }
            return `((() => { ${bindingStmts.join(" ")} ${bodyCode} })())`;
          }
          return "(() => null)()";
        }
        if (op === "do") return this.genDo(args);
        const BINARY_OPS = {
          "+": "+",
          "-": "-",
          "*": "*",
          "/": "/",
          "%": "%",
          "<": "<",
          ">": ">",
          "<=": "<=",
          ">=": ">=",
          "==": "===",
          "!=": "!==",
          "=": "==="
        };
        if (op in BINARY_OPS && args.length === 2) {
          const left = this.genNode(args[0]);
          const right = this.genNode(args[1]);
          return `(${left} ${BINARY_OPS[op]} ${right})`;
        }
        if (op === "-" && args.length === 1) {
          return `(-${this.genNode(args[0])})`;
        }
        if (op === "not" && args.length === 1) {
          return `(!${this.genNode(args[0])})`;
        }
        if (op === "if") {
          const cond = this.genNode(args[0]);
          const thenExpr = this.genNode(args[1]);
          const elseExpr = args[2] ? this.genNode(args[2]) : "undefined";
          return `(${cond} ? ${thenExpr} : ${elseExpr})`;
        }
        if (op === "define") {
          const varName = this.extractVarName(args[0]);
          const value = this.genNode(args[1]);
          return `const ${varName} = ${value};`;
        }
        if (op === "set!") {
          const varName = this.extractVarName(args[0]);
          const value = this.genNode(args[1]);
          return `(${varName} = ${value})`;
        }
        if (op === "defn" || op === "defun") {
          const name = this.extractVarName(args[0]);
          const { params, preamble } = this.extractParamListWithDestructuring(args[1]);
          const bodyNode = args[2];
          const body = bodyNode ? this.genNode(bodyNode) : "null";
          const finalBody = preamble ? `((() => { ${preamble} return ${body}; })())` : body;
          return `const ${name} = (${params.join(", ")}) => ${finalBody}`;
        }
        if (op === "fn") return this.genFn(args);
        if (op === "list") {
          const elements = args.map((a) => this.genNode(a));
          return `[${elements.join(", ")}]`;
        }
        if (op === "str-concat") {
          const parts = args.map((a) => this.genNode(a));
          return `('' + ${parts.join(" + ")})`;
        }
        if (op === "print" || op === "println") {
          const arg = args.length > 0 ? this.genNode(args[0]) : '""';
          return `_fl_print(${arg})`;
        }
        if (op === "map") return `_fl_map(${this.genNode(args[1])}, ${this.genNode(args[0])})`;
        if (op === "filter") return `_fl_filter(${this.genNode(args[1])}, ${this.genNode(args[0])})`;
        if (op === "reduce") return `_fl_reduce(${this.genNode(args[2])}, ${this.genNode(args[0])}, ${this.genNode(args[1])})`;
        if (op === "export") {
          for (const arg of args) {
            if (arg.kind === "variable") {
              this.exportedNames.push(arg.name);
            } else if (arg.kind === "literal" && typeof arg.value === "string") {
              this.exportedNames.push(arg.value);
            }
          }
          return "";
        }
        if (op === "let") {
          if (args.length >= 2) {
            const bindingsArg = args[0];
            let bindings = [];
            if (bindingsArg.kind === "block" && bindingsArg.type === "Array") {
              bindings = bindingsArg.fields.get("items") || [];
            } else if (bindingsArg.kind === "sexpr") {
              bindings = bindingsArg.args;
            }
            const bindingStmts = [];
            const isFlat = bindings.length > 0 && !(bindings[0].kind === "block" && bindings[0].type === "Array");
            if (isFlat) {
              for (let i = 0; i < bindings.length - 1; i += 2) {
                const varName2 = this.extractVarName(bindings[i]);
                const value2 = this.genNode(bindings[i + 1]);
                bindingStmts.push(`let ${varName2} = ${value2};`);
              }
            } else {
              for (const binding of bindings) {
                if (binding.kind === "block" && binding.type === "Array") {
                  const pairItems = binding.fields.get("items") || [];
                  if (pairItems.length >= 2) {
                    const varName2 = this.extractVarName(pairItems[0]);
                    const value2 = this.genNode(pairItems[1]);
                    bindingStmts.push(`let ${varName2} = ${value2};`);
                  }
                }
              }
            }
            const bodyStmts = args.slice(1).map((a) => this.genNode(a)).join("; ");
            return `(() => { ${bindingStmts.join(" ")} return ${bodyStmts}; })()`;
          }
          const varName = this.extractVarName(args[0]);
          const value = args[1] ? this.genNode(args[1]) : "undefined";
          return `(() => { let ${varName} = ${value}; return ${varName}; })()`;
        }
        return this.genFuncCall(op, args);
      }
      genDo(args) {
        if (args.length === 0) return "(() => undefined)()";
        if (args.length === 1) return `(() => ${this.genNode(args[0])})()`;
        const stmts = args.slice(0, -1).map((a) => {
          const c = this.genNode(a).trim();
          return c === "" || c.endsWith(";") ? c : c + ";";
        }).filter((s) => s !== "");
        const last = this.genNode(args[args.length - 1]);
        return `(() => { ${stmts.join(" ")} return ${last}; })()`;
      }
      genCond(args) {
        if (args.length === 0) return "null";
        let isNested = false;
        if (args[0].kind === "block" && args[0].type === "Array") {
          const items = args[0].fields.get("items");
          if (Array.isArray(items) && items.length >= 1) {
            isNested = true;
          }
        }
        let pairs;
        if (isNested) {
          pairs = args.map((arg) => {
            if (arg.kind === "block" && arg.type === "Array") {
              const items = arg.fields.get("items") || [];
              return [items[0], items[1]];
            }
            return [arg, null];
          });
        } else {
          pairs = [];
          for (let i = 0; i < args.length - 1; i += 2) {
            pairs.push([args[i], args[i + 1]]);
          }
          if (args.length % 2 === 1) {
            pairs.push([{ kind: "literal", type: "boolean", value: true }, args[args.length - 1]]);
          }
        }
        let res = "null";
        for (let i = pairs.length - 1; i >= 0; i--) {
          const [testNode, bodyNode] = pairs[i];
          if (!testNode) continue;
          const test = this.genNode(testNode);
          const body = bodyNode ? this.genNode(bodyNode) : "null";
          res = "(" + test + " ? " + body + " : " + res + ")";
        }
        return res;
      }
      genWhile(args) {
        const cond = this.genNode(args[0]);
        const bodyParts = args.slice(1).map((a) => this.genNode(a).trim()).filter((s) => s !== "");
        const bodyCode = bodyParts.map((s) => s.endsWith(";") ? s : s + ";").join(" ");
        return "(() => { while(" + cond + ") { " + bodyCode + " } })()";
      }
      genFn(args) {
        const { params, preamble } = this.extractParamListWithDestructuring(args[0]);
        let body;
        if (args.length <= 1) {
          body = "undefined";
        } else if (args.length === 2) {
          body = this.genNode(args[1]);
        } else {
          const bodyNodes = args.slice(1);
          const stmts = bodyNodes.slice(0, -1).map((n) => this.genNode(n) + ";").join(" ");
          const last = this.genNode(bodyNodes[bodyNodes.length - 1]);
          body = `((() => { ${stmts} return ${last}; })())`;
        }
        const finalBody = preamble ? `((() => { ${preamble} return ${body}; })())` : body;
        return `((${params.join(", ")}) => ${finalBody})`;
      }
      extractParamListWithDestructuring(node) {
        if (!node) return { params: [], preamble: "" };
        let pNodes = node.kind === "block" && node.type === "Array" ? node.fields.get("items") : node.kind === "sexpr" ? node.args : [node];
        const params = [];
        const bindingStmts = [];
        let tmpCount = 0;
        for (const p of pNodes || []) {
          if (p.kind === "variable") {
            params.push(flNameToJs(p.name.replace(/^\$/, "")));
          } else if (p.kind === "literal" && (p.type === "symbol" || typeof p.value === "string")) {
            params.push(flNameToJs(String(p.value).replace(/^\$/, "")));
          } else if (p.kind === "block" && p.type === "Array") {
            const tmpName = `_arg${tmpCount++}`;
            params.push(tmpName);
            const subItems = p.fields.get("items") || [];
            for (let i = 0; i < subItems.length; i++) {
              const sub = subItems[i];
              if (sub.kind === "variable") {
                const varName = flNameToJs(sub.name.replace(/^\$/, ""));
                bindingStmts.push(`let ${varName} = ${tmpName}[${i}];`);
              } else if (sub.kind === "literal" && (sub.type === "symbol" || typeof sub.value === "string")) {
                const varName = flNameToJs(String(sub.value).replace(/^\$/, ""));
                bindingStmts.push(`let ${varName} = ${tmpName}[${i}];`);
              }
            }
          } else {
            params.push("p");
          }
        }
        return { params, preamble: bindingStmts.join(" ") };
      }
      extractVarName(node) {
        if (node.kind === "variable") return flNameToJs(node.name.replace(/^\$/, ""));
        if (node.kind === "literal" && typeof node.value === "string") return flNameToJs(node.value);
        return "unknown";
      }
      extractParamList(node) {
        if (!node) return [];
        let pNodes = node.kind === "block" && node.type === "Array" ? node.fields.get("items") : node.kind === "sexpr" ? node.args : [node];
        return (pNodes || []).map((p) => (p.name || String(p.value || "p")).replace(/^\\$/, "")).map((n) => flNameToJs(n));
      }
      extractBlockParams(node) {
        const params = node.fields.get("params");
        if (!params) return [];
        let pNodes = Array.isArray(params) ? params : params.kind === "block" && params.type === "Array" ? params.fields.get("items") : [params];
        return (pNodes || []).map((p) => (p.name || String(p.value || "p")).replace(/^\\$/, "")).map((n) => flNameToJs(n));
      }
      genFuncCall(op, args) {
        const argStrs = args.map((a) => this.genNode(a));
        const jsOp = flNameToJs(op);
        return `${jsOp}(${argStrs.join(", ")})`;
      }
      genBlock(node) {
        switch (node.type) {
          case "FUNC":
            return this.genFuncBlock(node);
          case "MODULE":
            return this.genModuleBlock(node);
          case "SERVICE":
            return this.genServiceBlock(node);
          case "MODEL":
            return this.genModelBlock(node);
          case "CONTROLLER":
            return this.genControllerBlock(node);
          case "MAP":
          case "Map":
            return this.genMapBlock(node);
          case "ARRAY":
          case "Array":
            return this.genArrayBlock(node);
          default:
            return `/* unsupported block: ${node.type} */`;
        }
      }
      genMapBlock(node) {
        const pairs = [];
        node.fields.forEach((val, key) => {
          const jsKey = key.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) ? key : JSON.stringify(key);
          pairs.push(jsKey + ": " + this.genNode(val));
        });
        return "({ " + pairs.join(", ") + " })";
      }
      genArrayBlock(node) {
        const items = node.fields.get("items");
        let pNodes = Array.isArray(items) ? items : items && items.kind === "block" ? items.fields.get("items") : [];
        const elements = (pNodes || []).map((a) => this.genNode(a));
        return "[" + elements.join(", ") + "]";
      }
      genFuncBlock(node) {
        const params = this.extractBlockParams(node);
        const body = node.fields.get("body");
        const bodyCode = body ? this.genNode(body) : "undefined";
        const jsName = this.flNameToJs(node.name);
        return `function ${jsName}(${params.join(", ")}) { return ${bodyCode}; }`;
      }
      flNameToJs(name) {
        return flNameToJs(name);
      }
      genModuleBlock(node) {
        const body = node.fields.get("body");
        if (!body) return "";
        if (Array.isArray(body)) return body.map((n) => this.genNode(n)).join("\n");
        return this.genNode(body);
      }
      genServiceBlock(node) {
        const name = node.name;
        const methods = node.fields.get("methods");
        const inject = node.fields.get("inject");
        const injectParams = inject ? Array.isArray(inject) ? inject.map((dep) => `private ${dep.name || dep}: ${dep.name || dep}`).join(", ") : "" : "";
        let methodsCode = "";
        if (methods && methods.kind === "sexpr") {
          methodsCode = methods.args.map((arg) => {
            if (arg.kind === "sexpr" && arg.op === "fn") {
              const fnExpr = arg;
              const fnName = fnExpr.args[0].name || fnExpr.args[0].value || "method";
              const fnParams = this.extractParamList(fnExpr.args[1]).map((p) => p.replace(/^\$/, "")).join(", ");
              const fnBody = fnExpr.args[2] ? this.genNode(fnExpr.args[2]) : "undefined";
              return `  ${fnName}(${fnParams}) { return ${fnBody}; }`;
            }
            return "";
          }).filter(Boolean).join("\n");
        }
        return [`export class ${name} {`, injectParams ? `  constructor(${injectParams}) {}` : `  constructor() {}`, methodsCode, `}`].join("\n");
      }
      genModelBlock(node) {
        const name = node.name;
        const table = node.fields.get("table") || name.toLowerCase() + "s";
        const fields = node.fields.get("fields");
        let sqlColumns = "  id SERIAL PRIMARY KEY";
        if (fields && fields.kind === "sexpr") {
          for (const arg of fields.args) {
            if (arg.kind === "sexpr") {
              const fName = arg.op.replace(/^[\$:]/, "").replace(/-/g, "_");
              sqlColumns += `,
  ${fName} VARCHAR(255)`;
            }
          }
        }
        return [`CREATE TABLE IF NOT EXISTS ${table} (`, sqlColumns, `,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`].join("\n");
      }
      genControllerBlock(node) {
        const prefix = node.fields.get("prefix") || "/";
        const routes = node.fields.get("routes");
        let routeCode = "";
        if (routes && routes.kind === "sexpr") {
          const sExpr = routes;
          for (let i = 0; i < sExpr.args.length; i += 3) {
            const method = String(sExpr.args[i].value || "GET").toLowerCase();
            const route = String(sExpr.args[i + 1].value || "/");
            routeCode += `router.${method}("${prefix === "/" ? route : prefix + route}", async (req, res) => { res.json({ status: 200 }); });
`;
          }
        }
        return [`import { Router } from "express";`, `export const router = Router();`, routeCode].join("\n");
      }
      genTryBlock(node) {
        const body = this.genNode(node.body);
        const parts = [`(()=>{try{return ${body};}`];
        if (node.catchClauses) {
          for (const cc of node.catchClauses) {
            parts.push(`catch(${cc.variable || "err"}){return ${this.genNode(cc.handler)};}`);
          }
        }
        if (node.finallyBlock) parts.push(`finally{${this.genNode(node.finallyBlock)};}`);
        return parts.join("") + "})()";
      }
      minify(code) {
        return code.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, " ").trim();
      }
    };
  }
});

// src/stdlib-compile.ts
var stdlib_compile_exports = {};
__export(stdlib_compile_exports, {
  createCompileModule: () => createCompileModule
});
function createCompileModule() {
  const cg = new JSCodegen();
  return {
    // fl_compile_file(inputPath, outputPath) → boolean
    // Compile a single .fl file to JavaScript
    "fl_compile_file": (inputPath, outputPath) => {
      try {
        const source = fs3.readFileSync(inputPath, "utf-8");
        const tokens = lex(source);
        const ast = parse(tokens);
        const js = cg.generate(ast, {
          module: "commonjs",
          runtime: false,
          minify: false,
          target: "node"
        });
        const dir = path5.dirname(outputPath);
        if (dir !== "." && !fs3.existsSync(dir)) {
          fs3.mkdirSync(dir, { recursive: true });
        }
        fs3.writeFileSync(outputPath, js, "utf-8");
        return true;
      } catch (err) {
        throw new Error(`fl_compile_file failed for '${inputPath}': ${err.message}`);
      }
    },
    // fl_compile(srcDir, distDir) → { compiled: number, failed: number, errors: string[] }
    // Compile all .fl files in a directory
    "fl_compile": (srcDir, distDir) => {
      try {
        const absDir = path5.resolve(srcDir);
        const absOut = path5.resolve(distDir);
        const files = fs3.readdirSync(absDir).filter((f) => f.endsWith(".fl")).map((f) => path5.join(absDir, f));
        let compiled = 0;
        let failed = 0;
        const errors = [];
        for (const file of files) {
          const outFile = path5.join(absOut, path5.basename(file, ".fl") + ".js");
          try {
            const source = fs3.readFileSync(file, "utf-8");
            const tokens = lex(source);
            const ast = parse(tokens);
            const js = cg.generate(ast, {
              module: "commonjs",
              runtime: false,
              minify: false,
              target: "node"
            });
            const dir = path5.dirname(outFile);
            if (dir !== "." && !fs3.existsSync(dir)) {
              fs3.mkdirSync(dir, { recursive: true });
            }
            fs3.writeFileSync(outFile, js, "utf-8");
            compiled++;
          } catch (err) {
            failed++;
            errors.push(`${path5.basename(file)}: ${err.message}`);
          }
        }
        return { compiled, failed, errors };
      } catch (err) {
        throw new Error(`fl_compile failed for '${srcDir}': ${err.message}`);
      }
    },
    // fl_compile_result_ok(result) → boolean
    // Check if compilation result is successful (no failures)
    "fl_compile_result_ok": (result) => {
      return result.failed === 0;
    }
  };
}
var fs3, path5;
var init_stdlib_compile = __esm({
  "src/stdlib-compile.ts"() {
    fs3 = __toESM(require("fs"));
    path5 = __toESM(require("path"));
    init_lexer();
    init_parser();
    init_codegen_js();
  }
});

// src/stdlib-registry.ts
var stdlib_registry_exports = {};
__export(stdlib_registry_exports, {
  createRegistryModule: () => createRegistryModule
});
function createRegistryModule() {
  const registryUrl = process.env.REGISTRY_URL || "http://localhost:4873";
  return {
    // registry_publish(name, version, files) → {published: true}
    "registry_publish": (name, version, files) => {
      try {
        const body = JSON.stringify(files);
        const response = httpRequest("PUT", `${registryUrl}/${name}/${version}`, body);
        return response;
      } catch (err) {
        throw new Error(`registry_publish failed: ${err.message}`);
      }
    },
    // registry_search(query) → [{name, latest, description}]
    "registry_search": (query) => {
      try {
        const response = httpRequest("GET", `${registryUrl}/search?q=${encodeURIComponent(query)}`, "");
        return typeof response === "string" ? JSON.parse(response) : response;
      } catch (err) {
        throw new Error(`registry_search failed: ${err.message}`);
      }
    },
    // registry_info(name) → {name, latest, versions: {}}
    "registry_info": (name) => {
      try {
        const response = httpRequest("GET", `${registryUrl}/${name}`, "");
        return typeof response === "string" ? JSON.parse(response) : response;
      } catch (err) {
        throw new Error(`registry_info failed: ${err.message}`);
      }
    },
    // registry_delete(name, version) → {deleted: true}
    "registry_delete": (name, version) => {
      try {
        const response = httpRequest("DELETE", `${registryUrl}/${name}/${version}`, "");
        return response;
      } catch (err) {
        throw new Error(`registry_delete failed: ${err.message}`);
      }
    },
    // registry_start(port) → {port, running: true}
    "registry_start": (port = 4873) => {
      try {
        return { port, running: true, message: "Registry started" };
      } catch (err) {
        throw new Error(`registry_start failed: ${err.message}`);
      }
    }
  };
}
function httpRequest(method, url2, body) {
  try {
    const { execSync: execSync2 } = require("child_process");
    const cmd = `curl -s -X ${method} ${body ? `-d '${body}'` : ""} "${url2}"`;
    const result = execSync2(cmd, { encoding: "utf-8" });
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  } catch (err) {
    throw new Error(`HTTP ${method} ${url2} failed: ${err.message}`);
  }
}
var init_stdlib_registry = __esm({
  "src/stdlib-registry.ts"() {
  }
});

// src/stdlib-db.ts
function getDatabaseSync() {
  if (!_DatabaseSync) _DatabaseSync = eval("require")("node:sqlite").DatabaseSync;
  return _DatabaseSync;
}
function kimdbReq(method, path7, body) {
  const toSerializable2 = (obj) => {
    if (obj instanceof Map) return Object.fromEntries(obj);
    if (Array.isArray(obj)) return obj.map(toSerializable2);
    if (typeof obj === "object" && obj !== null) {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = toSerializable2(v);
      }
      return result;
    }
    return obj;
  };
  const url2 = `${KIMDB}${path7}`;
  const args = ["-sf", "--max-time", "5"];
  if (method !== "GET") {
    args.push("-X", method);
    if (body !== void 0) {
      args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(toSerializable2(body)));
    }
  }
  args.push(url2);
  const r = (0, import_child_process5.spawnSync)("curl", args, { timeout: 6e3 });
  if (r.error) throw new Error(`kimdb request failed: ${r.error.message}`);
  const raw = r.stdout?.toString().trim() ?? "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
function getDb(dbPath) {
  if (!dbConnections.has(dbPath)) {
    dbConnections.set(dbPath, new (getDatabaseSync())(dbPath));
  }
  return dbConnections.get(dbPath);
}
function toPlain(row) {
  if (!row) return row;
  return Object.assign({}, row);
}
function spreadParams(p) {
  if (Array.isArray(p)) return p;
  if (p !== null && p !== void 0) return [p];
  return [];
}
function validateIdentifier(name) {
  if (typeof name !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    throw new Error(`\uC798\uBABB\uB41C SQL \uC2DD\uBCC4\uC790: '${name}'`);
  return name;
}
function buildWhere(where) {
  if (typeof where === "string")
    throw new Error(`db WHERE \uC808\uC5D0 \uBB38\uC790\uC5F4 \uAE08\uC9C0 \u2014 Map\uC73C\uB85C \uC804\uB2EC\uD558\uC138\uC694. \uC608: {:id 1} \uB610\uB294 {"status" "active"}`);
  if (!where) return { sql: "", params: [] };
  const obj = where instanceof Map ? Object.fromEntries(where) : where;
  const parts = [];
  const params = [];
  for (const [k, v] of Object.entries(obj)) {
    const m = k.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([><=!]+)?$/);
    if (!m) throw new Error(`\uC798\uBABB\uB41C WHERE \uD0A4: '${k}'`);
    const col = m[1];
    const op = m[2] || "=";
    if (v === null || v === void 0) {
      parts.push(op === "!=" ? `${col} IS NOT NULL` : `${col} IS NULL`);
    } else {
      parts.push(`${col} ${op} ?`);
      params.push(v);
    }
  }
  return { sql: parts.length ? "WHERE " + parts.join(" AND ") : "", params };
}
function createDbModule() {
  return {
    // ── kimdb (REST API) ─────────────────────────────────────
    // db_get collection id -> data or null
    "db_get": (collection, id) => {
      try {
        const r = kimdbReq("GET", `/api/c/${collection}/${id}`);
        return r?.data ?? r ?? null;
      } catch {
        return null;
      }
    },
    // db_all collection -> array
    "db_all": (collection) => {
      try {
        const r = kimdbReq("GET", `/api/c/${collection}`);
        return Array.isArray(r) ? r : r?.data ?? [];
      } catch {
        return [];
      }
    },
    // db_put collection id data -> saved data
    "db_put": (collection, id, data) => {
      const r = kimdbReq("PUT", `/api/c/${collection}/${id}`, data);
      return r?.data ?? r;
    },
    // db_delete collection id -> boolean
    "db_delete": (collection, id) => {
      try {
        kimdbReq("DELETE", `/api/c/${collection}/${id}`);
        return true;
      } catch {
        return false;
      }
    },
    // db_project name -> project data or null  (kimdb shorthand)
    "db_project": (name) => {
      try {
        const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "");
        const r = kimdbReq("GET", `/api/c/projects/${safe}`);
        return r?.data ?? r ?? null;
      } catch {
        return null;
      }
    },
    // db_projects -> project list
    "db_projects": () => {
      try {
        const r = kimdbReq("GET", "/api/c/projects");
        return Array.isArray(r) ? r : r?.data ?? [];
      } catch {
        return [];
      }
    },
    // ── SQLite ───────────────────────────────────────────────
    // db_query dbPath sql params -> rows (JSON array)
    "db_query": (dbPath, sql, params = []) => {
      const db = getDb(dbPath);
      const p = spreadParams(params);
      return db.prepare(sql).all(...p).map(toPlain);
    },
    // db_exec dbPath sql [params] -> ""
    "db_exec": (dbPath, sql, params = []) => {
      const db = getDb(dbPath);
      const p = spreadParams(params);
      db.prepare(sql).run(...p);
      return "";
    },
    // db_insert dbPath table data -> true
    "db_insert": (dbPath, table, data) => {
      const db = getDb(dbPath);
      validateIdentifier(table);
      const keys = Object.keys(data).map(validateIdentifier);
      const placeholders = keys.map(() => "?").join(",");
      db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders})`).run(...Object.values(data));
      return true;
    },
    // db_update dbPath table data where -> true
    // where: Map 또는 객체 — 예: {:id 1} {"status" "active"}
    "db_update": (dbPath, table, data, where) => {
      const db = getDb(dbPath);
      validateIdentifier(table);
      const keys = Object.keys(data).map(validateIdentifier);
      const sets = keys.map((k) => `${k}=?`).join(", ");
      const { sql: whereSql, params: whereParams } = buildWhere(where);
      db.prepare(`UPDATE ${table} SET ${sets} ${whereSql}`).run(...Object.values(data), ...whereParams);
      return true;
    },
    // db_delete_row dbPath table where -> true
    // where: Map 또는 객체 — 예: {:id 1} {"status" "inactive"}
    "db_delete_row": (dbPath, table, where) => {
      validateIdentifier(table);
      const { sql: whereSql, params } = buildWhere(where);
      getDb(dbPath).prepare(`DELETE FROM ${table} ${whereSql}`).run(...params);
      return true;
    },
    // db_count dbPath table -> number
    "db_count": (dbPath, table) => {
      validateIdentifier(table);
      const row = toPlain(getDb(dbPath).prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get());
      return Number(row?.cnt ?? 0);
    },
    // db_tables dbPath -> string[]
    "db_tables": (dbPath) => {
      return getDb(dbPath).prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => toPlain(r).name);
    },
    // db_create dbPath sql -> true
    "db_create": (dbPath, sql) => {
      getDb(dbPath).exec(sql);
      return true;
    },
    // db_close dbPath -> true
    "db_close": (dbPath) => {
      if (dbConnections.has(dbPath)) {
        dbConnections.get(dbPath).close();
        dbConnections.delete(dbPath);
      }
      return true;
    }
  };
}
var import_child_process5, _DatabaseSync, KIMDB, dbConnections;
var init_stdlib_db = __esm({
  "src/stdlib-db.ts"() {
    import_child_process5 = require("child_process");
    _DatabaseSync = null;
    KIMDB = process.env.KIMDB_URL || "http://localhost:40000";
    dbConnections = /* @__PURE__ */ new Map();
  }
});

// src/stdlib-orm.ts
var stdlib_orm_exports = {};
__export(stdlib_orm_exports, {
  createOrmModule: () => createOrmModule
});
function createOrmModule() {
  const models = /* @__PURE__ */ new Map();
  const dbModule = createDbModule();
  return {
    // orm_define_model(name, table, fields, indexes) → model
    "orm_define_model": (name, table, fields, indexes) => {
      try {
        const modelDef = {
          name,
          table,
          fields: fields || [],
          indexes: indexes || []
        };
        models.set(name, modelDef);
        const sql = generateCreateTableSQL(name, table, fields);
        return {
          name,
          table,
          fields: fields.length,
          indexes: (indexes || []).length,
          sql
        };
      } catch (err) {
        throw new Error(`orm_define_model failed: ${err.message}`);
      }
    },
    // orm_migrate(model) → 테이블 생성
    "orm_migrate": (modelName) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        const sql = generateCreateTableSQL(modelName, model.table, model.fields);
        return true;
      } catch (err) {
        throw new Error(`orm_migrate failed: ${err.message}`);
      }
    },
    // orm_create(model, data) → {id, ...}
    "orm_create": (modelName, data) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        validateData(model, data);
        const id = Math.floor(Math.random() * 1e6);
        return { id, ...data, created_at: (/* @__PURE__ */ new Date()).toISOString() };
      } catch (err) {
        throw new Error(`orm_create failed: ${err.message}`);
      }
    },
    // orm_find(model, id) → record or null
    "orm_find": (modelName, id) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return { id, model: modelName };
      } catch (err) {
        throw new Error(`orm_find failed: ${err.message}`);
      }
    },
    // orm_find_by(model, field, value) → record or null
    "orm_find_by": (modelName, field, value) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return { [field]: value, model: modelName };
      } catch (err) {
        throw new Error(`orm_find_by failed: ${err.message}`);
      }
    },
    // orm_where(model, conditions) → [records]
    "orm_where": (modelName, conditions) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return [{ ...conditions, model: modelName }];
      } catch (err) {
        throw new Error(`orm_where failed: ${err.message}`);
      }
    },
    // orm_update(model, id, data) → updated record
    "orm_update": (modelName, id, data) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        validateData(model, data);
        return { id, ...data, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      } catch (err) {
        throw new Error(`orm_update failed: ${err.message}`);
      }
    },
    // orm_delete(model, id) → boolean
    "orm_delete": (modelName, id) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return true;
      } catch (err) {
        throw new Error(`orm_delete failed: ${err.message}`);
      }
    },
    // orm_all(model) → [records]
    "orm_all": (modelName) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return [];
      } catch (err) {
        throw new Error(`orm_all failed: ${err.message}`);
      }
    },
    // orm_count(model) → number
    "orm_count": (modelName) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }
        return 0;
      } catch (err) {
        throw new Error(`orm_count failed: ${err.message}`);
      }
    },
    // orm_get_model(name) → model definition
    "orm_get_model": (modelName) => {
      try {
        const model = models.get(modelName);
        if (!model) {
          return null;
        }
        return model;
      } catch (err) {
        throw new Error(`orm_get_model failed: ${err.message}`);
      }
    }
  };
}
function generateCreateTableSQL(modelName, table, fields) {
  const columns = fields.map((field) => {
    let sql = `${field.name} `;
    if (field.type === "integer") sql += "INTEGER";
    else if (field.type === "string") sql += "TEXT";
    else if (field.type === "datetime") sql += "DATETIME DEFAULT CURRENT_TIMESTAMP";
    else sql += "TEXT";
    if (field.primaryKey) sql += " PRIMARY KEY AUTOINCREMENT";
    if (field.unique) sql += " UNIQUE";
    if (field.required) sql += " NOT NULL";
    return sql;
  });
  return `CREATE TABLE IF NOT EXISTS ${table} (
  ${columns.join(",\n  ")}
);`;
}
function validateData(model, data) {
  for (const field of model.fields) {
    if (field.required && data[field.name] === void 0) {
      throw new Error(`Field '${field.name}' is required`);
    }
    if (field.type === "integer" && data[field.name] !== void 0 && typeof data[field.name] !== "number") {
      throw new Error(`Field '${field.name}' must be integer`);
    }
  }
}
var init_stdlib_orm = __esm({
  "src/stdlib-orm.ts"() {
    init_stdlib_db();
  }
});

// src/stdlib-validation.ts
var stdlib_validation_exports = {};
__export(stdlib_validation_exports, {
  createValidationModule: () => createValidationModule
});
function createValidationModule() {
  const schemas = /* @__PURE__ */ new Map();
  return {
    // schema_define(name, fields) → schema
    "schema_define": (name, fields) => {
      try {
        const schema = { name, fields };
        schemas.set(name, schema);
        return schema;
      } catch (err) {
        throw new Error(`schema_define failed: ${err.message}`);
      }
    },
    // schema_validate(schema, data) → {valid: boolean, errors: []}
    "schema_validate": (schemaName, data) => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }
        const errors = [];
        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule);
          errors.push(...fieldErrors);
        }
        return {
          valid: errors.length === 0,
          errors,
          data: errors.length === 0 ? data : null
        };
      } catch (err) {
        throw new Error(`schema_validate failed: ${err.message}`);
      }
    },
    // schema_is_valid(schema, data) → boolean
    "schema_is_valid": (schemaName, data) => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          return false;
        }
        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const errors = validateField(fieldName, value, rule);
          if (errors.length > 0) {
            return false;
          }
        }
        return true;
      } catch (err) {
        return false;
      }
    },
    // schema_validate_or_throw(schema, data) → data or throws error
    "schema_validate_or_throw": (schemaName, data) => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }
        const errors = [];
        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule);
          errors.push(...fieldErrors);
        }
        if (errors.length > 0) {
          throw new Error(`Validation failed: ${errors.join(", ")}`);
        }
        return data;
      } catch (err) {
        throw new Error(`schema_validate_or_throw failed: ${err.message}`);
      }
    },
    // schema_get_errors(schema, data) → [error messages]
    "schema_get_errors": (schemaName, data) => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }
        const errors = [];
        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule);
          errors.push(...fieldErrors);
        }
        return errors;
      } catch (err) {
        throw new Error(`schema_get_errors failed: ${err.message}`);
      }
    },
    // schema_get(name) → schema definition
    "schema_get": (name) => {
      try {
        return schemas.get(name) || null;
      } catch (err) {
        throw new Error(`schema_get failed: ${err.message}`);
      }
    },
    // validate_email(email) → boolean
    "validate_email": (email) => {
      try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      } catch {
        return false;
      }
    },
    // validate_string(value, minLen, maxLen) → boolean
    "validate_string": (value, minLen, maxLen) => {
      try {
        if (typeof value !== "string") return false;
        if (minLen !== void 0 && value.length < minLen) return false;
        if (maxLen !== void 0 && value.length > maxLen) return false;
        return true;
      } catch {
        return false;
      }
    },
    // validate_number(value, min, max) → boolean
    "validate_number": (value, min, max) => {
      try {
        if (typeof value !== "number") return false;
        if (min !== void 0 && value < min) return false;
        if (max !== void 0 && value > max) return false;
        return true;
      } catch {
        return false;
      }
    },
    // validate_regex(value, pattern) → boolean
    "validate_regex": (value, pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(String(value));
      } catch {
        return false;
      }
    }
  };
}
function validateField(fieldName, value, rule) {
  const errors = [];
  if (rule.required && (value === void 0 || value === null || value === "")) {
    errors.push(`${fieldName} is required`);
    return errors;
  }
  if (value === void 0 || value === null) {
    return errors;
  }
  if (rule.type === "string" && typeof value !== "string") {
    errors.push(`${fieldName} must be string`);
  } else if (rule.type === "number" && typeof value !== "number") {
    errors.push(`${fieldName} must be number`);
  } else if (rule.type === "integer" && !Number.isInteger(value)) {
    errors.push(`${fieldName} must be integer`);
  } else if (rule.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${fieldName} must be boolean`);
  } else if (rule.type === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push(`${fieldName} must be valid email`);
    }
  }
  if (typeof value === "string") {
    if (rule.min !== void 0 && value.length < rule.min) {
      errors.push(`${fieldName} minimum length is ${rule.min}`);
    }
    if (rule.max !== void 0 && value.length > rule.max) {
      errors.push(`${fieldName} maximum length is ${rule.max}`);
    }
  }
  if (typeof value === "number") {
    if (rule.min !== void 0 && value < rule.min) {
      errors.push(`${fieldName} minimum value is ${rule.min}`);
    }
    if (rule.max !== void 0 && value > rule.max) {
      errors.push(`${fieldName} maximum value is ${rule.max}`);
    }
  }
  if (rule.pattern) {
    try {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(String(value))) {
        errors.push(`${fieldName} does not match pattern`);
      }
    } catch {
      errors.push(`${fieldName} pattern is invalid`);
    }
  }
  return errors;
}
var init_stdlib_validation = __esm({
  "src/stdlib-validation.ts"() {
  }
});

// src/stdlib-middleware.ts
var stdlib_middleware_exports = {};
__export(stdlib_middleware_exports, {
  createMiddlewareModule: () => createMiddlewareModule
});
function createMiddlewareModule() {
  const middlewares = /* @__PURE__ */ new Map();
  const chains = [];
  return {
    // middleware_define(name, condition, handler, onFail) → middleware
    "middleware_define": (name, condition, handler, onFail) => {
      try {
        const mw = {
          name,
          condition: typeof condition === "function" ? condition : void 0,
          handler: typeof handler === "function" ? handler : () => handler,
          onFail: typeof onFail === "function" ? onFail : void 0
        };
        middlewares.set(name, mw);
        return {
          name,
          defined: true,
          hasCondition: !!mw.condition,
          hasOnFail: !!mw.onFail
        };
      } catch (err) {
        throw new Error(`middleware_define failed: ${err.message}`);
      }
    },
    // middleware_create_chain(middlewares[]) → chain
    "middleware_create_chain": (names) => {
      try {
        const chain = names.filter((name) => middlewares.has(name));
        chains.push(chain);
        return chain;
      } catch (err) {
        throw new Error(`middleware_create_chain failed: ${err.message}`);
      }
    },
    // middleware_apply_chain(chainId, request) → {passed: boolean, result: any, errors: []}
    "middleware_apply_chain": (chainId, request) => {
      try {
        const chain = chains[chainId];
        if (!chain) {
          throw new Error(`Chain not found: ${chainId}`);
        }
        const errors = [];
        let currentRequest = request;
        let passed = true;
        for (const middlewareName of chain) {
          const mw = middlewares.get(middlewareName);
          if (!mw) continue;
          if (mw.condition && !mw.condition(currentRequest)) {
            if (mw.onFail) {
              const result = mw.onFail(currentRequest);
              if (result && typeof result === "object" && "error" in result) {
                errors.push(`${middlewareName}: condition failed`);
                passed = false;
                break;
              }
            } else {
              errors.push(`${middlewareName}: condition not met`);
              passed = false;
              break;
            }
          } else {
            try {
              currentRequest = mw.handler(currentRequest);
            } catch (err) {
              errors.push(`${middlewareName}: ${err.message}`);
              passed = false;
              if (mw.onFail) {
                mw.onFail(currentRequest);
              }
              break;
            }
          }
        }
        return {
          passed,
          request: currentRequest,
          errors,
          chainLength: chain.length,
          executedMiddlewares: chain.length - (errors.length > 0 ? 1 : 0)
        };
      } catch (err) {
        throw new Error(`middleware_apply_chain failed: ${err.message}`);
      }
    },
    // middleware_add_to_chain(chainId, middleware) → chain
    "middleware_add_to_chain": (chainId, middlewareName) => {
      try {
        const chain = chains[chainId];
        if (!chain) {
          throw new Error(`Chain not found: ${chainId}`);
        }
        if (middlewares.has(middlewareName)) {
          chain.push(middlewareName);
        }
        return chain;
      } catch (err) {
        throw new Error(`middleware_add_to_chain failed: ${err.message}`);
      }
    },
    // middleware_get(name) → middleware
    "middleware_get": (name) => {
      try {
        const mw = middlewares.get(name);
        if (!mw) {
          return null;
        }
        return {
          name: mw.name,
          hasCondition: !!mw.condition,
          hasOnFail: !!mw.onFail
        };
      } catch (err) {
        throw new Error(`middleware_get failed: ${err.message}`);
      }
    },
    // 내장 미들웨어: 인증 체크
    "middleware_auth_check": (token) => {
      return {
        name: "auth-check",
        condition: (req) => {
          const authHeader = req.headers?.authorization || req.auth;
          return !!authHeader && authHeader.startsWith("Bearer ");
        },
        handler: (req) => {
          const authHeader = req.headers?.authorization || req.auth;
          const token2 = authHeader.replace("Bearer ", "");
          return { ...req, user: { token: token2 } };
        },
        onFail: (req) => ({ error: "UNAUTHORIZED", statusCode: 401 })
      };
    },
    // 내장 미들웨어: 요청 로깅
    "middleware_logging": () => {
      return {
        name: "logging",
        handler: (req) => {
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          console.log(`[${timestamp}] ${req.method || "GET"} ${req.path || "/"}`);
          return req;
        }
      };
    },
    // 내장 미들웨어: 요청 제한 (Rate limiting)
    "middleware_rate_limit": (limit = 100, windowMs = 6e4) => {
      const requestCounts = /* @__PURE__ */ new Map();
      return {
        name: "rate-limit",
        handler: (req) => {
          const clientId = req.ip || req.headers?.["x-forwarded-for"] || "unknown";
          const now = Date.now();
          const windowStart = now - windowMs;
          if (!requestCounts.has(clientId)) {
            requestCounts.set(clientId, []);
          }
          const requests = requestCounts.get(clientId);
          const recentRequests = requests.filter((t) => t > windowStart);
          if (recentRequests.length >= limit) {
            throw new Error(`Rate limit exceeded: ${limit} requests per ${windowMs}ms`);
          }
          recentRequests.push(now);
          requestCounts.set(clientId, recentRequests);
          return { ...req, rateLimit: { remaining: limit - recentRequests.length } };
        },
        onFail: (req) => ({ error: "TOO_MANY_REQUESTS", statusCode: 429 })
      };
    },
    // 내장 미들웨어: CORS
    "middleware_cors": (allowOrigin) => {
      return {
        name: "cors",
        handler: (req) => {
          return {
            ...req,
            headers: {
              ...req.headers,
              "Access-Control-Allow-Origin": allowOrigin || "*",
              "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type,Authorization"
            }
          };
        }
      };
    }
  };
}
var init_stdlib_middleware = __esm({
  "src/stdlib-middleware.ts"() {
  }
});

// src/stdlib-table.ts
var stdlib_table_exports = {};
__export(stdlib_table_exports, {
  createTableModule: () => createTableModule
});
function createTableModule() {
  return {
    // table_load_csv(path) → {headers, rows}
    "table_load_csv": (filePath) => {
      try {
        const content = fs4.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        const headers = lines[0].split(",").map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim());
          const row = {};
          headers.forEach((h, i) => {
            const val = values[i];
            row[h] = isNaN(Number(val)) ? val : Number(val);
          });
          return row;
        });
        return { headers, rows };
      } catch (err) {
        throw new Error(`table_load_csv failed: ${err.message}`);
      }
    },
    // table_load_json(path) → {headers, rows}
    "table_load_json": (filePath) => {
      try {
        const content = fs4.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
          throw new Error("JSON must be array of objects");
        }
        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        return { headers, rows: data };
      } catch (err) {
        throw new Error(`table_load_json failed: ${err.message}`);
      }
    },
    // table_save_csv(data, path) → boolean
    "table_save_csv": (data, filePath) => {
      try {
        const csv = [
          data.headers.join(","),
          ...data.rows.map(
            (row) => data.headers.map((h) => row[h] ?? "").join(",")
          )
        ].join("\n");
        fs4.writeFileSync(filePath, csv, "utf-8");
        return true;
      } catch (err) {
        throw new Error(`table_save_csv failed: ${err.message}`);
      }
    },
    // table_select(data, cols[]) → filtered data
    "table_select": (data, cols) => {
      try {
        const validCols = cols.filter((c) => data.headers.includes(c));
        const rows = data.rows.map((row) => {
          const newRow = {};
          validCols.forEach((c) => newRow[c] = row[c]);
          return newRow;
        });
        return { headers: validCols, rows };
      } catch (err) {
        throw new Error(`table_select failed: ${err.message}`);
      }
    },
    // table_filter(data, predicate) → filtered data
    "table_filter": (data, predicate) => {
      try {
        const rows = data.rows.filter(predicate);
        return { headers: data.headers, rows };
      } catch (err) {
        throw new Error(`table_filter failed: ${err.message}`);
      }
    },
    // table_map(data, fn) → transformed data
    "table_map": (data, fn) => {
      try {
        const rows = data.rows.map(fn);
        return { headers: data.headers, rows };
      } catch (err) {
        throw new Error(`table_map failed: ${err.message}`);
      }
    },
    // table_sort(data, col, order) → sorted data
    "table_sort": (data, col, order = "asc") => {
      try {
        const rows = [...data.rows].sort((a, b) => {
          const aVal = a[col];
          const bVal = b[col];
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return order === "desc" ? -cmp : cmp;
        });
        return { headers: data.headers, rows };
      } catch (err) {
        throw new Error(`table_sort failed: ${err.message}`);
      }
    },
    // table_group_by(data, col) → {key: rows[]}
    "table_group_by": (data, col) => {
      try {
        const groups = {};
        data.rows.forEach((row) => {
          const key = String(row[col]);
          if (!groups[key]) groups[key] = [];
          groups[key].push(row);
        });
        return groups;
      } catch (err) {
        throw new Error(`table_group_by failed: ${err.message}`);
      }
    },
    // table_aggregate(data, col, func) → number
    "table_aggregate": (data, col, func) => {
      try {
        const values = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== void 0);
        if (func === "count") return values.length;
        if (values.length === 0) return 0;
        if (func === "sum") return values.reduce((a, b) => a + b, 0);
        if (func === "mean") return values.reduce((a, b) => a + b, 0) / values.length;
        if (func === "min") return Math.min(...values);
        if (func === "max") return Math.max(...values);
        return 0;
      } catch (err) {
        throw new Error(`table_aggregate failed: ${err.message}`);
      }
    },
    // table_join(data1, data2, on) → joined data
    "table_join": (data1, data2, onCol) => {
      try {
        const joinMap = /* @__PURE__ */ new Map();
        data2.rows.forEach((r) => joinMap.set(r[onCol], r));
        const rows = data1.rows.map((r1) => {
          const r2 = joinMap.get(r1[onCol]);
          return r2 ? { ...r1, ...r2 } : r1;
        });
        const headers = [.../* @__PURE__ */ new Set([...data1.headers, ...data2.headers])];
        return { headers, rows };
      } catch (err) {
        throw new Error(`table_join failed: ${err.message}`);
      }
    },
    // table_head(data, n) → first n rows
    "table_head": (data, n = 5) => {
      try {
        return { headers: data.headers, rows: data.rows.slice(0, n) };
      } catch (err) {
        throw new Error(`table_head failed: ${err.message}`);
      }
    },
    // table_tail(data, n) → last n rows
    "table_tail": (data, n = 5) => {
      try {
        return { headers: data.headers, rows: data.rows.slice(-n) };
      } catch (err) {
        throw new Error(`table_tail failed: ${err.message}`);
      }
    },
    // table_shape(data) → {rows, cols}
    "table_shape": (data) => {
      try {
        return { rows: data.rows.length, cols: data.headers.length };
      } catch (err) {
        throw new Error(`table_shape failed: ${err.message}`);
      }
    }
  };
}
var fs4;
var init_stdlib_table = __esm({
  "src/stdlib-table.ts"() {
    fs4 = __toESM(require("fs"));
  }
});

// src/stdlib-service.ts
var stdlib_service_exports = {};
__export(stdlib_service_exports, {
  createServiceModule: () => createServiceModule
});
function createServiceModule() {
  const services = /* @__PURE__ */ new Map();
  const queues = /* @__PURE__ */ new Map();
  const circuitBreakers = /* @__PURE__ */ new Map();
  const metrics = { requests: 0, errors: 0 };
  return {
    // service_define(name, port, routes) → service
    "service_define": (name, port, routes) => {
      try {
        const service = {
          name,
          port,
          routes: routes || [],
          running: false
        };
        services.set(name, service);
        return service;
      } catch (err) {
        throw new Error(`service_define failed: ${err.message}`);
      }
    },
    // service_start(name) → {running, port}
    "service_start": (name) => {
      try {
        const service = services.get(name);
        if (!service) throw new Error(`Service not found: ${name}`);
        service.running = true;
        return { service: name, running: true, port: service.port };
      } catch (err) {
        throw new Error(`service_start failed: ${err.message}`);
      }
    },
    // service_stop(name) → boolean
    "service_stop": (name) => {
      try {
        const service = services.get(name);
        if (!service) throw new Error(`Service not found: ${name}`);
        service.running = false;
        return true;
      } catch (err) {
        throw new Error(`service_stop failed: ${err.message}`);
      }
    },
    // service_health(name) → {status, uptime, requests}
    "service_health": (name) => {
      try {
        const service = services.get(name);
        if (!service) throw new Error(`Service not found: ${name}`);
        return {
          service: name,
          status: service.running ? "healthy" : "down",
          uptime: service.running ? Math.random() * 3600 : 0,
          requests: metrics.requests
        };
      } catch (err) {
        throw new Error(`service_health failed: ${err.message}`);
      }
    },
    // queue_create(name, type) → queue
    "queue_create": (name, type) => {
      try {
        const queue = { name, type: type || "memory", messages: [] };
        queues.set(name, queue.messages);
        return queue;
      } catch (err) {
        throw new Error(`queue_create failed: ${err.message}`);
      }
    },
    // queue_publish(name, event, data) → boolean
    "queue_publish": (name, event, data) => {
      try {
        const queue = queues.get(name);
        if (!queue) throw new Error(`Queue not found: ${name}`);
        queue.push({ event, data, timestamp: Date.now() });
        return true;
      } catch (err) {
        throw new Error(`queue_publish failed: ${err.message}`);
      }
    },
    // queue_subscribe(name, event, handler) → subscriptionId
    "queue_subscribe": (name, event, handler) => {
      try {
        const subId = `sub-${Math.random().toString(36).substr(2, 9)}`;
        return subId;
      } catch (err) {
        throw new Error(`queue_subscribe failed: ${err.message}`);
      }
    },
    // circuit_breaker_define(name, threshold, timeout, fallback) → breaker
    "circuit_breaker_define": (name, threshold, timeout, fallback) => {
      try {
        const breaker = {
          name,
          state: "CLOSED",
          threshold: threshold || 5,
          timeout: timeout || 3e4,
          failures: 0,
          lastFailure: null,
          fallback
        };
        circuitBreakers.set(name, breaker);
        return breaker;
      } catch (err) {
        throw new Error(`circuit_breaker_define failed: ${err.message}`);
      }
    },
    // circuit_call(name, fn) → result
    "circuit_call": (name, fn) => {
      try {
        const breaker = circuitBreakers.get(name);
        if (!breaker) {
          return fn();
        }
        if (breaker.state === "OPEN") {
          return breaker.fallback ? breaker.fallback() : { error: "Circuit open" };
        }
        try {
          const result = fn();
          breaker.failures = 0;
          breaker.state = "CLOSED";
          return result;
        } catch (err) {
          breaker.failures++;
          breaker.lastFailure = Date.now();
          if (breaker.failures >= breaker.threshold) {
            breaker.state = "OPEN";
          }
          throw err;
        }
      } catch (err) {
        throw new Error(`circuit_call failed: ${err.message}`);
      }
    },
    // observe_metric(name, value, type) → boolean
    "observe_metric": (name, value, type) => {
      try {
        if (!metrics[name]) {
          metrics[name] = 0;
        }
        if (type === "gauge") {
          metrics[name] = value;
        } else {
          metrics[name] += value;
        }
        return true;
      } catch (err) {
        throw new Error(`observe_metric failed: ${err.message}`);
      }
    },
    // observe_log(level, message, data) → boolean
    "observe_log": (level, message, data) => {
      try {
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || "");
        return true;
      } catch (err) {
        throw new Error(`observe_log failed: ${err.message}`);
      }
    },
    // observe_report() → metrics
    "observe_report": () => {
      try {
        return {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          metrics,
          services: Array.from(services.values()).map((s) => ({
            name: s.name,
            port: s.port,
            running: s.running
          })),
          queues: Array.from(queues.keys())
        };
      } catch (err) {
        throw new Error(`observe_report failed: ${err.message}`);
      }
    }
  };
}
var init_stdlib_service = __esm({
  "src/stdlib-service.ts"() {
  }
});

// src/stdlib-markdown.ts
var stdlib_markdown_exports = {};
__export(stdlib_markdown_exports, {
  createMarkdownModule: () => createMarkdownModule
});
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function parseFrontmatter(src) {
  const fm = {};
  if (!src.startsWith("---\n") && !src.startsWith("---\r\n")) {
    return { fm, body: src };
  }
  const rest = src.replace(/^---\r?\n/, "");
  const match = rest.match(/\n---[ \t]*(\r?\n|$)/);
  const end = match ? rest.indexOf(match[0]) : -1;
  if (end < 0) return { fm, body: src };
  const block = rest.slice(0, end);
  const body = rest.slice(end).replace(/^\n---\r?\n?/, "");
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (/^(true|false)$/i.test(String(val))) val = String(val).toLowerCase() === "true";
    else if (/^-?\d+(\.\d+)?$/.test(String(val))) val = Number(val);
    else if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    fm[m[1]] = val;
  }
  return { fm, body };
}
function renderInline(s) {
  const codeSlots = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => {
    codeSlots.push(`<code>${escapeHtml(code)}</code>`);
    return `\0C${codeSlots.length - 1}\0`;
  });
  s = escapeHtml(s);
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_m, alt, url2, title) => title ? `<img src="${url2}" alt="${alt}" title="${title}" loading="lazy" decoding="async">` : `<img src="${url2}" alt="${alt}" loading="lazy" decoding="async">`
  );
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_m, text, url2, title) => title ? `<a href="${url2}" title="${title}">${text}</a>` : `<a href="${url2}">${text}</a>`
  );
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\x00C(\d+)\x00/g, (_m, i) => codeSlots[Number(i)] || "");
  return s;
}
function tokenize(body) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const fenceOpen = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/);
    if (fenceOpen) {
      const lang = fenceOpen[1] || "";
      i++;
      const codeLines = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push({ kind: "code", lang, text: codeLines.join("\n") });
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push({ kind: "hr" });
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      out.push({ kind: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push({ kind: "quote", lines: quoteLines });
      continue;
    }
    const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items = [];
      const re = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
      while (i < lines.length) {
        const m = lines[i].match(re);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      out.push({ kind: "list", ordered, items });
      continue;
    }
    const paraLines = [line];
    i++;
    while (i < lines.length) {
      const n = lines[i];
      if (/^\s*$/.test(n)) break;
      if (/^#{1,6}\s/.test(n)) break;
      if (/^```/.test(n)) break;
      if (/^>\s?/.test(n)) break;
      if (/^\s*[-*+]\s+/.test(n)) break;
      if (/^\s*\d+\.\s+/.test(n)) break;
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(n)) break;
      paraLines.push(n);
      i++;
    }
    out.push({ kind: "paragraph", text: paraLines.join(" ") });
  }
  return out;
}
function renderBlock(b) {
  switch (b.kind) {
    case "heading":
      return `<h${b.level}>${renderInline(b.text)}</h${b.level}>`;
    case "paragraph":
      return `<p>${renderInline(b.text)}</p>`;
    case "code":
      return b.lang ? `<pre><code class="language-${escapeHtml(b.lang)}">${escapeHtml(b.text)}</code></pre>` : `<pre><code>${escapeHtml(b.text)}</code></pre>`;
    case "quote": {
      const inner = tokenize(b.lines.join("\n")).map(renderBlock).join("");
      return `<blockquote>${inner}</blockquote>`;
    }
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const items = b.items.map((it) => `<li>${renderInline(it)}</li>`).join("");
      return `<${tag}>${items}</${tag}>`;
    }
    case "hr":
      return `<hr>`;
  }
}
function createMarkdownModule() {
  return {
    // markdown_to_html md -> html string
    "markdown_to_html": (src) => {
      if (typeof src !== "string") return "";
      const { body } = parseFrontmatter(src);
      return tokenize(body).map(renderBlock).join("");
    },
    // markdown_frontmatter md -> { fm: {...}, body: "..." }
    "markdown_frontmatter": (src) => {
      if (typeof src !== "string") return { fm: {}, body: "" };
      return parseFrontmatter(src);
    },
    // markdown_render_full md -> { fm, html }
    "markdown_render_full": (src) => {
      if (typeof src !== "string") return { fm: {}, html: "" };
      const { fm, body } = parseFrontmatter(src);
      const html = tokenize(body).map(renderBlock).join("");
      return { fm, html };
    }
  };
}
var init_stdlib_markdown = __esm({
  "src/stdlib-markdown.ts"() {
  }
});

// src/stdlib-blog.ts
var stdlib_blog_exports = {};
__export(stdlib_blog_exports, {
  createBlogModule: () => createBlogModule
});
function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").replace(/\s+/g, " ").trim();
}
function createBlogModule() {
  return {
    // blog_all_tags [posts] → [tag1, tag2, ...] unique, sorted by count desc
    "blog_all_tags": (posts) => {
      const counts = /* @__PURE__ */ new Map();
      for (const p of posts || []) {
        for (const t of p.tags || []) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((e) => e[0]);
    },
    // blog_posts_by_tag [posts] tag → posts with that tag, newest first
    "blog_posts_by_tag": (posts, tag) => {
      const filtered = (posts || []).filter((p) => (p.tags || []).includes(tag));
      return filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    },
    // blog_tag_counts [posts] → {tag: count, ...}
    "blog_tag_counts": (posts) => {
      const counts = {};
      for (const p of posts || []) {
        for (const t of p.tags || []) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
      return counts;
    },
    // blog_related [posts] currentSlug limit → posts sharing most tags,
    // excluding the current post, newest as tiebreak.
    "blog_related": (posts, currentSlug, limit = 5) => {
      const current = (posts || []).find((p) => p.slug === currentSlug);
      if (!current) return [];
      const currentTags = new Set(current.tags || []);
      const scored = (posts || []).filter((p) => p.slug !== currentSlug).map((p) => ({
        post: p,
        score: (p.tags || []).filter((t) => currentTags.has(t)).length,
        date: p.date || ""
      })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
      return scored.slice(0, Math.max(0, limit)).map((x) => x.post);
    },
    // blog_search_index [posts] → [{slug, title, url, body_terms}] compact JSON
    // body_terms: space-joined normalized words, limited to 500 chars.
    "blog_search_index": (posts) => {
      return (posts || []).map((p) => ({
        slug: p.slug,
        title: p.title,
        url: p.url || `/blog/${p.slug}`,
        terms: normalize(`${p.title} ${p.summary || ""} ${p.body || ""}`).slice(0, 500)
      }));
    },
    // blog_search [index] query → top matches by term overlap score
    "blog_search": (index, query, limit = 10) => {
      const q = normalize(query);
      if (!q) return [];
      const terms = q.split(" ").filter(Boolean);
      const results = (index || []).map((entry) => {
        let score = 0;
        for (const t of terms) {
          if (entry.title.toLowerCase().includes(t)) score += 3;
          if (entry.terms.includes(t)) score += 1;
        }
        return { entry, score };
      }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(0, limit)).map((r) => ({ slug: r.entry.slug, title: r.entry.title, url: r.entry.url, score: r.score }));
      return results;
    },
    // blog_posts_sorted [posts] → newest first
    "blog_posts_sorted": (posts) => {
      return [...posts || []].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    },
    // blog_paginate [posts] page per-page → {items, total, page, pages}
    "blog_paginate": (posts, page = 1, perPage = 10) => {
      const all = posts || [];
      const pp = Math.max(1, perPage);
      const pages = Math.max(1, Math.ceil(all.length / pp));
      const p = Math.min(Math.max(1, page), pages);
      const start = (p - 1) * pp;
      return {
        items: all.slice(start, start + pp),
        total: all.length,
        page: p,
        pages,
        perPage: pp,
        hasPrev: p > 1,
        hasNext: p < pages
      };
    }
  };
}
var init_stdlib_blog = __esm({
  "src/stdlib-blog.ts"() {
  }
});

// src/stdlib-audit.ts
var stdlib_audit_exports = {};
__export(stdlib_audit_exports, {
  createAuditModule: () => createAuditModule
});
function postJson(url2, body, apiKey) {
  const args = [
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    ...apiKey ? ["-H", `X-Service-Key: ${apiKey}`] : [],
    "-d",
    body,
    url2
  ];
  try {
    const result = (0, import_child_process6.spawnSync)("curl", args, { timeout: 3e3 });
    const code = parseInt(result.stdout?.toString().trim() ?? "0", 10);
    return { ok: code >= 200 && code < 300, status: code };
  } catch {
    return { ok: false, status: 0 };
  }
}
function createAuditModule() {
  return {
    // audit_log serviceId actorId action resource detail
    //   → {:ok true :status 200} | {:ok false :status N}
    // actorId가 nil이면 serviceId로 자동 대체
    // 실패해도 nil 반환 (본 작업 차단 없음)
    "audit_log": (serviceId, actorId, action, resource, detail) => {
      const url2 = process.env.AUDIT_URL ?? "";
      const key = process.env.AUDIT_SERVICE_KEY ?? "";
      if (!url2) return null;
      const payload = JSON.stringify({
        service_id: serviceId,
        actor_id: actorId ?? serviceId,
        action,
        resource,
        detail,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      try {
        return postJson(url2, payload, key);
      } catch {
        return null;
      }
    },
    // audit_log_custom serviceId actorId action resource detail extraMap
    //   → extraMap을 페이로드에 병합
    "audit_log_custom": (serviceId, actorId, action, resource, detail, extra) => {
      const url2 = process.env.AUDIT_URL ?? "";
      const key = process.env.AUDIT_SERVICE_KEY ?? "";
      if (!url2) return null;
      const payload = JSON.stringify({
        service_id: serviceId,
        actor_id: actorId ?? serviceId,
        action,
        resource,
        detail,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ...extra && typeof extra === "object" ? extra : {}
      });
      try {
        return postJson(url2, payload, key);
      } catch {
        return null;
      }
    },
    // audit_log_ok? result → true/false (결과 확인용)
    "audit_log_ok?": (result) => {
      return result !== null && result !== void 0 && result.ok === true;
    }
  };
}
var import_child_process6;
var init_stdlib_audit = __esm({
  "src/stdlib-audit.ts"() {
    import_child_process6 = require("child_process");
  }
});

// src/stdlib-http-server.ts
var stdlib_http_server_exports = {};
__export(stdlib_http_server_exports, {
  __activeServer: () => __activeServer,
  createHttpServerModule: () => createHttpServerModule
});
function createHttpServerModule(callFn, callFunctionValue) {
  const routes = [];
  const middlewares = [];
  let server = null;
  let requestCounter = 0;
  const pendingResponses = /* @__PURE__ */ new Map();
  let currentRequestId = null;
  let currentNonce = "";
  const wsPublicMap = /* @__PURE__ */ new Map();
  let upgradeHandler = null;
  let wsClientMessageHandler = null;
  let wsClientCloseHandler = null;
  let wssPublic = null;
  function generateRequestId() {
    const timestamp = Date.now();
    const counter = ++requestCounter;
    return `req_${timestamp}_${counter}`;
  }
  function logAccess(method, path7, status, duration, requestId) {
    const icon = status >= 400 ? "\u274C" : "\u2705";
    console.log(`${icon} [${requestId}] ${method} ${path7} ${status} ${duration}ms`);
  }
  function pathToRegex(path7) {
    const params = [];
    const pattern = path7.replace(/\//g, "\\/").replace(/\*/g, ".*").replace(/:(\w+)/g, (_, param) => {
      params.push(param);
      return "([^\\/]+)";
    });
    return [new RegExp(`^${pattern}$`), params];
  }
  function parseUrl(urlStr) {
    const parsed = url.parse(urlStr, true);
    return {
      path: parsed.pathname || "/",
      query: parsed.query
    };
  }
  async function readBody(req) {
    return new Promise((resolve3) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const raw = Buffer.concat(chunks);
        const ct = (req.headers["content-type"] || "").toString();
        if (ct.includes("application/json")) {
          try {
            resolve3(JSON.parse(raw.toString()));
            return;
          } catch {
          }
        }
        if (ct.includes("multipart/form-data")) {
          try {
            resolve3(parseMultipart(raw, ct));
            return;
          } catch {
          }
        }
        if (ct.includes("application/x-www-form-urlencoded")) {
          try {
            const params = {};
            new url.URLSearchParams(raw.toString()).forEach((v, k) => {
              params[k] = v;
            });
            resolve3(params);
            return;
          } catch {
          }
        }
        resolve3(raw.toString());
      });
    });
  }
  function parseMultipart(raw, contentType) {
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) return {};
    const boundary = boundaryMatch[1];
    const delimiter = Buffer.from("\r\n--" + boundary);
    const fields = {};
    const files = [];
    const uploadDir = path6.join(os2.tmpdir(), "fl-uploads");
    if (!fs5.existsSync(uploadDir)) fs5.mkdirSync(uploadDir, { recursive: true });
    const start = Buffer.from("--" + boundary + "\r\n");
    let pos = raw.indexOf(start);
    if (pos < 0) return { fields, files };
    pos += start.length;
    while (pos < raw.length) {
      const next = raw.indexOf(delimiter, pos);
      const partEnd = next < 0 ? raw.length : next;
      const part = raw.slice(pos, partEnd);
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const headerStr = part.slice(0, headerEnd).toString();
      const bodyBuf = part.slice(headerEnd + 4);
      const dispMatch = headerStr.match(/Content-Disposition:[^\n]*?;\s*name="([^"]+)"(?:[^\n]*?filename="([^"]+)")?/i);
      if (!dispMatch) {
        pos = partEnd + delimiter.length + 2;
        continue;
      }
      const fieldName = dispMatch[1];
      const fileName = dispMatch[2];
      if (fileName) {
        const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
        const mimetype = ctMatch ? ctMatch[1].trim() : "application/octet-stream";
        const ext = path6.extname(fileName) || "";
        const savedName = crypto2.randomBytes(8).toString("hex") + ext;
        const savedPath = path6.join(uploadDir, savedName);
        fs5.writeFileSync(savedPath, bodyBuf);
        const m = /* @__PURE__ */ new Map();
        m.set("fieldname", fieldName);
        m.set("originalname", fileName);
        m.set("mimetype", mimetype);
        m.set("size", bodyBuf.length);
        m.set("path", savedPath);
        m.set("filename", savedName);
        files.push(m);
      } else {
        fields[fieldName] = bodyBuf.toString().replace(/\r\n$/, "");
      }
      if (next < 0) break;
      pos = next + delimiter.length;
      if (raw.slice(pos, pos + 2).toString() === "--") break;
      pos += 2;
    }
    const result = /* @__PURE__ */ new Map();
    const fieldsMap = /* @__PURE__ */ new Map();
    Object.entries(fields).forEach(([k, v]) => fieldsMap.set(k, v));
    result.set("fields", fieldsMap);
    result.set("files", files);
    return result;
  }
  function sendResponse(res, status, body, contentType = "application/json", extraHeaders) {
    const headersToWrite = { "Content-Type": contentType };
    if (extraHeaders) {
      const hopByHop = /* @__PURE__ */ new Set([
        "connection",
        "keep-alive",
        "transfer-encoding",
        "te",
        "trailer",
        "proxy-authorization",
        "proxy-authenticate",
        "upgrade",
        "content-encoding"
      ]);
      for (const [k, v] of Object.entries(extraHeaders)) {
        if (!hopByHop.has(k.toLowerCase())) {
          headersToWrite[k] = v;
        }
      }
    }
    res.writeHead(status, headersToWrite);
    if (typeof body === "string") {
      if (contentType.includes("text/html") && currentNonce) {
        body = body.replace(
          /<(script|style)(?![^>]*\bnonce=)(\s|>)/gi,
          (_, tag, rest) => `<${tag} nonce="${currentNonce}"${rest}`
        );
      }
      res.end(body);
    } else if (Buffer.isBuffer(body)) {
      res.end(body);
    } else if (contentType.includes("json") && typeof body === "object") {
      res.end(JSON.stringify(
        body,
        (_k, v) => v instanceof Map ? Object.fromEntries(v) : Array.isArray(v) ? v : v
      ));
    } else {
      res.end(String(body ?? ""));
    }
  }
  function createFlRequest(method, path7, query, headers, body, params, requestId) {
    return {
      __fl_request: true,
      method,
      path: path7,
      query,
      headers,
      body: body || void 0,
      params,
      request_id: requestId,
      csp_nonce: currentNonce,
      timestamp: Date.now()
    };
  }
  const rlStore = /* @__PURE__ */ new Map();
  let rlMax = 100;
  let rlWindowMs = 6e4;
  function checkRateLimit(ip) {
    const now = Date.now();
    let entry = rlStore.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + rlWindowMs };
      rlStore.set(ip, entry);
      return true;
    }
    entry.count++;
    return entry.count <= rlMax;
  }
  setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of rlStore) {
      if (now > e.resetAt + rlWindowMs) rlStore.delete(ip);
    }
  }, 3e5).unref();
  return {
    // server_use path middlewareName — 경로 패턴 매칭 시 미들웨어 실행
    // handler가 null/undefined 반환 → 다음 미들웨어/라우트 진행
    // handler가 응답 객체 반환 → 즉시 응답 (라우트 실행 안 함)
    "server_use": (path7, handlerName) => {
      const [pattern] = pathToRegex(path7);
      middlewares.push({ pattern, handler: handlerName });
      return null;
    },
    // server_rate_limit max window_ms → null  (e.g. 100req/60s)
    "server_rate_limit": (max, windowMs) => {
      rlMax = Math.max(1, Math.floor(max));
      rlWindowMs = Math.max(1e3, Math.floor(windowMs));
      return null;
    },
    // server_get path handlerName -> null
    "server_get": (path7, handlerName) => {
      const [pattern, params] = pathToRegex(path7);
      routes.push({ method: "GET", path: path7, pattern, params, handler: handlerName });
      return null;
    },
    // server_post path handlerName -> null
    "server_post": (path7, handlerName) => {
      const [pattern, params] = pathToRegex(path7);
      routes.push({ method: "POST", path: path7, pattern, params, handler: handlerName });
      return null;
    },
    // server_put path handlerName -> null
    "server_put": (path7, handlerName) => {
      const [pattern, params] = pathToRegex(path7);
      routes.push({ method: "PUT", path: path7, pattern, params, handler: handlerName });
      return null;
    },
    // server_patch path handlerName -> null
    "server_patch": (path7, handlerName) => {
      const [pattern, params] = pathToRegex(path7);
      routes.push({ method: "PATCH", path: path7, pattern, params, handler: handlerName });
      return null;
    },
    // server_delete path handlerName -> null
    "server_delete": (path7, handlerName) => {
      const [pattern, params] = pathToRegex(path7);
      routes.push({ method: "DELETE", path: path7, pattern, params, handler: handlerName });
      return null;
    },
    // route method path handler → 메서드 문자열로 등록
    // (route "GET"    "/api/x" handler-fn)
    // (route "POST"   "/api/x" handler-fn)
    "route": (method, path7, handlerName) => {
      const m = String(method).toUpperCase();
      const [pattern, params] = pathToRegex(path7);
      routes.push({ method: m, path: path7, pattern, params, handler: handlerName });
      return null;
    },
    // v12: 라우트 초기화 (hot reload 시 재등록 전 호출)
    "server-clear-routes": () => {
      routes.length = 0;
      return null;
    },
    "server_clear_routes": () => {
      routes.length = 0;
      return null;
    },
    // server_static dir [urlPrefix] -> null  정적 파일 서빙 (server-static "public" "/")
    "server_static": (dir, urlPrefix = "/") => {
      const mimeMap = {
        ".html": "text/html; charset=utf-8",
        ".htm": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".mjs": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".txt": "text/plain; charset=utf-8",
        ".pdf": "application/pdf"
      };
      const absDir = path6.resolve(dir);
      const prefix = urlPrefix.endsWith("/") ? urlPrefix : urlPrefix + "/";
      const handler = (_req, res, reqPath) => {
        let rel = reqPath.startsWith(prefix) ? reqPath.slice(prefix.length - 1) : reqPath;
        if (rel === "" || rel === "/") rel = "/index.html";
        const filePath = path6.join(absDir, rel);
        if (!filePath.startsWith(absDir)) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden");
          return true;
        }
        if (!fs5.existsSync(filePath) || !fs5.statSync(filePath).isFile()) return false;
        const ext = path6.extname(filePath).toLowerCase();
        const mime = mimeMap[ext] || "application/octet-stream";
        const content = fs5.readFileSync(filePath);
        res.writeHead(200, {
          "Content-Type": mime,
          "Content-Length": content.length,
          "Cache-Control": "public, max-age=3600"
        });
        res.end(content);
        return true;
      };
      const routePath = prefix === "/" ? "/*" : prefix + "*";
      const [pattern, params] = pathToRegex(routePath);
      routes.push({
        method: "GET",
        path: routePath,
        pattern,
        params,
        handler: { __fl_static_handler: true, fn: handler }
      });
      return null;
    },
    // server_all path handler → 모든 메서드 등록 (catch-all)
    "server_all": (path7, handlerName) => {
      const [pattern, params] = pathToRegex(path7);
      for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        routes.push({ method: m, path: path7, pattern, params, handler: handlerName });
      }
      return null;
    },
    // server_start port|config -> string
    // 선언형 API: (server_start {:port 40090 :routes [...] :middleware [...]})
    // 기존 API:   (server_start 40090)
    "server_start": (portOrConfig) => {
      const port = portOrConfig !== null && typeof portOrConfig === "object" ? portOrConfig[":port"] ?? portOrConfig["port"] ?? 8080 : portOrConfig;
      if (__activeServer.server) {
        try {
          __activeServer.server.close();
        } catch (_e) {
        }
        __activeServer.server = null;
      }
      server = http.createServer(async (req, res) => {
        const requestStart = Date.now();
        const requestId = generateRequestId();
        currentRequestId = requestId;
        const cspNonce = crypto2.randomBytes(16).toString("base64url");
        currentNonce = cspNonce;
        const method = req.method || "GET";
        const { path: path7, query } = parseUrl(req.url || "/");
        const headers = req.headers;
        const body = await readBody(req);
        const allowedOrigins = process.env.FL_ALLOWED_ORIGINS;
        if (allowedOrigins && allowedOrigins !== "*") {
          const reqOrigin = req.headers["origin"] || "";
          if (allowedOrigins.split(",").map((s) => s.trim()).includes(reqOrigin)) {
            res.setHeader("Access-Control-Allow-Origin", reqOrigin);
            res.setHeader("Vary", "Origin");
          }
        } else {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("X-Request-Id", requestId);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader("X-XSS-Protection", "1; mode=block");
        res.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'self' 'nonce-${cspNonce}'; style-src 'self' 'nonce-${cspNonce}'`);
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        if (method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }
        const clientIp = process.env.FL_TRUST_PROXY === "1" ? (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim() : req.socket.remoteAddress || "unknown";
        if (!checkRateLimit(clientIp)) {
          res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rlWindowMs / 1e3)) });
          res.end(JSON.stringify({ error: "Too Many Requests", retry_after: Math.ceil(rlWindowMs / 1e3) }));
          return;
        }
        if (process.env.FL_DEV === "1" && path7 === "/__hot" && method === "GET") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
          });
          res.write("retry: 400\n\n");
          return;
        }
        const baseReq = createFlRequest(method, path7, query, headers, body, {}, requestId);
        for (const mw of middlewares) {
          if (!mw.pattern.exec(path7)) continue;
          try {
            let mwResult;
            if (typeof mw.handler === "string") {
              mwResult = callFn(mw.handler, [baseReq]);
            } else if (mw.handler?.kind === "function-value" && callFunctionValue) {
              mwResult = callFunctionValue(mw.handler, [baseReq]);
            }
            if (mwResult instanceof Promise) mwResult = await mwResult;
            if (mwResult !== null && mwResult !== void 0) {
              const mwStatus = mwResult.status ?? (mwResult.__fl_status ?? 200);
              const headersObj = {};
              if (mwResult.__fl_headers) Object.assign(headersObj, mwResult.__fl_headers);
              const mwBody = mwResult.__fl_response ? typeof mwResult.body === "object" ? JSON.stringify(mwResult.body) : String(mwResult.body ?? "") : typeof mwResult === "object" ? JSON.stringify(mwResult) : String(mwResult);
              const mwCT = mwResult.contentType ?? "application/json";
              sendResponse(res, mwStatus, mwBody, mwCT, headersObj);
              logAccess(method, path7, mwStatus, Date.now() - requestStart, requestId);
              return;
            }
          } catch (mwErr) {
            sendResponse(res, 500, JSON.stringify({ error: mwErr.message ?? "middleware error" }));
            return;
          }
        }
        let matched = false;
        for (const route of routes) {
          if (route.method !== method) continue;
          const match = route.pattern.exec(path7);
          if (!match) continue;
          matched = true;
          let status = 200;
          try {
            const params = {};
            for (let i = 0; i < route.params.length; i++) {
              params[route.params[i]] = match[i + 1];
            }
            const flReq = createFlRequest(method, path7, query, headers, body, params, requestId);
            let rawResult;
            if (typeof route.handler === "string") {
              rawResult = callFn(route.handler, [flReq]);
            } else if (route.handler && route.handler.__fl_static_handler === true) {
              const served = route.handler.fn(req, res, path7);
              if (served) return;
              sendResponse(res, 404, { error: "Not found" });
              return;
            } else if (route.handler && route.handler.kind === "function-value" && callFunctionValue) {
              rawResult = callFunctionValue(route.handler, [flReq]);
            } else {
              throw new Error(`Invalid handler: expected string or function-value, got ${typeof route.handler}`);
            }
            const result = rawResult instanceof Promise ? await rawResult : rawResult;
            if (pendingResponses.has(requestId)) {
              pendingResponses.delete(requestId);
            } else if (result && typeof result === "object" && result.__fl_wait_and_respond === true) {
              const asyncResp = await result.promise;
              if (!asyncResp) {
                sendResponse(res, 504, { error: "Gateway Timeout" });
              } else {
                status = asyncResp.status ?? 200;
                let respBody = asyncResp.body ?? "";
                let contentType = asyncResp.contentType ?? "application/json";
                const extraHeaders = asyncResp.headers ?? {};
                if (asyncResp.encoding === "base64" && typeof respBody === "string") {
                  const buf = Buffer.from(respBody, "base64");
                  if (extraHeaders["content-type"]) {
                    contentType = extraHeaders["content-type"];
                  }
                  sendResponse(res, status, buf, contentType, extraHeaders);
                } else {
                  if (extraHeaders["content-type"]) {
                    contentType = extraHeaders["content-type"];
                  }
                  sendResponse(res, status, respBody, contentType, extraHeaders);
                }
              }
            } else {
              if (result && typeof result === "object") {
                const getField = (obj, key) => obj instanceof Map ? obj.get(key) ?? obj.get(":" + key) : obj[key];
                const resStatus = getField(result, "status");
                const resBody = getField(result, "body");
                if (result.__fl_response === true || resStatus !== void 0 && resBody !== void 0) {
                  status = resStatus ?? 200;
                  const resHeaders = getField(result, "headers") ?? {};
                  const headersObj = resHeaders instanceof Map ? Object.fromEntries(resHeaders) : resHeaders;
                  const contentType = headersObj["content-type"] ?? getField(result, "contentType") ?? "application/json";
                  sendResponse(res, status, resBody ?? "", contentType, headersObj);
                } else {
                  const hint49 = `[FreeLang #49] \uB77C\uC6B0\uD2B8 \uD578\uB4E4\uB7EC\uAC00 map\uC744 \uC9C1\uC811 \uBC18\uD658\uD588\uC2B5\uB2C8\uB2E4.
  \uC790\uB3D9\uC73C\uB85C JSON \uC9C1\uB82C\uD654\uD558\uC5EC \uC804\uC1A1\uD569\uB2C8\uB2E4.
  \uBA85\uC2DC\uC801 \uC751\uB2F5: (server-json result) \uC0AC\uC6A9\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.`;
                  if (process.env.FL_V12 === "1") {
                    sendResponse(res, 400, { error: hint49 });
                  } else {
                    console.warn(`\u26A0\uFE0F  ${hint49}`);
                    sendResponse(res, 200, result);
                  }
                }
              } else {
                sendResponse(res, 200, result ?? "");
              }
            }
            const duration = Date.now() - requestStart;
            logAccess(method, path7, status, duration, requestId);
          } catch (err) {
            const status2 = 500;
            sendResponse(res, status2, { error: err.message });
            const duration = Date.now() - requestStart;
            logAccess(method, path7, status2, duration, requestId);
          }
          return;
        }
        if (!matched) {
          const status = 404;
          sendResponse(res, status, { error: "Not Found", path: path7 });
          const duration = Date.now() - requestStart;
          logAccess(method, path7, status, duration, requestId);
        }
      });
      server.on("upgrade", (req, socket, head) => {
        if (!upgradeHandler) {
          socket.destroy();
          return;
        }
        const key = req.headers["sec-websocket-key"];
        if (!key) {
          socket.destroy();
          return;
        }
        const accept = crypto2.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
        socket.write([
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          "Sec-WebSocket-Accept: " + accept,
          "",
          ""
        ].join("\r\n"));
        const sessionId = "wsc-" + crypto2.randomBytes(8).toString("hex");
        wsPublicMap.set(sessionId, socket);
        let buf = Buffer.alloc(0);
        socket.on("data", async (chunk) => {
          buf = Buffer.concat([buf, chunk]);
          while (buf.length >= 2) {
            const fin = (buf[0] & 128) !== 0;
            const opcode = buf[0] & 15;
            const masked = (buf[1] & 128) !== 0;
            let payloadLen = buf[1] & 127;
            let hdrLen = 2;
            if (payloadLen === 126) {
              if (buf.length < 4) break;
              payloadLen = buf.readUInt16BE(2);
              hdrLen = 4;
            } else if (payloadLen === 127) {
              if (buf.length < 10) break;
              payloadLen = Number(buf.readBigUInt64BE(2));
              hdrLen = 10;
            }
            if (masked) hdrLen += 4;
            if (buf.length < hdrLen + payloadLen) break;
            let maskKey = null;
            if (masked) maskKey = buf.slice(hdrLen - 4, hdrLen);
            const payload = Buffer.from(buf.slice(hdrLen, hdrLen + payloadLen));
            if (maskKey) {
              for (let i = 0; i < payload.length; i++) {
                payload[i] ^= maskKey[i % 4];
              }
            }
            if (opcode === 8) {
              wsPublicMap.delete(sessionId);
              if (wsClientCloseHandler) {
                try {
                  await callFn(wsClientCloseHandler, [sessionId, 1e3]);
                } catch {
                }
              }
              socket.end();
              return;
            }
            if (opcode === 9) {
              socket.write(Buffer.from([138, 0]));
            } else if (opcode === 1 || opcode === 2) {
              if (wsClientMessageHandler) {
                const isBinary = opcode === 2;
                const data = isBinary ? payload.toString("base64") : payload.toString("utf8");
                try {
                  await callFn(wsClientMessageHandler, [sessionId, data, isBinary]);
                } catch {
                }
              }
            }
            buf = buf.slice(hdrLen + payloadLen);
          }
        });
        socket.on("close", async () => {
          wsPublicMap.delete(sessionId);
          if (wsClientCloseHandler) {
            try {
              await callFn(wsClientCloseHandler, [sessionId, 1006]);
            } catch {
            }
          }
        });
        socket.on("error", () => {
          wsPublicMap.delete(sessionId);
        });
        const _wsUrl = new URL(req.url || "/", "http://localhost");
        const _wsQuery = {};
        _wsUrl.searchParams.forEach((v, k) => {
          _wsQuery[k] = v;
        });
        const upgradeReq = {
          __fl_request: true,
          method: "WS_UPGRADE",
          path: req.url || "/",
          headers: req.headers,
          query: _wsQuery,
          body: "",
          params: {},
          session_id: sessionId
        };
        callFn(upgradeHandler, [upgradeReq]);
      });
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`[server] \uD3EC\uD2B8 ${port} \uC774\uBBF8 \uC0AC\uC6A9 \uC911 \u2014 PM2 \uC7AC\uC2DC\uC791 \uC704\uD574 \uC885\uB8CC`);
          process.exit(1);
        } else {
          console.error(`[server] \uC11C\uBC84 \uC624\uB958: ${err.message}`);
          process.exit(1);
        }
      });
      server.listen(port);
      __activeServer.server = server;
      setInterval(() => {
      }, 1e4).unref();
      return `server listening on :${port}`;
    },
    // server_stop -> null
    "server_stop": () => {
      if (server) {
        server.close();
        server = null;
      }
      return null;
    },
    // server_json [status] obj -> response object
    // (server_json data)        → 200 JSON
    // (server_json 201 data)    → 201 JSON
    "server_json": (statusOrBody, maybeBody) => {
      const isStatus = typeof statusOrBody === "number" && statusOrBody >= 100 && statusOrBody < 600;
      return {
        __fl_response: true,
        status: isStatus ? statusOrBody : 200,
        contentType: "application/json",
        body: isStatus ? maybeBody : statusOrBody
      };
    },
    // server_text text -> response object
    "server_text": (body) => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "text/plain",
        body
      };
    },
    // server_status code body -> response object
    "server_status": (code, body) => {
      if (typeof code === "string" && typeof body === "number") {
        const hint = `server-status \uC778\uC790 \uC21C\uC11C: (server-status code body)
  \uC608: (server-status 404 "Not Found")
  \u2192 \uBC1B\uC740 \uAC12: (server-status "${code}" ${body}) \u2014 \uC22B\uC790\uC640 \uBB38\uC790\uC5F4 \uC5ED\uC804`;
        if (process.env.FL_V12 === "1") throw new Error(`[v12] ${hint}`);
        console.warn(`\u26A0\uFE0F  [FreeLang] ${hint}`);
        return { __fl_response: true, status: Number(body), contentType: "application/json", body: code };
      }
      return {
        __fl_response: true,
        status: Number(code),
        contentType: "application/json",
        body
      };
    },
    // server_html body -> response object (text/html)
    // In dev mode (FL_DEV=1), injects hot-reload script before </body>
    // so browsers auto-refresh when the FreeLang source file changes.
    "server_html": (body, statusOrUndef) => {
      const status = typeof statusOrUndef === "number" ? statusOrUndef : 200;
      let finalBody = body;
      if (process.env.FL_DEV === "1" && typeof finalBody === "string") {
        const script = `<script>(function(){let w=false;function c(){const e=new EventSource('/__hot');e.onopen=function(){if(w)location.reload();w=true;};e.onerror=function(){e.close();setTimeout(c,400);};}c();})();</script>`;
        if (finalBody.includes("</body>")) {
          finalBody = finalBody.replace("</body>", script + "</body>");
        } else {
          finalBody = finalBody + script;
        }
      }
      return {
        __fl_response: true,
        status,
        contentType: "text/html; charset=utf-8",
        body: finalBody
      };
    },
    // server_html_cookie cookie html -> response (Set-Cookie 헤더 포함 HTML 응답)
    "server_html_cookie": (cookie, html) => {
      return {
        __fl_response: true,
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: html,
        headers: { "Set-Cookie": cookie }
      };
    },
    // server_csp_nonce -> string (현재 요청의 CSP nonce — <script nonce=...> 등에 사용)
    "server_csp_nonce": () => currentNonce,
    // server_set_cookie name value opts -> cookie string (HttpOnly+Secure+SameSite 자동)
    "server_set_cookie": (name, value, opts = {}) => {
      let cookie = `${encodeURIComponent(String(name))}=${encodeURIComponent(String(value))}`;
      if (opts && opts["max_age"] !== void 0) cookie += `; Max-Age=${opts["max_age"]}`;
      cookie += `; Path=${opts && opts["path"] || "/"}`;
      if (opts && opts["domain"]) {
        const domain = String(opts["domain"]);
        if (!/^[a-zA-Z0-9.\-]+$/.test(domain)) throw new Error(`\uC798\uBABB\uB41C \uCFE0\uD0A4 \uB3C4\uBA54\uC778: '${domain}'`);
        cookie += `; Domain=${domain}`;
      }
      if (!opts || opts["http_only"] !== false) cookie += "; HttpOnly";
      if (!opts || opts["secure"] !== false) cookie += "; Secure";
      const ss = opts && opts["same_site"] || "Strict";
      cookie += `; SameSite=${ss}`;
      return cookie;
    },
    // server_redirect url -> response (302 리다이렉트)
    "server_redirect": (url2) => {
      return {
        __fl_response: true,
        status: 302,
        contentType: "text/plain",
        body: "",
        headers: { "Location": String(url2).replace(/[\r\n]/g, "") }
      };
    },
    // v12: 짧은 응답 별칭 — res-json / res-html / res-status / res-redirect / res-text
    "res-json": (statusOrBody, maybeBody) => {
      const isStatus = typeof statusOrBody === "number" && statusOrBody >= 100 && statusOrBody < 600;
      return {
        __fl_response: true,
        status: isStatus ? statusOrBody : 200,
        contentType: "application/json",
        body: isStatus ? maybeBody : statusOrBody
      };
    },
    "res-html": (body, status = 200) => ({
      __fl_response: true,
      status,
      contentType: "text/html; charset=utf-8",
      body
    }),
    "res-status": (code, body) => ({
      __fl_response: true,
      status: code,
      contentType: "application/json",
      body
    }),
    "res-redirect": (url2) => ({
      __fl_response: true,
      status: 302,
      contentType: "text/plain",
      body: "",
      headers: { "Location": String(url2).replace(/[\r\n]/g, "") }
    }),
    "res-text": (body, status = 200) => ({
      __fl_response: true,
      status,
      contentType: "text/plain; charset=utf-8",
      body
    }),
    // server_redirect_cookie url cookie -> response (302 리다이렉트 + Set-Cookie)
    "server_redirect_cookie": (url2, cookie) => {
      return {
        __fl_response: true,
        status: 302,
        contentType: "text/plain",
        body: "",
        headers: { "Location": url2, "Set-Cookie": cookie }
      };
    },
    // server_header response key value -> response (헤더 추가)
    "server_header": (response, key, value) => {
      const existing = response.headers || {};
      return { ...response, headers: { ...existing, [key]: value } };
    },
    // ── API 응답 헬퍼 ─────────────────────────────────────────────────
    // api_ok data              → 200 {:ok true :data ...}
    // api_ok "msg"             → 200 {:ok true :message ...}
    "api_ok": (data) => ({
      __fl_response: true,
      status: 200,
      contentType: "application/json",
      body: typeof data === "string" ? { ok: true, message: data } : { ok: true, data }
    }),
    // api_created data         → 201 {:ok true :data ...}
    "api_created": (data) => ({
      __fl_response: true,
      status: 201,
      contentType: "application/json",
      body: { ok: true, data }
    }),
    // api_error message [code] → 4xx/5xx {:ok false :error ...}
    // (api_error "Not found" 404)
    // (api_error "Server error")  → 500
    "api_error": (message, code) => ({
      __fl_response: true,
      status: code ?? 500,
      contentType: "application/json",
      body: { ok: false, error: message }
    }),
    // api_not_found [message]  → 404
    "api_not_found": (message) => ({
      __fl_response: true,
      status: 404,
      contentType: "application/json",
      body: { ok: false, error: message ?? "Not Found" }
    }),
    // api_bad_request [message] → 400
    "api_bad_request": (message) => ({
      __fl_response: true,
      status: 400,
      contentType: "application/json",
      body: { ok: false, error: message ?? "Bad Request" }
    }),
    // api_unauthorized [message] → 401
    "api_unauthorized": (message) => ({
      __fl_response: true,
      status: 401,
      contentType: "application/json",
      body: { ok: false, error: message ?? "Unauthorized" }
    }),
    // api_forbidden [message]  → 403
    "api_forbidden": (message) => ({
      __fl_response: true,
      status: 403,
      contentType: "application/json",
      body: { ok: false, error: message ?? "Forbidden" }
    }),
    // ── CORS 헬퍼 ────────────────────────────────────────────────────
    // server_cors response [origin] → response에 CORS 헤더 추가
    // (server_cors (server_json data))
    // (server_cors (server_json data) "https://app.example.com")
    "server_cors": (response, origin) => {
      const corsHeaders = {
        "Access-Control-Allow-Origin": origin ?? "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      };
      return { ...response, headers: { ...response.headers || {}, ...corsHeaders } };
    },
    // server_cors_all → 모든 라우트에 CORS 미들웨어 등록 (use와 함께)
    "server_cors_middleware": () => {
      return (req) => {
        if (req.method === "OPTIONS") {
          return {
            __fl_response: true,
            status: 204,
            contentType: "text/plain",
            body: "",
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
          };
        }
        return null;
      };
    },
    // server_options response -> 204 No Content (CORS preflight 응답)
    "server_options": (allowMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS") => {
      return {
        __fl_response: true,
        status: 204,
        contentType: "text/plain",
        body: "",
        headers: {
          "Access-Control-Allow-Methods": allowMethods,
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      };
    },
    // server_req_cookie req name -> string | null (쿠키 값 읽기)
    "server_req_cookie": (req, name) => {
      const cookieHeader = req.headers["cookie"];
      if (!cookieHeader) return null;
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      for (const cookie of cookies) {
        const [k, ...rest] = cookie.split("=");
        if (k.trim() === name) return rest.join("=").trim();
      }
      return null;
    },
    // server_wait_respond promise -> response object (비동기 응답 대기)
    "server_wait_respond": (promise) => {
      return {
        __fl_wait_and_respond: true,
        promise
      };
    },
    // server_req_body req -> string OR object (Content-Type 자동 가드)
    // 자잘 마찰 #1 (2026-04-25): Content-Type=application/json이면 이미 객체이므로
    // json_parse 두 번 하면 [object Object] 에러. (server_req_body req)는 string 보장.
    "server_req_body": (req) => {
      const b = req.body;
      if (b === null || b === void 0) return "";
      if (typeof b === "object") return JSON.stringify(b);
      return String(b);
    },
    // server_req_json req -> parsed object (자동 파싱, Content-Type 무관)
    // 자잘 마찰 #1 (2026-04-25): 사용자 18세션에서 18군데 우회 헬퍼 작성
    // (if (string? raw) (json_parse raw) raw) 대신 한 줄
    "server_req_json": (req) => {
      const b = req.body;
      if (b === null || b === void 0) return null;
      if (typeof b === "object") return b;
      try {
        return JSON.parse(String(b));
      } catch {
        return null;
      }
    },
    // server_req_query req [key] -> object or string
    "server_req_query": (req, key) => {
      if (key === void 0) {
        return req.query;
      }
      const value = req.query[key];
      if (Array.isArray(value)) return value[0];
      return value ?? null;
    },
    // server_req_files req -> array of multipart files
    "server_req_files": (req) => {
      const b = req.body;
      if (b instanceof Map) return b.get("files") ?? [];
      return [];
    },
    // server_req_fields req -> map of multipart text fields
    "server_req_fields": (req) => {
      const b = req.body;
      if (b instanceof Map) return b.get("fields") ?? /* @__PURE__ */ new Map();
      return null;
    },
    // server_req_header req name -> string
    "server_req_header": (req, name) => {
      const value = req.headers[name.toLowerCase()];
      if (Array.isArray(value)) return value[0];
      return value;
    },
    // server_req_headers req -> object (전체 헤더 맵)
    "server_req_headers": (req) => {
      const result = {};
      for (const [k, v] of Object.entries(req.headers)) {
        result[k] = Array.isArray(v) ? v[0] : v ?? "";
      }
      return result;
    },
    // server_req_param req name -> string
    "server_req_param": (req, name) => {
      return req.params[name] ?? null;
    },
    // server_req_params req -> object  (all URL params as an object)
    "server_req_params": (req) => {
      return req.params ?? {};
    },
    // v12: 짧은 별칭 — req-param / req-query / req-body / req-header
    "req-param": (req, name) => req.params[name] ?? null,
    "req-query": (req, key) => {
      if (key === void 0) return req.query ?? {};
      const v = (req.query ?? {})[key];
      return Array.isArray(v) ? v[0] : v ?? null;
    },
    "req-body": (req) => {
      const b = req.body;
      if (b === null || b === void 0) return null;
      if (typeof b === "object") return b;
      if (typeof b === "string") {
        try {
          return JSON.parse(b);
        } catch {
          return b;
        }
      }
      return b;
    },
    "req-header": (req, name) => {
      const v = req.headers[name.toLowerCase()];
      return Array.isArray(v) ? v[0] : v ?? null;
    },
    // server_req_method req -> string
    "server_req_method": (req) => {
      return req.method;
    },
    // server_req_path req -> string
    "server_req_path": (req) => {
      return req.path;
    },
    // Phase 57: 비동기 응답 보류 함수들
    // server_req_id -> string | null (현재 요청 ID)
    "server_req_id": () => {
      return currentRequestId;
    },
    // server_hold_response reqId -> null (응답 보류)
    "server_hold_response": (reqId) => {
      if (currentRequestId === reqId) {
        pendingResponses.set(reqId, true);
      }
      return null;
    },
    // server_send_held reqId status body -> boolean (보류된 응답 전송)
    "server_send_held": (reqId, status, body) => {
      const isPending = pendingResponses.has(reqId);
      if (isPending) {
        pendingResponses.delete(reqId);
        return true;
      }
      return false;
    },
    // ── WebSocket 터널 프록시 함수들 ─────────────────────────────
    // server_on_upgrade fnName -> null (WS upgrade 핸들러 등록)
    "server_on_upgrade": (fnName) => {
      upgradeHandler = fnName;
      return null;
    },
    // server_on_ws_message fnName -> null (클라이언트 WS 메시지 핸들러)
    "server_on_ws_message": (fnName) => {
      wsClientMessageHandler = fnName;
      return null;
    },
    // server_on_ws_close fnName -> null (클라이언트 WS 종료 핸들러)
    "server_on_ws_close": (fnName) => {
      wsClientCloseHandler = fnName;
      return null;
    },
    // ws_send_to_client sessionId data [isBinary] -> boolean
    "ws_send_to_client": (sessionId, data, isBinary = false) => {
      const socket = wsPublicMap.get(sessionId);
      if (!socket || socket.destroyed) return false;
      try {
        const payload = isBinary ? Buffer.from(data, "base64") : Buffer.from(data);
        const opcode = isBinary ? 2 : 1;
        let frame;
        if (payload.length < 126) {
          const h = Buffer.alloc(2);
          h[0] = 128 | opcode;
          h[1] = payload.length;
          frame = Buffer.concat([h, payload]);
        } else if (payload.length < 65536) {
          const h = Buffer.alloc(4);
          h[0] = 128 | opcode;
          h[1] = 126;
          h.writeUInt16BE(payload.length, 2);
          frame = Buffer.concat([h, payload]);
        } else {
          const h = Buffer.alloc(10);
          h[0] = 128 | opcode;
          h[1] = 127;
          h.writeBigUInt64BE(BigInt(payload.length), 2);
          frame = Buffer.concat([h, payload]);
        }
        socket.write(frame);
        return true;
      } catch {
        return false;
      }
    },
    // ws_close_client sessionId [code] -> null
    "ws_close_client": (sessionId, code = 1e3) => {
      const socket = wsPublicMap.get(sessionId);
      if (socket && !socket.destroyed) {
        const b = Buffer.alloc(4);
        b[0] = 136;
        b[1] = 2;
        b.writeUInt16BE(code, 2);
        socket.write(b);
        socket.end();
        wsPublicMap.delete(sessionId);
      }
      return null;
    },
    // server_req_session_id req -> string | null
    "server_req_session_id": (req) => {
      return req?.session_id ?? null;
    }
  };
}
var http, url, crypto2, fs5, path6, os2, __activeServer;
var init_stdlib_http_server = __esm({
  "src/stdlib-http-server.ts"() {
    http = __toESM(require("http"));
    url = __toESM(require("url"));
    crypto2 = __toESM(require("crypto"));
    fs5 = __toESM(require("fs"));
    path6 = __toESM(require("path"));
    os2 = __toESM(require("os"));
    __activeServer = { server: null };
  }
});

// src/stdlib-lazy-registry.ts
var stdlib_lazy_registry_exports = {};
__export(stdlib_lazy_registry_exports, {
  getAvailableModules: () => getAvailableModules,
  isModuleLoaded: () => isModuleLoaded,
  requireModule: () => requireModule
});
module.exports = __toCommonJS(stdlib_lazy_registry_exports);
var LAZY_REGISTRY = {
  "ws": (interp) => {
    const { createWsModule: createWsModule2 } = (init_stdlib_ws(), __toCommonJS(stdlib_ws_exports));
    return createWsModule2(interp ? (n, a) => interp.callUserFunction(n, a) : () => null);
  },
  "wsc": (interp) => {
    const { createWscModule: createWscModule2 } = (init_stdlib_wsc(), __toCommonJS(stdlib_wsc_exports));
    return createWscModule2(interp ? (n, a) => interp.callUserFunction(n, a) : () => null);
  },
  "crypto-rsa": () => {
    const { createCryptoRsaModule: createCryptoRsaModule2 } = (init_stdlib_crypto_rsa(), __toCommonJS(stdlib_crypto_rsa_exports));
    return createCryptoRsaModule2();
  },
  "totp": () => {
    const { createTotpModule: createTotpModule2 } = (init_stdlib_totp(), __toCommonJS(stdlib_totp_exports));
    return createTotpModule2();
  },
  "mail": () => {
    const { createMailModule: createMailModule2 } = (init_stdlib_mail(), __toCommonJS(stdlib_mail_exports));
    return createMailModule2();
  },
  "webauthn": () => {
    const { createWebauthnModule: createWebauthnModule2 } = (init_stdlib_webauthn(), __toCommonJS(stdlib_webauthn_exports));
    return createWebauthnModule2();
  },
  "queue": () => {
    const { createQueueHelpersModule: createQueueHelpersModule2 } = (init_stdlib_queue_helpers(), __toCommonJS(stdlib_queue_helpers_exports));
    return createQueueHelpersModule2();
  },
  "workflow": () => {
    const { createWorkflowModule: createWorkflowModule2 } = (init_stdlib_workflow(), __toCommonJS(stdlib_workflow_exports));
    return createWorkflowModule2();
  },
  "resource": () => {
    const { createResourceModule: createResourceModule2 } = (init_stdlib_resource(), __toCommonJS(stdlib_resource_exports));
    return createResourceModule2();
  },
  "mariadb": () => {
    const { createMariadbModule: createMariadbModule2 } = (init_stdlib_mariadb(), __toCommonJS(stdlib_mariadb_exports));
    return createMariadbModule2();
  },
  "mongodb": () => {
    const { createMongodbModule: createMongodbModule2 } = (init_stdlib_mongodb(), __toCommonJS(stdlib_mongodb_exports));
    return createMongodbModule2();
  },
  "async": (interp) => {
    const { createAsyncModule: createAsyncModule2 } = (init_stdlib_async(), __toCommonJS(stdlib_async_exports));
    return createAsyncModule2(interp ? (n, a) => interp.callUserFunction(n, a) : () => null);
  },
  "channel": () => {
    const { createChannelModule: createChannelModule2 } = (init_stdlib_channel(), __toCommonJS(stdlib_channel_exports));
    return createChannelModule2();
  },
  "immutable": () => {
    const { createImmutableModule: createImmutableModule2 } = (init_immutable(), __toCommonJS(immutable_exports));
    return createImmutableModule2();
  },
  "ai": () => {
    const { createAiNativeModule: createAiNativeModule2 } = (init_stdlib_ai_native(), __toCommonJS(stdlib_ai_native_exports));
    return createAiNativeModule2();
  },
  "compile": () => {
    const { createCompileModule: createCompileModule2 } = (init_stdlib_compile(), __toCommonJS(stdlib_compile_exports));
    return createCompileModule2();
  },
  "registry": () => {
    const { createRegistryModule: createRegistryModule2 } = (init_stdlib_registry(), __toCommonJS(stdlib_registry_exports));
    return createRegistryModule2();
  },
  "oci": () => {
    throw new Error("oci \uBAA8\uB4C8\uC740 \uBCC4\uB3C4 \uD328\uD0A4\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
  },
  "orm": () => {
    const { createOrmModule: createOrmModule2 } = (init_stdlib_orm(), __toCommonJS(stdlib_orm_exports));
    return createOrmModule2();
  },
  "validation": () => {
    const { createValidationModule: createValidationModule2 } = (init_stdlib_validation(), __toCommonJS(stdlib_validation_exports));
    return createValidationModule2();
  },
  "middleware": () => {
    const { createMiddlewareModule: createMiddlewareModule2 } = (init_stdlib_middleware(), __toCommonJS(stdlib_middleware_exports));
    return createMiddlewareModule2();
  },
  "table": () => {
    const { createTableModule: createTableModule2 } = (init_stdlib_table(), __toCommonJS(stdlib_table_exports));
    return createTableModule2();
  },
  "stats": () => {
    throw new Error("stats \uBAA8\uB4C8\uC740 \uBCC4\uB3C4 \uD328\uD0A4\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
  },
  "plot": () => {
    throw new Error("plot \uBAA8\uB4C8\uC740 \uBCC4\uB3C4 \uD328\uD0A4\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
  },
  "service": () => {
    const { createServiceModule: createServiceModule2 } = (init_stdlib_service(), __toCommonJS(stdlib_service_exports));
    return createServiceModule2();
  },
  "markdown": () => {
    const { createMarkdownModule: createMarkdownModule2 } = (init_stdlib_markdown(), __toCommonJS(stdlib_markdown_exports));
    return createMarkdownModule2();
  },
  "feed": () => {
    throw new Error("feed \uBAA8\uB4C8\uC740 \uBCC4\uB3C4 \uD328\uD0A4\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
  },
  "blog": () => {
    const { createBlogModule: createBlogModule2 } = (init_stdlib_blog(), __toCommonJS(stdlib_blog_exports));
    return createBlogModule2();
  },
  "cloud": () => {
    throw new Error("cloud \uBAA8\uB4C8\uC740 \uBCC4\uB3C4 \uD328\uD0A4\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
  },
  "matrix": () => {
    throw new Error("matrix \uBAA8\uB4C8\uC740 \uBCC4\uB3C4 \uD328\uD0A4\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
  },
  "audit": () => {
    const { createAuditModule: createAuditModule2 } = (init_stdlib_audit(), __toCommonJS(stdlib_audit_exports));
    return createAuditModule2();
  },
  "http-server": (interp) => {
    const { createHttpServerModule: createHttpServerModule2 } = (init_stdlib_http_server(), __toCommonJS(stdlib_http_server_exports));
    return createHttpServerModule2(
      interp ? (n, a) => interp.callUserFunction(n, a) : () => null,
      interp ? (fn, a) => interp.callFunctionValue(fn, a) : () => null
    );
  }
};
var loaded = /* @__PURE__ */ new Set();
function getAvailableModules() {
  return Object.keys(LAZY_REGISTRY);
}
function isModuleLoaded(name) {
  return loaded.has(name);
}
function requireModule(name, interp) {
  const normalized = name.replace(/_/g, "-");
  if (loaded.has(normalized)) return true;
  const factory = LAZY_REGISTRY[normalized];
  if (!factory) {
    console.warn(`\u26A0\uFE0F  [FreeLang] require: \uC54C \uC218 \uC5C6\uB294 \uBAA8\uB4C8 "${name}". \uC0AC\uC6A9 \uAC00\uB2A5: ${Object.keys(LAZY_REGISTRY).join(", ")}`);
    return false;
  }
  try {
    const mod = factory(interp);
    interp.registerModule(mod);
    loaded.add(normalized);
    return true;
  } catch (e) {
    console.error(`\u274C [FreeLang] require "${name}" \uB85C\uB4DC \uC2E4\uD328:`, e);
    return false;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getAvailableModules,
  isModuleLoaded,
  requireModule
});
