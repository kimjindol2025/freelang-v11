// FreeLang v11: WebAuthn / FIDO2 / Passkey (Phase J, dclub-auth)
//
// 외부 npm 0개 — Node 표준 crypto + 자체 미니 CBOR 디코더만 사용.
// 지원: ES256 (ECDSA P-256, COSE alg=-7) — Passkey 표준 채택률 95%+
// 지원 attestation: "none" (self) + "packed"(self-attestation only)
//   기업 attestation 검증(Apple/Yubico 인증서)은 Phase J.2 로 분리
//
// 표준: W3C WebAuthn Level 2, RFC 8152 (COSE).

import { randomBytes, createHash, createPublicKey, createVerify } from "crypto";

// ── 미니 CBOR 디코더 (RFC 8949) ──────────────────────────
// 지원: major type 0(uint) 1(neg) 2(bytes) 3(text) 4(array) 5(map)
//       indefinite length 미지원 (WebAuthn 미사용)
//       float/tag 미지원 (WebAuthn 미사용)

function cborDecode(buf: Buffer, offset = 0): { value: any; next: number } {
  const ib = buf[offset];
  const major = ib >> 5;
  const minor = ib & 0x1f;
  let val: number;
  let pos = offset + 1;

  if (minor < 24) val = minor;
  else if (minor === 24) { val = buf[pos]; pos += 1; }
  else if (minor === 25) { val = buf.readUInt16BE(pos); pos += 2; }
  else if (minor === 26) { val = buf.readUInt32BE(pos); pos += 4; }
  else if (minor === 27) {
    // 64-bit — JS bitwise 한계, but Buffer.readBigUInt64BE → number 변환
    val = Number(buf.readBigUInt64BE(pos)); pos += 8;
  }
  else throw new Error(`cbor: unsupported minor ${minor}`);

  switch (major) {
    case 0: return { value: val, next: pos };
    case 1: return { value: -1 - val, next: pos };
    case 2: {
      const bytes = buf.slice(pos, pos + val);
      return { value: bytes, next: pos + val };
    }
    case 3: {
      const text = buf.slice(pos, pos + val).toString("utf8");
      return { value: text, next: pos + val };
    }
    case 4: {
      const arr: any[] = [];
      for (let i = 0; i < val; i++) {
        const r = cborDecode(buf, pos);
        arr.push(r.value); pos = r.next;
      }
      return { value: arr, next: pos };
    }
    case 5: {
      const map: Record<any, any> = {};
      for (let i = 0; i < val; i++) {
        const k = cborDecode(buf, pos); pos = k.next;
        const v = cborDecode(buf, pos); pos = v.next;
        map[String(k.value)] = v.value;
      }
      return { value: map, next: pos };
    }
    default: throw new Error(`cbor: unsupported major ${major}`);
  }
}

// ── authData 파싱 (W3C WebAuthn §6.1) ────────────────────
function parseAuthData(authData: Buffer): {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  aaguid?: Buffer;
  credentialId?: Buffer;
  credentialPublicKey?: any;
} {
  if (authData.length < 37) throw new Error("authData too short");
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const signCount = authData.readUInt32BE(33);
  const result: any = { rpIdHash, flags, signCount };

  if (flags & 0x40) { // AT flag — attested credential data
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

// ── COSE_Key (ES256) → JWK 변환 (RFC 8152) ──────────────
// COSE label: 1=kty(2=EC2) 3=alg(-7=ES256) -1=crv(1=P-256) -2=x -3=y
function cosePublicKeyToJwk(cose: any): { kty: string; crv: string; alg: string; x: string; y: string } {
  if (cose["1"] !== 2) throw new Error("COSE: not EC2");
  if (cose["3"] !== -7) throw new Error("COSE: not ES256");
  if (cose["-1"] !== 1) throw new Error("COSE: not P-256");
  const x = cose["-2"] as Buffer;
  const y = cose["-3"] as Buffer;
  return {
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    x: x.toString("base64url"),
    y: y.toString("base64url"),
  };
}

// ── DER → JOSE signature 변환 ────────────────────────────
// WebAuthn assertion 의 signature 는 ECDSA-Sig DER 형식.
// Node crypto.verify 는 DER 직접 받지만, 우리는 클라이언트가 raw 64바이트로 보낼 수도
// 있어 양쪽 호환. 여기서는 createVerify 가 DER 자동 처리.

export function createWebauthnModule() {
  return {
    // webauthn_challenge bytes -> base64url string (32 bytes)
    "webauthn_challenge": (bytes: number = 32): string => {
      return randomBytes(bytes).toString("base64url");
    },

    // webauthn_parse_attestation b64url_attestation_object -> {fmt, authData_parsed, jwk, credential_id, sign_count, aaguid_hex}
    // attestation="none" 또는 "packed" self-attestation 만 처리.
    "webauthn_parse_attestation": (
      attestationObjectB64Url: string,
    ): Record<string, any> => {
      const buf = Buffer.from(attestationObjectB64Url, "base64url");
      const decoded = cborDecode(buf).value;
      const fmt = decoded.fmt as string;
      const authDataBuf = decoded.authData as Buffer;
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
        public_jwk: jwk,
      };
    },

    // webauthn_verify_assertion args -> boolean
    //   args = {jwk, authenticator_data, client_data_json_b64url, signature_b64url, expected_challenge, expected_origin, expected_rp_id, prev_sign_count}
    // 반환: {ok, sign_count} 또는 {ok:false, error}
    "webauthn_verify_assertion": (args: Record<string, any>): Record<string, any> => {
      try {
        const jwk = args.jwk;
        const authenticatorData = Buffer.from(args.authenticator_data_b64url, "base64url");
        const clientDataJson = Buffer.from(args.client_data_json_b64url, "base64url");
        const signature = Buffer.from(args.signature_b64url, "base64url");

        // 1) clientData 검증
        const clientData = JSON.parse(clientDataJson.toString("utf8"));
        if (clientData.type !== "webauthn.get") return { ok: false, error: "type!=webauthn.get" };
        if (clientData.challenge !== args.expected_challenge) return { ok: false, error: "challenge mismatch" };
        if (clientData.origin !== args.expected_origin) return { ok: false, error: "origin mismatch" };

        // 2) authData 파싱 + RP ID hash 검증
        const auth = parseAuthData(authenticatorData);
        const expectedRpHash = createHash("sha256").update(args.expected_rp_id).digest();
        if (Buffer.compare(auth.rpIdHash, expectedRpHash) !== 0) return { ok: false, error: "rp_id_hash mismatch" };
        if (!(auth.flags & 0x01)) return { ok: false, error: "user not present" };

        // 3) signCount 단조 증가 (replay 방어)
        if (auth.signCount !== 0 && auth.signCount <= (args.prev_sign_count ?? 0)) {
          return { ok: false, error: `signCount regression (${auth.signCount} <= ${args.prev_sign_count})` };
        }

        // 4) 서명 검증: signed = authData || SHA256(clientDataJson)
        const cdHash = createHash("sha256").update(clientDataJson).digest();
        const signedData = Buffer.concat([authenticatorData, cdHash]);

        const pub = createPublicKey({ key: jwk, format: "jwk" });
        const verifier = createVerify("SHA256");
        verifier.update(signedData);
        verifier.end();
        const ok = verifier.verify(pub, signature);

        return ok
          ? { ok: true, sign_count: auth.signCount }
          : { ok: false, error: "signature invalid" };
      } catch (e: any) {
        return { ok: false, error: `exception: ${e.message}` };
      }
    },
  };
}
