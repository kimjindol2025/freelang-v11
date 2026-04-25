#!/usr/bin/env node
// scripts/ai-validate.js — AI가 작성한 FreeLang 코드 검증 + 자동 normalize
//
// 사용:
//   node scripts/ai-validate.js my-code.fl              # 진단만
//   node scripts/ai-validate.js my-code.fl --fix        # 자동 수정 + stdout
//   echo "(defun foo [x] x)" | node scripts/ai-validate.js --stdin
//   echo "..." | node scripts/ai-validate.js --stdin --fix
//
// 검사 항목 (Phase A~E + AI-1/2 결과 활용):
//   1. defun → defn (Common Lisp → Clojure)
//   2. == → = (FL은 = 만 있음)
//   3. nil 위험: (get x :k) → (get-or x :k default) 권장
//   4. if 분기: (if cond then) — else 누락 경고
//   5. 함수명 typo: Levenshtein으로 stdlib 후보 추천
//   6. compile 시도 (bootstrap.js로 syntactic + semantic 검증)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const SIGS_PATH = path.join(REPO, "src/_stdlib-signatures.json");

const args = process.argv.slice(2);
const FIX = args.includes("--fix");
const STDIN = args.includes("--stdin");
const QUIET = args.includes("--quiet");
const inputFile = args.find((a) => !a.startsWith("--"));

// ─────────────────────────────────────────────────────────────
// Levenshtein (gen-ai-prompt와 별도, 의존성 0)
// ─────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function suggestSimilar(name, candidates) {
  const threshold = name.length > 4 ? 3 : 2;
  let best = null, bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name.toLowerCase(), c.toLowerCase());
    if (d <= threshold && d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────
// 검사 규칙
// ─────────────────────────────────────────────────────────────

function checkDefun(src) {
  const issues = [];
  const re = /\(\s*defun\b/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    issues.push({
      line: src.slice(0, m.index).split("\n").length,
      level: "info",
      code: "DEFUN_ALIAS",
      msg: "(defun ...) 대신 (defn ...) 권장 (Clojure 스타일)",
      fix: { search: /\(\s*defun\b/g, replace: "(defn" },
    });
    break; // 한 번만 보고
  }
  return issues;
}

function checkDoubleEq(src) {
  const issues = [];
  const re = /\(\s*==\s/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    issues.push({
      line: src.slice(0, m.index).split("\n").length,
      level: "error",
      code: "DOUBLE_EQ",
      msg: "FreeLang은 (==) 미지원. (=) 사용",
      fix: { search: /\(\s*==\s/g, replace: "(= " },
    });
    break;
  }
  return issues;
}

function checkRawGet(src) {
  // (get X :key) 패턴 — get-or 권장
  const issues = [];
  const re = /\(\s*get\s+[^\s)]+\s+[^\s)]+\s*\)/g;
  let m, count = 0;
  while ((m = re.exec(src)) !== null && count < 3) {
    count++;
    issues.push({
      line: src.slice(0, m.index).split("\n").length,
      level: "info",
      code: "RAW_GET",
      msg: "(get ...) 대신 (get-or coll key default) 권장 — nil-safety 향상",
      fix: null, // 자동 fix는 default 값을 알 수 없어 안전하지 않음
    });
  }
  return issues;
}

function checkIfNoElse(src) {
  // (if cond then) — paren 갯수 균형 검사로 단순 휴리스틱
  // 정확한 분석은 lexer 필요. 여기선 라인 기반 근사.
  const issues = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // (if ... ...) 패턴인데 두번째 ... 다음에 닫는 paren이 바로 오는 경우
    const m = line.match(/\(\s*if\s+[^\s]+\s+[^\s)]+\s*\)/);
    if (m) {
      issues.push({
        line: i + 1,
        level: "warn",
        code: "IF_NO_ELSE",
        msg: "(if cond then) — else 누락. 의도한 결과면 (if cond then nil) 명시 권장",
        fix: null,
      });
    }
  }
  return issues;
}

