// FreeLang v11: TOTP (Time-Based One-Time Password) — RFC 6238 / RFC 4226
//
// dclub-auth IdP의 2단계 인증 기반시설.
// HMAC-SHA1 + 30초 step + 6 digits + ±1 step clock skew window.
// 외부 npm 0개 — Node 표준 crypto 만 사용.
//
// 표준 호환:
//   - Google Authenticator, Authy, 1Password 등 모든 RFC 6238 클라이언트와 호환
//   - otpauth:// URI 표준 (Key URI Format) 사용

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// ── Base32 (RFC 4648, no padding for TOTP) ────────────────────────
const BASE32_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHA[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHA[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHA.indexOf(clean[i]);
    if (idx === -1) throw new Error(`invalid base32 char: ${clean[i]}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ── HOTP / TOTP core (RFC 4226 §5.3) ──────────────────────────────
function hotp(secret: Buffer, counter: number, digits: number = 6): string {
  // counter as 8-byte big-endian
  const ctrBuf = Buffer.alloc(8);
  // JS bitwise is 32-bit; for 64-bit counter split into high/low
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  ctrBuf.writeUInt32BE(high, 0);
  ctrBuf.writeUInt32BE(low, 4);

  const hmac = createHmac("sha1", secret).update(ctrBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const truncated = ((hmac[offset] & 0x7f) << 24)
                  | ((hmac[offset + 1] & 0xff) << 16)
                  | ((hmac[offset + 2] & 0xff) << 8)
                  |  (hmac[offset + 3] & 0xff);
  const code = truncated % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}

function totpCounter(unixSeconds: number, step: number = 30): number {
  return Math.floor(unixSeconds / step);
}

export function createTotpModule() {
  return {
    // totp_secret_generate bytes -> string (base32, default 20 bytes = 160 bits = 32 chars)
    "totp_secret_generate": (bytes: number = 20): string => {
      const buf = randomBytes(bytes);
      return base32Encode(buf);
    },

    // totp_now secret_b32 -> string (현재 시각의 6자리 코드, 디버그·등록용)
    "totp_now": (secretB32: string): string => {
      const secret = base32Decode(secretB32);
      const counter = totpCounter(Math.floor(Date.now() / 1000));
      return hotp(secret, counter, 6);
    },

    // totp_verify secret_b32 code window_steps -> boolean
    // window=1 → 현재 ±1 step (총 90초 윈도우) 허용 (시계 오차 보정)
    "totp_verify": (secretB32: string, code: string, window: number = 1): boolean => {
      try {
        if (!/^\d+$/.test(code)) return false;
        const secret = base32Decode(secretB32);
        const now = totpCounter(Math.floor(Date.now() / 1000));
        const expected = Buffer.from(code);
        for (let i = -window; i <= window; i++) {
          const candidate = Buffer.from(hotp(secret, now + i, code.length));
          if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
            return true;
          }
        }
        return false;
      } catch { return false; }
    },

    // totp_uri label issuer secret_b32 -> string (otpauth://totp/... QR 코드 표준)
    "totp_uri": (label: string, issuer: string, secretB32: string): string => {
      const enc = (s: string) => encodeURIComponent(s);
      return `otpauth://totp/${enc(issuer)}:${enc(label)}?secret=${secretB32}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
    },
  };
}
