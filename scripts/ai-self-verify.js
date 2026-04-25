#!/usr/bin/env node
// scripts/ai-self-verify.js — AI 자가 검증 루프
//
// 워크플로우:
//   1) FL 코드 받음 (file or stdin)
//   2) ai-validate.js 진단 + 자동 수정 (loop iteration N회)
//   3) bootstrap.js 실행 시도
//   4) 성공: 수정된 코드 + 적용된 fix 목록 출력
//   5) 실패: AI에게 다시 줄 수 있는 구조화 컨텍스트 출력 (ErrorCode + 힌트 + 호출 체인)
//
// 사용:
//   node scripts/ai-self-verify.js my.fl
//   echo "..." | node scripts/ai-self-verify.js --stdin
//   node scripts/ai-self-verify.js my.fl --max-iter=3 --strict
//   node scripts/ai-self-verify.js my.fl --json   # 머신 판독 가능 결과
//
// 활용 시나리오:
//   AI 에이전트 파이프라인에서:
//     a. AI가 .fl 생성
//     b. self-verify로 자동 정리 + 실행
//     c. 결과를 다시 AI에 피드백 (성공/실패 + 컨텍스트)
//   → AI 코드 신뢰도 폭증

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const VALIDATE = path.join(__dirname, "ai-validate.js");
const BOOTSTRAP = path.join(REPO, "bootstrap.js");

const args = process.argv.slice(2);
const STDIN = args.includes("--stdin");
const STRICT = args.includes("--strict");
const JSON_OUT = args.includes("--json");
const MAX_ITER = Number(args.find((a) => a.startsWith("--max-iter="))?.split("=")[1] ?? "3");
const inputFile = args.find((a) => !a.startsWith("--"));

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────

function readSource() {
  if (STDIN) return fs.readFileSync(0, "utf-8");
  if (!inputFile) {
    console.error("사용: ai-self-verify.js <file.fl> [--max-iter=N] [--strict] [--json]");
    process.exit(2);
  }
  if (!fs.existsSync(inputFile)) {
    console.error(`파일 없음: ${inputFile}`);
    process.exit(2);
  }
  return fs.readFileSync(inputFile, "utf-8");
}

function runValidateFix(src) {
  // ai-validate.js --fix --stdin → stdout (수정된 코드)
  const r = spawnSync("node", [VALIDATE, "--stdin", "--fix", "--quiet"], {
    input: src,
    encoding: "utf-8",
    timeout: 30000,
  });
  return { fixed: r.stdout || src, exitCode: r.status };
}

function runBootstrap(src, useStrict = false) {
  const tmpPath = path.join(REPO, ".tmp-self-verify-" + process.pid + ".fl");
  fs.writeFileSync(tmpPath, src, "utf-8");
  try {
    const env = { ...process.env };
    if (useStrict) env.FL_STRICT = "1";
    // bootstrap.js run X.fl — 한 번에 컴파일+실행
    const out = execSync(
      `node --stack-size=8000 ${BOOTSTRAP} run ${tmpPath}`,
      { encoding: "utf-8", timeout: 30000, env, stdio: ["pipe", "pipe", "pipe"] }
    );
    return { ok: true, stdout: out };
  } catch (e) {
    return {
      ok: false,
      errMsg: ((e.stdout || "") + "\n" + (e.stderr || "") + "\n" + (e.message || "")).toString(),
    };
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

function extractContext(errMsg) {
  const ctx = {};
  // ErrorCode (Phase A) — [E_xxx] prefix 또는 일반 패턴
  const codeMatch = errMsg.match(/\[(E_[A-Z_]+)\]/) || errMsg.match(/\b(E_[A-Z_]+)\b/);
  if (codeMatch) ctx.code = codeMatch[1];
  // 라인
  const lineMatch = errMsg.match(/line (\d+)/);
  if (lineMatch) ctx.line = Number(lineMatch[1]);
  // 함수명 (FunctionNotFound 패턴) — 코드가 없으면 자동으로 E_FN_NOT_FOUND 부여
  const fnMatch = errMsg.match(/Function not found:\s*(\S+)/);
  if (fnMatch) {
    ctx.missingFn = fnMatch[1];
    if (!ctx.code) ctx.code = "E_FN_NOT_FOUND";
  }
  // 한국어 힌트
  const hintMatch = errMsg.match(/혹시 '([^']+)'/);
  if (hintMatch) ctx.suggestion = hintMatch[1];
  // 호출 체인 (Phase E)
  const chainMatch = errMsg.match(/최근 호출 체인:\s*([\s\S]+?)(\n\n|$)/);
  if (chainMatch) ctx.callChain = chainMatch[1].trim().split("\n").slice(0, 5);
  return ctx;
}

// ─────────────────────────────────────────────────────────────
// 메인 루프
// ─────────────────────────────────────────────────────────────

function main() {
  let src = readSource();
  const original = src;
  const history = [];

  for (let iter = 1; iter <= MAX_ITER; iter++) {
    // Step 1: validate + fix
    const { fixed } = runValidateFix(src);
    const fixApplied = fixed !== src;
    src = fixed;

    // Step 2: bootstrap 실행
    const result = runBootstrap(src, STRICT);

    history.push({
      iter,
      fixApplied,
      runOk: result.ok,
      errSnippet: result.ok ? null : (result.errMsg || "").slice(0, 200),
    });

    if (result.ok) {
      const out = {
        status: "success",
        iterations: iter,
        fixed: fixed !== original,
        history,
        finalCode: src,
        stdout: (result.stdout || "").slice(-500),
      };
      if (JSON_OUT) {
        process.stdout.write(JSON.stringify(out, null, 2));
      } else {
        console.log(`✅ 성공 (iter ${iter})`);
        if (fixed !== original) console.log(`   자동 수정 적용됨`);
        console.log(`   stdout (마지막 500자):\n${out.stdout}`);
      }
      return;
    }

    // 에러 있으면 다음 iteration 시도 (auto fix가 더 적용될 수 있음)
    if (!fixApplied) {
      // 더 이상 fix할 게 없음 → 종료
      break;
    }
  }

  // 모든 iteration 실패 → AI 피드백용 구조화 보고
  const lastErr = history[history.length - 1]?.errSnippet ?? "";
  const ctx = extractContext(lastErr);

  const out = {
    status: "failure",
    iterations: history.length,
    history,
    errorContext: ctx,
    feedback: {
      // AI 다시 호출 시 시스템 프롬프트에 추가할 내용
      hint: ctx.code
        ? `에러 코드: ${ctx.code}. ` +
          (ctx.missingFn ? `미정의 함수: ${ctx.missingFn}. ` : "") +
          (ctx.suggestion ? `대안: ${ctx.suggestion}. ` : "") +
          `(use NAME) import 누락 또는 typo 확인.`
        : "에러 컨텍스트 추출 실패. 원본 메시지 확인 필요.",
      lastError: lastErr,
    },
    finalCode: src,
  };

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(out, null, 2));
  } else {
    console.log(`❌ 실패 (iter ${history.length}/${MAX_ITER})`);
    console.log(`   에러 코드: ${ctx.code ?? "없음"}`);
    if (ctx.missingFn) console.log(`   미정의 함수: ${ctx.missingFn}`);
    if (ctx.suggestion) console.log(`   대안 제안: ${ctx.suggestion}`);
    if (ctx.callChain) {
      console.log(`   호출 체인:`);
      for (const c of ctx.callChain) console.log(`     ${c}`);
    }
    console.log(`\n💡 AI 재요청 힌트:\n   ${out.feedback.hint}`);
  }
  process.exit(1);
}

main();
