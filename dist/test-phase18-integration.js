"use strict";
// FreeLang v9: Phase 18 — Full Integration + Workflow Engine Tests
//
// 이것이 FreeLang v9의 증명이다.
// AI(Claude Code)가 실제로 이 언어를 사용해서 복잡한 태스크를 수행한다.
// Phase 9~17의 모든 블록이 여기서 함께 동작한다.
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
const stdlib_workflow_1 = require("./stdlib-workflow");
const stdlib_agent_1 = require("./stdlib-agent");
const stdlib_time_1 = require("./stdlib-time");
const stdlib_crypto_1 = require("./stdlib-crypto");
const stdlib_data_1 = require("./stdlib-data");
const stdlib_collection_1 = require("./stdlib-collection");
const stdlib_http_1 = require("./stdlib-http");
const stdlib_file_1 = require("./stdlib-file");
const stdlib_shell_1 = require("./stdlib-shell");
const fs = __importStar(require("fs"));
const W = (0, stdlib_workflow_1.createWorkflowModule)();
const A = (0, stdlib_agent_1.createAgentModule)();
const T = (0, stdlib_time_1.createTimeModule)();
const X = (0, stdlib_crypto_1.createCryptoModule)();
const D = (0, stdlib_data_1.createDataModule)();
const C = (0, stdlib_collection_1.createCollectionModule)();
const H = (0, stdlib_http_1.createHttpModule)();
const F = (0, stdlib_file_1.createFileModule)();
const S = (0, stdlib_shell_1.createShellModule)();
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
const TMP = "/tmp/freelang-v9-phase18";
if (!fs.existsSync(TMP))
    fs.mkdirSync(TMP, { recursive: true });
