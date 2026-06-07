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

// src/ext-auth.ts
var ext_auth_exports = {};
__export(ext_auth_exports, {
  createCryptoRsaModule: () => createCryptoRsaModule,
  createMailModule: () => createMailModule,
  createTotpModule: () => createTotpModule,
  createWebauthnModule: () => createWebauthnModule
});
module.exports = __toCommonJS(ext_auth_exports);

// src/stdlib-webauthn.ts
var import_crypto = require("crypto");
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
      return (0, import_crypto.randomBytes)(bytes).toString("base64url");
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
        const expectedRpHash = (0, import_crypto.createHash)("sha256").update(args.expected_rp_id).digest();
        if (Buffer.compare(auth.rpIdHash, expectedRpHash) !== 0) return { ok: false, error: "rp_id_hash mismatch" };
        if (!(auth.flags & 1)) return { ok: false, error: "user not present" };
        if (auth.signCount !== 0 && auth.signCount <= (args.prev_sign_count ?? 0)) {
          return { ok: false, error: `signCount regression (${auth.signCount} <= ${args.prev_sign_count})` };
        }
        const cdHash = (0, import_crypto.createHash)("sha256").update(clientDataJson).digest();
        const signedData = Buffer.concat([authenticatorData, cdHash]);
        const pub = (0, import_crypto.createPublicKey)({ key: jwk, format: "jwk" });
        const verifier = (0, import_crypto.createVerify)("SHA256");
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

// src/stdlib-totp.ts
var import_crypto2 = require("crypto");
var BASE32_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
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

// src/stdlib-crypto-rsa.ts
var import_crypto3 = require("crypto");
function createCryptoRsaModule() {
  return {
    // ── RSA 키 생성 ────────────────────────────────────────────
    // crypto_rsa_generate bits -> map (publicKey/privateKey PEM)
    "crypto_rsa_generate": (bits = 2048) => {
      const size = bits >= 2048 ? bits : 2048;
      const { publicKey, privateKey } = (0, import_crypto3.generateKeyPairSync)("rsa", {
        modulusLength: size,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
      });
      return { publicKey, privateKey };
    },
    // ── RS256 서명 / 검증 ─────────────────────────────────────
    // crypto_rsa_sign private_pem data -> string (base64url 서명)
    "crypto_rsa_sign": (privateKeyPem, data) => {
      const signer = (0, import_crypto3.createSign)("RSA-SHA256");
      signer.update(data);
      signer.end();
      return signer.sign(privateKeyPem).toString("base64url");
    },
    // crypto_rsa_verify public_pem data signature_b64url -> boolean
    "crypto_rsa_verify": (publicKeyPem, data, sigB64Url) => {
      try {
        const verifier = (0, import_crypto3.createVerify)("RSA-SHA256");
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
      return (0, import_crypto3.createHash)("sha256").update(verifier, "utf8").digest("base64url");
    },
    // crypto_rsa_public_to_jwk public_pem kid -> map (kty/n/e/kid/alg/use)
    "crypto_rsa_public_to_jwk": (publicKeyPem, kid) => {
      const key = (0, import_crypto3.createPublicKey)(publicKeyPem);
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

// src/stdlib-mail.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_crypto4 = require("crypto");
var tls = require("tls");
function createMailModule() {
  return {
    // mail_outbox_write dir to subject body -> string (파일 경로)
    "mail_outbox_write": (dir, to, subject, body) => {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
      }
      const id = `${Date.now()}-${(0, import_crypto4.randomBytes)(6).toString("hex")}.json`;
      const file = path.join(dir, id);
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
            return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
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
      return new Promise((resolve) => {
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
          resolve({ ok: false, log: log.join("\n"), error: msg });
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
                  resolve({ ok: true, log: log.join("\n") });
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
      return new Promise((resolve) => {
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
                  resolve({
                    ok: true,
                    id: json.id,
                    message: "\uBA54\uC77C \uC804\uC1A1 \uC644\uB8CC"
                  });
                } else {
                  resolve({
                    ok: false,
                    error: json.message || "Mailgun API \uC624\uB958"
                  });
                }
              } catch (e) {
                resolve({
                  ok: false,
                  error: `\uD30C\uC2F1 \uC2E4\uD328: ${e.message}`
                });
              }
            });
          });
          req.on("error", (e) => {
            resolve({
              ok: false,
              error: `\uC694\uCCAD \uC2E4\uD328: ${e.message}`
            });
          });
          req.write(postData);
          req.end();
        } catch (e) {
          resolve({
            ok: false,
            error: `\uC608\uC678: ${e.message}`
          });
        }
      });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCryptoRsaModule,
  createMailModule,
  createTotpModule,
  createWebauthnModule
});
