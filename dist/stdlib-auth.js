"use strict";
// FreeLang v9: Authentication Standard Library
// Phase 21: JWT (native crypto), API key, password hashing, session tokens
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthModule = createAuthModule;
const crypto_1 = require("crypto");
// ── JWT helpers (Node.js crypto only — no external deps) ─────────────────────
function b64url(input) {
    const buf = typeof input === "string" ? Buffer.from(input) : input;
    return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s) {
    return Buffer.from(s, "base64url").toString("utf8");
}
function jwtSign(payload, secret, expirySeconds) {
    const iat = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = b64url(JSON.stringify({ ...payload, iat, exp: iat + expirySeconds }));
    const sig = b64url((0, crypto_1.createHmac)("sha256", secret).update(`${header}.${body}`).digest());
    return `${header}.${body}.${sig}`;
}
function jwtVerify(token, secret) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3)
            return null;
        const [header, body, sig] = parts;
        const expected = b64url((0, crypto_1.createHmac)("sha256", secret).update(`${header}.${body}`).digest());
        // timing-safe compare
        const a = Buffer.from(sig + "=".repeat((4 - sig.length % 4) % 4), "base64");
        const b = Buffer.from(expected + "=".repeat((4 - expected.length % 4) % 4), "base64");
        if (a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b))
            return null;
        const payload = JSON.parse(b64urlDecode(body));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
// ── Module ────────────────────────────────────────────────────────────────────
function createAuthModule() {
    return {
        // ── JWT ──────────────────────────────────────────────────
        // auth_jwt_sign payload secret expiry_seconds → token
        "auth_jwt_sign": (payload, secret, expiry = 3600) => {
            return jwtSign(payload, secret, expiry);
        },
        // auth_jwt_verify token secret → payload or null (null = invalid/expired)
        "auth_jwt_verify": (token, secret) => {
            return jwtVerify(token, secret);
        },
        // auth_jwt_decode token → payload (no signature check)
        "auth_jwt_decode": (token) => {
            try {
                const [, body] = token.split(".");
                return JSON.parse(b64urlDecode(body));
            }
            catch {
                return null;
            }
        },
        // auth_jwt_expired token → boolean
        "auth_jwt_expired": (token) => {
            try {
                const [, body] = token.split(".");
                const { exp } = JSON.parse(b64urlDecode(body));
                return exp ? exp < Math.floor(Date.now() / 1000) : false;
            }
            catch {
                return true;
            }
        },
        // ── Bearer / API Key extraction ──────────────────────────
        // auth_bearer_extract req → token string or null
        "auth_bearer_extract": (req) => {
            const auth = req?.headers?.authorization ?? req?.headers?.Authorization ?? "";
            return typeof auth === "string" && auth.startsWith("Bearer ")
                ? auth.slice(7)
                : null;
        },
        // auth_apikey_valid req validKeys → boolean
        // Checks X-API-Key header, then ?api_key query param
        "auth_apikey_valid": (req, validKeys) => {
            const key = req?.headers?.["x-api-key"]
                ?? req?.query?.api_key
                ?? req?.body?.api_key
                ?? "";
            return Array.isArray(validKeys) && validKeys.includes(String(key));
        },
        // auth_apikey_get req → string (the raw key, or "")
        "auth_apikey_get": (req) => {
            return String(req?.headers?.["x-api-key"] ?? req?.query?.api_key ?? req?.body?.api_key ?? "");
        },
        // ── Password hashing (sha256 + random salt) ──────────────
        // auth_hash_password password → "salt:hash"
        "auth_hash_password": (password) => {
            const salt = (0, crypto_1.randomBytes)(16).toString("hex");
            const hash = (0, crypto_1.createHash)("sha256").update(salt + password).digest("hex");
            return `${salt}:${hash}`;
        },
        // auth_verify_password password stored → boolean
        "auth_verify_password": (password, stored) => {
            try {
                const [salt, hash] = stored.split(":");
                const computed = (0, crypto_1.createHash)("sha256").update(salt + password).digest("hex");
                const a = Buffer.from(hash, "hex");
                const b = Buffer.from(computed, "hex");
                return a.length === b.length && (0, crypto_1.timingSafeEqual)(a, b);
            }
            catch {
                return false;
            }
        },
        // ── Tokens / HMAC ────────────────────────────────────────
        // auth_random_token bytes → hex string
        "auth_random_token": (bytes = 32) => {
            return (0, crypto_1.randomBytes)(bytes).toString("hex");
        },
        // auth_hmac data secret → hex
        "auth_hmac": (data, secret) => {
            return (0, crypto_1.createHmac)("sha256", secret).update(data).digest("hex");
        },
        // auth_sha256 data → hex
        "auth_sha256": (data) => {
            return (0, crypto_1.createHash)("sha256").update(data).digest("hex");
        },
        // auth_base64 data → base64 string
        "auth_base64": (data) => Buffer.from(data).toString("base64"),
        // auth_base64_decode b64 → string
        "auth_base64_decode": (b64) => Buffer.from(b64, "base64").toString("utf8"),
    };
}
//# sourceMappingURL=stdlib-auth.js.map