// smoke-webauthn.js — Phase J 헤드리스 e2e
//
// 브라우저 navigator.credentials API 가 없으므로 Node webcrypto 로 시뮬레이션.
// 실제 인증기(Yubikey/Touch ID)가 하는 일을 코드로 모방:
//   1) ES256 키쌍 생성
//   2) attestationObject 구성 (fmt="none" + authData with AT flag + COSE_Key)
//   3) clientDataJSON + 서명 (assertion)
//   4) 서버 4 라우트 흐름 통과

const crypto = require("crypto");

const BASE = "http://localhost:30100";
const RP_ID = "localhost";
const ORIGIN = BASE;

// ── 헬퍼 ─────────────────────────────────────────────
function b64u(buf) { return Buffer.from(buf).toString("base64url"); }
function fromB64u(s) { return Buffer.from(s, "base64url"); }
function sha256(buf) { return crypto.createHash("sha256").update(buf).digest(); }

// CBOR 인코더 (최소) — uint/bytes/text/map/neg
function cborEncode(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 0) return cborInt(0, value);
    return cborInt(1, -1 - value);
  }
  if (Buffer.isBuffer(value)) return Buffer.concat([cborInt(2, value.length), value]);
  if (typeof value === "string") {
    const b = Buffer.from(value, "utf8");
    return Buffer.concat([cborInt(3, b.length), b]);
  }
  if (Array.isArray(value)) {
    const parts = [cborInt(4, value.length), ...value.map(cborEncode)];
    return Buffer.concat(parts);
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    const parts = [cborInt(5, keys.length)];
    for (const k of keys) {
      const ki = parseInt(k, 10);
      parts.push(cborEncode(Number.isInteger(ki) ? ki : k));
      parts.push(cborEncode(value[k]));
    }
    return Buffer.concat(parts);
  }
  throw new Error(`cbor: unsupported ${typeof value}`);
}
function cborInt(major, val) {
  const m = major << 5;
  if (val < 24) return Buffer.from([m | val]);
  if (val < 0x100) return Buffer.from([m | 24, val]);
  if (val < 0x10000) {
    const b = Buffer.alloc(3); b[0] = m | 25; b.writeUInt16BE(val, 1); return b;
  }
  if (val < 0x100000000) {
    const b = Buffer.alloc(5); b[0] = m | 26; b.writeUInt32BE(val, 1); return b;
  }
  throw new Error("cbor: int too large");
}

// ── 1. ES256 키쌍 생성 ──────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });
console.log(`[1] ES256 키쌍 생성 OK (kty=${jwk.kty}, crv=${jwk.crv})`);

// ── 2. authData + COSE_Key 구성 ────────────────────────
const credentialId = crypto.randomBytes(16);
const aaguid = Buffer.alloc(16); // zero (none attestation 표준)
const xBuf = fromB64u(jwk.x);
const yBuf = fromB64u(jwk.y);
const cose = cborEncode({ "1": 2, "3": -7, "-1": 1, "-2": xBuf, "-3": yBuf });

function makeAuthData(rpId, flags, signCount, attestedCredData) {
  const rpIdHash = sha256(Buffer.from(rpId, "utf8"));
  const fb = Buffer.from([flags]);
  const sc = Buffer.alloc(4); sc.writeUInt32BE(signCount, 0);
  return attestedCredData
    ? Buffer.concat([rpIdHash, fb, sc, attestedCredData])
    : Buffer.concat([rpIdHash, fb, sc]);
}

// ── 헬퍼 ─────────────────────────────────────────────
async function fetchJson(path, opts) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

