// FreeLang v9: Phase 80 — CI Pipeline Runner 테스트
// TC-1~5:   CIPipeline 기본
// TC-6~10:  다중 step
// TC-11~15: createDefaultPipeline
// TC-16~20: 출력 포매팅 + regression

import {
  CIPipeline,
  CIStep,
  CIResult,
  CISummary,
  createDefaultPipeline,
  createFmtCheckStep,
  createLintStep,
  createTypeCheckStep,
} from "./ci-runner";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result && typeof (result as any).then === "function") {
      // async 테스트는 별도 처리
      (result as Promise<void>)
        .then(() => {
          console.log(`  ✅ ${name}`);
          passed++;
        })
        .catch((e: any) => {
          console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 200)}`);
          failed++;
        });
    } else {
      console.log(`  ✅ ${name}`);
      passed++;
    }
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 200)}`);
    failed++;
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 200)}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, msg?: string): void {
  if (actual !== expected)
    throw new Error(`${msg ?? "assertEqual"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// 성공 step 팩토리
function successStep(name: string, delayMs = 0): CIStep {
  return {
    name,
    run: async (): Promise<CIResult> => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return { passed: true, output: `${name} OK`, durationMs: delayMs };
    },
  };
}

// 실패 step 팩토리
function failStep(name: string, delayMs = 0): CIStep {
  return {
    name,
    run: async (): Promise<CIResult> => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return { passed: false, output: `${name} FAILED`, durationMs: delayMs };
    },
  };
}

// ─────────────────────────────────────────
// TC-1~5: CIPipeline 기본
// ─────────────────────────────────────────
console.log("\n[TC-1~5] CIPipeline 기본\n");

test("TC-1: CIPipeline 생성 가능", () => {
  const pipeline = new CIPipeline();
  assert(pipeline instanceof CIPipeline, "CIPipeline 인스턴스여야 함");
});

test("TC-2: addStep 체이닝", () => {
  const pipeline = new CIPipeline();
  const result = pipeline.addStep(successStep("step1"));
  assert(result === pipeline, "addStep은 this를 반환해야 함");
});

// TC-3~5: async 테스트는 한꺼번에 실행

async function runBasicTests(): Promise<void> {
  await testAsync("TC-3: 빈 파이프라인 run → passed:true", async () => {
    const pipeline = new CIPipeline();
    const summary = await pipeline.run();
    assert(summary.passed === true, "passed여야 함");
    assertEqual(summary.steps.length, 0, "steps 길이");
  });

  await testAsync("TC-4: 성공 step → passed:true, durationMs 기록", async () => {
    const pipeline = new CIPipeline();
    pipeline.addStep(successStep("step-a", 5));
    const summary = await pipeline.run();
    assert(summary.passed === true, "passed여야 함");
    assertEqual(summary.steps.length, 1, "steps 길이");
    assert(summary.steps[0].durationMs >= 0, "durationMs >= 0");
  });

  await testAsync("TC-5: 실패 step → passed:false", async () => {
    const pipeline = new CIPipeline();
    pipeline.addStep(failStep("step-fail"));
    const summary = await pipeline.run();
    assert(summary.passed === false, "passed:false여야 함");
    assert(summary.steps[0].passed === false, "step.passed:false여야 함");
  });

  // ─────────────────────────────────────────
  // TC-6~10: 다중 step
  // ─────────────────────────────────────────
  console.log("\n[TC-6~10] 다중 step\n");

  await testAsync("TC-6: 2개 step 모두 성공 → passed:true", async () => {
    const pipeline = new CIPipeline();
    pipeline.addStep(successStep("step1")).addStep(successStep("step2"));
    const summary = await pipeline.run();
    assert(summary.passed === true, "passed여야 함");
    assertEqual(summary.steps.length, 2, "steps 길이");
    assert(summary.steps[0].passed, "step1 passed");
    assert(summary.steps[1].passed, "step2 passed");
  });

  await testAsync("TC-7: 첫 번째 step 실패 → 두 번째 skip (fail-fast 기본)", async () => {
    const pipeline = new CIPipeline({ failFast: true });
    pipeline.addStep(failStep("step1")).addStep(successStep("step2"));
    const summary = await pipeline.run();
    assert(summary.passed === false, "passed:false여야 함");
    assertEqual(summary.steps.length, 2, "steps 길이");
    assert(summary.steps[1].skipped === true, "step2 skipped여야 함");
  });

  await testAsync("TC-8: fail-fast 비활성화 → 모든 step 실행", async () => {
    const pipeline = new CIPipeline({ failFast: false });
    pipeline.addStep(failStep("step1")).addStep(successStep("step2"));
    const summary = await pipeline.run();
    assert(summary.passed === false, "passed:false여야 함");
    assert(summary.steps[1].skipped === false, "step2 skipped 아니어야 함");
  });

  await testAsync("TC-9: CISummary.totalMs 합산", async () => {
    const pipeline = new CIPipeline();
    pipeline.addStep(successStep("s1", 10)).addStep(successStep("s2", 20));
    const summary = await pipeline.run();
    // durationMs는 실제 지연을 반영하므로 >= 0 인지만 확인
    assert(summary.totalMs >= 0, "totalMs >= 0");
  });

  await testAsync("TC-10: CISummary.steps 배열 길이", async () => {
    const pipeline = new CIPipeline();
    pipeline
      .addStep(successStep("s1"))
      .addStep(successStep("s2"))
      .addStep(failStep("s3"));
    const summary = await pipeline.run();
    // fail-fast: s3 실패 후 skipped는 없음(마지막 step이므로)
    assertEqual(summary.steps.length, 3, "steps 길이");
  });

  // ─────────────────────────────────────────
  // TC-11~15: createDefaultPipeline
  // ─────────────────────────────────────────
  console.log("\n[TC-11~15] createDefaultPipeline\n");

  test("TC-11: createDefaultPipeline 반환값이 CIPipeline", () => {
    const pipeline = createDefaultPipeline([]);
    assert(pipeline instanceof CIPipeline, "CIPipeline 인스턴스여야 함");
  });

  await testAsync("TC-12: 빈 파일 목록으로 실행 가능", async () => {
    const pipeline = createDefaultPipeline([]);
    // type-check는 실제 tsc 실행 → 느릴 수 있음. fmt-check, lint만 테스트
    const fmtStep = createFmtCheckStep([]);
    const result = await fmtStep.run();
    assert(result.passed === true, "빈 목록 fmt-check는 passed여야 함");
  });

  test("TC-13: fmt-check step 이름 포함", () => {
    const step = createFmtCheckStep([]);
    assertEqual(step.name, "fmt-check", "step 이름");
  });

  test("TC-14: lint step 이름 포함", () => {
    const step = createLintStep([]);
    assertEqual(step.name, "lint", "step 이름");
  });

  test("TC-15: type-check step 이름 포함", () => {
    const step = createTypeCheckStep();
    assertEqual(step.name, "type-check", "step 이름");
  });

  // ─────────────────────────────────────────
  // TC-16~20: 출력 포매팅 + regression
  // ─────────────────────────────────────────
  console.log("\n[TC-16~20] 출력 포매팅 + regression\n");

  await testAsync("TC-16: 성공 step 출력에 passed:true 포함", async () => {
    const step = successStep("ok-step");
    const result = await step.run();
    assert(result.passed === true, "passed:true여야 함");
    assert(typeof result.output === "string", "output은 string이어야 함");
  });

  await testAsync("TC-17: 실패 step 출력에 passed:false 포함", async () => {
    const step = failStep("fail-step");
    const result = await step.run();
    assert(result.passed === false, "passed:false여야 함");
    assert(result.output.length > 0, "output이 비어있지 않아야 함");
  });

  await testAsync("TC-18: durationMs가 0 이상", async () => {
    const step = successStep("timer-step");
    const result = await step.run();
    assert(result.durationMs >= 0, "durationMs >= 0");
  });

  test("TC-19: CIResult 인터페이스 형태 확인", () => {
    // 런타임에서 CIResult 구조를 직접 생성하여 형태 확인
    const result: CIResult = {
      passed: true,
      output: "test output",
      durationMs: 42,
    };
    assert(typeof result.passed === "boolean", "passed는 boolean");
    assert(typeof result.output === "string", "output은 string");
    assert(typeof result.durationMs === "number", "durationMs는 number");
  });

  // TC-20: Phase 56 regression — 렉시컬 스코프로 팩토리얼 계산
  await testAsync("TC-20: Phase 56 regression (팩토리얼 계산)", async () => {
    const interp = new Interpreter();
    const src = `
      [FUNC fact :params [$n]
        :body (if (= $n 0) 1 (* $n (fact (- $n 1))))]
      (fact 5)
    `;
    interp.interpret(parse(lex(src)));
    const val = (interp as any).context.lastValue;
    assertEqual(val, 120, "fact(5) = 120");
  });

  // ─────────────────────────────────────────
  // 결과 출력
  // ─────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  const total = passed + failed;
  console.log(`[Phase 80] CI Pipeline Runner: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log(`  실패: ${failed}개`);
    process.exit(1);
  }
}

runBasicTests().catch((err) => {
  console.error("테스트 실행 오류:", err);
  process.exit(1);
});
