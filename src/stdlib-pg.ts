// FreeLang v11 — PostgreSQL stdlib
// pg_query, pg_exec, pg_one, jwt_sign, jwt_verify, pbkdf2_hash, pbkdf2_verify, ai_complete

import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

// JWT 헬퍼: Node.js 내장 crypto로 HS256 구현
const base64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

function jwtSign(payload: any, secret: string, expiresIn: string = "7d"): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));

  // expiresIn 파싱 (예: "7d" → 7일 후)
  let expSeconds = 7 * 24 * 60 * 60; // 기본 7일
  if (expiresIn.endsWith("d")) {
    expSeconds = parseInt(expiresIn) * 24 * 60 * 60;
  } else if (expiresIn.endsWith("h")) {
    expSeconds = parseInt(expiresIn) * 60 * 60;
  } else if (expiresIn.endsWith("m")) {
    expSeconds = parseInt(expiresIn) * 60;
  }

  const payloadObj = { ...payload, exp: Math.floor(Date.now() / 1000) + expSeconds };
  const encodedPayload = base64url(Buffer.from(JSON.stringify(payloadObj)));

  const signature = base64url(
    crypto.createHmac("sha256", secret).update(`${header}.${encodedPayload}`).digest()
  );

  return `${header}.${encodedPayload}.${signature}`;
}

function jwtVerify(token: string, secret: string): any | null {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const expectedSignature = base64url(
      crypto.createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest()
    );

    if (signatureB64 !== expectedSignature) return null;

    const payload = JSON.parse(Buffer.from(payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4), "base64").toString());

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// freelang-v9 node_modules 위치
const V9_DIR = path.resolve(__dirname, "..");
const PG_HELPER = path.join(V9_DIR, "dist", "_pg_helper.js");

// pg helper 스크립트 생성 (dist 폴더에 한 번만)
function ensurePgHelper(): void {
  if (fs.existsSync(PG_HELPER)) return;
  const pgPath = JSON.stringify(path.join(V9_DIR, "node_modules", "pg"));
  const helperSrc = `
const { Client } = require(${pgPath});
const inputFile = process.argv[2];
const { sql, params, dbUrl } = JSON.parse(require('fs').readFileSync(inputFile, 'utf8'));
(async () => {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  const r = await c.query(sql, params);
  process.stdout.write(JSON.stringify(r.rows));
  await c.end();
})().catch(e => { process.stderr.write(e.message); process.exit(1); });
`;
  fs.writeFileSync(PG_HELPER, helperSrc);
}

let _tmpCounter = 0;

export const pgBuiltins: Record<string, (...args: any[]) => any> = {
  // pg_query sql params -> rows[]
  pg_query: (sql: string, params: any[]): any[] => {
    ensurePgHelper();
    const dbUrl =
      process.env.DATABASE_URL ||
      "postgresql://jangjangai:password@localhost:35432/jangjangai";
    const tmpFile = path.join(V9_DIR, "dist", `_pg_tmp_${++_tmpCounter}.json`);
    try {
      fs.writeFileSync(tmpFile, JSON.stringify({ sql, params: params || [], dbUrl }));
      const out = execSync(`node ${JSON.stringify(PG_HELPER)} ${JSON.stringify(tmpFile)}`,
        { encoding: "utf8", timeout: 10000 }
      );
      return JSON.parse(out.trim() || "[]");
    } catch (e: any) {
      throw new Error(`pg_query error: ${e.stderr || e.message}`);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  },

  // pg_one sql params -> row | null
  pg_one: (sql: string, params: any[]): any | null => {
    const rows = pgBuiltins.pg_query(sql, params || []);
    return rows.length > 0 ? rows[0] : null;
  },

  // pg_exec sql params -> void
  pg_exec: (sql: string, params: any[]): void => {
    pgBuiltins.pg_query(sql, params);
  },

  // jwt_sign payload secret expiresIn -> token
  // payload can be a plain object or a FreeLang (list :key val ...) array
  jwt_sign: (payload: any, secret: string, expiresIn: string = "7d"): string => {
    if (Array.isArray(payload)) {
      const obj: Record<string, any> = {};
      for (let i = 0; i < payload.length; i += 2) {
        let k = payload[i];
        const v = payload[i + 1];
        if (typeof k === "string" && k.startsWith(":")) k = k.slice(1);
        if (typeof k === "string") obj[k] = v;
      }
      payload = obj;
    }
    return jwtSign(payload, secret, expiresIn);
  },

  // jwt_verify token secret -> payload | null
  jwt_verify: (token: string, secret: string): any | null => {
    return jwtVerify(token, secret);
  },

  // pbkdf2_hash password secret -> hash
  pbkdf2_hash: (password: string, secret: string): string => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .pbkdf2Sync(password, salt + secret, 100000, 64, "sha512")
      .toString("hex");
    return `${salt}:${hash}`;
  },

  // pbkdf2_verify password secret stored -> bool
  pbkdf2_verify: (password: string, secret: string, stored: string): boolean => {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const verify = crypto
      .pbkdf2Sync(password, salt + secret, 100000, 64, "sha512")
      .toString("hex");
    return hash === verify;
  },

  // env_get key -> string
  env_get: (key: string): string => process.env[key] ?? "",

  // ai_complete model prompt -> string
  ai_complete: (model: string, prompt: string): string => {
    const { execSync } = require("child_process");
    const apiKey = process.env.CLAUDE_API_KEY || "";
    if (!apiKey) return "AI_API_KEY_NOT_SET";
    const body = JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    try {
      const out = execSync(
        `curl -s https://api.anthropic.com/v1/messages \
          -H "x-api-key: ${apiKey}" \
          -H "anthropic-version: 2023-06-01" \
          -H "content-type: application/json" \
          -d '${body.replace(/'/g, "'\"'\"'")}'`,
        { encoding: "utf8", timeout: 30000 }
      );
      const res = JSON.parse(out);
      return res?.content?.[0]?.text ?? "";
    } catch (e: any) {
      return `AI_ERROR: ${e.message}`;
    }
  },
};
