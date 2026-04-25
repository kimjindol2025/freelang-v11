#!/usr/bin/env node
// scripts/ai-eval.js — AI 모델 자동 평가 도구 (FL-Bench 통합)
//
// 워크플로우:
//   1) FL-Bench task 로드
//   2) Provider(Mock/Claude CLI/API)로 AI에 prompt 전송
//   3) 응답에서 .fl 코드 추출 (markdown code block)
//   4) ai-self-verify로 자동 normalize + 실행
//   5) validation 비교 → PASS/FAIL
//   6) 모델별 결과 저장 + 점수표 출력
//
// 사용:
//   node scripts/ai-eval.js --provider=mock                            # mock 모드 (인프라 검증)
//   node scripts/ai-eval.js --provider=claude-cli --label=opus-4.7     # 실제 Claude CLI
//   node scripts/ai-eval.js --provider=mock --task=T01                 # 단일 task
//   node scripts/ai-eval.js --provider=claude-cli --solutions-out=./ai-solutions/  # 코드도 저장
//
// Provider:
//   - mock: deterministic 가짜 응답 (인프라 검증, API key 불필요)
//   - claude-cli: `claude --bare -p` subprocess 호출 (Claude Code 환경)
//   - api: ANTHROPIC_API_KEY 사용 (미구현, 추후)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const TASKS_DIR = path.join(REPO, "benchmarks/fl-bench/tasks");
const RESULTS_DIR = path.join(REPO, "benchmarks/fl-bench/results");
const SELF_VERIFY = path.join(REPO, "scripts/ai-self-verify.js");
const SYSTEM_PROMPT_PATH = path.join(REPO, "docs/AI_SYSTEM_PROMPT_MINI.md");

const args = process.argv.slice(2);
const PROVIDER = args.find((a) => a.startsWith("--provider="))?.split("=")[1] ?? "mock";
const TASK_FILTER = args.find((a) => a.startsWith("--task="))?.split("=")[1] ?? null;
const LABEL = args.find((a) => a.startsWith("--label="))?.split("=")[1] ?? PROVIDER;
const SOLUTIONS_OUT = args.find((a) => a.startsWith("--solutions-out="))?.split("=")[1] ?? null;
const VERBOSE = args.includes("--verbose");

// ─────────────────────────────────────────────────────────────
// Task 로드
// ─────────────────────────────────────────────────────────────

function loadTasks() {
  const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith(".json")).sort();
  const tasks = files.map(f => JSON.parse(fs.readFileSync(path.join(TASKS_DIR, f), "utf-8")));
  return TASK_FILTER ? tasks.filter(t => t.id.includes(TASK_FILTER)) : tasks;
}

function loadSystemPrompt() {
  if (!fs.existsSync(SYSTEM_PROMPT_PATH)) return "";
  return fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
}

// ─────────────────────────────────────────────────────────────
// Provider — AI 응답을 받는 추상화
// ─────────────────────────────────────────────────────────────

