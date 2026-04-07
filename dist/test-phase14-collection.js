"use strict";
// FreeLang v9: Phase 14 Collection + Execution Control Tests
// AI agent workflow primitives: array ops + retry + pipeline
Object.defineProperty(exports, "__esModule", { value: true });
const stdlib_collection_1 = require("./stdlib-collection");
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
const C = (0, stdlib_collection_1.createCollectionModule)();
console.log("=== Phase 14: Collection + Control Tests ===\n");
// ── Array Transformation ──────────────────────────────────────
test("arr_flatten", () => {
    const r = C.arr_flatten([[1, 2], [3, 4], [5]]);
    if (JSON.stringify(r) !== "[1,2,3,4,5]")
        throw new Error(`Got: ${r}`);
});
test("arr_flatten_deep", () => {
    const r = C.arr_flatten_deep([1, [2, [3, [4]]]]);
    if (JSON.stringify(r) !== "[1,2,3,4]")
        throw new Error(`Got: ${r}`);
});
test("arr_zip", () => {
    const r = C.arr_zip([1, 2, 3], ["a", "b", "c"]);
    if (r[0][0] !== 1 || r[0][1] !== "a")
        throw new Error(`Got: ${JSON.stringify(r)}`);
    if (r.length !== 3)
        throw new Error(`Expected 3 pairs`);
});
test("arr_zip shorter", () => {
    const r = C.arr_zip([1, 2], ["a", "b", "c"]);
    if (r.length !== 2)
        throw new Error(`Expected 2 pairs (min length)`);
});
test("arr_unique", () => {
    const r = C.arr_unique([1, 2, 1, 3, 2]);
    if (r.length !== 3)
        throw new Error(`Expected 3 unique, got ${r.length}`);
    if (!r.includes(1) || !r.includes(2) || !r.includes(3))
        throw new Error(`Missing values`);
});
test("arr_chunk", () => {
    const r = C.arr_chunk([1, 2, 3, 4, 5], 2);
    if (r.length !== 3)
        throw new Error(`Expected 3 chunks`);
    if (r[0].length !== 2 || r[2].length !== 1)
        throw new Error(`Wrong chunk sizes`);
});
test("arr_take", () => {
    const r = C.arr_take([1, 2, 3, 4, 5], 3);
    if (JSON.stringify(r) !== "[1,2,3]")
        throw new Error(`Got: ${r}`);
});
test("arr_drop", () => {
    const r = C.arr_drop([1, 2, 3, 4, 5], 2);
    if (JSON.stringify(r) !== "[3,4,5]")
        throw new Error(`Got: ${r}`);
});
test("arr_sum", () => {
    if (C.arr_sum([1, 2, 3, 4, 5]) !== 15)
        throw new Error("Expected 15");
});
test("arr_avg", () => {
    if (C.arr_avg([10, 20, 30]) !== 20)
        throw new Error("Expected 20");
});
test("arr_min", () => {
    if (C.arr_min([3, 1, 4, 1, 5, 9]) !== 1)
        throw new Error("Expected 1");
});
test("arr_max", () => {
    if (C.arr_max([3, 1, 4, 1, 5, 9]) !== 9)
        throw new Error("Expected 9");
});
test("arr_group_by", () => {
    const items = [
        { type: "A", val: 1 }, { type: "B", val: 2 }, { type: "A", val: 3 }
    ];
    const r = C.arr_group_by(items, "type");
    if (r["A"].length !== 2)
        throw new Error(`Expected 2 in group A`);
    if (r["B"].length !== 1)
        throw new Error(`Expected 1 in group B`);
});
test("arr_sort_by", () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const r = C.arr_sort_by(items, "n");
    if (r[0].n !== 1 || r[1].n !== 2 || r[2].n !== 3)
        throw new Error(`Not sorted: ${JSON.stringify(r)}`);
});
test("arr_sort_by_desc", () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const r = C.arr_sort_by_desc(items, "n");
    if (r[0].n !== 3 || r[2].n !== 1)
        throw new Error(`Not sorted desc: ${JSON.stringify(r)}`);
});
test("arr_sort_by immutable (original unchanged)", () => {
    const items = [{ n: 3 }, { n: 1 }];
    C.arr_sort_by(items, "n");
    if (items[0].n !== 3)
        throw new Error("Original should not be mutated");
});
test("arr_count_by", () => {
    const items = [{ role: "ai" }, { role: "ai" }, { role: "human" }];
    const r = C.arr_count_by(items, "role");
    if (r["ai"] !== 2 || r["human"] !== 1)
        throw new Error(`Got: ${JSON.stringify(r)}`);
});
test("arr_pluck", () => {
    const items = [{ name: "a" }, { name: "b" }, { name: "c" }];
    const r = C.arr_pluck(items, "name");
    if (JSON.stringify(r) !== '["a","b","c"]')
        throw new Error(`Got: ${JSON.stringify(r)}`);
});
test("arr_index_by", () => {
    const items = [{ id: "x", v: 1 }, { id: "y", v: 2 }];
    const r = C.arr_index_by(items, "id");
    if (r["x"].v !== 1 || r["y"].v !== 2)
        throw new Error(`Got: ${JSON.stringify(r)}`);
});
// ── Range ─────────────────────────────────────────────────────
test("range", () => {
    const r = C.range(0, 5);
    if (JSON.stringify(r) !== "[0,1,2,3,4]")
        throw new Error(`Got: ${r}`);
});
test("range_step", () => {
    const r = C.range_step(0, 10, 2);
    if (JSON.stringify(r) !== "[0,2,4,6,8]")
        throw new Error(`Got: ${r}`);
});
test("repeat", () => {
    const r = C.repeat(3, "ai");
    if (JSON.stringify(r) !== '["ai","ai","ai"]')
        throw new Error(`Got: ${r}`);
});
// ── Execution Control ─────────────────────────────────────────
test("retry success on first", () => {
    let calls = 0;
    const r = C.retry(3, () => { calls++; return "ok"; });
    if (r !== "ok" || calls !== 1)
        throw new Error(`Expected 1 call, got ${calls}`);
});
test("retry recovers after failure", () => {
    let calls = 0;
    const r = C.retry(3, () => {
        calls++;
        if (calls < 3)
            throw new Error("fail");
        return "recovered";
    });
    if (r !== "recovered")
        throw new Error(`Expected "recovered", got ${r}`);
    if (calls !== 3)
        throw new Error(`Expected 3 calls, got ${calls}`);
});
test("retry throws on exhaustion", () => {
    let threw = false;
    try {
        C.retry(2, () => { throw new Error("always fails"); });
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error("Expected error after exhaustion");
});
test("retry_silent returns null on failure", () => {
    const r = C.retry_silent(2, () => { throw new Error("fail"); });
    if (r !== null)
        throw new Error(`Expected null, got ${r}`);
});
test("pipeline_run", () => {
    const r = C.pipeline_run(5, [(x) => x * 2, (x) => x + 1, (x) => x * 3]);
    // 5 → *2=10 → +1=11 → *3=33
    if (r !== 33)
        throw new Error(`Expected 33, got ${r}`);
});
test("pipeline_run string transforms", () => {
    const r = C.pipeline_run("  hello world  ", [(s) => s.trim(), (s) => s.toUpperCase(), (s) => s + "!"]);
    if (r !== "HELLO WORLD!")
        throw new Error(`Got: "${r}"`);
});
test("memoize caches results", () => {
    let calls = 0;
    const fn = C.memoize((x) => { calls++; return x * 2; });
    fn(5);
    fn(5);
    fn(5);
    fn(10);
    if (calls !== 2)
        throw new Error(`Expected 2 unique calls, got ${calls}`);
    if (fn(5) !== 10)
        throw new Error("Wrong cached value");
});
test("once executes only once", () => {
    let calls = 0;
    const fn = C.once(() => { calls++; return "init"; });
    fn();
    fn();
    fn();
    if (calls !== 1)
        throw new Error(`Expected 1 call, got ${calls}`);
    if (fn() !== "init")
        throw new Error("Should return first result");
});
test("tap returns value unchanged", () => {
    const side = [];
    const r = C.tap([1, 2, 3], (v) => side.push(v.length));
    if (JSON.stringify(r) !== "[1,2,3]")
        throw new Error("Value changed");
    if (side[0] !== 3)
        throw new Error("Side effect not called");
});
// ── Integration: AI data pipeline ────────────────────────────
test("csv → parse → group_by → count pipeline", () => {
    const { createDataModule } = require("./stdlib-data");
    const D = createDataModule();
    const csv = "role,name\nai,claude\nai,gpt\nhuman,alice\nai,gemini";
    const rows = D.csv_parse(csv);
    const objs = D.csv_to_objects(rows);
    const grouped = C.arr_group_by(objs, "role");
    const counts = C.arr_count_by(objs, "role");
    if (counts["ai"] !== 3)
        throw new Error(`Expected 3 ai, got ${counts["ai"]}`);
    if (counts["human"] !== 1)
        throw new Error(`Expected 1 human`);
    if (grouped["ai"].length !== 3)
        throw new Error("Group mismatch");
    console.log(`    → ai: ${counts["ai"]}, human: ${counts["human"]}`);
});
test("retry + http_get resilience", () => {
    // Simulate: first attempt fails, second succeeds using retry_silent
    let attempt = 0;
    const r = C.retry(2, () => {
        attempt++;
        if (attempt < 2)
            throw new Error("simulated failure");
        return { status: "ok", attempt };
    });
    if (r.status !== "ok" || r.attempt !== 2)
        throw new Error(`Unexpected: ${JSON.stringify(r)}`);
});
test("range + arr_sum: total tokens budget", () => {
    // AI token budget: range of per-call costs, sum = total
    const costs = C.range(1, 6).map(i => i * 100); // [100,200,300,400,500]
    const total = C.arr_sum(costs);
    if (total !== 1500)
        throw new Error(`Expected 1500, got ${total}`);
});
console.log("\n=== Phase 14 Tests Complete ===");
//# sourceMappingURL=test-phase14-collection.js.map