"use strict";
// FreeLang v9: Phase 80 — CI Pipeline Runner
// fmt-check + lint + type-check + test를 한 번에 실행하는 CI 파이프라인
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
exports.CIPipeline = void 0;
exports.createFmtCheckStep = createFmtCheckStep;
exports.createLintStep = createLintStep;
exports.createTypeCheckStep = createTypeCheckStep;
exports.createTestStep = createTestStep;
exports.createDefaultPipeline = createDefaultPipeline;
const fs = __importStar(require("fs"));
const formatter_1 = require("./formatter");
const linter_1 = require("./linter");
// ──────────────────────────────────────────────
// CIPipeline 클래스
// ──────────────────────────────────────────────
class CIPipeline {
    constructor(opts = {}) {
        this.steps = [];
        this.failFast = true;
        if (opts.failFast !== undefined) {
            this.failFast = opts.failFast;
        }
    }
    setFailFast(value) {
        this.failFast = value;
        return this;
    }
    addStep(step) {
        this.steps.push(step);
        return this;
    }
    async run() {
        const results = [];
        let pipelinePassed = true;
        let totalMs = 0;
        let shouldSkip = false;
        for (const step of this.steps) {
            if (shouldSkip) {
                results.push({
                    name: step.name,
                    passed: false,
                    output: "(skipped)",
                    durationMs: 0,
                    skipped: true,
                });
                continue;
            }
            let result;
            try {
                result = await step.run();
            }
            catch (err) {
                result = {
                    passed: false,
                    output: `Exception: ${err.message ?? String(err)}`,
                    durationMs: 0,
                };
            }
            const icon = result.passed ? "✅" : "❌";
            console.log(`${icon} ${step.name} (${result.durationMs}ms)`);
            if (!result.passed && result.output && result.output !== "(skipped)") {
                // 실패 출력 들여쓰기
                const indented = result.output.split("\n").map((l) => "    " + l).join("\n");
                console.log(indented);
            }
            results.push({
                name: step.name,
                passed: result.passed,
                output: result.output,
                durationMs: result.durationMs,
                skipped: false,
            });
            totalMs += result.durationMs;
            if (!result.passed) {
                pipelinePassed = false;
                if (this.failFast) {
                    shouldSkip = true;
                }
            }
        }
        return {
            passed: pipelinePassed,
            steps: results,
            totalMs,
        };
    }
}
exports.CIPipeline = CIPipeline;
// ──────────────────────────────────────────────
// 헬퍼: 시간 측정 래퍼
// ──────────────────────────────────────────────
async function timed(fn) {
    const start = Date.now();
    const { passed, output } = await fn();
    const durationMs = Date.now() - start;
    return { passed, output, durationMs };
}
// ──────────────────────────────────────────────
// 내장 step 팩토리
// ──────────────────────────────────────────────
/**
 * fmt-check step: 파일들이 이미 포맷됐는지 확인
 */
function createFmtCheckStep(files) {
    return {
        name: "fmt-check",
        run: () => timed(async () => {
            if (files.length === 0) {
                return { passed: true, output: "검사할 파일 없음" };
            }
            const needsFormat = [];
            for (const f of files) {
                if (!fs.existsSync(f))
                    continue;
                const src = fs.readFileSync(f, "utf-8");
                try {
                    const formatted = (0, formatter_1.formatFL)(src);
                    if (src !== formatted) {
                        needsFormat.push(f);
                    }
                }
                catch (err) {
                    return {
                        passed: false,
                        output: `포맷 오류 ${f}: ${err.message}`,
                    };
                }
            }
            if (needsFormat.length > 0) {
                return {
                    passed: false,
                    output: `포맷 필요 파일:\n${needsFormat.map((f) => `  - ${f}`).join("\n")}`,
                };
            }
            return { passed: true, output: `${files.length}개 파일 포맷 OK` };
        }),
    };
}
/**
 * lint step: linter 실행, error 있으면 실패
 */
function createLintStep(files) {
    return {
        name: "lint",
        run: () => timed(async () => {
            if (files.length === 0) {
                return { passed: true, output: "검사할 파일 없음" };
            }
            const linter = (0, linter_1.createDefaultLinter)();
            const errors = [];
            for (const f of files) {
                if (!fs.existsSync(f))
                    continue;
                const src = fs.readFileSync(f, "utf-8");
                const diags = linter.lint(src);
                const errs = diags.filter((d) => d.severity === "error");
                for (const e of errs) {
                    errors.push(`  ${f}:${e.line ?? "?"}:${e.col ?? "?"} [${e.rule}] ${e.message}`);
                }
            }
            if (errors.length > 0) {
                return {
                    passed: false,
                    output: `Lint 오류 ${errors.length}개:\n${errors.join("\n")}`,
                };
            }
            return { passed: true, output: `${files.length}개 파일 lint OK` };
        }),
    };
}
/**
 * type-check step: npx tsc --noEmit
 */
function createTypeCheckStep() {
    return {
        name: "type-check",
        run: () => timed(async () => {
            const { execSync } = require("child_process");
            try {
                const cwd = process.cwd();
                execSync("npx tsc --noEmit", { cwd, stdio: "pipe" });
                return { passed: true, output: "TypeScript 타입 체크 OK" };
            }
            catch (err) {
                const output = err.stdout?.toString() ?? err.stderr?.toString() ?? String(err);
                return { passed: false, output: output.trim() };
            }
        }),
    };
}
/**
 * test step: ts-node로 테스트 파일 실행
 */
function createTestStep(testFile) {
    return {
        name: `test:${testFile.split("/").pop() ?? testFile}`,
        run: () => timed(async () => {
            const { execSync } = require("child_process");
            try {
                const cwd = process.cwd();
                const out = execSync(`npx ts-node ${testFile}`, { cwd, stdio: "pipe" });
                return { passed: true, output: out.toString().trim() };
            }
            catch (err) {
                const output = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "") || String(err);
                return { passed: false, output: output.trim() };
            }
        }),
    };
}
// ──────────────────────────────────────────────
// createDefaultPipeline
// ──────────────────────────────────────────────
/**
 * 기본 CI 파이프라인 생성:
 * 1. fmt-check
 * 2. lint
 * 3. type-check
 */
function createDefaultPipeline(files, opts = {}) {
    const pipeline = new CIPipeline(opts);
    pipeline.addStep(createFmtCheckStep(files));
    pipeline.addStep(createLintStep(files));
    pipeline.addStep(createTypeCheckStep());
    return pipeline;
}
//# sourceMappingURL=ci-runner.js.map