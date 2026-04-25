// FreeLang v11: RSA / RS256 비대칭 암호 모듈 (Phase A.1 — dclub-auth)
//
// 자체 OIDC IdP (auth.dclub.kr) id_token 발급용 RS256 서명 기반시설.
// self/stdlib/crypto.fl:28-35의 crypto-rsa-* stub과 정합 (TS 빌트인 채움).
// 외부 npm 0개 — Node 표준 crypto 모듈만 사용.

import {
  generateKeyPairSync,
  createSign,
  createVerify,
  createPublicKey,
  KeyObject,
} from "crypto";

export function createCryptoRsaModule() {
  return {
    // ── RSA 키 생성 ────────────────────────────────────────────

    // crypto_rsa_generate bits -> map (publicKey/privateKey PEM)
    "crypto_rsa_generate": (bits: number = 2048): Record<string, string> => {
      const size = bits >= 2048 ? bits : 2048;
      const { publicKey, privateKey } = generateKeyPairSync("rsa", {
        modulusLength: size,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      return { publicKey, privateKey };
    },

    // ── RS256 서명 / 검증 ─────────────────────────────────────

    // crypto_rsa_sign private_pem data -> string (base64url 서명)
    "crypto_rsa_sign": (privateKeyPem: string, data: string): string => {
      const signer = createSign("RSA-SHA256");
      signer.update(data);
      signer.end();
      return signer.sign(privateKeyPem).toString("base64url");
    },

    // crypto_rsa_verify public_pem data signature_b64url -> boolean
    "crypto_rsa_verify": (
      publicKeyPem: string,
      data: string,
      sigB64Url: string,
    ): boolean => {
      try {
        const verifier = createVerify("RSA-SHA256");
        verifier.update(data);
        verifier.end();
        const sigBuf = Buffer.from(sigB64Url, "base64url");
        return verifier.verify(publicKeyPem, sigBuf);
      } catch {
        return false;
      }
    },

    // ── JWK 직렬화 (RFC 7517) ─────────────────────────────────

    // crypto_rsa_public_to_jwk public_pem kid -> map (kty/n/e/kid/alg/use)
    "crypto_rsa_public_to_jwk": (
      publicKeyPem: string,
      kid: string,
    ): Record<string, string> => {
      const key: KeyObject = createPublicKey(publicKeyPem);
      const jwk = key.export({ format: "jwk" }) as { kty: string; n: string; e: string };
      return {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        kid,
        alg: "RS256",
        use: "sig",
      };
    },
  };
}
