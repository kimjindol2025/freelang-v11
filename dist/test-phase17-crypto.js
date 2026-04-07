"use strict";
// FreeLang v9: Phase 17 Crypto + UUID + Regex Tests
Object.defineProperty(exports, "__esModule", { value: true });
const stdlib_crypto_1 = require("./stdlib-crypto");
const stdlib_agent_1 = require("./stdlib-agent");
const stdlib_data_1 = require("./stdlib-data");
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    }
    catch (err) {
        console.log(`✗ ${name}`);
        console.log(`  ${err.message}`);
    }
}
const X = (0, stdlib_crypto_1.createCryptoModule)();
const A = (0, stdlib_agent_1.createAgentModule)();
const D = (0, stdlib_data_1.createDataModule)();
console.log("=== Phase 17: Crypto + UUID + Regex Tests ===\n");
// ── Hash ──────────────────────────────────────────────────────
test("sha256 deterministic", () => {
    const h1 = X.sha256("hello");
    const h2 = X.sha256("hello");
    if (h1 !== h2)
        throw new Error("Not deterministic");
    if (h1.length !== 64)
        throw new Error(`Expected 64 chars, got ${h1.length}`);
    if (!/^[0-9a-f]+$/.test(h1))
        throw new Error("Not hex");
});
test("sha256 different inputs differ", () => {
    if (X.sha256("a") === X.sha256("b"))
        throw new Error("Collision");
});
test("sha256_short is 8 chars", () => {
    const s = X.sha256_short("test");
    if (s.length !== 8)
        throw new Error(`Expected 8, got ${s.length}`);
});
test("md5", () => {
    const h = X.md5("hello");
    if (h.length !== 32)
        throw new Error(`Expected 32 chars`);
    if (h !== "5d41402abc4b2a76b9719d911017c592")
        throw new Error(`Wrong md5: ${h}`);
});
test("sha1", () => {
    const h = X.sha1("hello");
    if (h.length !== 40)
        throw new Error(`Expected 40 chars`);
});
test("hmac_sha256", () => {
    const h1 = X.hmac_sha256("secret", "message");
    const h2 = X.hmac_sha256("secret", "message");
    const h3 = X.hmac_sha256("other", "message");
    if (h1 !== h2)
        throw new Error("Not deterministic");
    if (h1 === h3)
        throw new Error("Different keys should differ");
    if (h1.length !== 64)
        throw new Error(`Expected 64 chars`);
});
test("hash_eq same", () => {
    const h = X.sha256("test");
    if (!X.hash_eq(h, h))
        throw new Error("Same hash should be equal");
});
test("hash_eq different", () => {
    if (X.hash_eq(X.sha256("a"), X.sha256("b")))
        throw new Error("Different hashes should not be equal");
});
// ── Encoding ──────────────────────────────────────────────────
test("base64 roundtrip", () => {
    const original = "FreeLang v9 — AI native language";
    const encoded = X.base64_encode(original);
    const decoded = X.base64_decode(encoded);
    if (decoded !== original)
        throw new Error(`Got: "${decoded}"`);
});
test("base64_encode known value", () => {
    if (X.base64_encode("hello") !== "aGVsbG8=")
        throw new Error("Wrong base64");
});
test("base64url_encode no padding", () => {
    const s = X.base64url_encode("test");
    if (s.includes("="))
        throw new Error("Should not have padding");
    if (s.includes("+") || s.includes("/"))
        throw new Error("Should be URL-safe");
});
test("hex roundtrip", () => {
    const original = "AI agent";
    const hex = X.hex_encode(original);
    if (X.hex_decode(hex) !== original)
        throw new Error("Hex roundtrip failed");
});
// ── Random ────────────────────────────────────────────────────
test("random_bytes length", () => {
    const r = X.random_bytes(16);
    if (r.length !== 32)
        throw new Error(`Expected 32 hex chars (16 bytes), got ${r.length}`);
});
test("random_bytes unique", () => {
    if (X.random_bytes(8) === X.random_bytes(8))
        throw new Error("Should be unique");
});
test("random_int in range", () => {
    for (let i = 0; i < 20; i++) {
        const r = X.random_int(1, 10);
        if (r < 1 || r > 10)
            throw new Error(`Out of range: ${r}`);
    }
});
test("random_float in [0,1]", () => {
    for (let i = 0; i < 10; i++) {
        const r = X.random_float();
        if (r < 0 || r > 1)
            throw new Error(`Out of range: ${r}`);
    }
});
// ── UUID ──────────────────────────────────────────────────────
test("uuid_v4 format", () => {
    const id = X.uuid_v4();
    if (!X.is_uuid(id))
        throw new Error(`Invalid UUID: ${id}`);
    if (id[14] !== "4")
        throw new Error("Version should be 4");
});
test("uuid_v4 unique", () => {
    if (X.uuid_v4() === X.uuid_v4())
        throw new Error("Should be unique");
});
test("uuid_short is 8 chars", () => {
    const s = X.uuid_short();
    if (s.length !== 8)
        throw new Error(`Expected 8, got ${s.length}`);
});
test("uuid_from_str deterministic", () => {
    const id1 = X.uuid_from_str("freelang-v9");
    const id2 = X.uuid_from_str("freelang-v9");
    if (id1 !== id2)
        throw new Error("Should be deterministic");
    if (!X.is_uuid(id1))
        throw new Error(`Invalid UUID format: ${id1}`);
});
test("uuid_from_str different inputs differ", () => {
    if (X.uuid_from_str("a") === X.uuid_from_str("b"))
        throw new Error("Should differ");
});
test("is_uuid valid", () => {
    if (!X.is_uuid("550e8400-e29b-41d4-a716-446655440000"))
        throw new Error("Should be valid");
});
test("is_uuid invalid", () => {
    if (X.is_uuid("not-a-uuid"))
        throw new Error("Should be invalid");
    if (X.is_uuid("hello"))
        throw new Error("Should be invalid");
});
// ── Regex ─────────────────────────────────────────────────────
test("regex_match true", () => {
    if (!X.regex_match("hello world", "\\bworld\\b"))
        throw new Error("Should match");
});
test("regex_match false", () => {
    if (X.regex_match("hello", "^world"))
        throw new Error("Should not match");
});
test("regex_match_i case insensitive", () => {
    if (!X.regex_match_i("Hello", "hello"))
        throw new Error("Should match case-insensitive");
});
test("regex_find first match", () => {
    const r = X.regex_find("foo 123 bar 456", "\\d+");
    if (r !== "123")
        throw new Error(`Expected "123", got "${r}"`);
});
test("regex_find null when no match", () => {
    if (X.regex_find("hello", "\\d+") !== null)
        throw new Error("Expected null");
});
test("regex_find_all", () => {
    const r = X.regex_find_all("foo 123 bar 456 baz 789", "\\d+");
    if (r.length !== 3)
        throw new Error(`Expected 3, got ${r.length}`);
    if (r[0] !== "123" || r[2] !== "789")
        throw new Error(`Wrong matches: ${r}`);
});
test("regex_replace global", () => {
    const r = X.regex_replace("aaa bbb aaa", "aaa", "xxx");
    if (r !== "xxx bbb xxx")
        throw new Error(`Got: "${r}"`);
});
test("regex_replace_first only first", () => {
    const r = X.regex_replace_first("aaa bbb aaa", "aaa", "xxx");
    if (r !== "xxx bbb aaa")
        throw new Error(`Got: "${r}"`);
});
test("regex_extract capture groups", () => {
    const r = X.regex_extract("2026-04-07", "(\\d{4})-(\\d{2})-(\\d{2})");
    if (r[0] !== "2026" || r[1] !== "04" || r[2] !== "07")
        throw new Error(`Got: ${JSON.stringify(r)}`);
});
test("regex_extract_all multiple matches", () => {
    const r = X.regex_extract_all("key=val1 key=val2", "key=(\\w+)");
    if (r.length !== 2)
        throw new Error(`Expected 2, got ${r.length}`);
    if (r[0][0] !== "val1" || r[1][0] !== "val2")
        throw new Error(`Got: ${JSON.stringify(r)}`);
});
test("regex_split", () => {
    const r = X.regex_split("a1b2c3d", "\\d");
    if (r.length !== 4)
        throw new Error(`Expected 4, got ${r.length}`);
    if (r[0] !== "a" || r[3] !== "d")
        throw new Error(`Got: ${r}`);
});
test("regex_count", () => {
    if (X.regex_count("abc123def456", "\\d+") !== 2)
        throw new Error("Expected 2");
});
// ── AI Text Parsing Helpers ───────────────────────────────────
test("extract_json from text", () => {
    const text = 'The result is: {"status": "ok", "count": 42} done.';
    const obj = X.extract_json(text);
    if (!obj || obj.status !== "ok" || obj.count !== 42)
        throw new Error(`Got: ${JSON.stringify(obj)}`);
});
test("extract_json returns null when none", () => {
    if (X.extract_json("no json here") !== null)
        throw new Error("Expected null");
});
test("extract_code markdown", () => {
    const md = "Here is code:\n```python\nprint('hello')\n```\nDone.";
    const code = X.extract_code(md, "python");
    if (!code || !code.includes("print"))
        throw new Error(`Got: "${code}"`);
});
test("extract_emails", () => {
    const r = X.extract_emails("contact alice@example.com or bob@test.org for info");
    if (r.length !== 2)
        throw new Error(`Expected 2, got ${r.length}`);
    if (!r.includes("alice@example.com"))
        throw new Error("Missing alice");
});
test("extract_urls", () => {
    const r = X.extract_urls("See https://example.com and http://test.org/path for details");
    if (r.length !== 2)
        throw new Error(`Expected 2, got ${r.length}`);
});
test("extract_numbers", () => {
    const r = X.extract_numbers("score: 95.5, attempts: 3, ratio: -0.42");
    if (r.length !== 3)
        throw new Error(`Expected 3, got ${r.length}`);
    if (r[0] !== 95.5)
        throw new Error(`Expected 95.5, got ${r[0]}`);
});
test("is_email valid", () => {
    if (!X.is_email("user@example.com"))
        throw new Error("Should be valid");
});
test("is_email invalid", () => {
    if (X.is_email("not-an-email"))
        throw new Error("Should be invalid");
});
test("is_url valid", () => {
    if (!X.is_url("https://example.com"))
        throw new Error("Should be valid");
});
test("is_url invalid", () => {
    if (X.is_url("not a url"))
        throw new Error("Should be invalid");
});
// ── Integration: AI output parsing pipeline ──────────────────
test("AI output parsing: extract JSON + validate + hash", () => {
    // Simulate parsing LLM output
    const llmOutput = `
    Analysis complete. Results:
    {"confidence": 0.92, "category": "AI", "tags": ["language", "agent", "v9"]}
    Processing done.
  `;
    const obj = X.extract_json(llmOutput);
    if (!obj)
        throw new Error("JSON extraction failed");
    // Generate deterministic ID from content
    const contentId = X.uuid_from_str(JSON.stringify(obj));
    if (!X.is_uuid(contentId))
        throw new Error("Invalid content ID");
    // Verify hash for integrity
    const checksum = X.sha256_short(JSON.stringify(obj));
    if (checksum.length !== 8)
        throw new Error("Invalid checksum");
    console.log(`    → content_id: ${contentId}`);
    console.log(`    → checksum: ${checksum}`);
    console.log(`    → confidence: ${obj.confidence}`);
});
test("agent session ID + log tracking", () => {
    const sessionId = X.uuid_v4();
    const agentId = X.uuid_from_str("reasoning-agent-v1");
    let agent = A.agent_create("tracked-agent");
    agent = A.agent_set(agent, "session_id", sessionId);
    agent = A.agent_set(agent, "agent_id", agentId);
    if (!X.is_uuid(A.agent_get(agent, "session_id")))
        throw new Error("Invalid session ID");
    if (!X.is_uuid(A.agent_get(agent, "agent_id")))
        throw new Error("Invalid agent ID");
    console.log(`    → session: ${sessionId.slice(0, 8)}...`);
    console.log(`    → agent:   ${agentId.slice(0, 8)}...`);
});
console.log("\n=== Phase 17 Tests Complete ===");
//# sourceMappingURL=test-phase17-crypto.js.map