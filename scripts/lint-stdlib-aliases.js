#!/usr/bin/env node
// scripts/lint-stdlib-aliases.js — stdlib 함수명 hyphen/underscore alias 일관성 lint
//
// 목적:
//   AI는 Lisp 관례(hyphen)와 PHP/Python 관례(underscore) 둘 다 자연스럽게 작성.
//   stdlib에 한쪽만 등록되면 AI 코드가 "Function not found"로 깨짐.
//   양쪽 모두 등록 (alias)되어야 호환성 보장.
//
// 검사:
//   1. src/stdlib-*.ts 모든 함수명 추출
//   2. 함수명에 _ 또는 - 가 있으면 alias 후보
//      - foo_bar 있는데 foo-bar 없으면 → MISSING_HYPHEN_ALIAS
//      - foo-bar 있는데 foo_bar 없으면 → MISSING_UNDERSCORE_ALIAS
//   3. 분류:
//      - 핵심 alias 누락: WARN (권장)
//      - 단일 자만 다름 (json_get vs json-get): WARN
//
// 사용:
//   node scripts/lint-stdlib-aliases.js          # 진단만
//   node scripts/lint-stdlib-aliases.js --json   # CI용
//   node scripts/lint-stdlib-aliases.js --quiet  # exit code만
//
// 통합:
//   scripts/build.js의 extractSignatures 직후 자동 실행 가능
//   make lint-aliases 명령

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const SRC_DIR = path.join(REPO, "src");

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const QUIET = args.includes("--quiet");

// ─────────────────────────────────────────────────────────────
// stdlib-*.ts 파일에서 함수명 추출
// ─────────────────────────────────────────────────────────────

function extractFunctionNames(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  // 패턴: "name": (...) => 또는 "name": function 또는 "name": fn
  // 객체 리터럴 키 형태
  const re = /"([a-zA-Z_][a-zA-Z0-9_-]*[?!]?)"\s*:/g;
  const names = new Set();
  let m;
  while ((m = re.exec(content)) !== null) {
    names.add(m[1]);
  }
  // case fall-through 패턴: case "name": case "alias":
  // (eval-builtins.ts에 있는 패턴)
  const caseRe = /case\s+"([a-zA-Z_][a-zA-Z0-9_-]*[?!]?)":/g;
  while ((m = caseRe.exec(content)) !== null) {
    names.add(m[1]);
  }
  return names;
}

function loadAllStdlibNames() {
  const files = fs.readdirSync(SRC_DIR).filter(f =>
    (f.startsWith("stdlib-") && f.endsWith(".ts")) ||
    f === "eval-builtins.ts"
  );
  const all = new Set();
  const byFile = {};
  for (const f of files) {
    const names = extractFunctionNames(path.join(SRC_DIR, f));
    byFile[f] = names;
    for (const n of names) all.add(n);
  }
  return { all, byFile };
}

// ─────────────────────────────────────────────────────────────
// alias 누락 검출
// ─────────────────────────────────────────────────────────────

function findMissingAliases(allNames) {
  const issues = [];
  for (const name of allNames) {
    // hyphen 있으면 underscore 버전 확인
    if (name.includes("-")) {
      const underscored = name.replace(/-/g, "_");
      if (!allNames.has(underscored)) {
        issues.push({
          level: "info",
          code: "MISSING_UNDERSCORE_ALIAS",
          name,
          missing: underscored,
          msg: `'${name}' 있음, '${underscored}' 누락 (AI underscore 표기 호환)`,
        });
      }
    }
    // underscore 있으면 hyphen 버전 확인 (ai_, ws_, db_ 등 namespace는 제외)
    if (name.includes("_")) {
      // namespace prefix 패턴 제외 (e.g., ws_send, db_query, ai_complete)
      // 단순 짧은 prefix는 lib namespace로 보고 skip
      const parts = name.split("_");
      const isShortNamespace = parts[0].length <= 3 && parts.length === 2;
      if (isShortNamespace) continue;

      const hyphenated = name.replace(/_/g, "-");
      if (!allNames.has(hyphenated) && hyphenated !== name) {
        issues.push({
          level: "info",
          code: "MISSING_HYPHEN_ALIAS",
          name,
          missing: hyphenated,
          msg: `'${name}' 있음, '${hyphenated}' 누락 (AI hyphen 표기 호환)`,
        });
      }
    }
  }
  return issues;
}

// ─────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────

function main() {
  const { all, byFile } = loadAllStdlibNames();
  const issues = findMissingAliases(all);

  // 분류
  const missingHyphen = issues.filter(i => i.code === "MISSING_HYPHEN_ALIAS");
  const missingUnderscore = issues.filter(i => i.code === "MISSING_UNDERSCORE_ALIAS");

  if (JSON_OUT) {
    const out = {
      timestamp: new Date().toISOString(),
      total_functions: all.size,
      total_issues: issues.length,
      missing_hyphen_aliases: missingHyphen.length,
      missing_underscore_aliases: missingUnderscore.length,
      issues: issues.slice(0, 100), // 처음 100개만 (너무 많으면 truncate)
    };
    process.stdout.write(JSON.stringify(out, null, 2));
  } else if (!QUIET) {
    console.log(`\n📋 stdlib alias lint`);
    console.log(`   총 함수: ${all.size}`);
    console.log(`   진단 이슈: ${issues.length}개`);
    console.log(`     - hyphen alias 누락: ${missingHyphen.length} (underscore→hyphen)`);
    console.log(`     - underscore alias 누락: ${missingUnderscore.length} (hyphen→underscore)\n`);

    if (issues.length > 0) {
      console.log(`상세 (처음 30개):\n`);
      for (const i of issues.slice(0, 30)) {
        const icon = { error: "❌", warn: "⚠️", info: "💡" }[i.level] ?? "·";
        console.log(`  ${icon} [${i.code}] ${i.msg}`);
      }
      if (issues.length > 30) {
        console.log(`\n  ... 외 ${issues.length - 30}개 (--json 으로 전체 보기)`);
      }
    } else {
      console.log(`✅ alias 일관성 완벽`);
    }
  }

  // CI: warning만 → exit 0 (advisory)
  // 향후: 'error' 레벨 추가 시 exit 1
  process.exit(0);
}

main();
