// FreeLang v9: Phase 80 — CI Pipeline Runner
// fmt-check + lint + type-check + test를 한 번에 실행하는 CI 파이프라인

import * as fs from "fs";
import { formatFL } from "./formatter";
import { createDefaultLinter } from "./linter";

// ──────────────────────────────────────────────
// Core Interfaces
// ──────────────────────────────────────────────

export interface CIStep {
  name: string;
  run: () => Promise<CIResult>;
}

export interface CIResult {
  passed: boolean;
  output: string;
  durationMs: number;
}

export interface CIStepResult {
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
  skipped: boolean;
}

export interface CISummary {
  passed: boolean;
  steps: CIStepResult[];
  totalMs: number;
}

// ──────────────────────────────────────────────
// CIPipeline 클래스
// ──────────────────────────────────────────────

export class CIPipeline {
  private steps: CIStep[] = [];
  private failFast: boolean = true;

  constructor(opts: { failFast?: boolean } = {}) {
    if (opts.failFast !== undefined) {
      this.failFast = opts.failFast;
    }
  }

  setFailFast(value: boolean): this {
    this.failFast = value;
    return this;
  }

  addStep(step: CIStep): this {
    this.steps.push(step);
    return this;
  }

  async run(): Promise<CISummary> {
    const results: CIStepResult[] = [];
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

      let result: CIResult;
      try {
        result = await step.run();
      } catch (err: any) {
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

// ──────────────────────────────────────────────
// 헬퍼: 시간 측정 래퍼
// ──────────────────────────────────────────────

async function timed(fn: () => Promise<{ passed: boolean; output: string }>): Promise<CIResult> {
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
export function createFmtCheckStep(files: string[]): CIStep {
  return {
    name: "fmt-check",
    run: () =>
      timed(async () => {
        if (files.length === 0) {
          return { passed: true, output: "검사할 파일 없음" };
        }

        const needsFormat: string[] = [];

        for (const f of files) {
          if (!fs.existsSync(f)) continue;
          const src = fs.readFileSync(f, "utf-8");
          try {
            const formatted = formatFL(src);
            if (src !== formatted) {
              needsFormat.push(f);
            }
          } catch (err: any) {
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
export function createLintStep(files: string[]): CIStep {
  return {
    name: "lint",
    run: () =>
      timed(async () => {
        if (files.length === 0) {
          return { passed: true, output: "검사할 파일 없음" };
        }

        const linter = createDefaultLinter();
        const errors: string[] = [];

        for (const f of files) {
          if (!fs.existsSync(f)) continue;
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
export function createTypeCheckStep(): CIStep {
  return {
    name: "type-check",
    run: () =>
      timed(async () => {
        const { execSync } = require("child_process");
        try {
          const cwd = process.cwd();
          execSync("npx tsc --noEmit", { cwd, stdio: "pipe" });
          return { passed: true, output: "TypeScript 타입 체크 OK" };
        } catch (err: any) {
          const output = err.stdout?.toString() ?? err.stderr?.toString() ?? String(err);
          return { passed: false, output: output.trim() };
        }
      }),
  };
}

/**
 * test step: ts-node로 테스트 파일 실행
 */
export function createTestStep(testFile: string): CIStep {
  return {
    name: `test:${testFile.split("/").pop() ?? testFile}`,
    run: () =>
      timed(async () => {
        const { execSync } = require("child_process");
        try {
          const cwd = process.cwd();
          const out = execSync(`npx ts-node ${testFile}`, { cwd, stdio: "pipe" });
          return { passed: true, output: out.toString().trim() };
        } catch (err: any) {
          const output =
            (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "") || String(err);
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
export function createDefaultPipeline(files: string[], opts: { failFast?: boolean } = {}): CIPipeline {
  const pipeline = new CIPipeline(opts);

  pipeline.addStep(createFmtCheckStep(files));
  pipeline.addStep(createLintStep(files));
  pipeline.addStep(createTypeCheckStep());

  return pipeline;
}