const providers = {
  // Mock: deterministic 응답 (reference_solution 그대로 반환)
  // → 인프라 정상 동작 확인용. 100% PASS 기대.
  mock: {
    name: "mock",
    async ask(systemPrompt, userPrompt, task) {
      // task의 reference_solution을 markdown code block으로 wrapping
      return "```fl\n" + task.reference_solution + "\n```";
    },
  },

  // Claude CLI: Claude Code 환경에서 `claude -p` subprocess 호출
  // --bare는 ANTHROPIC_API_KEY strict 요구 → 제거 (현재 OAuth 세션 사용)
  "claude-cli": {
    name: "claude-cli",
    async ask(systemPrompt, userPrompt, task) {
      // -p (--print): non-interactive, 응답만
      // --append-system-prompt로 FreeLang 시스템 프롬프트 주입
      // --no-session-persistence: 세션 저장 안 함 (병렬 평가 시 오염 방지)
      // --max-budget-usd 1.0: 안전망 (실수로 50개 다 돌릴 때)
      // --model 옵션 지원 (sonnet, haiku, opus, 또는 full model name)
      const modelArg = process.argv.find((a) => a.startsWith("--model="))?.split("=")[1];
      const args = [
        "-p",
        "--no-session-persistence",
        "--append-system-prompt", systemPrompt,
      ];
      if (modelArg) args.push("--model", modelArg);
      args.push("--", userPrompt);
      const r = spawnSync("claude", args, {
        encoding: "utf-8",
        timeout: 90000,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (r.status !== 0) {
        throw new Error(`claude CLI exit ${r.status}: ${(r.stderr || "").slice(0, 300)}`);
      }
      return r.stdout || "";
    },
  },
};

function getProvider(name) {
  if (!providers[name]) {
    console.error(`알 수 없는 provider: ${name}. 사용 가능: ${Object.keys(providers).join(", ")}`);
    process.exit(2);
  }
  return providers[name];
}

// ─────────────────────────────────────────────────────────────
// AI 응답에서 .fl 코드 추출
// ─────────────────────────────────────────────────────────────

function extractFLCode(response) {
  if (!response) return null;
  // 1) ```fl ... ``` 블록 (가장 명확) — 모든 매칭 수집해서 가장 큰 것 선택
  const flBlocks = [...response.matchAll(/```(?:fl|freelang|lisp|clojure|scheme)?\s*\n?([\s\S]*?)```/gi)];
  if (flBlocks.length > 0) {
    // 가장 긴 코드 블록 선택 (educational 응답에서 마지막 정답이 보통 가장 자세함)
    const best = flBlocks.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    return best[1].trim();
  }
  // 2) ``` ... ``` (언어 미지정, 같은 전략)
  const anyBlocks = [...response.matchAll(/```\s*\n?([\s\S]*?)```/g)];
  if (anyBlocks.length > 0) {
    const best = anyBlocks.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    return best[1].trim();
  }
  // 3) 코드 블록 없으면 (...)로 시작하는 줄들 모음 — heuristic
  const lines = response.split("\n").filter(l => l.trim().startsWith("(") || l.trim().startsWith("[FUNC"));
  if (lines.length > 0) return lines.join("\n");
  return null;
}

// ─────────────────────────────────────────────────────────────
// 코드 실행 + 검증 (ai-self-verify 재사용)
// ─────────────────────────────────────────────────────────────

function runWithVerify(src) {
  const r = spawnSync("node", [SELF_VERIFY, "--stdin", "--json"], {
    input: src,
    encoding: "utf-8",
    timeout: 60000,
    maxBuffer: 5 * 1024 * 1024,
  });
  try { return JSON.parse(r.stdout || "{}"); }
  catch { return { status: "error", parseError: true, raw: r.stdout?.slice(0, 500) }; }
}

function validate(stdout, validation) {
  const out = (stdout || "").trim();
  switch (validation?.type) {
    case "stdout_match": return out === validation.expected.trim();
    case "stdout_contains": return out.includes(validation.expected);
    case "stdout_regex": return new RegExp(validation.expected, "s").test(out);
    default: return false;
  }
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

async function main() {
  const tasks = loadTasks();
  if (tasks.length === 0) { console.error("❌ task 없음"); process.exit(2); }

  const systemPrompt = loadSystemPrompt();
  if (!systemPrompt) console.warn("⚠️  AI_SYSTEM_PROMPT_MINI.md 없음 — empty system prompt");

  const provider = getProvider(PROVIDER);

  console.log(`\n🤖 AI 평가 시작`);
  console.log(`   provider: ${provider.name}`);
  console.log(`   label:    ${LABEL}`);
  console.log(`   tasks:    ${tasks.length}개`);
  console.log(`   sys prompt: ${systemPrompt.length} chars\n`);

  if (SOLUTIONS_OUT) fs.mkdirSync(SOLUTIONS_OUT, { recursive: true });

  const results = [];
  const t0 = Date.now();

  for (let idx = 0; idx < tasks.length; idx++) {
    const task = tasks[idx];
    const tStart = Date.now();
    let response = null, code = null, verifyResult = null, pass = false, error = null;

    try {
      response = await provider.ask(systemPrompt, task.prompt, task);
      code = extractFLCode(response);
      if (!code) {
        error = "응답에서 .fl 코드 추출 실패";
      } else {
        if (SOLUTIONS_OUT) {
          fs.writeFileSync(path.join(SOLUTIONS_OUT, task.id + ".fl"), code, "utf-8");
        }
        verifyResult = runWithVerify(code);
        if (verifyResult.status === "success") {
          pass = validate(verifyResult.stdout, task.validation);
        } else {
          error = "실행 실패: " + (verifyResult.errorContext?.code ?? "unknown");
        }
      }
    } catch (e) {
      error = e.message?.slice(0, 200);
    }

    const elapsed = Date.now() - tStart;
    const icon = pass ? "✅" : "❌";
    const label = `[${idx + 1}/${tasks.length}]`;
    console.log(`  ${icon} ${label} ${task.id} (${task.difficulty}) — ${pass ? "PASS" : "FAIL"} ${elapsed}ms`);
    if (!pass && VERBOSE) {
      if (error) console.log(`     err: ${error}`);
      else if (verifyResult?.stdout) console.log(`     stdout: ${verifyResult.stdout.slice(0, 100)}`);
    }

    results.push({
      id: task.id,
      category: task.category,
      difficulty: task.difficulty,
      pass,
      error,
      elapsed_ms: elapsed,
      stdout: verifyResult?.stdout?.slice(-200),
      response_length: response?.length ?? 0,
    });
  }

  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  const score = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";
  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // 카테고리/난이도별 분석
  const byCategory = {};
  const byDifficulty = {};
  for (const r of results) {
    byCategory[r.category] = byCategory[r.category] || { pass: 0, total: 0 };
    byCategory[r.category].total++;
    if (r.pass) byCategory[r.category].pass++;
    byDifficulty[r.difficulty] = byDifficulty[r.difficulty] || { pass: 0, total: 0 };
    byDifficulty[r.difficulty].total++;
    if (r.pass) byDifficulty[r.difficulty].pass++;
  }

  console.log(`\n📊 결과: ${passed}/${total} PASS (${score}%) — ${totalElapsed}s`);
  console.log(`\n  카테고리별:`);
  for (const [cat, s] of Object.entries(byCategory).sort()) {
    console.log(`    ${cat.padEnd(20)} ${s.pass}/${s.total} (${(s.pass/s.total*100).toFixed(0)}%)`);
  }
  console.log(`\n  난이도별:`);
  for (const [d, s] of Object.entries(byDifficulty).sort()) {
    console.log(`    ${d.padEnd(8)} ${s.pass}/${s.total} (${(s.pass/s.total*100).toFixed(0)}%)`);
  }

  // 결과 저장
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(RESULTS_DIR, `ai-eval-${LABEL}-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    label: LABEL,
    provider: provider.name,
    timestamp: new Date().toISOString(),
    elapsed_seconds: parseFloat(totalElapsed),
    total, passed, score: parseFloat(score),
    by_category: byCategory,
    by_difficulty: byDifficulty,
    results,
  }, null, 2), "utf-8");
  console.log(`\n   결과: ${path.relative(REPO, outPath)}`);
  if (SOLUTIONS_OUT) console.log(`   solutions: ${path.relative(REPO, SOLUTIONS_OUT)}/`);
}

main().catch(e => { console.error("❌ fatal:", e.message); process.exit(1); });
