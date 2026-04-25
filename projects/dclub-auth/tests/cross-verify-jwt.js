// cross-verify-jwt.js — FreeLang가 발급한 RS256 JWT를 Node 표준 crypto로 검증
// 사용처: dclub-auth IdP가 발급한 토큰을 다른 언어/라이브러리(jose, jsonwebtoken 등)가
//         검증 가능한지 RFC 7515 호환성을 자체 확인하는 sanity check.
//
// 실행: node projects/dclub-auth/tests/cross-verify-jwt.js

const crypto = require("crypto");
const { execSync } = require("child_process");

// FL로 키 생성 + 토큰 발급
const flScript = `
(load "projects/dclub-auth/lib/jwt-rs256.fl")
(define keys (crypto_rsa_generate 2048))
(define token (jwt-rs256-sign {"sub" "cross-test" "iss" "auth.dclub.kr"} (get $keys "privateKey") "k1" 600))
(println (get $keys "publicKey"))
(println "===TOKEN===")
(println $token)
`;
require("fs").writeFileSync("/tmp/_xverify.fl", flScript);
const out = execSync("node bootstrap.js run /tmp/_xverify.fl", { encoding: "utf8" });
const lines = out.split("\n");
const sepIdx = lines.indexOf("===TOKEN===");
const pubPem = lines.slice(0, sepIdx).join("\n").trim() + "\n";
const token = lines[sepIdx + 1].trim();

// Node 표준 라이브러리로 RS256 JWT 검증 (외부 라이브러리 0개)
const [headerB64, payloadB64, sigB64] = token.split(".");
const signingInput = `${headerB64}.${payloadB64}`;
const sig = Buffer.from(sigB64, "base64url");

const verifier = crypto.createVerify("RSA-SHA256");
verifier.update(signingInput);
verifier.end();
const ok = verifier.verify(pubPem, sig);

const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

console.log(`cross_verify=${ok}`);
console.log(`header.alg=${header.alg} typ=${header.typ} kid=${header.kid}`);
console.log(`payload.sub=${payload.sub} iss=${payload.iss}`);
console.log(`payload.iat=${payload.iat} exp=${payload.exp}`);
console.log(`exp-iat=${payload.exp - payload.iat}s`);

if (!ok || header.alg !== "RS256" || header.typ !== "JWT") {
  console.error("FAIL: cross-verify did not satisfy RFC 7515 expectations");
  process.exit(1);
}
console.log("Phase A.2 cross-verify OK (RFC 7515 호환)");