console.log("=== Phase 18: Full Integration + Workflow Engine ===\n");
// ── Workflow Engine Unit Tests ────────────────────────────────
test("workflow_create", () => {
    const wf = W.workflow_create("test", []);
    if (!wf.id || !wf.name)
        throw new Error("Missing id/name");
    if (!X.is_uuid(wf.id))
        throw new Error("Invalid UUID");
});
test("workflow_run all steps succeed", () => {
    const wf = W.workflow_create("add-pipeline", [
        W.workflow_step("init", (ctx) => ({ ...ctx, value: 0 })),
        W.workflow_step("add10", (ctx) => ({ ...ctx, value: ctx.value + 10 })),
        W.workflow_step("double", (ctx) => ({ ...ctx, value: ctx.value * 2 })),
    ]);
    const result = W.workflow_run(wf, {});
    if (result.status !== "success")
        throw new Error(`Expected success, got ${result.status}`);
    if (W.workflow_get(result, "value") !== 20)
        throw new Error(`Expected 20, got ${W.workflow_get(result, "value")}`);
    if (result.steps_ok !== 3)
        throw new Error(`Expected 3 ok steps`);
});
test("workflow_run required step failure aborts", () => {
    const wf = W.workflow_create("abort-test", [
        W.workflow_step("ok1", (ctx) => ({ ...ctx, a: 1 })),
        W.workflow_step("fail", (_) => { throw new Error("required step exploded"); }),
        W.workflow_step("never", (ctx) => ({ ...ctx, b: 2 })),
    ]);
    const result = W.workflow_run(wf, {});
    if (result.status !== "failed")
        throw new Error(`Expected failed, got ${result.status}`);
    if (result.steps_run !== 2)
        throw new Error(`Expected 2 steps run, got ${result.steps_run}`);
    if (W.workflow_get(result, "b") !== null)
        throw new Error("Step after failure should not run");
});
test("workflow_run optional step failure continues", () => {
    const wf = W.workflow_create("partial-test", [
        W.workflow_step("ok1", (ctx) => ({ ...ctx, a: 1 })),
        W.workflow_step("optional-fail", (_) => { throw new Error("optional failed"); }, { required: false }),
        W.workflow_step("ok2", (ctx) => ({ ...ctx, b: 2 })),
    ]);
    const result = W.workflow_run(wf, {});
    if (result.status !== "partial")
        throw new Error(`Expected partial, got ${result.status}`);
    if (W.workflow_get(result, "a") !== 1 || W.workflow_get(result, "b") !== 2)
        throw new Error("Optional steps should continue");
});
test("workflow_run with retry", () => {
    let attempts = 0;
    const wf = W.workflow_create("retry-test", [
        W.workflow_step("flaky", (ctx) => {
            attempts++;
            if (attempts < 3)
                throw new Error("not ready");
            return { ...ctx, ok: true };
        }, { retry: 3 }),
    ]);
    const result = W.workflow_run(wf, {});
    if (result.status !== "success")
        throw new Error(`Expected success, got ${result.status}`);
    if (attempts !== 3)
        throw new Error(`Expected 3 attempts, got ${attempts}`);
});
test("workflow_summary readable", () => {
    const wf = W.workflow_create("s", [
        W.workflow_step("a", (ctx) => ({ ...ctx, x: 1 })),
        W.workflow_step("b", (ctx) => ({ ...ctx, y: 2 })),
    ]);
    const result = W.workflow_run(wf, {});
    const summary = W.workflow_summary(result);
    if (!summary.includes("success".toUpperCase()))
        throw new Error("Status missing from summary");
    if (!summary.includes("Steps:"))
        throw new Error("Steps missing");
});
// ── Task Tracker ──────────────────────────────────────────────
test("task lifecycle", () => {
    let task = W.task_create("analyze projects");
    task = W.task_add_subtask(task, "fetch");
    task = W.task_add_subtask(task, "filter");
    task = W.task_add_subtask(task, "report");
    if (W.task_progress(task) !== 0)
        throw new Error("Expected 0 progress");
    task = W.task_complete_subtask(task, "fetch", { count: 10 });
    if (Math.abs(W.task_progress(task) - 1 / 3) > 0.01)
        throw new Error("Expected 1/3 progress");
    task = W.task_complete_subtask(task, "filter", { kept: 7 });
    task = W.task_complete_subtask(task, "report", "report.txt");
    task = W.task_finish(task, "all done");
    if (W.task_progress(task) !== 1)
        throw new Error("Expected 100% progress");
    if (task.status !== "done")
        throw new Error("Expected done");
});
// ── Report Builder ────────────────────────────────────────────
test("report create and render", () => {
    let report = W.report_create("FreeLang v9 Status");
    report = W.report_add(report, "Overview", "AI-native language, Phase 18 complete");
    report = W.report_add(report, "Phases", ["Phase 9 Reasoning", "Phase 10 File I/O", "Phase 17 Crypto"]);
    report = W.report_add(report, "Metrics", { total_phases: 18, total_tests: 200, status: "passing" });
    const rendered = W.report_render(report);
    if (!rendered.includes("FreeLang v9 Status"))
        throw new Error("Title missing");
    if (!rendered.includes("Overview"))
        throw new Error("Section missing");
    if (!rendered.includes("total_phases"))
        throw new Error("Metrics missing");
});
// ── Integration Scenario 1: Data Analysis Pipeline ───────────
// HTTP → JSON → filter → sort → report → file
test("Scenario 1: kimdb data analysis pipeline", () => {
    const wf = W.workflow_create("kimdb-analysis", [
        W.workflow_step("fetch_health", (ctx) => {
            const data = H.http_json("http://localhost:40000/health");
            return { ...ctx, server_status: D.json_get(data, "status"), server_version: D.json_get(data, "version") };
        }),
        W.workflow_step("generate_project_data", (ctx) => {
            // Simulate project data (since we know kimdb is running)
            const projects = C.range(1, 11).map(i => ({
                id: `proj-${i}`,
                name: `project-${i}`,
                priority: C.range(1, 4)[X.random_int(0, 2)],
                score: Math.round(X.random_float() * 100),
                category: ["infra", "web", "ai", "tool"][X.random_int(0, 3)],
            }));
            return { ...ctx, projects };
        }),
        W.workflow_step("analyze", (ctx) => {
            const projects = ctx.projects;
            const byCategory = C.arr_group_by(projects, "category");
            const sorted = C.arr_sort_by_desc(projects, "score");
            const top3 = C.arr_take(sorted, 3);
            const avgScore = C.arr_avg(C.arr_pluck(projects, "score"));
            return { ...ctx, by_category: byCategory, top3, avg_score: Math.round(avgScore) };
        }),
        W.workflow_step("checksum", (ctx) => {
            const fingerprint = X.sha256_short(JSON.stringify(ctx.top3));
            return { ...ctx, fingerprint };
        }),
        W.workflow_step("save_report", (ctx) => {
            let report = W.report_create("Project Analysis Report");
            report = W.report_add(report, "Server", { status: ctx.server_status, version: ctx.server_version });
            report = W.report_add(report, "Top 3 Projects", ctx.top3.map((p) => `${p.name} (score: ${p.score})`));
            report = W.report_add(report, "Stats", { total: ctx.projects.length, avg_score: ctx.avg_score, fingerprint: ctx.fingerprint });
            const rendered = W.report_render(report);
            const path = `${TMP}/analysis-report.txt`;
            F.file_write(path, rendered);
            return { ...ctx, report_path: path, report_size: rendered.length };
        }),
    ]);
    const timer = T.timer_start("scenario-1");
    const result = W.workflow_run(wf, {});
    const elapsed = T.timer_elapsed(timer);
    if (result.status !== "success")
        throw new Error(`Expected success: ${result.errors.join(", ")}`);
    if (!F.file_exists(W.workflow_get(result, "report_path")))
        throw new Error("Report file not created");
    const top3 = W.workflow_get(result, "top3");
    if (!Array.isArray(top3) || top3.length !== 3)
        throw new Error("Expected 3 top projects");
    console.log(`    → server: ${W.workflow_get(result, "server_status")} v${W.workflow_get(result, "server_version")}`);
    console.log(`    → top project: ${top3[0].name} (score: ${top3[0].score})`);
    console.log(`    → avg score: ${W.workflow_get(result, "avg_score")}`);
    console.log(`    → fingerprint: ${W.workflow_get(result, "fingerprint")}`);
    console.log(`    → report: ${W.workflow_get(result, "report_path")} (${W.workflow_get(result, "report_size")} bytes)`);
    console.log(`    → total time: ${elapsed}ms`);
});
// ── Integration Scenario 2: Agent + Workflow + Logging ────────
// Agent uses workflow as a tool, logs everything, tracks metrics
test("Scenario 2: agent-driven multi-step reasoning with observability", () => {
    let logger = T.log_create("agent", "debug");
    let metrics = T.metrics_create("agent-run");
    const sessionId = X.uuid_v4();
    let agent = A.agent_create("reasoning-agent");
    agent = A.agent_set(agent, "session_id", sessionId);
    agent = A.agent_set(agent, "goal", "categorize and rank data sources");
    // Register tools
    agent = A.agent_add_tool(agent, "fetch_sources", () => [
        { name: "kimdb", type: "database", latency_ms: 12, reliability: 0.99 },
        { name: "gogs-api", type: "api", latency_ms: 45, reliability: 0.97 },
        { name: "local-files", type: "filesystem", latency_ms: 2, reliability: 0.999 },
        { name: "web-search", type: "external", latency_ms: 200, reliability: 0.85 },
        { name: "shell-cmd", type: "process", latency_ms: 30, reliability: 0.95 },
    ]);
    agent = A.agent_add_tool(agent, "score_source", (src) => ({
        ...src,
        score: Math.round((1 / src.latency_ms * 1000 * src.reliability) * 100) / 100,
    }));
    // Plan
    let plan = A.plan_create(["fetch", "score", "rank", "decide"]);
    agent = A.agent_set(agent, "plan", plan);
    logger = T.log_info(logger, `session ${sessionId.slice(0, 8)} started`);
    const wfTimer = T.timer_start("agent-workflow");
    const result = A.agent_loop(agent, (state) => A.plan_done(state.plan), (a) => {
        const step = A.plan_next(A.agent_get(a, "plan"));
        const stepTimer = T.timer_start(step);
        let stepResult;
        if (step === "fetch") {
            stepResult = A.agent_call_tool(a, "fetch_sources");
            a = A.agent_set(a, "sources", stepResult);
            logger = T.log_info(logger, `fetched ${stepResult.length} sources`);
        }
        else if (step === "score") {
            const sources = A.agent_get(a, "sources");
            stepResult = sources.map((s) => A.agent_call_tool(a, "score_source", s));
            a = A.agent_set(a, "scored", stepResult);
            logger = T.log_debug(logger, `scored ${stepResult.length} sources`);
        }
        else if (step === "rank") {
            const scored = A.agent_get(a, "scored");
            stepResult = C.arr_sort_by_desc(scored, "score");
            a = A.agent_set(a, "ranked", stepResult);
            logger = T.log_info(logger, `ranked: #1 = ${stepResult[0].name}`);
        }
        else if (step === "decide") {
            const ranked = A.agent_get(a, "ranked");
            const best = ranked[0];
            const summary = D.str_template("Best source: {name} (type={type}, score={score}, latency={latency_ms}ms)", best);
            stepResult = { best, summary, alternatives: C.arr_pluck(ranked.slice(1), "name") };
            a = A.agent_set(a, "decision", stepResult);
            logger = T.log_info(logger, summary);
        }
        const ms = T.timer_elapsed(stepTimer);
        metrics = T.metrics_record(metrics, "step_ms", ms);
        metrics = T.metrics_inc(metrics, "steps");
        a = A.agent_push_history(a, { type: "tool_call", data: { step, ms } });
        a = A.agent_set(a, "plan", A.plan_advance(A.agent_get(a, "plan"), stepResult));
        return a;
    }, 20);
    const totalMs = T.timer_elapsed(wfTimer);
    const metricsSummary = T.metrics_summary(metrics);
    if (result.status !== "done")
        throw new Error(`Agent failed: ${A.agent_get(result, "_error")}`);
    if (result.steps !== 4)
        throw new Error(`Expected 4 steps, got ${result.steps}`);
    const decision = A.agent_get(result, "decision");
    if (!decision?.best)
        throw new Error("No decision made");
    if (T.log_count(logger, "info") < 3)
        throw new Error("Expected at least 3 info logs");
    console.log(`    → ${decision.summary}`);
    console.log(`    → alternatives: ${decision.alternatives.join(", ")}`);
    console.log(`    → total: ${totalMs}ms, avg_step: ${T.metrics_avg(metrics, "step_ms").toFixed(1)}ms`);
    console.log(`    → logs: ${logger.entries.length} entries`);
});
// ── Integration Scenario 3: File pipeline with integrity checks ──
// shell → csv → parse → transform → hash → save → verify
test("Scenario 3: CSV file pipeline with integrity verification", () => {
    const csvPath = `${TMP}/data.csv`;
    const outPath = `${TMP}/processed.json`;
    // Generate CSV via shell
    S.shell(`printf 'name,score,tag\\nclaudeCode,99,ai\\nfreelang,95,lang\\nagentLoop,88,agent\\ndataFlow,92,data\\n' > ${csvPath}`);
    const wf = W.workflow_create("csv-integrity-pipeline", [
        W.workflow_step("read_csv", (ctx) => {
            const raw = F.file_read(csvPath);
            const rows = D.csv_parse(raw);
            const items = D.csv_to_objects(rows);
            return { ...ctx, items, row_count: items.length };
        }),
        W.workflow_step("transform", (ctx) => {
            const items = ctx.items;
            const transformed = items.map((item) => ({
                ...item,
                score: parseInt(item.score),
                id: X.uuid_from_str(item.name),
                checksum: X.sha256_short(item.name + item.score),
            }));
            return { ...ctx, transformed };
        }),
        W.workflow_step("analyze", (ctx) => {
            const t = ctx.transformed;
            return {
                ...ctx,
                ranked: C.arr_sort_by_desc(t, "score"),
                avg_score: Math.round(C.arr_avg(C.arr_pluck(t, "score"))),
                by_tag: C.arr_group_by(t, "tag"),
            };
        }),
        W.workflow_step("save", (ctx) => {
            const output = {
                generated_at: T.now_iso(),
                row_count: ctx.row_count,
                avg_score: ctx.avg_score,
                ranked: ctx.ranked,
                by_tag: ctx.by_tag,
            };
            const json = D.json_pretty(output);
            F.file_write(outPath, json);
            const integrity = X.sha256(json);
            return { ...ctx, output_path: outPath, integrity_hash: integrity };
        }),
        W.workflow_step("verify", (ctx) => {
            const saved = F.file_read(ctx.output_path);
            const verifyHash = X.sha256(saved);
            if (!X.hash_eq(ctx.integrity_hash, verifyHash))
                throw new Error("Integrity check failed!");
            return { ...ctx, verified: true };
        }),
    ]);
    const result = W.workflow_run(wf, {});
    if (result.status !== "success")
        throw new Error(`Workflow failed: ${result.errors.join(", ")}`);
    if (!W.workflow_get(result, "verified"))
        throw new Error("Not verified");
    const ranked = W.workflow_get(result, "ranked");
    console.log(`    → top: ${ranked[0].name} (${ranked[0].score})`);
    console.log(`    → avg_score: ${W.workflow_get(result, "avg_score")}`);
    console.log(`    → integrity: ${W.workflow_get(result, "integrity_hash").slice(0, 16)}... ✓`);
    console.log(`    → output: ${outPath}`);
});
// ── Integration Scenario 4: Resilient HTTP agent ──────────────
// retry + timeout awareness + metrics + structured logging
test("Scenario 4: resilient HTTP fetch with full observability", () => {
    let logger = T.log_create("http-agent", "info");
    let metrics = T.metrics_create("http-calls");
    const endpoints = [
        "http://localhost:40000/health",
        "http://localhost:40000/api/c/projects", // may or may not exist
        "http://localhost:40000/health", // retry this one
    ];
    let task = W.task_create("fetch all endpoints");
    endpoints.forEach((_, i) => {
        task = W.task_add_subtask(task, `fetch-${i}`);
    });
    const results = [];
    for (let i = 0; i < endpoints.length; i++) {
        const url = endpoints[i];
        const t = T.timer_start(`req-${i}`);
        const res = C.retry_silent(2, () => {
            const status = H.http_status(url);
            const ms = T.timer_elapsed(t);
            metrics = T.metrics_record(metrics, "latency_ms", ms);
            metrics = T.metrics_inc(metrics, "requests");
            return { url, status, ms };
        });
        if (res) {
            metrics = T.metrics_inc(metrics, "success");
            logger = T.log_info(logger, `${url} → ${res.status} (${res.ms}ms)`);
            results.push(res);
        }
        else {
            metrics = T.metrics_inc(metrics, "failure");
            logger = T.log_warn(logger, `${url} → failed`);
        }
        task = W.task_complete_subtask(task, `fetch-${i}`, res);
    }
    task = W.task_finish(task, results);
    const summary = T.metrics_summary(metrics);
    if (T.metrics_count(metrics, "requests") !== endpoints.length)
        throw new Error("Wrong request count");
    if (W.task_progress(task) !== 1)
        throw new Error("Task not complete");
    console.log(`    → requests: ${T.metrics_count(metrics, "requests")}, success: ${T.metrics_count(metrics, "success")}`);
    console.log(`    → avg latency: ${T.metrics_avg(metrics, "latency_ms").toFixed(1)}ms`);
    console.log(`    → info logs: ${T.log_count(logger, "info")}, warn logs: ${T.log_count(logger, "warn")}`);
});
// Cleanup
try {
    if (fs.existsSync(TMP)) {
        fs.rmSync(TMP, { recursive: true, force: true });
    }
}
catch { }
console.log("\n=== Phase 18 Integration Complete ===");
console.log("\n── FreeLang v9 Phase 9~18 ALL COMPLETE ──");
console.log("AI-native language: 추론/파일/에러/HTTP+Shell/데이터/컬렉션/에이전트/시간+관찰/암호화+정규식/워크플로우");
//# sourceMappingURL=test-phase18-integration.js.map