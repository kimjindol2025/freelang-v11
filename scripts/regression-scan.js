#!/usr/bin/env node
// FreeLang 전수 회귀 컴파일 스캐너
// 사용법: node scripts/regression-scan.js [--dir /root/kim] [--json] [--fail-only]

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const ROOT = args.includes("--dir")
  ? args[args.indexOf("--dir") + 1]
  : "/root/kim";
const JSON_OUT = args.includes("--json");
const FAIL_ONLY = args.includes("--fail-only");
const BOOTSTRAP = path.join(__dirname, "../bootstrap.js");
const TMP_OUT = "/tmp/__regression_out.js";

// .fl 파일 전체 수집
function collectFl(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // node_modules / .git 제외
      if (e.name === "node_modules" || e.name === ".git") continue;
      collectFl(full, results);
    } else if (e.name.endsWith(".fl")) {
      results.push(full);
    }
  }
  return results;
}

// 컴파일 시도 → {ok, ms, error}
function tryCompile(filePath) {
  const t0 = Date.now();
  const r = spawnSync(
    "node",
    [BOOTSTRAP, "compile", filePath, "-o", TMP_OUT],
    { timeout: 10000, encoding: "utf8" }
  );
  const ms = Date.now() - t0;
  if (r.status === 0) return { ok: true, ms };
  const err = (r.stderr || r.stdout || "").trim().split("\n")[0];
  return { ok: false, ms, error: err };
}

// 진행률 표시
function bar(done, total, width = 30) {
  const filled = Math.round((done / total) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

// ── 메인 ──
const files = collectFl(ROOT);
const total = files.length;
const results = [];
let pass = 0, fail = 0;

if (!JSON_OUT) {
  console.log(`\nFreeLang 전수 회귀 스캔 — ${ROOT}`);
  console.log(`총 ${total}개 .fl 파일\n`);
}

for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const rel = path.relative(ROOT, f);
  const r = tryCompile(f);
  results.push({ file: rel, ...r });

  if (r.ok) pass++;
  else fail++;

  if (!JSON_OUT) {
    const pct = Math.round(((i + 1) / total) * 100);
    process.stdout.write(
      `\r${bar(i + 1, total)} ${pct}% (${i + 1}/${total})  PASS:${pass} FAIL:${fail}  `
    );
  }
}

if (!JSON_OUT) process.stdout.write("\n\n");

// ── 리포트 ──
if (JSON_OUT) {
  console.log(JSON.stringify({ total, pass, fail, results }, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

// 실패 목록
const failures = results.filter(r => !r.ok);
if (failures.length > 0) {
  console.log(`${"─".repeat(60)}`);
  console.log(`❌ 컴파일 실패 ${failures.length}개`);
  console.log(`${"─".repeat(60)}`);

  // 에러 패턴별 그룹화
  const groups = {};
  for (const f of failures) {
    const key = f.error
      ? f.error.replace(/\/.+\.fl/, "<file>").replace(/:\d+/g, ":N").slice(0, 80)
      : "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(f.file);
  }

  for (const [err, files] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n[${files.length}건] ${err}`);
    for (const f of files.slice(0, 5)) console.log(`  • ${f}`);
    if (files.length > 5) console.log(`  ... 외 ${files.length - 5}건`);
  }
} else {
  console.log("✅ 모든 파일 컴파일 성공!");
}

// ── 요약 ──
console.log(`\n${"═".repeat(60)}`);
console.log(`총 ${total}개  ✅ ${pass}개 PASS  ❌ ${fail}개 FAIL`);
const passRate = ((pass / total) * 100).toFixed(1);
console.log(`통과율: ${passRate}%`);

// 느린 파일 Top 5
const slow = results.filter(r => r.ok).sort((a, b) => b.ms - a.ms).slice(0, 5);
if (slow.length > 0) {
  console.log(`\n⏱  컴파일 느린 파일 Top 5`);
  for (const s of slow) console.log(`  ${s.ms}ms  ${s.file}`);
}

process.exit(fail > 0 ? 1 : 0);
