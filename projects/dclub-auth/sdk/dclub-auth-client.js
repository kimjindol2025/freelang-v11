/**
 * @dclub-auth/client — dclub-auth OIDC 클라이언트 SDK (JS/TS)
 *
 * 외부 의존 0개. 브라우저(window) + Node 양용. 약 300줄 단일 파일.
 *
 * 사용법:
 *   import { createClient } from "./dclub-auth-client.js";
 *   const auth = createClient({
 *     issuer: "https://auth.dclub.kr",
 *     clientId: "blog",
 *     redirectUri: "https://blog.dclub.kr/oauth/callback",
 *     scope: "openid profile email"
 *   });
 *   auth.signIn();          // → /authorize 로 리다이렉트
 *   await auth.handleCallback(); // 콜백 페이지에서 호출
 *   const user = await auth.getUser();   // /userinfo
 *   const token = await auth.getAccessToken(); // 자동 갱신
 *   auth.signOut();
 *
 * 보안:
 *   - PKCE (S256) 자동 처리
 *   - state CSRF 검증
 *   - nonce replay 방어
 *   - 토큰은 sessionStorage (브라우저) 또는 메모리 (Node)
 */

const isBrowser = typeof window !== "undefined" && typeof window.location !== "undefined";

// ── 유틸 ──────────────────────────────────────────────────
function randomBase64Url(bytes) {
  const buf = new Uint8Array(bytes);
  if (isBrowser) {
    crypto.getRandomValues(buf);
  } else {
    const nodeCrypto = require("crypto");
    const r = nodeCrypto.randomBytes(bytes);
    for (let i = 0; i < bytes; i++) buf[i] = r[i];
  }
  return base64UrlEncode(buf);
}

function base64UrlEncode(bytes) {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  const b64 = isBrowser ? btoa(str) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function sha256Base64Url(input) {
  if (isBrowser) {
    const buf = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return base64UrlEncode(new Uint8Array(hash));
  } else {
    const nodeCrypto = require("crypto");
    return nodeCrypto.createHash("sha256").update(input).digest("base64url");
  }
}

function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1];
  const padded = payload + "=".repeat((4 - payload.length % 4) % 4);
  const decoded = isBrowser
    ? atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
    : Buffer.from(padded, "base64").toString("utf8");
  try { return JSON.parse(decoded); } catch { return null; }
}

// ── 저장소 추상화 ────────────────────────────────────────
function createStorage() {
  if (isBrowser && window.sessionStorage) {
    return {
      get: (k) => window.sessionStorage.getItem(`dclub-auth:${k}`),
      set: (k, v) => window.sessionStorage.setItem(`dclub-auth:${k}`, v),
      remove: (k) => window.sessionStorage.removeItem(`dclub-auth:${k}`),
    };
  }
  // Node 또는 storage 없는 환경: 메모리
  const mem = {};
  return {
    get: (k) => mem[k] ?? null,
    set: (k, v) => { mem[k] = v; },
    remove: (k) => { delete mem[k]; },
  };
}

// ── 메인 클라이언트 ──────────────────────────────────────
function createClient(config) {
  const {
    issuer,
    clientId,
    clientSecret,           // public client(SPA)면 생략
    redirectUri,
    scope = "openid profile email",
    storage = createStorage(),
  } = config;

  let discoveryCache = null;

  async function discover() {
    if (discoveryCache) return discoveryCache;
    const res = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(`discovery failed: ${res.status}`);
    discoveryCache = await res.json();
    return discoveryCache;
  }

  async function signIn(extraParams = {}) {
    const d = await discover();
    const state = randomBase64Url(16);
    const nonce = randomBase64Url(16);
    const verifier = randomBase64Url(32);
    const challenge = await sha256Base64Url(verifier);

    storage.set("verifier", verifier);
    storage.set("state", state);
    storage.set("nonce", nonce);

    const url = new URL(d.authorization_endpoint);
    const params = {
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...extraParams,
    };
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    if (isBrowser) {
      window.location.href = url.toString();
    } else {
      return url.toString();
    }
  }

  async function handleCallback(callbackUrl) {
    const url = new URL(callbackUrl || (isBrowser ? window.location.href : ""));
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) throw new Error(`auth error: ${error} - ${url.searchParams.get("error_description") ?? ""}`);
    if (!code) throw new Error("no code in callback");

    const expectedState = storage.get("state");
    if (returnedState !== expectedState) throw new Error("state mismatch (CSRF)");

    const verifier = storage.get("verifier");
    if (!verifier) throw new Error("no PKCE verifier (storage cleared?)");

    const d = await discover();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    });
    if (clientSecret) body.set("client_secret", clientSecret);

    const res = await fetch(d.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`token endpoint: ${res.status} ${await res.text()}`);
    const tokens = await res.json();

    // nonce 검증 (id_token 의 nonce 클레임)
    const expectedNonce = storage.get("nonce");
    const idClaims = tokens.id_token ? decodeJwt(tokens.id_token) : null;
    if (idClaims && idClaims.nonce && idClaims.nonce !== expectedNonce) {
      throw new Error("nonce mismatch (replay?)");
    }

    storage.remove("verifier");
    storage.remove("state");
    storage.remove("nonce");

    storeTokens(tokens);
    return tokens;
  }

  function storeTokens(tokens) {
    storage.set("access_token", tokens.access_token);
    storage.set("expires_at", String(Date.now() + (tokens.expires_in ?? 3600) * 1000));
    if (tokens.refresh_token) storage.set("refresh_token", tokens.refresh_token);
    if (tokens.id_token) storage.set("id_token", tokens.id_token);
  }

  async function refresh() {
    const rt = storage.get("refresh_token");
    if (!rt) throw new Error("no refresh_token");
    const d = await discover();
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: rt,
      client_id: clientId,
    });
    if (clientSecret) body.set("client_secret", clientSecret);

    const res = await fetch(d.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      // refresh 실패 → 강제 재로그인
      signOut();
      throw new Error(`refresh failed: ${res.status}`);
    }
    const tokens = await res.json();
    storeTokens(tokens);
    return tokens;
  }

  async function getAccessToken() {
    const token = storage.get("access_token");
    const expiresAt = parseInt(storage.get("expires_at") ?? "0", 10);
    // 5분 미만 남으면 갱신
    if (token && expiresAt - Date.now() > 5 * 60 * 1000) return token;
    if (storage.get("refresh_token")) {
      const refreshed = await refresh();
      return refreshed.access_token;
    }
    return null;
  }

  async function getUser() {
    const token = await getAccessToken();
    if (!token) return null;
    const d = await discover();
    const res = await fetch(d.userinfo_endpoint, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        // 토큰 만료 의심 → 갱신 후 1회 재시도
        await refresh();
        return getUser();
      }
      throw new Error(`userinfo: ${res.status}`);
    }
    return res.json();
  }

  function isAuthenticated() {
    return !!storage.get("access_token");
  }

  function signOut() {
    storage.remove("access_token");
    storage.remove("refresh_token");
    storage.remove("id_token");
    storage.remove("expires_at");
  }

  return {
    signIn,
    handleCallback,
    getAccessToken,
    getUser,
    refresh,
    isAuthenticated,
    signOut,
    discover,
  };
}

// ── UMD-style export (CJS + 브라우저 글로벌) ─────────────
// ESM이 필요하면 별도 .mjs 파일을 import 또는 dynamic import 권장.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { createClient };
}
if (typeof window !== "undefined") {
  window.DclubAuth = { createClient };
}
