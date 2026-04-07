"use strict";
// FreeLang v9: Phase 16 Time + Logging + Monitoring Tests
// AI observability: time ops + structured logging + metrics
Object.defineProperty(exports, "__esModule", { value: true });
const stdlib_time_1 = require("./stdlib-time");
const stdlib_agent_1 = require("./stdlib-agent");
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
const T = (0, stdlib_time_1.createTimeModule)();
const A = (0, stdlib_agent_1.createAgentModule)();
const C = (0, stdlib_collection_1.createCollectionModule)();
console.log("=== Phase 16: Time + Logging + Monitoring Tests ===\n");
// ── Time ──────────────────────────────────────────────────────
test("now returns number", () => {
    const n = T.now();
    if (typeof n !== "number" || n < 1000000000000)
        throw new Error(`Unexpected: ${n}`);
});
test("now_iso is ISO string", () => {
    const s = T.now_iso();
    if (!s.includes("T") || !s.includes("Z"))
        throw new Error(`Not ISO: ${s}`);
});
test("now_unix is seconds", () => {
    const u = T.now_unix();
    const expected = Math.floor(Date.now() / 1000);
    if (Math.abs(u - expected) > 2)
        throw new Error(`Expected ~${expected}, got ${u}`);
});
test("time_diff positive", () => {
    const t1 = T.now();
    T.sleep_ms(5);
    const t2 = T.now();
    const diff = T.time_diff(t1, t2);
    if (diff < 0)
        throw new Error(`Expected positive diff, got ${diff}`);
});
test("time_since", () => {
    const ts = T.now();
    T.sleep_ms(5);
    const since = T.time_since(ts);
    if (since < 0)
        throw new Error(`Expected positive, got ${since}`);
});
test("time_ago ms", () => {
    const ts = T.now() - 500;
    const r = T.time_ago(ts);
    if (!r.includes("ms ago"))
        throw new Error(`Expected "ms ago", got "${r}"`);
});
test("time_ago seconds", () => {
    const ts = T.now() - 5000;
    const r = T.time_ago(ts);
    if (!r.includes("s ago"))
        throw new Error(`Expected "s ago", got "${r}"`);
});
test("time_ago minutes", () => {
    const ts = T.now() - 90000;
    const r = T.time_ago(ts);
    if (!r.includes("m ago"))
        throw new Error(`Expected "m ago", got "${r}"`);
});
test("format_date", () => {
    const ts = new Date("2026-04-07T12:30:45.000Z").getTime();
    const formatted = T.format_date(ts, "YYYY-MM-DD");
    if (!formatted.includes("2026"))
        throw new Error(`Expected 2026 in "${formatted}"`);
});
test("date_parts", () => {
    const ts = T.now();
    const parts = T.date_parts(ts);
    if (typeof parts.year !== "number")
        throw new Error("year missing");
    if (typeof parts.month !== "number")
        throw new Error("month missing");
    if (parts.year < 2026)
        throw new Error(`Unexpected year: ${parts.year}`);
});
test("date_add seconds", () => {
    const ts = 1000000;
    const r = T.date_add(ts, "s", 10);
    if (r !== 1010000)
        throw new Error(`Expected 1010000, got ${r}`);
});
test("date_add days", () => {
    const ts = 0;
    const r = T.date_add(ts, "d", 1);
    if (r !== 86400000)
        throw new Error(`Expected 86400000, got ${r}`);
});
test("date_add invalid unit throws", () => {
    let threw = false;
    try {
        T.date_add(0, "year", 1);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error("Expected error for unknown unit");
});
// ── Timer ─────────────────────────────────────────────────────
test("timer_start / timer_elapsed", () => {
    const timer = T.timer_start("test");
    T.sleep_ms(5);
    const elapsed = T.timer_elapsed(timer);
    if (elapsed < 0)
        throw new Error(`Elapsed should be >= 0, got ${elapsed}`);
    if (typeof elapsed !== "number")
        throw new Error("Expected number");
});
test("timer_lap", () => {
    const t1 = T.timer_start("laps");
    T.sleep_ms(2);
    const t2 = T.timer_lap(t1, "step1");
    T.sleep_ms(2);
    const t3 = T.timer_lap(t2, "step2");
    if (t3.laps.length !== 2)
        throw new Error(`Expected 2 laps, got ${t3.laps.length}`);
    if (t3.laps[0].label !== "step1")
        throw new Error("Wrong lap label");
});
test("timer_stop", () => {
    const timer = T.timer_start("perf");
    T.sleep_ms(3);
    const result = T.timer_stop(timer);
    if (typeof result.total_ms !== "number")
        throw new Error("total_ms missing");
    if (result.label !== "perf")
        throw new Error("label missing");
});
// ── Logger ────────────────────────────────────────────────────
test("log_create", () => {
    const logger = T.log_create("agent", "info");
    if (logger.name !== "agent")
        throw new Error("Wrong name");
    if (logger.entries.length !== 0)
        throw new Error("Should start empty");
});
test("log_info / log_warn / log_error", () => {
    let logger = T.log_create("test", "debug");
    logger = T.log_info(logger, "started");
    logger = T.log_warn(logger, "slow response");
    logger = T.log_error(logger, "connection failed");
    if (logger.entries.length !== 3)
        throw new Error(`Expected 3, got ${logger.entries.length}`);
    if (logger.entries[0].level !== "info")
        throw new Error("Wrong level");
    if (logger.entries[1].level !== "warn")
        throw new Error("Wrong level");
    if (logger.entries[2].level !== "error")
        throw new Error("Wrong level");
});
test("log_debug filtered by level", () => {
    let logger = T.log_create("test", "info"); // min level = info
    logger = T.log_debug(logger, "debug msg"); // should be filtered
    logger = T.log_info(logger, "info msg");
    if (logger.entries.length !== 1)
        throw new Error(`Expected 1 entry, got ${logger.entries.length}`);
    if (logger.entries[0].level !== "info")
        throw new Error("Wrong entry");
});
test("log_entry with data", () => {
    let logger = T.log_create("test", "debug");
    logger = T.log_entry(logger, "info", "tool called", { tool: "http_get", ms: 42 });
    if (logger.entries[0].data?.tool !== "http_get")
        throw new Error("data missing");
    if (logger.entries[0].data?.ms !== 42)
        throw new Error("ms missing");
});
test("log_filter by level", () => {
    let logger = T.log_create("test", "debug");
    logger = T.log_debug(logger, "d");
    logger = T.log_info(logger, "i");
    logger = T.log_warn(logger, "w");
    logger = T.log_error(logger, "e");
    const warns = T.log_filter(logger, "warn");
    if (warns.length !== 2)
        throw new Error(`Expected 2 (warn+error), got ${warns.length}`);
});
test("log_count", () => {
    let logger = T.log_create("test", "debug");
    logger = T.log_warn(logger, "w1");
    logger = T.log_warn(logger, "w2");
    logger = T.log_error(logger, "e1");
    if (T.log_count(logger, "warn") !== 2)
        throw new Error("Expected 2 warns");
    if (T.log_count(logger, "error") !== 1)
        throw new Error("Expected 1 error");
});
test("log_last", () => {
    let logger = T.log_create("test", "debug");
    for (let i = 0; i < 5; i++)
        logger = T.log_info(logger, `msg-${i}`);
    const last2 = T.log_last(logger, 2);
    if (last2.length !== 2)
        throw new Error(`Expected 2, got ${last2.length}`);
    if (last2[1].msg !== "msg-4")
        throw new Error("Wrong last entry");
});
// ── Metrics ───────────────────────────────────────────────────
test("metrics_create", () => {
    const m = T.metrics_create("agent-metrics");
    if (m.name !== "agent-metrics")
        throw new Error("Wrong name");
});
test("metrics_record / metrics_avg", () => {
    let m = T.metrics_create("m");
    m = T.metrics_record(m, "latency", 10);
    m = T.metrics_record(m, "latency", 20);
    m = T.metrics_record(m, "latency", 30);
    if (T.metrics_avg(m, "latency") !== 20)
        throw new Error(`Expected 20, got ${T.metrics_avg(m, "latency")}`);
});
test("metrics_min / metrics_max", () => {
    let m = T.metrics_create("m");
    [5, 1, 9, 3, 7].forEach(v => { m = T.metrics_record(m, "v", v); });
    if (T.metrics_min(m, "v") !== 1)
        throw new Error("Wrong min");
    if (T.metrics_max(m, "v") !== 9)
        throw new Error("Wrong max");
});
test("metrics_p95", () => {
    let m = T.metrics_create("m");
    // 100 values: 1..100
    for (let i = 1; i <= 100; i++)
        m = T.metrics_record(m, "rt", i);
    const p95 = T.metrics_p95(m, "rt");
    if (p95 < 90 || p95 > 100)
        throw new Error(`p95 out of range: ${p95}`);
});
test("metrics_inc / metrics_count", () => {
    let m = T.metrics_create("m");
    m = T.metrics_inc(m, "requests");
    m = T.metrics_inc(m, "requests");
    m = T.metrics_inc(m, "errors");
    if (T.metrics_count(m, "requests") !== 2)
        throw new Error("Expected 2");
    if (T.metrics_count(m, "errors") !== 1)
        throw new Error("Expected 1");
});
test("metrics_inc_by", () => {
    let m = T.metrics_create("m");
    m = T.metrics_inc_by(m, "tokens", 150);
    m = T.metrics_inc_by(m, "tokens", 200);
    if (T.metrics_count(m, "tokens") !== 350)
        throw new Error(`Expected 350, got ${T.metrics_count(m, "tokens")}`);
});
test("metrics_summary", () => {
    let m = T.metrics_create("m");
    m = T.metrics_record(m, "latency", 10);
    m = T.metrics_record(m, "latency", 20);
    m = T.metrics_inc(m, "calls");
    const s = T.metrics_summary(m);
    if (!s.latency || s.latency.count !== 2)
        throw new Error("latency summary missing");
    if (!s["counter.calls"])
        throw new Error("counter summary missing");
});
// ── Integration: Agent + Timer + Logger + Metrics ─────────────
test("agent loop with full observability", () => {
    let agent = A.agent_create("observed-agent");
    let logger = T.log_create("loop", "debug");
    let metrics = T.metrics_create("loop-metrics");
    const timer = T.timer_start("total");
    agent = A.agent_set(agent, "target", 5);
    agent = A.agent_set(agent, "value", 0);
    const result = A.agent_loop(agent, (state) => state.value >= state.target, (a) => {
        const stepTimer = T.timer_start("step");
        const cur = A.agent_get(a, "value");
        const next = cur + 1;
        const elapsed = T.timer_elapsed(stepTimer);
        logger = T.log_info(logger, `step ${next}: value=${next}`);
        metrics = T.metrics_record(metrics, "step_ms", elapsed);
        metrics = T.metrics_inc(metrics, "steps");
        return A.agent_set(a, "value", next);
    }, 20);
    const totalMs = T.timer_elapsed(timer);
    const summary = T.metrics_summary(metrics);
    if (result.status !== "done")
        throw new Error(`Expected done`);
    if (A.agent_get(result, "value") !== 5)
        throw new Error("Expected value=5");
    if (T.log_count(logger, "info") !== 5)
        throw new Error(`Expected 5 log entries`);
    if (summary["counter.steps"].count !== 5)
        throw new Error("Expected 5 step metrics");
    if (typeof totalMs !== "number")
        throw new Error("Timer failed");
    console.log(`    → steps: ${result.steps}, total: ${totalMs}ms, avg_step: ${T.metrics_avg(metrics, "step_ms").toFixed(2)}ms`);
    console.log(`    → log entries: ${logger.entries.length}`);
});
console.log("\n=== Phase 16 Tests Complete ===");
//# sourceMappingURL=test-phase16-time.js.map