// FreeLang v9 — PostgreSQL stdlib
// pg_query, pg_exec, pg_one, jwt_sign, jwt_verify, pbkdf2_hash, pbkdf2_verify, ai_complete

import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

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
  jwt_sign: (payload: any, secret: string, expiresIn: string = "7d"): string => {
    return (jwt as any).sign(payload, secret, { expiresIn });
  },

  // jwt_verify token secret -> payload | null
  jwt_verify: (token: string, secret: string): any | null => {
    try {
      return (jwt as any).verify(token, secret);
    } catch {
      return null;
    }
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
