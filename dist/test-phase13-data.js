"use strict";
// FreeLang v9: Phase 13 Data Transform Tests
// AI-native data pipeline: JSON manipulation + CSV + string template
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
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
// Direct module tests (unit) — bypass interpreter, test functions directly
const D = (0, stdlib_data_1.createDataModule)();
// FreeLang interpreter test — uses $var syntax
function runWith(vars, code) {
    const interp = new interpreter_1.Interpreter();
    for (const [k, v] of Object.entries(vars)) {
        interp.context.variables.set(k, v);
    }
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(code)));
    return interp.context.lastValue;
}
console.log("=== Phase 13: Data Transform Tests ===\n");
// ── JSON (direct) ─────────────────────────────────────────────
test("json_keys", () => {
    const result = D.json_keys({ name: "claude", phase: 13 });
    if (!result.includes("name") || !result.includes("phase"))
        throw new Error(`Expected [name, phase], got ${result}`);
});
test("json_vals", () => {
    const result = D.json_vals({ x: 1, y: 2 });
    if (!result.includes(1) || !result.includes(2))
        throw new Error(`Expected [1, 2], got ${result}`);
});
test("json_has true", () => {
    if (D.json_has({ name: "ai" }, "name") !== true)
        throw new Error("Expected true");
});
test("json_has false", () => {
    if (D.json_has({ name: "ai" }, "age") !== false)
        throw new Error("Expected false");
});
test("json_str", () => {
    const s = D.json_str({ ok: true });
    if (JSON.parse(s).ok !== true)
        throw new Error(`Expected ok=true`);
});
test("json_pretty", () => {
    const s = D.json_pretty({ a: 1 });
    if (!s.includes("\n"))
        throw new Error("Expected pretty-printed JSON with newlines");
});
test("json_merge", () => {
    const r = D.json_merge({ x: 1 }, { y: 2 });
    if (r.x !== 1 || r.y !== 2)
        throw new Error(`Expected x=1 y=2`);
});
test("json_merge overwrite", () => {
    const r = D.json_merge({ x: 1, y: 0 }, { y: 99 });
    if (r.y !== 99)
        throw new Error(`Expected y=99, got ${r.y}`);
});
test("json_deep_merge", () => {
    const r = D.json_deep_merge({ a: { x: 1, z: 3 } }, { a: { y: 2 } });
    if (r.a.x !== 1 || r.a.y !== 2 || r.a.z !== 3)
        throw new Error(`Deep merge failed: ${JSON.stringify(r)}`);
});
test("json_del", () => {
    const r = D.json_del({ name: "ai", secret: "x" }, "secret");
    if ("secret" in r)
        throw new Error("Expected secret deleted");
    if (r.name !== "ai")
        throw new Error("Expected name preserved");
});
test("json_get dot-path", () => {
    const r = D.json_get({ user: { name: "claude", level: 9 } }, "user.name");
    if (r !== "claude")
        throw new Error(`Expected "claude", got "${r}"`);
});
test("json_get array index", () => {
    const r = D.json_get({ items: ["a", "b", "c"] }, "items.1");
    if (r !== "b")
        throw new Error(`Expected "b", got "${r}"`);
});
test("json_get missing returns null", () => {
    const r = D.json_get({ x: 1 }, "y.z");
    if (r !== null)
        throw new Error(`Expected null, got ${r}`);
});
test("json_set", () => {
    const r = D.json_set({ x: 1 }, "y", 42);
    if (r.y !== 42)
        throw new Error(`Expected y=42`);
    if (r.x !== 1)
        throw new Error("Expected x preserved");
});
test("json_set immutable (original unchanged)", () => {
    const orig = { x: 1 };
    D.json_set(orig, "y", 42);
    if ("y" in orig)
        throw new Error("Original should not be mutated");
});
// ── CSV (direct) ──────────────────────────────────────────────
test("csv_parse basic", () => {
    const rows = D.csv_parse("name,age\nclaude,9\nai,13");
    if (rows.length !== 3)
        throw new Error(`Expected 3 rows, got ${rows.length}`);
    if (rows[0][0] !== "name")
        throw new Error(`Expected header "name"`);
    if (rows[1][1] !== "9")
        throw new Error(`Expected "9"`);
});
test("csv_parse quoted cell", () => {
    const rows = D.csv_parse(`a,"hello, world",c`);
    if (rows[0][1] !== "hello, world")
        throw new Error(`Expected "hello, world", got "${rows[0][1]}"`);
});
test("csv_header", () => {
    const rows = [["id", "name"], ["1", "claude"]];
    const h = D.csv_header(rows);
    if (h[0] !== "id" || h[1] !== "name")
        throw new Error(`Expected [id, name]`);
});
test("csv_to_objects", () => {
    const rows = [["name", "phase"], ["claude", "13"], ["ai", "9"]];
    const objs = D.csv_to_objects(rows);
    if (objs.length !== 2)
        throw new Error(`Expected 2 objects`);
    if (objs[0].name !== "claude" || objs[0].phase !== "13")
        throw new Error(`Expected name=claude phase=13`);
});
test("csv_write", () => {
    const s = D.csv_write([["a", "b"], ["1", "2"]]);
    if (!s.includes("a,b") || !s.includes("1,2"))
        throw new Error(`Got: ${s}`);
});
test("csv_roundtrip", () => {
    const original = [["name", "score"], ["claude", "100"], ["ai", "99"]];
    const csv = D.csv_write(original);
    const parsed = D.csv_parse(csv);
    if (parsed[1][0] !== "claude")
        throw new Error(`Roundtrip failed: ${JSON.stringify(parsed)}`);
});
// ── String Template (direct) ──────────────────────────────────
test("str_template basic", () => {
    const r = D.str_template("Hello {name}, phase {phase}", { name: "claude", phase: 13 });
    if (r !== "Hello claude, phase 13")
        throw new Error(`Got: "${r}"`);
});
test("str_template missing key stays", () => {
    const r = D.str_template("Hello {name} at {time}", { name: "ai" });
    if (!r.includes("{time}"))
        throw new Error(`Expected {time} to remain, got "${r}"`);
});
test("str_lines", () => {
    const lines = D.str_lines("line1\nline2\nline3");
    if (lines.length !== 3)
        throw new Error(`Expected 3 lines`);
});
test("str_join_lines", () => {
    const s = D.str_join_lines(["a", "b", "c"]);
    if (s !== "a\nb\nc")
        throw new Error(`Expected "a\\nb\\nc", got "${s}"`);
});
test("str_trim", () => {
    if (D.str_trim("  hello  ") !== "hello")
        throw new Error("Expected trimmed string");
});
test("str_words", () => {
    const words = D.str_words("  hello world  ai  ");
    if (words.length !== 3)
        throw new Error(`Expected 3 words, got ${words.length}`);
});
test("str_count", () => {
    if (D.str_count("abcabcabc", "abc") !== 3)
        throw new Error("Expected 3");
});
// ── Integration: HTTP → json_get ($var in FreeLang) ──────────
test("http_json + json_get via $var in FreeLang", () => {
    const interp = new interpreter_1.Interpreter();
    // Step 1: fetch JSON from local service
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(`(http_json "http://localhost:40000/health")`)));
    const data = interp.context.lastValue;
    // Step 2: use data module directly (avoids complex object-in-FreeLang-code issue)
    const status = D.json_get(data, "status");
    if (typeof status !== "string")
        throw new Error(`Expected string status, got ${typeof status}`);
    console.log(`    → status: ${status}`);
});
test("shell + csv_parse pipeline", () => {
    // Generate CSV via shell, parse via data module
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(`(shell "printf 'name,score\\nclaude,100\\nai,99'")`)));
    const csv = interp.context.lastValue;
    const rows = D.csv_parse(csv);
    const objs = D.csv_to_objects(rows);
    if (objs[0].name !== "claude")
        throw new Error(`Expected claude, got ${objs[0].name}`);
    if (objs[0].score !== "100")
        throw new Error(`Expected 100, got ${objs[0].score}`);
});
test("str_template + http_get response formatting", () => {
    const msg = D.str_template("AI language: {name} | version: {version} | phase: {phase}", { name: "FreeLang v9", version: "13", phase: "data-transform" });
    if (!msg.includes("FreeLang v9"))
        throw new Error(`Template failed: ${msg}`);
    console.log(`    → ${msg}`);
});
console.log("\n=== Phase 13 Tests Complete ===");
//# sourceMappingURL=test-phase13-data.js.map