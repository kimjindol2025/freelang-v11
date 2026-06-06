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
const stdlib_checkpoint_1 = require("./stdlib-checkpoint");
const T = (0, stdlib_time_1.createTimeModule)();
const A = (0, stdlib_agent_1.createAgentModule)();
const X = (0, stdlib_crypto_1.createCryptoModule)();
// P0-4: Error categorization helper
function categorizeError(message) {
    const msg = message.toLowerCase();
    if (msg.includes("timeout"))
        return "TIMEOUT";
    if (msg.includes("enoent") || msg.includes("not found"))
        return "NOT_FOUND";
    if (msg.includes("eacces") || msg.includes("permission"))
        return "PERMISSION";
    if (msg.includes("econnrefused") || msg.includes("connection refused"))
        return "CONNECTION";
    if (msg.includes("econnreset") || msg.includes("connection reset"))
        return "CONNECTION";
    if (msg.includes("parse") || msg.includes("json"))
        return "PARSE_ERROR";
    if (msg.includes("type") || msg.includes("typeof"))
        return "TYPE_ERROR";
    if (msg.includes("null") || msg.includes("undefined"))
        return "NULL_ERROR";
    if (msg.includes("network") || msg.includes("http"))
        return "NETWORK";
    if (msg.includes("io error"))
        return "IO_ERROR";
    return "UNKNOWN";
}
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
        // workflow_step name fn options -> WorkflowStep  (helper for defining steps)
        "workflow_step": (name, fn, options = {}) => ({
            name,
            fn,
            retry: options.retry ?? 0,
            required: options.required ?? true,
            on_error: options.on_error,
            on_timeout: options.on_timeout,
            fallback: options.fallback,
            timeout_ms: options.timeout_ms,
            if: options.if,
            parallel_tasks: options.parallel_tasks,
            merge_strategy: options.merge_strategy,
        }),
        // ── Workflow Execution ────────────────────────────────────
        // workflow_run workflow initial_ctx options -> WorkflowResult (P0, no parallel support)
        // Use workflow_run_async for P1-1 parallel task support
        "workflow_run": (workflow, initialCtx = {}, options) => {
            const startMs = T.now();
            const runId = X.uuid_short();
            const checkpointPath = options?.checkpoint_path;
            const checkpointEvery = options?.checkpoint_every ?? 0;
            const autoResume = options?.auto_resume ?? true;
            // P0-3: Load checkpoint if available
            let startFromStep = 0;
            let ctx = { ...initialCtx, _workflow: workflow.name, _run_id: runId };
            if (autoResume && checkpointPath) {
                const checkpoint = (0, stdlib_checkpoint_1.loadCheckpoint)(checkpointPath);
                if (checkpoint && checkpoint.workflow_id === workflow.id) {
                    startFromStep = checkpoint.step_index;
                    ctx = { ...checkpoint.context, _workflow: workflow.name, _run_id: runId };
                    console.log(`[Checkpoint] Resuming from step ${startFromStep} (${checkpoint.step_names.length} completed)`);
                }
            }
            const log = [];
            const errors = [];
            let stepsOk = 0;
            let stepsFailed = 0;
            const steps = workflow.steps;
            const completedStepNames = [];
            for (let stepIndex = startFromStep; stepIndex < steps.length; stepIndex++) {
                const step = steps[stepIndex];
                // P1-1: Reject if parallel_tasks detected (use workflow_run_async instead)
                if (step.parallel_tasks && step.parallel_tasks.length > 0) {
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
                        errors: ["Parallel tasks detected. Use workflow_run_async() instead of workflow_run()"],
                    };
                }
                // P0-2: Check conditional execution
                if (step.if !== undefined) {
                    try {
                        const shouldRun = step.if(ctx);
                        if (!shouldRun) {
                            log.push({ step: step.name, status: "skipped", ms: 0 });
                            continue;
                        }
                    }
                    catch (condErr) {
                        errors.push(`[${step.name}] Condition failed: ${condErr.message}`);
                        if (step.required !== false) {
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
                        continue;
                    }
                }
                const stepStart = T.now();
                let success = false;
                let lastErr = "";
                const maxAttempts = (step.retry ?? 0) + 1;
                let stepResult = undefined;
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    try {
                        stepResult = step.fn(ctx);
                        ctx = { ...ctx, ...stepResult };
                        success = true;
                        break;
                    }
                    catch (err) {
                        lastErr = err.message;
                        if (attempt < maxAttempts - 1) {
                            const wait = 50 * (attempt + 1);
                            const end = Date.now() + wait;
                            while (Date.now() < end) { /* spin */ }
                        }
                    }
                }
                const stepMs = T.now() - stepStart;
                if (success) {
                    stepsOk++;
                    completedStepNames.push(step.name);
                    log.push({ step: step.name, status: "ok", ms: stepMs });
                    ctx[`_step_${step.name}_ms`] = stepMs;
                    if (checkpointPath && checkpointEvery > 0 && completedStepNames.length % checkpointEvery === 0) {
                        const checkpoint = {
                            workflow_id: workflow.id,
                            workflow_name: workflow.name,
                            step_index: stepIndex + 1,
                            context: ctx,
                            timestamp: T.now(),
                            step_names: completedStepNames,
                            steps_completed: completedStepNames.length,
                        };
                        (0, stdlib_checkpoint_1.saveCheckpoint)(checkpointPath, checkpoint);
                    }
                }
                else {
                    stepsFailed++;
                    let fallbackValue = undefined;
                    const errorCategory = categorizeError(lastErr);
                    if (step.on_error) {
                        try {
                            fallbackValue = step.on_error({ error: lastErr, attempts: maxAttempts, step_name: step.name });
                            ctx = { ...ctx, ...fallbackValue };
                            success = true;
                            errors.push(`[${step.name}] ${lastErr} (handled by on_error)`);
                            log.push({
                                step: step.name,
                                status: "error_handled",
                                ms: stepMs,
                                error: lastErr,
                                category: errorCategory,
                                attempted: maxAttempts,
                            });
                            stepsOk++;
                            stepsFailed--;
                            ctx[`_step_${step.name}_ms`] = stepMs;
                            continue;
                        }
                        catch (handlerErr) {
                            errors.push(`[${step.name}] ${lastErr} → on_error handler also failed: ${handlerErr.message}`);
                        }
                    }
                    if (step.fallback !== undefined) {
                        try {
                            fallbackValue = typeof step.fallback === 'function' ? step.fallback() : step.fallback;
                            ctx = { ...ctx, ...fallbackValue };
                            success = true;
                            errors.push(`[${step.name}] ${lastErr} (fallback used)`);
                            log.push({
                                step: step.name,
                                status: "fallback_used",
                                ms: stepMs,
                                error: lastErr,
                                category: errorCategory,
                                attempted: maxAttempts,
                            });
                            stepsOk++;
                            stepsFailed--;
                            ctx[`_step_${step.name}_ms`] = stepMs;
                            continue;
                        }
                        catch (fallbackErr) {
                            errors.push(`[${step.name}] ${lastErr} → fallback also failed: ${fallbackErr.message}`);
                        }
                    }
                    if (!success) {
                        errors.push(`[${step.name}] ${lastErr}`);
                        log.push({
                            step: step.name,
                            status: "failed",
                            ms: stepMs,
                            error: lastErr,
                            category: errorCategory,
                            attempted: maxAttempts,
                        });
                        if (step.required !== false) {
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
                    }
                }
            }
            const totalMs = T.now() - startMs;
            const status = stepsFailed === 0 ? "success" : "partial";
            if ((status === "success" || status === "partial") && checkpointPath) {
                (0, stdlib_checkpoint_1.deleteCheckpoint)(checkpointPath);
            }
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
        // workflow_run_async workflow initial_ctx options -> Promise<WorkflowResult>
        // P1-1 async version supporting parallel tasks
        // options: {checkpoint_path, checkpoint_every, auto_resume}
        "workflow_run_async": async (workflow, initialCtx = {}, options) => {
            const startMs = T.now();
            const runId = X.uuid_short();
            const checkpointPath = options?.checkpoint_path;
            const checkpointEvery = options?.checkpoint_every ?? 0;
            const autoResume = options?.auto_resume ?? true;
            // P0-3: Load checkpoint if available
            let startFromStep = 0;
            let ctx = { ...initialCtx, _workflow: workflow.name, _run_id: runId };
            if (autoResume && checkpointPath) {
                const checkpoint = (0, stdlib_checkpoint_1.loadCheckpoint)(checkpointPath);
                if (checkpoint && checkpoint.workflow_id === workflow.id) {
                    startFromStep = checkpoint.step_index;
                    ctx = { ...checkpoint.context, _workflow: workflow.name, _run_id: runId };
                    console.log(`[Checkpoint] Resuming from step ${startFromStep} (${checkpoint.step_names.length} completed)`);
                }
            }
            const log = [];
            const errors = [];
            let stepsOk = 0;
            let stepsFailed = 0;
            const steps = workflow.steps;
            const completedStepNames = [];
            // P1-1: Helper to execute a single step (with retry, error handling, etc)
            const executeStep = async (step, currentCtx) => {
                const stepStart = T.now();
                let success = false;
                let lastErr = "";
                const maxAttempts = (step.retry ?? 0) + 1;
                let stepResult = undefined;
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    try {
                        stepResult = step.fn(currentCtx);
                        success = true;
                        break;
                    }
                    catch (err) {
                        lastErr = err.message;
                        if (attempt < maxAttempts - 1) {
                            const wait = 50 * (attempt + 1);
                            const end = Date.now() + wait;
                            while (Date.now() < end) { /* spin */ }
                        }
                    }
                }
                const stepMs = T.now() - stepStart;
                return { success, result: stepResult, error: lastErr, ms: stepMs };
            };
            // P1-1: Helper to execute parallel tasks
            const executeParallelTasks = async (parallelTasks, mergeStrategy, currentCtx) => {
                const taskExecutions = parallelTasks.map(task => executeStep(task, currentCtx));
                const taskResults = await Promise.all(taskExecutions);
                const mergedResults = {};
                const taskErrors = [];
                let allSuccess = true;
                let anySuccess = false;
                taskResults.forEach((result, index) => {
                    const taskName = parallelTasks[index].name;
                    if (result.success) {
                        mergedResults[taskName] = result.result;
                        anySuccess = true;
                    }
                    else {
                        taskErrors.push(`${taskName}: ${result.error}`);
                        allSuccess = false;
                    }
                });
                // Determine success based on merge_strategy
                let strategySuccess = false;
                if (mergeStrategy === "all-success") {
                    strategySuccess = allSuccess;
                }
                else if (mergeStrategy === "first-success") {
                    strategySuccess = anySuccess;
                }
                else if (mergeStrategy === "any-partial") {
                    strategySuccess = true; // Always succeed
                }
                else {
                    strategySuccess = allSuccess; // Default to all-success
                }
                return { success: strategySuccess, results: mergedResults, errors: taskErrors };
            };
            for (let stepIndex = startFromStep; stepIndex < steps.length; stepIndex++) {
                const step = steps[stepIndex];
                // P0-2: Check conditional execution
                if (step.if !== undefined) {
                    try {
                        const shouldRun = step.if(ctx);
                        if (!shouldRun) {
                            log.push({ step: step.name, status: "skipped", ms: 0 });
                            continue;
                        }
                    }
                    catch (condErr) {
                        errors.push(`[${step.name}] Condition failed: ${condErr.message}`);
                        if (step.required !== false) {
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
                        continue;
                    }
                }
                const stepStart = T.now();
                let success = false;
                let lastErr = "";
                let stepResult = undefined;
                let stepMs = 0;
                // P1-1: Check for parallel tasks
                if (step.parallel_tasks && step.parallel_tasks.length > 0) {
                    const mergeStrategy = step.merge_strategy ?? "all-success";
                    const parallelResult = await executeParallelTasks(step.parallel_tasks, mergeStrategy, ctx);
                    stepMs = T.now() - stepStart;
                    if (parallelResult.success) {
                        success = true;
                        stepResult = { [step.name]: parallelResult.results };
                        ctx = { ...ctx, ...stepResult };
                        stepsOk++;
                        completedStepNames.push(step.name);
                        log.push({ step: step.name, status: "ok", ms: stepMs });
                        ctx[`_step_${step.name}_ms`] = stepMs;
                    }
                    else {
                        stepsFailed++;
                        lastErr = parallelResult.errors.join("; ");
                        const errorCategory = categorizeError(lastErr);
                        if (step.fallback !== undefined) {
                            try {
                                const fallbackValue = typeof step.fallback === 'function' ? step.fallback() : step.fallback;
                                ctx = { ...ctx, ...fallbackValue };
                                success = true;
                                errors.push(`[${step.name}] Parallel tasks failed (fallback used)`);
                                log.push({ step: step.name, status: "fallback_used", ms: stepMs, error: lastErr, category: errorCategory });
                                stepsOk++;
                                stepsFailed--;
                                ctx[`_step_${step.name}_ms`] = stepMs;
                            }
                            catch (fallbackErr) {
                                errors.push(`[${step.name}] Parallel tasks failed: ${lastErr}`);
                                log.push({ step: step.name, status: "failed", ms: stepMs, error: lastErr, category: errorCategory });
                                if (step.required !== false) {
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
                            }
                        }
                        else {
                            errors.push(`[${step.name}] Parallel tasks failed: ${lastErr}`);
                            log.push({ step: step.name, status: "failed", ms: stepMs, error: lastErr, category: categorizeError(lastErr) });
                            if (step.required !== false) {
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
                        }
                    }
                }
                else {
                    // Regular step execution (P0 behavior)
                    const execResult = await executeStep(step, ctx);
                    stepMs = execResult.ms;
                    success = execResult.success;
                    lastErr = execResult.error;
                    stepResult = execResult.result;
                    if (success) {
                        stepsOk++;
                        completedStepNames.push(step.name);
                        log.push({ step: step.name, status: "ok", ms: stepMs });
                        ctx = { ...ctx, ...stepResult };
                        ctx[`_step_${step.name}_ms`] = stepMs;
                        if (checkpointPath && checkpointEvery > 0 && completedStepNames.length % checkpointEvery === 0) {
                            const checkpoint = {
                                workflow_id: workflow.id,
                                workflow_name: workflow.name,
                                step_index: stepIndex + 1,
                                context: ctx,
                                timestamp: T.now(),
                                step_names: completedStepNames,
                                steps_completed: completedStepNames.length,
                            };
                            (0, stdlib_checkpoint_1.saveCheckpoint)(checkpointPath, checkpoint);
                        }
                    }
                    else {
                        stepsFailed++;
                        let fallbackValue = undefined;
                        const errorCategory = categorizeError(lastErr);
                        if (step.on_error) {
                            try {
                                fallbackValue = step.on_error({ error: lastErr, attempts: 1, step_name: step.name });
                                ctx = { ...ctx, ...fallbackValue };
                                success = true;
                                errors.push(`[${step.name}] ${lastErr} (handled by on_error)`);
                                log.push({
                                    step: step.name,
                                    status: "error_handled",
                                    ms: stepMs,
                                    error: lastErr,
                                    category: errorCategory,
                                    attempted: 1,
                                });
                                stepsOk++;
                                stepsFailed--;
                                ctx[`_step_${step.name}_ms`] = stepMs;
                                continue;
                            }
                            catch (handlerErr) {
                                errors.push(`[${step.name}] ${lastErr} → on_error handler also failed: ${handlerErr.message}`);
                            }
                        }
                        if (step.fallback !== undefined) {
                            try {
                                fallbackValue = typeof step.fallback === 'function' ? step.fallback() : step.fallback;
                                ctx = { ...ctx, ...fallbackValue };
                                success = true;
                                errors.push(`[${step.name}] ${lastErr} (fallback used)`);
                                log.push({
                                    step: step.name,
                                    status: "fallback_used",
                                    ms: stepMs,
                                    error: lastErr,
                                    category: errorCategory,
                                    attempted: 1,
                                });
                                stepsOk++;
                                stepsFailed--;
                                ctx[`_step_${step.name}_ms`] = stepMs;
                                continue;
                            }
                            catch (fallbackErr) {
                                errors.push(`[${step.name}] ${lastErr} → fallback also failed: ${fallbackErr.message}`);
                            }
                        }
                        if (!success) {
                            errors.push(`[${step.name}] ${lastErr}`);
                            log.push({
                                step: step.name,
                                status: "failed",
                                ms: stepMs,
                                error: lastErr,
                                category: errorCategory,
                                attempted: 1,
                            });
                            if (step.required !== false) {
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
                        }
                    }
                }
            }
            const totalMs = T.now() - startMs;
            const status = stepsFailed === 0 ? "success" : "partial";
            if ((status === "success" || status === "partial") && checkpointPath) {
                (0, stdlib_checkpoint_1.deleteCheckpoint)(checkpointPath);
            }
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
        // ── P0-1: Error Handling Helpers ──────────────────────────
        // step-with-error step handler-fn -> WorkflowStep (add error handler)
        "step-with-error": (step, handler) => ({
            ...step,
            on_error: handler,
        }),
        // step-with-fallback step value-or-fn -> WorkflowStep (add fallback)
        "step-with-fallback": (step, value) => ({
            ...step,
            fallback: value,
        }),
        // step-with-timeout step ms -> WorkflowStep (add timeout)
        "step-with-timeout": (step, ms) => ({
            ...step,
            timeout_ms: ms,
        }),
        // ── P0-2: Conditional Execution Helpers ──────────────────
        // step-when step condition-fn -> WorkflowStep (add conditional)
        "step-when": (step, condition) => ({
            ...step,
            if: condition,
        }),
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