function checkUndefinedFnCall(src, stdlibFns) {
  // 모든 (foo ...) 호출을 추출해서 stdlib에 없으면 typo 의심
  const issues = [];
  const re = /\(\s*([a-z][a-zA-Z0-9_\-?!]*)\b/g;
  const seen = new Set();
  let m;
  // 사용자 정의 함수 (defn/defun 으로 정의된)
  const userDefRe = /\((?:defn|defun)\s+([a-zA-Z0-9_\-?!]+)/g;
  const userDefs = new Set();
  let dm;
  while ((dm = userDefRe.exec(src)) !== null) userDefs.add(dm[1]);
  // FUNC block
  const funcBlockRe = /\[FUNC\s+([a-zA-Z0-9_\-?!]+)/g;
  while ((dm = funcBlockRe.exec(src)) !== null) userDefs.add(dm[1]);

  // 빌트인/special form (검사 제외)
  const BUILTIN = new Set([
    "fn", "defn", "defun", "let", "if", "cond", "do", "begin", "progn",
    "and", "or", "not", "set!", "set", "define", "loop", "recur", "while",
    "compose", "pipe", "->", "->>", "|>", "use", "import", "open", "module",
    "+", "-", "*", "/", "%", "=", "!=", "<", ">", "<=", ">=", "**",
    "if-let", "when", "unless", "when-let", "for", "doseq", "match",
    "func-ref", "call", "async", "await", "throw", "fl-try", "try", "catch", "finally",
    "defmacro", "macroexpand", "defstruct", "defprotocol", "impl",
    "parallel", "race", "with-timeout", "REFLECT",
    "list", "first", "last", "rest", "cons", "reverse", "sort", "map", "filter", "reduce",
    "println", "print", "str", "concat", "length", "get", "get-or", "first-or", "last-or",
    "keys", "values", "empty?", "null?", "nil?", "string?", "number?", "list?", "array?",
    "map?", "fn?", "function?", "boolean?", "bool?", "true?", "false?", "zero?", "pos?", "neg?", "even?", "odd?",
    "json-parse", "json-stringify", "type-of", "trim", "upper-case", "lower-case",
    "split", "replace", "substring", "char-at", "index-of", "starts-with?", "ends-with?", "includes?",
    "abs", "floor", "ceil", "round", "sqrt", "max", "min", "mod",
    "int", "float", "bool",
  ]);

  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    if (BUILTIN.has(name) || userDefs.has(name)) continue;
    if (stdlibFns.has(name)) continue;
    // typo 의심: 후보 추천
    const candidates = [...stdlibFns, ...BUILTIN];
    const suggest = suggestSimilar(name, candidates);
    issues.push({
      line: src.slice(0, m.index).split("\n").length,
      level: suggest ? "warn" : "info",
      code: "UNKNOWN_FN",
      msg: suggest
        ? `미정의 함수 '${name}' — 혹시 '${suggest}'?`
        : `미정의 함수 '${name}' — (use MODULE) import 누락 가능성`,
      fix: suggest ? { search: new RegExp(`\\(\\s*${name.replace(/[?$+\-]/g, "\\$&")}\\b`, "g"), replace: `(${suggest}` } : null,
    });
  }
  return issues;
}

function tryCompile(src, srcPath) {
  // bootstrap.js에 임시 파일로 던져 실제 lex/parse 검증
  const tmpPath = path.join(REPO, ".tmp-ai-validate-" + process.pid + ".fl");
  const tmpOut = tmpPath + ".out.js";
  try {
    fs.writeFileSync(tmpPath, src, "utf-8");
    const cmd = `node --stack-size=8000 ${path.join(REPO, "bootstrap.js")} run ${tmpPath} ${tmpOut} 2>&1`;
    execSync(cmd, { encoding: "utf-8", timeout: 30000 });
    fs.unlinkSync(tmpPath);
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    return { ok: true, msg: "compile OK" };
  } catch (e) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    return { ok: false, msg: e.stdout || e.message };
  }
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

function loadStdlibFns() {
  if (!fs.existsSync(SIGS_PATH)) return new Set();
  const sigs = JSON.parse(fs.readFileSync(SIGS_PATH, "utf-8"));
  return new Set(sigs.map((s) => s.name));
}

function readSource() {
  if (STDIN) {
    return fs.readFileSync(0, "utf-8");
  }
  if (!inputFile) {
    console.error("사용: ai-validate.js <file.fl> [--fix] | --stdin [--fix]");
    process.exit(2);
  }
  if (!fs.existsSync(inputFile)) {
    console.error(`파일 없음: ${inputFile}`);
    process.exit(2);
  }
  return fs.readFileSync(inputFile, "utf-8");
}

function applyFixes(src, issues) {
  let fixed = src;
  for (const issue of issues) {
    if (!issue.fix) continue;
    fixed = fixed.replace(issue.fix.search, issue.fix.replace);
  }
  return fixed;
}

function reportIssues(issues, totalLines) {
  if (issues.length === 0) {
    if (!QUIET) console.error(`✅ 검사 통과 (이슈 0개)`);
    return;
  }
  const sorted = [...issues].sort((a, b) => a.line - b.line);
  if (!QUIET) console.error(`\n📋 진단 (${sorted.length}개):\n`);
  for (const i of sorted) {
    const icon = { error: "❌", warn: "⚠️", info: "💡" }[i.level] ?? "·";
    console.error(`  ${icon} L${i.line} [${i.code}] ${i.msg}`);
  }
  console.error("");
}

function main() {
  const src = readSource();
  const stdlibFns = loadStdlibFns();

  // 모든 검사 실행
  const issues = [
    ...checkDefun(src),
    ...checkDoubleEq(src),
    ...checkRawGet(src),
    ...checkIfNoElse(src),
    ...checkUndefinedFnCall(src, stdlibFns),
  ];

  // compile 검증 (가장 무거운 검사 — fix 모드에선 skip)
  let compileResult = null;
  if (!FIX) {
    compileResult = tryCompile(src, inputFile);
    if (!compileResult.ok) {
      issues.push({
        line: 0,
        level: "error",
        code: "COMPILE_FAIL",
        msg: "compile 실패: " + compileResult.msg.split("\n").slice(0, 3).join(" / "),
      });
    }
  }

  if (FIX) {
    const fixed = applyFixes(src, issues);
    process.stdout.write(fixed);
    if (!QUIET) {
      const fixedCount = issues.filter(i => i.fix).length;
      console.error(`\n🔧 자동 수정 ${fixedCount}건 적용 (총 진단 ${issues.length}건)`);
    }
    return;
  }

  reportIssues(issues, src.split("\n").length);
  // exit code: error 있으면 1, warn만 있으면 0
  const hasError = issues.some(i => i.level === "error");
  process.exit(hasError ? 1 : 0);
}

main();