(async () => {
  // ── 사전: 일반 로그인으로 access_token 획득 ────────
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = sha256(Buffer.from(verifier)).toString("base64url");
  const loginRes = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: "demo", password: "demo1234", client_id: "blog",
      redirect_uri: "http://localhost:30200/cb", scope: "openid",
      state: "wa-state", code_challenge: challenge, code_challenge_method: "S256",
    }).toString(),
    redirect: "manual",
  });
  const code = new URL(loginRes.headers.get("location")).searchParams.get("code");
  const tokRes = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: "http://localhost:30200/cb",
      client_id: "blog", client_secret: "blog-secret-CHANGE-ME", code_verifier: verifier,
    }).toString(),
  });
  const { access_token } = await tokRes.json();
  console.log(`[2] 사전 로그인 OK (Bearer 발급)`);

  // ── 3. /webauthn/register/begin ────────────────────
  const beginRes = await fetchJson("/webauthn/register/begin", {
    method: "POST",
    headers: { "Authorization": `Bearer ${access_token}` },
  });
  if (beginRes.status !== 200) throw new Error(`register/begin: ${beginRes.status} ${JSON.stringify(beginRes.body)}`);
  const regChallenge = beginRes.body.challenge;
  console.log(`[3] /webauthn/register/begin OK challenge=${regChallenge.slice(0, 12)}...`);

  // ── 4. attestationObject 구성 ─────────────────────
  // AT(0x40) | UP(0x01) = 0x41
  const credIdLen = Buffer.alloc(2); credIdLen.writeUInt16BE(credentialId.length, 0);
  const attestedCredData = Buffer.concat([aaguid, credIdLen, credentialId, cose]);
  const authData = makeAuthData(RP_ID, 0x41, 0, attestedCredData);
  const attestationObject = cborEncode({ fmt: "none", attStmt: {}, authData });
  const attB64 = b64u(attestationObject);
  console.log(`[4] attestationObject 구성 (${attestationObject.length} bytes)`);

  // ── 5. /webauthn/register/complete ────────────────
  const completeRes = await fetchJson("/webauthn/register/complete", {
    method: "POST",
    headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ challenge: regChallenge, attestationObject: attB64, label: "Smoke Test Passkey" }),
  });
  if (completeRes.status !== 200) throw new Error(`register/complete: ${completeRes.status} ${JSON.stringify(completeRes.body)}`);
  console.log(`[5] /webauthn/register/complete OK credential_id=${completeRes.body.credential_id.slice(0, 12)}...`);
  const credId = completeRes.body.credential_id;

  // ── 6. /webauthn/auth/begin ───────────────────────
  const authBeginRes = await fetchJson("/webauthn/auth/begin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "demo" }),
  });
  if (authBeginRes.status !== 200) throw new Error(`auth/begin: ${authBeginRes.status}`);
  const authChallenge = authBeginRes.body.challenge;
  console.log(`[6] /webauthn/auth/begin OK challenge=${authChallenge.slice(0, 12)}... allow=${authBeginRes.body.allowCredentials.length}`);
  if (authBeginRes.body.allowCredentials.length === 0) throw new Error("allowCredentials empty");

  // ── 7. assertion 구성 + 서명 ─────────────────────
  const clientData = {
    type: "webauthn.get",
    challenge: authChallenge,
    origin: ORIGIN,
  };
  const cdJsonBuf = Buffer.from(JSON.stringify(clientData), "utf8");
  // signCount 단조 증가
  const authDataAuth = makeAuthData(RP_ID, 0x01, 1, null);
  const signedData = Buffer.concat([authDataAuth, sha256(cdJsonBuf)]);
  const signer = crypto.createSign("SHA256");
  signer.update(signedData);
  signer.end();
  const signature = signer.sign(privateKey);
  console.log(`[7] assertion 서명 생성 (${signature.length} bytes DER)`);

  // ── 8. /webauthn/auth/complete ────────────────────
  const authCompleteRes = await fetchJson("/webauthn/auth/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge: authChallenge,
      credential_id: credId,
      clientDataJSON: b64u(cdJsonBuf),
      authenticatorData: b64u(authDataAuth),
      signature: b64u(signature),
    }),
  });
  if (authCompleteRes.status !== 200) throw new Error(`auth/complete: ${authCompleteRes.status} ${JSON.stringify(authCompleteRes.body)}`);
  console.log(`[8] /webauthn/auth/complete OK user=${authCompleteRes.body.username}`);

  // ── 9. signCount 회귀 거부 (replay 방어) ─────────
  // 같은 signCount로 다시 시도 → 거부 (sign_count 단조 증가 룰)
  // 이번엔 새 challenge 가 필요하므로 begin → complete 재구성
  const authBegin2 = await fetchJson("/webauthn/auth/begin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "demo" }),
  });
  const ch2 = authBegin2.body.challenge;
  const cd2 = JSON.stringify({ type: "webauthn.get", challenge: ch2, origin: ORIGIN });
  const cd2Buf = Buffer.from(cd2);
  // 같은 signCount=1 (회귀)
  const ad2 = makeAuthData(RP_ID, 0x01, 1, null);
  const sd2 = Buffer.concat([ad2, sha256(cd2Buf)]);
  const sig2 = crypto.createSign("SHA256").update(sd2).sign(privateKey);
  const replayRes = await fetchJson("/webauthn/auth/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge: ch2, credential_id: credId,
      clientDataJSON: b64u(cd2Buf), authenticatorData: b64u(ad2), signature: b64u(sig2),
    }),
  });
  if (replayRes.status !== 401) throw new Error(`replay should fail: status=${replayRes.status}`);
  console.log(`[9] signCount 회귀 거부 OK (HTTP 401: ${replayRes.body.error})`);

  console.log("\nPhase J WebAuthn e2e OK ✅");
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
