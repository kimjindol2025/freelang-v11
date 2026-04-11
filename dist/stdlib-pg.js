"use strict";
// FreeLang v9 — PostgreSQL stdlib
// pg_query, pg_exec, pg_one, jwt_sign, jwt_verify, pbkdf2_hash, pbkdf2_verify, ai_complete
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pgBuiltins = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
// freelang-v9 node_modules 위치
const V9_DIR = path.resolve(__dirname, "..");
const PG_HELPER = path.join(V9_DIR, "dist", "_pg_helper.js");
// pg helper 스크립트 생성 (dist 폴더에 한 번만)
function ensurePgHelper() {
    if (fs.existsSync(PG_HELPER))
        return;
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
exports.pgBuiltins = {
    // pg_query sql params -> rows[]
    pg_query: (sql, params) => {
        ensurePgHelper();
        const dbUrl = process.env.DATABASE_URL ||
            "postgresql://jangjangai:password@localhost:35432/jangjangai";
        const tmpFile = path.join(V9_DIR, "dist", `_pg_tmp_${++_tmpCounter}.json`);
        try {
            fs.writeFileSync(tmpFile, JSON.stringify({ sql, params: params || [], dbUrl }));
            const out = (0, child_process_1.execSync)(`node ${JSON.stringify(PG_HELPER)} ${JSON.stringify(tmpFile)}`, { encoding: "utf8", timeout: 10000 });
            return JSON.parse(out.trim() || "[]");
        }
        catch (e) {
            throw new Error(`pg_query error: ${e.stderr || e.message}`);
        }
        finally {
            try {
                fs.unlinkSync(tmpFile);
            }
            catch { }
        }
    },
    // pg_one sql params -> row | null
    pg_one: (sql, params) => {
        const rows = exports.pgBuiltins.pg_query(sql, params || []);
        return rows.length > 0 ? rows[0] : null;
    },
    // pg_exec sql params -> void
    pg_exec: (sql, params) => {
        exports.pgBuiltins.pg_query(sql, params);
    },
    // jwt_sign payload secret expiresIn -> token
    // payload can be a plain object or a FreeLang (list :key val ...) array
    jwt_sign: (payload, secret, expiresIn = "7d") => {
        if (Array.isArray(payload)) {
            const obj = {};
            for (let i = 0; i < payload.length; i += 2) {
                let k = payload[i];
                const v = payload[i + 1];
                if (typeof k === "string" && k.startsWith(":"))
                    k = k.slice(1);
                if (typeof k === "string")
                    obj[k] = v;
            }
            payload = obj;
        }
        return jwt.sign(payload, secret, { expiresIn });
    },
    // jwt_verify token secret -> payload | null
    jwt_verify: (token, secret) => {
        try {
            return jwt.verify(token, secret);
        }
        catch {
            return null;
        }
    },
    // pbkdf2_hash password secret -> hash
    pbkdf2_hash: (password, secret) => {
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = crypto
            .pbkdf2Sync(password, salt + secret, 100000, 64, "sha512")
            .toString("hex");
        return `${salt}:${hash}`;
    },
    // pbkdf2_verify password secret stored -> bool
    pbkdf2_verify: (password, secret, stored) => {
        const [salt, hash] = stored.split(":");
        if (!salt || !hash)
            return false;
        const verify = crypto
            .pbkdf2Sync(password, salt + secret, 100000, 64, "sha512")
            .toString("hex");
        return hash === verify;
    },
    // env_get key -> string
    env_get: (key) => process.env[key] ?? "",
    // ai_complete model prompt -> string
    ai_complete: (model, prompt) => {
        const { execSync } = require("child_process");
        const apiKey = process.env.CLAUDE_API_KEY || "";
        if (!apiKey)
            return "AI_API_KEY_NOT_SET";
        const body = JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
        });
        try {
            const out = execSync(`curl -s https://api.anthropic.com/v1/messages \
          -H "x-api-key: ${apiKey}" \
          -H "anthropic-version: 2023-06-01" \
          -H "content-type: application/json" \
          -d '${body.replace(/'/g, "'\"'\"'")}'`, { encoding: "utf8", timeout: 30000 });
            const res = JSON.parse(out);
            return res?.content?.[0]?.text ?? "";
        }
        catch (e) {
            return `AI_ERROR: ${e.message}`;
        }
    },
};
//# sourceMappingURL=stdlib-pg.js.map