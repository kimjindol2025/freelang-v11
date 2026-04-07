"use strict";
// FreeLang v9: Workflow Engine Standard Library
// Phase 18: High-level orchestration — wraps all previous phases into named workflows
//
// "워크플로우"는 FreeLang v9의 최상위 실행 단위다.
// Phase 9~17의 모든 블록이 도구(tool)가 되고,
// Workflow가 그것들을 이름 있는 단계로 조율한다.
//
// AI가 복잡한 태스크를 수행할 때의 표준 패턴:
//   workflow_create → 단계 정의
//   workflow_run   → 실행 (자동 로깅 + 메트릭 + 에러 처리)
//   workflow_report → 결과 리포트
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkflowModule = createWorkflowModule;
const stdlib_time_1 = require("./stdlib-time");
const stdlib_agent_1 = require("./stdlib-agent");
const stdlib_crypto_1 = require("./stdlib-crypto");
const T = (0, stdlib_time_1.createTimeModule)();
const A = (0, stdlib_agent_1.createAgentModule)();
const X = (0, stdlib_crypto_1.createCryptoModule)();
function createWorkflowModule() {
    return {
        // ── Workflow Definition ───────────────────────────────────
        // workflow_create name steps -> Workflow object
        "workflow_create": (name, steps) => ({
            id: X.uuid_from_str(name + Date.now()),
            name,
            steps,
            created_at: T.now(),
        }),
        // workflow_step name fn -> WorkflowStep  (helper for defining steps)
        "workflow_step": (name, fn, options = {}) => ({
            name,
            fn,
            retry: options.retry ?? 0,
            required: options.required ?? true,
        }),
        // ── Workflow Execution ────────────────────────────────────
        // workflow_run workflow initial_ctx -> WorkflowResult
        "workflow_run": (workflow, initialCtx = {}) => {
            const startMs = T.now();
            const runId = X.uuid_short();
            let ctx = { ...initialCtx, _workflow: workflow.name, _run_id: runId };
            const log = [];
            const errors = [];
            let stepsOk = 0;
            let stepsFailed = 0;
            for (const step of workflow.steps) {
                const stepStart = T.now();
                let success = false;
                let lastErr = "";
                const maxAttempts = (step.retry ?? 0) + 1;
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    try {
                        const result = step.fn(ctx);
                        ctx = { ...ctx, ...result };
                        success = true;
                        break;
                    }
                    catch (err) {
                        lastErr = err.message;
                        if (attempt < maxAttempts - 1) {
                            // backoff between retries
                            const wait = 50 * (attempt + 1);
                            const end = Date.now() + wait;
                            while (Date.now() < end) { /* spin */ }
                        }
                    }
                }
                const stepMs = T.now() - stepStart;
                if (success) {
                    stepsOk++;
                    log.push({ step: step.name, status: "ok", ms: stepMs });
                    ctx[`_step_${step.name}_ms`] = stepMs;
                }
                else {
                    stepsFailed++;
                    errors.push(`[${step.name}] ${lastErr}`);
                    log.push({ step: step.name, status: "failed", ms: stepMs, error: lastErr });
                    if (step.required !== false) {
                        // Required step failed — abort workflow
                        return {
                            id: runId,
                            name: workflow.name,
                            status: "failed",
                            context: ctx,
                            steps_run: stepsOk + stepsFailed,
                            steps_ok: stepsOk,
                            steps_failed: stepsFailed,
                            total_ms: T.now() - startMs,
                            log,
                            errors,
                        };
                    }
                    // Optional step failed — continue
                }
            }
            const totalMs = T.now() - startMs;
            const status = stepsFailed === 0 ? "success" : "partial";
            return {
                id: runId,
                name: workflow.name,
                status,
                context: ctx,
                steps_run: stepsOk + stepsFailed,
                steps_ok: stepsOk,
                steps_failed: stepsFailed,
                total_ms: totalMs,
                log,
                errors,
            };
        },
        // ── Result Inspection ─────────────────────────────────────
        // workflow_ok result -> boolean
        "workflow_ok": (result) => result.status !== "failed",
        // workflow_get result key -> any  (get value from result context)
        "workflow_get": (result, key) => result.context[key] ?? null,
        // workflow_summary result -> string  (human/AI readable summary)
        "workflow_summary": (result) => {
            const lines = [
                `Workflow: ${result.name} [${result.status.toUpperCase()}]`,
                `Run ID:   ${result.id}`,
                `Steps:    ${result.steps_ok}/${result.steps_run} ok, ${result.steps_failed} failed`,
                `Time:     ${result.total_ms}ms`,
            ];
            if (result.errors.length > 0) {
                lines.push(`Errors:`);
                result.errors.forEach(e => lines.push(`  - ${e}`));
            }
            lines.push(`Step log:`);
            result.log.forEach(l => {
                const err = l.error ? ` — ${l.error}` : "";
                lines.push(`  [${l.status.padEnd(6)}] ${l.step} (${l.ms}ms)${err}`);
            });
            return lines.join("\n");
        },
        // ── Task Tracker ──────────────────────────────────────────
        // task_create goal -> Task
        "task_create": (goal) => ({
            id: X.uuid_v4(),
            goal,
            status: "pending",
            subtasks: [],
            completed: [],
            result: null,
            created_at: T.now(),
        }),
        // task_add_subtask task name -> task
        "task_add_subtask": (task, name) => ({
            ...task,
            subtasks: [...task.subtasks, name],
        }),
        // task_complete_subtask task name result -> task
        "task_complete_subtask": (task, name, result) => ({
            ...task,
            completed: [...task.completed, name],
            [`result_${name}`]: result,
        }),
        // task_finish task result -> task
        "task_finish": (task, result) => ({
            ...task,
            status: "done",
            result,
            finished_at: T.now(),
            duration_ms: T.now() - task.created_at,
        }),
        // task_progress task -> number (0.0-1.0)
        "task_progress": (task) => {
            if (task.subtasks.length === 0)
                return task.status === "done" ? 1 : 0;
            return task.completed.length / task.subtasks.length;
        },
        // ── Report Builder ────────────────────────────────────────
        // report_create title -> Report
        "report_create": (title) => ({
            title,
            sections: [],
            created_at: T.now_iso(),
        }),
        // report_add report section_name data -> Report
        "report_add": (report, sectionName, data) => ({
            ...report,
            sections: [...report.sections, { name: sectionName, data }],
        }),
        // report_render report -> string  (formatted text report)
        "report_render": (report) => {
            const divider = "─".repeat(50);
            const lines = [
                divider,
                `  ${report.title}`,
                `  Generated: ${report.created_at}`,
                divider,
            ];
            for (const section of report.sections) {
                lines.push(`\n## ${section.name}`);
                const d = section.data;
                if (typeof d === "string") {
                    lines.push(d);
                }
                else if (Array.isArray(d)) {
                    d.forEach((item, i) => {
                        lines.push(`  ${i + 1}. ${typeof item === "object" ? JSON.stringify(item) : item}`);
                    });
                }
                else if (typeof d === "object") {
                    Object.entries(d).forEach(([k, v]) => {
                        lines.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
                    });
                }
                else {
                    lines.push(String(d));
                }
            }
            lines.push("\n" + divider);
            return lines.join("\n");
        },
    };
}
//# sourceMappingURL=stdlib-workflow.js.map