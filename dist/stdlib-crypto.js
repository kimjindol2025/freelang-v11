"use strict";
// FreeLang v9: Crypto + UUID + Regex Standard Library
// Phase 17: Data integrity + unique IDs + text pattern matching
//
// AI 에이전트가 처리하는 데이터를 검증하고, 추적하고, 파싱하는 도구.
// - Crypto: 해시로 데이터 무결성 확인, base64로 인코딩
// - UUID: 각 추론 세션/태스크/결과에 고유 ID 부여
// - Regex: LLM 출력 파싱, 패턴 추출, 유효성 검사
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
exports.createCryptoModule = createCryptoModule;
const nodeCrypto = __importStar(require("crypto"));
function createCryptoModule() {
    return {
        // ── Hash ──────────────────────────────────────────────────
        // sha256 str -> string (hex digest)
        "sha256": (str) => nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex"),
        // sha256_short str -> string (first 8 chars, useful as short ID)
        "sha256_short": (str) => nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 8),
        // md5 str -> string (hex digest, for checksums only)
        "md5": (str) => nodeCrypto.createHash("md5").update(str, "utf8").digest("hex"),
        // sha1 str -> string
        "sha1": (str) => nodeCrypto.createHash("sha1").update(str, "utf8").digest("hex"),
        // hmac_sha256 key msg -> string (hex digest)
        "hmac_sha256": (key, msg) => nodeCrypto.createHmac("sha256", key).update(msg, "utf8").digest("hex"),
        // hash_eq hash1 hash2 -> boolean (timing-safe compare)
        "hash_eq": (h1, h2) => {
            if (h1.length !== h2.length)
                return false;
            try {
                return nodeCrypto.timingSafeEqual(Buffer.from(h1, "hex"), Buffer.from(h2, "hex"));
            }
            catch {
                return false;
            }
        },
        // ── Encoding ──────────────────────────────────────────────
        // base64_encode str -> string
        "base64_encode": (str) => Buffer.from(str, "utf8").toString("base64"),
        // base64_decode str -> string
        "base64_decode": (str) => Buffer.from(str, "base64").toString("utf8"),
        // base64url_encode str -> string (URL-safe, no padding)
        "base64url_encode": (str) => Buffer.from(str, "utf8").toString("base64url"),
        // hex_encode str -> string
        "hex_encode": (str) => Buffer.from(str, "utf8").toString("hex"),
        // hex_decode hex -> string
        "hex_decode": (hex) => Buffer.from(hex, "hex").toString("utf8"),
        // ── Random ────────────────────────────────────────────────
        // random_bytes n -> string (hex, n bytes of randomness)
        "random_bytes": (n) => nodeCrypto.randomBytes(n).toString("hex"),
        // random_int min max -> number (inclusive)
        "random_int": (min, max) => {
            const range = max - min + 1;
            return min + (nodeCrypto.randomInt(range));
        },
        // random_float -> number (0.0 - 1.0)
        "random_float": () => {
            const buf = nodeCrypto.randomBytes(4);
            return buf.readUInt32BE(0) / 0xFFFFFFFF;
        },
        // ── UUID ──────────────────────────────────────────────────
        // uuid_v4 -> string (random UUID)
        "uuid_v4": () => nodeCrypto.randomUUID(),
        // uuid_short -> string (8-char short ID from random bytes)
        "uuid_short": () => nodeCrypto.randomBytes(4).toString("hex"),
        // uuid_from_str str -> string (deterministic ID from string content)
        "uuid_from_str": (str) => {
            const hash = nodeCrypto.createHash("sha256").update(str).digest("hex");
            // Format as UUID v5-ish: 8-4-4-4-12
            return [hash.slice(0, 8), hash.slice(8, 12), "5" + hash.slice(13, 16), hash.slice(16, 20), hash.slice(20, 32)].join("-");
        },
        // is_uuid str -> boolean
        "is_uuid": (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
        // ── Regex ─────────────────────────────────────────────────
        // regex_match str pattern -> boolean
        "regex_match": (str, pattern) => {
            try {
                return new RegExp(pattern).test(str);
            }
            catch (e) {
                throw new Error(`regex_match: invalid pattern "${pattern}": ${e.message}`);
            }
        },
        // regex_match_i str pattern -> boolean (case insensitive)
        "regex_match_i": (str, pattern) => {
            try {
                return new RegExp(pattern, "i").test(str);
            }
            catch (e) {
                throw new Error(`regex_match_i: invalid pattern: ${e.message}`);
            }
        },
        // regex_find str pattern -> string|null (first match)
        "regex_find": (str, pattern) => {
            const m = str.match(new RegExp(pattern));
            return m ? m[0] : null;
        },
        // regex_find_all str pattern -> [string] (all non-overlapping matches)
        "regex_find_all": (str, pattern) => {
            const matches = str.match(new RegExp(pattern, "g"));
            return matches ?? [];
        },
        // regex_replace str pattern replacement -> string
        "regex_replace": (str, pattern, replacement) => str.replace(new RegExp(pattern, "g"), replacement),
        // regex_replace_first str pattern replacement -> string (only first match)
        "regex_replace_first": (str, pattern, replacement) => str.replace(new RegExp(pattern), replacement),
        // regex_extract str pattern -> [string] (capture groups of first match)
        "regex_extract": (str, pattern) => {
            const m = str.match(new RegExp(pattern));
            return m ? m.slice(1) : [];
        },
        // regex_extract_all str pattern -> [[string]] (all matches with groups)
        "regex_extract_all": (str, pattern) => {
            const results = [];
            const re = new RegExp(pattern, "g");
            let m;
            while ((m = re.exec(str)) !== null) {
                results.push(m.slice(1));
            }
            return results;
        },
        // regex_split str pattern -> [string]
        "regex_split": (str, pattern) => str.split(new RegExp(pattern)),
        // regex_count str pattern -> number (count of matches)
        "regex_count": (str, pattern) => {
            const m = str.match(new RegExp(pattern, "g"));
            return m ? m.length : 0;
        },
        // ── AI Text Parsing Helpers ───────────────────────────────
        // extract_json str -> any|null  (extract first JSON object/array from text)
        "extract_json": (str) => {
            const m = str.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (!m)
                return null;
            try {
                return JSON.parse(m[0]);
            }
            catch {
                return null;
            }
        },
        // extract_code str lang -> string|null  (extract code block from markdown)
        "extract_code": (str, lang) => {
            const pattern = lang
                ? `\`\`\`${lang}\\n([\\s\\S]*?)\`\`\``
                : `\`\`\`(?:\\w+)?\\n([\\s\\S]*?)\`\`\``;
            const m = str.match(new RegExp(pattern));
            return m ? m[1].trim() : null;
        },
        // extract_emails str -> [string]
        "extract_emails": (str) => str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [],
        // extract_urls str -> [string]
        "extract_urls": (str) => str.match(/https?:\/\/[^\s"'<>)]+/g) ?? [],
        // extract_numbers str -> [number]
        "extract_numbers": (str) => (str.match(/-?\d+\.?\d*/g) ?? []).map(Number),
        // is_email str -> boolean
        "is_email": (str) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str),
        // is_url str -> boolean
        "is_url": (str) => {
            try {
                new URL(str);
                return true;
            }
            catch {
                return false;
            }
        },
    };
}
//# sourceMappingURL=stdlib-crypto.js.map