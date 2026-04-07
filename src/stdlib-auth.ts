// FreeLang v9: Authentication Standard Library
// Phase 21: JWT (native crypto), API key, password hashing, session tokens

import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

// ── JWT helpers (Node.js crypto only — no external deps) ─────────────────────

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function jwtSign(payload: any, secret: string, expirySeconds: number): string {
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body   = b64url(JSON.stringify({ ...payload, iat, exp: iat + expirySeconds }));
  const sig    = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function jwtVerify(token: string, secret: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
    // timing-safe compare
    const a = Buffer.from(sig + "=".repeat((4 - sig.length % 4) % 4), "base64");
    const b = Buffer.from(expected + "=".repeat((4 - expected.length % 4) % 4), "base64");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ── Module ────────────────────────────────────────────────────────────────────

export function createAuthModule() {
  return {
    // ── JWT ──────────────────────────────────────────────────

    // auth_jwt_sign payload secret expiry_seconds → token
    "auth_jwt_sign": (payload: any, secret: string, expiry: number = 3600): string => {
      return jwtSign(payload, secret, expiry);
    },

    // auth_jwt_verify token secret → payload or null (null = invalid/expired)
    "auth_jwt_verify": (token: string, secret: string): any => {
      return jwtVerify(token, secret);
    },

    // auth_jwt_decode token → payload (no signature check)
    "auth_jwt_decode": (token: string): any => {
      try {
        const [, body] = token.split(".");
        return JSON.parse(b64urlDecode(body));
      } catch { return null; }
    },

    // auth_jwt_expired token → boolean
    "auth_jwt_expired": (token: string): boolean => {
      try {
        const [, body] = token.split(".");
        const { exp } = JSON.parse(b64urlDecode(body));
        return exp ? exp < Math.floor(Date.now() / 1000) : false;
      } catch { return true; }
    },

    // ── Bearer / API Key extraction ──────────────────────────

    // auth_bearer_extract req → token string or null
    "auth_bearer_extract": (req: any): string | null => {
      const auth = req?.headers?.authorization ?? req?.headers?.Authorization ?? "";
      return typeof auth === "string" && auth.startsWith("Bearer ")
        ? auth.slice(7)
        : null;
    },

    // auth_apikey_valid req validKeys → boolean
    // Checks X-API-Key header, then ?api_key query param
    "auth_apikey_valid": (req: any, validKeys: string[]): boolean => {
      const key = req?.headers?.["x-api-key"]
        ?? req?.query?.api_key
        ?? req?.body?.api_key
        ?? "";
      return Array.isArray(validKeys) && validKeys.includes(String(key));
    },

    // auth_apikey_get req → string (the raw key, or "")
    "auth_apikey_get": (req: any): string => {
      return String(
        req?.headers?.["x-api-key"] ?? req?.query?.api_key ?? req?.body?.api_key ?? ""
      );
    },

    // ── Password hashing (sha256 + random salt) ──────────────

    // auth_hash_password password → "salt:hash"
    "auth_hash_password": (password: string): string => {
      const salt = randomBytes(16).toString("hex");
      const hash = createHash("sha256").update(salt + password).digest("hex");
      return `${salt}:${hash}`;
    },

    // auth_verify_password password stored → boolean
    "auth_verify_password": (password: string, stored: string): boolean => {
      try {
        const [salt, hash] = stored.split(":");
        const computed = createHash("sha256").update(salt + password).digest("hex");
        const a = Buffer.from(hash, "hex");
        const b = Buffer.from(computed, "hex");
        return a.length === b.length && timingSafeEqual(a, b);
      } catch { return false; }
    },

    // ── Tokens / HMAC ────────────────────────────────────────

    // auth_random_token bytes → hex string
    "auth_random_token": (bytes: number = 32): string => {
      return randomBytes(bytes).toString("hex");
    },

    // auth_hmac data secret → hex
    "auth_hmac": (data: string, secret: string): string => {
      return createHmac("sha256", secret).update(data).digest("hex");
    },

    // auth_sha256 data → hex
    "auth_sha256": (data: string): string => {
      return createHash("sha256").update(data).digest("hex");
    },

    // auth_base64 data → base64 string
    "auth_base64": (data: string): string => Buffer.from(data).toString("base64"),

    // auth_base64_decode b64 → string
    "auth_base64_decode": (b64: string): string => Buffer.from(b64, "base64").toString("utf8"),
  };
}
