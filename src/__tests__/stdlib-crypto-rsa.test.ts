// Phase A.1 — RSA / RS256 primitive 테스트 (dclub-auth)
//
// self/stdlib/crypto.fl:28-35 stub과 정합하는 TS 빌트인이
// 자가 서명·검증, 변조 거부, JWK 직렬화, 외부 호환성을 만족하는지 검증.

import { lex } from "../lexer";
import { Parser } from "../parser";
import { Interpreter } from "../interpreter";
import {
  createSign,
  createVerify,
  generateKeyPairSync,
} from "crypto";

function run(source: string): any {
  const tokens = lex(source);
  const ast = new Parser(tokens).parse();
  return new Interpreter().interpret(ast).lastValue;
}

describe("stdlib-crypto-rsa (RS256)", () => {
  test("crypto_rsa_generate → publicKey/privateKey PEM", () => {
    const result = run(`
      (define keys (crypto_rsa_generate 2048))
      (get $keys "publicKey")
    `);
    expect(typeof result).toBe("string");
    expect(result).toContain("-----BEGIN PUBLIC KEY-----");
    expect(result).toContain("-----END PUBLIC KEY-----");
  });

  test("sign/verify 라운드트립 PASS", () => {
    const ok = run(`
      (define keys (crypto_rsa_generate 2048))
      (define sig  (crypto_rsa_sign  (get $keys "privateKey") "hello-rs256"))
      (crypto_rsa_verify (get $keys "publicKey") "hello-rs256" $sig)
    `);
    expect(ok).toBe(true);
  });

  test("변조된 데이터는 검증 실패", () => {
    const ok = run(`
      (define keys (crypto_rsa_generate 2048))
      (define sig  (crypto_rsa_sign  (get $keys "privateKey") "original"))
      (crypto_rsa_verify (get $keys "publicKey") "tampered" $sig)
    `);
    expect(ok).toBe(false);
  });

  test("다른 키쌍의 공개키로 검증 시 실패", () => {
    const ok = run(`
      (define keysA (crypto_rsa_generate 2048))
      (define keysB (crypto_rsa_generate 2048))
      (define sig   (crypto_rsa_sign (get $keysA "privateKey") "data"))
      (crypto_rsa_verify (get $keysB "publicKey") "data" $sig)
    `);
    expect(ok).toBe(false);
  });

  test("JWK 출력에 RS256 필수 필드 모두 존재", () => {
    const fields = run(`
      (let [keys (crypto_rsa_generate 2048)
            jwk  (crypto_rsa_public_to_jwk (get $keys "publicKey") "key-1")]
        [(get $jwk "kty")
         (get $jwk "alg")
         (get $jwk "use")
         (get $jwk "kid")
         (get $jwk "n")
         (get $jwk "e")])
    `);
    expect(fields[0]).toBe("RSA");
    expect(fields[1]).toBe("RS256");
    expect(fields[2]).toBe("sig");
    expect(fields[3]).toBe("key-1");
    expect(typeof fields[4]).toBe("string");
    expect(fields[4].length).toBeGreaterThan(100);
    expect(typeof fields[5]).toBe("string");
    expect(fields[5].length).toBeGreaterThan(0);
  });

  test("외부 Node crypto로 서명한 것을 우리가 검증 가능 (cross-verify)", () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const data = "external-signed";
    const signer = createSign("RSA-SHA256");
    signer.update(data);
    signer.end();
    const sigB64Url = signer.sign(privateKey).toString("base64url");

    const ok = run(`
      (crypto_rsa_verify ${JSON.stringify(publicKey)} ${JSON.stringify(data)} ${JSON.stringify(sigB64Url)})
    `);
    expect(ok).toBe(true);
  });

  test("우리가 서명한 것을 외부 Node crypto가 검증 가능 (cross-sign)", () => {
    const result = run(`
      (let [keys (crypto_rsa_generate 2048)
            sig  (crypto_rsa_sign (get $keys "privateKey") "ours")]
        [(get $keys "publicKey") $sig])
    `);
    const [pub, sig] = result;
    const verifier = createVerify("RSA-SHA256");
    verifier.update("ours");
    verifier.end();
    expect(verifier.verify(pub, Buffer.from(sig, "base64url"))).toBe(true);
  });

  test("base64url_decode 라운드트립", () => {
    const result = run(`
      (define encoded (base64url_encode "hello world"))
      (base64url_decode $encoded)
    `);
    expect(result).toBe("hello world");
  });
});
