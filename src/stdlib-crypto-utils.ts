// stdlib-crypto-utils.ts — AES-256-GCM + advanced hashing (v11.7.6)
// Provides cryptographic utilities: encryption, hashing, key derivation, password strength

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  scryptSync,
  pbkdf2Sync,
} from "crypto";

// ── Internal helpers ───────────────────────────────────────────────────────

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64url");
}

function calculatePasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*]/.test(password)) score += 1;
  return Math.min(score, 5);
}

// ── Module ─────────────────────────────────────────────────────────────────

export function createCryptoUtilsModule() {
  return {
    // AES-256-GCM encryption: plaintext key → base64 ciphertext (IV+tag embedded)
    crypto_aes_encrypt: (plaintext: string, key: string): string | null => {
      try {
        if (typeof plaintext !== "string" || typeof key !== "string") return null;

        const iv = randomBytes(16);
        const derivedKey = scryptSync(key, "salt", 32);
        const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);

        let encrypted = cipher.update(plaintext, "utf8", "hex");
        encrypted += cipher.final("hex");

        const tag = cipher.getAuthTag();
        const combined = iv.toString("hex") + ":" + encrypted + ":" + tag.toString("hex");

        return Buffer.from(combined, "utf8").toString("base64");
      } catch {
        return null;
      }
    },

    // AES-256-GCM decryption: base64 ciphertext key → plaintext | null
    crypto_aes_decrypt: (ciphertext: string, key: string): string | null => {
      try {
        if (typeof ciphertext !== "string" || typeof key !== "string") return null;

        const combined = Buffer.from(ciphertext, "base64").toString("utf8");
        const parts = combined.split(":");
        if (parts.length !== 3) return null;

        const iv = Buffer.from(parts[0], "hex");
        const encryptedHex = parts[1];
        const tag = Buffer.from(parts[2], "hex");

        const derivedKey = scryptSync(key, "salt", 32);
        const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encryptedHex, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
      } catch {
        return null;
      }
    },

    // SHA-512 hash: data → hex string
    crypto_sha512: (data: string): string | null => {
      try {
        if (typeof data !== "string") return null;
        return createHash("sha512").update(data).digest("hex");
      } catch {
        return null;
      }
    },

    // MD5 hash (checksums only, not for security): data → hex string
    crypto_md5: (data: string): string | null => {
      try {
        if (typeof data !== "string") return null;
        return createHash("md5").update(data).digest("hex");
      } catch {
        return null;
      }
    },

    // Base64URL encode (JWT-compatible): data → base64url string
    crypto_b64url_encode: (data: string): string | null => {
      try {
        if (typeof data !== "string") return null;
        return b64url(data);
      } catch {
        return null;
      }
    },

    // Base64URL decode: base64url → data string
    crypto_b64url_decode: (b64url_str: string): string | null => {
      try {
        if (typeof b64url_str !== "string") return null;
        return b64urlDecode(b64url_str).toString("utf8");
      } catch {
        return null;
      }
    },

    // PBKDF2 key derivation: password salt iterations → hex string
    crypto_pbkdf2: (password: string, salt: string, iterations: number): string | null => {
      try {
        if (typeof password !== "string" || typeof salt !== "string" || typeof iterations !== "number") {
          return null;
        }
        if (iterations < 1) return null;

        return pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
      } catch {
        return null;
      }
    },

    // Password strength checker: password → {score, label, feedback}
    crypto_password_strength: (password: string): any => {
      if (typeof password !== "string") {
        return { score: 0, label: "invalid", feedback: ["유효한 문자열이 아닙니다"] };
      }

      const score = calculatePasswordStrength(password);
      const labelMap: { [key: number]: string } = {
        0: "very-weak",
        1: "weak",
        2: "fair",
        3: "good",
        4: "strong",
        5: "very-strong",
      };
      const label = labelMap[score] || "unknown";

      const feedback: string[] = [];
      if (password.length < 8) feedback.push("최소 8자 이상");
      if (!/[A-Z]/.test(password)) feedback.push("대문자 포함");
      if (!/[a-z]/.test(password)) feedback.push("소문자 포함");
      if (!/[0-9]/.test(password)) feedback.push("숫자 포함");
      if (!/[!@#$%^&*]/.test(password)) feedback.push("특수문자 포함");

      return { score, label, feedback };
    },
  };
}
