#!/usr/bin/env node
// benchmarks/fl-bench/run.js — FL-Bench 평가 실행기
//
// 워크플로우:
//   1) tasks/*.json 로드
//   2) 각 task에 대해 코드 입력 받음:
//      a) --reference 모드: tasks/*.json의 reference_solution 사용 (sanity check)
//      b) --solution-file PATH: 외부 파일에서 읽음
//      c) --solution-dir PATH: PATH/{task-id}.fl 파일 자동 매칭
//      d) --manual: 사용자가 stdin에 직접 입력 (대화식)
//   3) ai-self-verify로 실행 + 결과 추출
//   4) validation 규칙으로 점수
//   5) results/{timestamp}.json 저장 + 콘솔 표 출력
//
// 사용:
//   node benchmarks/fl-bench/run.js --reference                  # 참조 답안 검증 (인프라 sanity)
//   node benchmarks/fl-bench/run.js --reference --task=T01_*     # 단일 task
//   node benchmarks/fl-bench/run.js --solution-dir=./my-ai-output
//   node benchmarks/fl-bench/run.js --reference --label=opus47
//
// AI 통합 시나리오:
//   1. AI에게 docs/AI_SYSTEM_PROMPT_MINI.md + 각 task prompt 보냄
//   2. 받은 .fl 코드를 ./my-ai-output/{task-id}.fl로 저장
//   3. node run.js --solution-dir=./my-ai-output --label=ai-name

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const TASKS_DIR = path.join(__dirname, "tasks");
const RESULTS_DIR = path.join(__dirname, "results");
const SELF_VERIFY = path.join(REPO, "scripts/ai-self-verify.js");

const args = process.argv.slice(2);
const REFERENCE = args.includes("--reference");
const MANUAL = args.includes("--manual");
const TASK_FILTER = args.find((a) => a.startsWith("--task="))?.split("=")[1] ?? null;
const SOLUTION_DIR = args.find((a) => a.startsWith("--solution-dir="))?.split("=")[1] ?? null;
const SOLUTION_FILE = args.find((a) => a.startsWith("--solution-file="))?.split("=")[1] ?? null;
const LABEL = args.find((a) => a.startsWith("--label="))?.split("=")[1] ?? "unlabeled";

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────

function loadTasks() {
  const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith(".json")).sort();
  const tasks = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(TASKS_DIR, f), "utf-8"));
    return data;
  });
  if (TASK_FILTER) {
    return tasks.filter(t => t.id.includes(TASK_FILTER) || t.id === TASK_FILTER);
  }
  return tasks;
}

function getSolutionForTask(task) {
  if (REFERENCE) return task.reference_solution;
  if (SOLUTION_FILE) return fs.readFileSync(SOLUTION_FILE, "utf-8");
  if (SOLUTION_DIR) {
    const fp = path.join(SOLUTION_DIR, task.id + ".fl");
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, "utf-8");
  }
  if (MANUAL) {
    console.error(`\n📋 ${task.id} (${task.difficulty})`);
    console.error(`Prompt: ${task.prompt}`);
    console.error(`코드 입력 후 Ctrl+D로 종료:`);
    return fs.readFileSync(0, "utf-8");
  }
  return null;
}

function runSolution(src) {
  const r = spawnSync("node", [SELF_VERIFY, "--stdin", "--json"], {
    input: src,
    encoding: "utf-8",
    timeout: 60000,
  });
  try {
    return JSON.parse(r.stdout || "{}");
  } catch {
    return { status: "error", parseError: true, raw: r.stdout };
  }
}

function validate(stdout, validation) {
  if (!validation) return { pass: false, reason: "no validation rule" };
  const out = (stdout || "").trim();
  switch (validation.type) {
    case "stdout_match":
      return { pass: out === validation.expected.trim(), reason: out };
    case "stdout_contains":
      return { pass: out.includes(validation.expected), reason: out };
    case "stdout_regex":
      return { pass: new RegExp(validation.expected, "s").test(out), reason: out };
    default:
      return { pass: false, reason: `unknown validation type: ${validation.type}` };
  }
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

function main() {
  const tasks = loadTasks();
  if (tasks.length === 0) {
    console.error(`❌ tasks/ 에 task 없음 (또는 --task 필터 매칭 실패)`);
    process.exit(2);
  }

  console.log(`\n🎯 FL-Bench 평가 시작`);
  console.log(`   라벨: ${LABEL}`);
  console.log(`   tasks: ${tasks.length}개\n`);

  const results = [];
  for (const task of tasks) {
    const src = getSolutionForTask(task);
    if (!src) {
      console.log(`  ⏭  ${task.id}: solution 없음 (skip)`);
      results.push({ id: task.id, status: "skip", reason: "no solution" });
      continue;
    }

    const verifyResult = runSolution(src);
    if (verifyResult.status !== "success") {
      console.log(`  ❌ ${task.id}: 실행 실패 — ${verifyResult.errorContext?.code ?? "compile/runtime error"}`);
      results.push({
        id: task.id,
        status: "fail",
        reason: "execution failed",
        errorCode: verifyResult.errorContext?.code,
      });
      continue;
    }

    const v = validate(verifyResult.stdout, task.validation);
    const icon = v.pass ? "✅" : "❌";
    console.log(`  ${icon} ${task.id} (${task.difficulty}) — ${v.pass ? "PASS" : "FAIL"}`);
    if (!v.pass) console.log(`     stdout: ${v.reason.slice(0, 80)}`);
    results.push({
      id: task.id,
      status: v.pass ? "pass" : "fail",
      difficulty: task.difficulty,
      category: task.category,
      stdout: verifyResult.stdout?.slice(-200),
    });
  }

  // 통계
  const total = results.length;
  const pass = results.filter(r => r.status === "pass").length;
  const fail = results.filter(r => r.status === "fail").length;
  const skip = results.filter(r => r.status === "skip").length;
  const score = total > 0 ? ((pass / total) * 100).toFixed(1) : "0.0";

  console.log(`\n📊 결과: ${pass}/${total} PASS (${score}%) — fail=${fail} skip=${skip}`);

  // 결과 저장
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(RESULTS_DIR, `${LABEL}-${ts}.json`);
  const summary = {
    label: LABEL,
    timestamp: new Date().toISOString(),
    total, pass, fail, skip,
    score: parseFloat(score),
    results,
  };
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf-8");
  console.log(`   결과 저장: ${path.relative(REPO, outPath)}`);
}

main();
