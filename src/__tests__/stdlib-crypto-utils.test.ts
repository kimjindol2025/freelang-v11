// stdlib-crypto-utils.test.ts — AES-256-GCM + 고급 해시 테스트

import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

describe("stdlib-crypto-utils", () => {
  const bootstrapPath = path.join(__dirname, "../../bootstrap.js");
  let testCounter = 0;

  const run = (code: string) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `fl-crypto-${Date.now()}-${testCounter++}.fl`
    );
    const wrappedCode = code;
    fs.writeFileSync(tmpFile, wrappedCode);
    try {
      const output = execSync(`node ${bootstrapPath} run ${tmpFile}`, {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      try {
        return JSON.parse(output);
      } catch {
        return output; // 문자열이면 그대로
      }
    } finally {
      fs.unlinkSync(tmpFile);
    }
  };

  // ── AES-256-GCM 대칭 암호화 ───────────────────────────────────
  describe("AES-256-GCM 암호화/복호화", () => {
    test("암호화 성공 → base64 문자열 반환", () => {
      const result = run(`(json-str (crypto_aes_encrypt "hello" "mykey"))`);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(10);
    });

    test("암호화/복호화 라운드트립", () => {
      const result = run(`
        (json-str
          (let [plaintext "hello world"
                key "secret-key-123"
                encrypted (crypto_aes_encrypt plaintext key)
                decrypted (crypto_aes_decrypt encrypted key)]
            decrypted))
      `);
      expect(result).toBe("hello world");
    });

    test("잘못된 키로 복호화 → nil 반환", () => {
      const result = run(`
        (json-str
          (let [plaintext "secret data"
                key1 "key-one"
                key2 "key-two"
                encrypted (crypto_aes_encrypt plaintext key1)
                decrypted (crypto_aes_decrypt encrypted key2)]
            decrypted))
      `);
      expect(result).toBeNull();
    });

    test("nil 입력 처리", () => {
      const result1 = run(`(json-str (crypto_aes_encrypt nil "key"))`);
      const result2 = run(`(json-str (crypto_aes_encrypt "data" nil))`);
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    test("빈 문자열 암호화", () => {
      const result = run(`
        (json-str
          (let [encrypted (crypto_aes_encrypt "" "mykey")
                decrypted (crypto_aes_decrypt encrypted "mykey")]
            decrypted))
      `);
      expect(result).toBe("");
    });

    test("큰 데이터 암호화", () => {
      const result = run(`
        (json-str
          (let [big (str-repeat 1000 "data")
                key "key"
                encrypted (crypto_aes_encrypt big key)
                decrypted (crypto_aes_decrypt encrypted key)]
            (= big decrypted)))
      `);
      expect(result).toBe(true);
    });

    test("동일한 plaintext, key로도 매번 다른 암호문 (IV 랜덤)", () => {
      const result = run(`
        (json-str
          (let [plaintext "same"
                key "same"
                enc1 (crypto_aes_encrypt plaintext key)
                enc2 (crypto_aes_encrypt plaintext key)]
            (not= enc1 enc2)))
      `);
      expect(result).toBe(true);
    });
  });

  // ── SHA-512 해시 ──────────────────────────────────────────────
  describe("crypto_sha512", () => {
    test("SHA-512 생성 → hex 문자열", () => {
      const result = run(`(json-str (crypto_sha512 "hello"))`);
      expect(typeof result).toBe("string");
      expect(result.length).toBe(128); // SHA-512는 512비트 = 64바이트 = 128 hex chars
      expect(/^[0-9a-f]{128}$/.test(result)).toBe(true);
    });

    test("동일 입력 → 동일 해시", () => {
      const result = run(`
        (json-str
          (= (crypto_sha512 "data")
             (crypto_sha512 "data")))
      `);
      expect(result).toBe(true);
    });

    test("다른 입력 → 다른 해시", () => {
      const result = run(`
        (json-str
          (not= (crypto_sha512 "data1")
                (crypto_sha512 "data2")))
      `);
      expect(result).toBe(true);
    });

    test("nil 입력 → nil 반환", () => {
      const result = run(`(json-str (crypto_sha512 nil))`);
      expect(result).toBeNull();
    });

    test("빈 문자열 해시", () => {
      const result = run(`(json-str (crypto_sha512 ""))`);
      expect(typeof result).toBe("string");
      expect(result.length).toBe(128);
    });
  });

  // ── MD5 해시 ───────────────────────────────────────────────────
  describe("crypto_md5", () => {
    test("MD5 생성 → hex 문자열", () => {
      const result = run(`(json-str (crypto_md5 "hello"))`);
      expect(typeof result).toBe("string");
      expect(result.length).toBe(32); // MD5는 128비트 = 16바이트 = 32 hex chars
      expect(/^[0-9a-f]{32}$/.test(result)).toBe(true);
    });

    test("동일 입력 → 동일 해시", () => {
      const result = run(`
        (json-str
          (= (crypto_md5 "checksum")
             (crypto_md5 "checksum")))
      `);
      expect(result).toBe(true);
    });

    test("nil 입력 → nil 반환", () => {
      const result = run(`(json-str (crypto_md5 nil))`);
      expect(result).toBeNull();
    });
  });

  // ── Base64URL 인코딩/디코딩 (JWT 호환) ──────────────────────
  describe("Base64URL 인코딩/디코딩", () => {
    test("Base64URL 인코딩", () => {
      const result = run(`(json-str (crypto_b64url_encode "hello"))`);
      expect(typeof result).toBe("string");
      expect(result).not.toContain("=");
      expect(result).not.toContain("+");
      expect(result).not.toContain("/");
    });

    test("라운드트립: 인코딩 → 디코딩", () => {
      const result = run(`
        (json-str
          (let [original "hello world! 123"
                encoded (crypto_b64url_encode original)
                decoded (crypto_b64url_decode encoded)]
            (= original decoded)))
      `);
      expect(result).toBe(true);
    });

    test("nil 입력 처리", () => {
      const result1 = run(`(json-str (crypto_b64url_encode nil))`);
      const result2 = run(`(json-str (crypto_b64url_decode nil))`);
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    test("특수문자 포함 인코딩", () => {
      const result = run(`
        (json-str
          (let [original "user@domain.com+password/special"
                encoded (crypto_b64url_encode original)
                decoded (crypto_b64url_decode encoded)]
            (= original decoded)))
      `);
      expect(result).toBe(true);
    });

    test("JWT 패딩 자동 처리", () => {
      const result = run(`
        (json-str
          (let [data "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"]
            (crypto_b64url_decode data)))
      `);
      expect(typeof result).toBe("string");
    });
  });

  // ── PBKDF2 키 유도 ─────────────────────────────────────────────
  describe("crypto_pbkdf2", () => {
    test("PBKDF2 생성 → hex 문자열", () => {
      const result = run(
        `(json-str (crypto_pbkdf2 "password" "salt" 100000))`
      );
      expect(typeof result).toBe("string");
      expect(result.length).toBe(128); // 64 bytes = 128 hex chars
      expect(/^[0-9a-f]{128}$/.test(result)).toBe(true);
    });

    test("동일 입력 → 동일 키", () => {
      const result = run(`
        (json-str
          (= (crypto_pbkdf2 "pwd" "salt" 100000)
             (crypto_pbkdf2 "pwd" "salt" 100000)))
      `);
      expect(result).toBe(true);
    });

    test("다른 iterations → 다른 키", () => {
      const result = run(`
        (json-str
          (not= (crypto_pbkdf2 "pwd" "salt" 100000)
                (crypto_pbkdf2 "pwd" "salt" 200000)))
      `);
      expect(result).toBe(true);
    });

    test("nil 입력 처리", () => {
      const result = run(`(json-str (crypto_pbkdf2 nil "salt" 100000))`);
      expect(result).toBeNull();
    });

    test("인자 타입 검증", () => {
      const result = run(`(json-str (crypto_pbkdf2 "pwd" "salt" "not-int"))`);
      expect(result).toBeNull();
    });
  });

  // ── 패스워드 강도 검사 ─────────────────────────────────────────
  describe("crypto_password_strength", () => {
    test("약한 비밀번호: weak", () => {
      const result = run(`
        (json-str
          (let [strength (crypto_password_strength "abc")]
            {:score (get strength "score")
             :label (get strength "label")}))
      `);
      expect(result.label).toBe("very-weak");
      expect(result.score).toBeLessThan(2);
    });

    test("보통 비밀번호: fair", () => {
      const result = run(`
        (json-str
          (let [strength (crypto_password_strength "password123")]
            {:score (get strength "score")
             :label (get strength "label")}))
      `);
      expect(result.label).toBe("fair");
      expect(result.score).toBe(2);
    });

    test("강한 비밀번호: strong", () => {
      const result = run(`
        (json-str
          (let [strength (crypto_password_strength "P@ssw0rd123")]
            {:score (get strength "score")
             :label (get strength "label")}))
      `);
      expect(["strong", "very-strong"]).toContain(result.label);
      expect(result.score).toBeGreaterThanOrEqual(4);
    });

    test("매우 강한 비밀번호: very-strong", () => {
      const result = run(`
        (json-str
          (let [strength (crypto_password_strength "MyP@$$w0rd!2026#Secure")]
            (get strength "label")))
      `);
      expect(result).toBe("very-strong");
    });

    test("피드백 배열 포함", () => {
      const result = run(`
        (json-str
          (let [strength (crypto_password_strength "weak")]
            (get strength "feedback")))
      `);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("nil 입력 → invalid", () => {
      const result = run(`
        (json-str
          (let [strength (crypto_password_strength nil)]
            {:score (get strength "score")
             :label (get strength "label")}))
      `);
      expect(result.label).toBe("invalid");
      expect(result.score).toBe(0);
    });

    test("강도 점수: 길이 8자 이상 (+1)", () => {
      const result = run(`
        (json-str
          (>= (get (crypto_password_strength "abcdefgh") "score") 1))
      `);
      expect(result).toBe(true);
    });

    test("강도 점수: 길이 12자 이상 (+1)", () => {
      const result = run(`
        (json-str
          (>= (get (crypto_password_strength "abcdefghijkl") "score") 2))
      `);
      expect(result).toBe(true);
    });

    test("강도 점수: 대문자 포함 (+1)", () => {
      const result = run(`
        (json-str
          (>= (get (crypto_password_strength "Abcdefghijkl") "score") 3))
      `);
      expect(result).toBe(true);
    });

    test("강도 점수: 숫자 포함 (+1)", () => {
      const result = run(`
        (json-str
          (>= (get (crypto_password_strength "Abcdefghijkl1") "score") 4))
      `);
      expect(result).toBe(true);
    });

    test("강도 점수: 특수문자 포함 (+1)", () => {
      const result = run(`
        (json-str
          (>= (get (crypto_password_strength "Abcdefghijkl1!") "score") 5))
      `);
      expect(result).toBe(true);
    });
  });

  // ── 에러 복원력 테스트 ───────────────────────────────────────
  describe("에러 처리", () => {
    test("잘못된 암호문 형식 → nil 반환", () => {
      const result = run(`(json-str (crypto_aes_decrypt "invalid-base64" "key"))`);
      expect(result).toBeNull();
    });

    test("문자열 아닌 입력 → nil 반환", () => {
      const result = run(`(json-str (crypto_aes_encrypt 123 "key"))`);
      expect(result).toBeNull();
    });

    test("비정상 iterations → nil 반환", () => {
      const result = run(`(json-str (crypto_pbkdf2 "pwd" "salt" -1))`);
      expect(result).toBeNull();
    });
  });
});
