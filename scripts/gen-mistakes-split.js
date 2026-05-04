#!/usr/bin/env node
// _classifications.json → MISTAKES.md / LEARNING.md / LANGUAGE-FAULTS.md 자동 생성

const path = require("path");
const fs = require("fs");

const docsDir = path.resolve(__dirname, "..", "docs");
const cls = JSON.parse(fs.readFileSync(path.join(docsDir, "_classifications.json"), "utf-8"));

// 본 MISTAKES-100.md에서 코드 블록 추출
const orig = fs.readFileSync(path.join(docsDir, "MISTAKES-100.md"), "utf-8");

function extractItem(num) {
  // ;; #N — 으로 시작하는 단락 추출 (다음 ;; #N+ 또는 --- 까지)
  const re = new RegExp(`;;\\s*#${num}\\b[\\s\\S]*?(?=\\n;;\\s*#\\d+\\b|\\n\`\`\`|\\n---)`, "m");
  const m = orig.match(re);
  return m ? m[0].trim() : null;
}

// ─────────────────────────────────────────────────────────────
// 분류 컬렉션
// ─────────────────────────────────────────────────────────────
const groups = {};
for (const t of Object.keys(cls._categories)) groups[t] = [];

for (const [id, item] of Object.entries(cls.items)) {
  groups[item.type].push({ id, ...item, code: extractItem(id.slice(1)) });
}

// ─────────────────────────────────────────────────────────────
// MISTAKES.md — 진짜 실수 (user + learning + missing)
// ─────────────────────────────────────────────────────────────
function genMistakes() {
  const lines = [
    "# FreeLang v11 — 진짜 실수 모음",
    "",
    "> 사용자/AI가 *진짜로 잘못 쓰는* 항목. 28개.",
    "> v11.4.2 기준 28개 중 20개 ALIAS hint로 자동 처리됨.",
    "",
    "관련 문서:",
    "- `LEARNING.md` — Lisp/FreeLang 학습 (실수 아님, 25개)",
    "- `LANGUAGE-FAULTS.md` — 언어 디자인 결함 (44개, v12 fix 대상)",
    "- `MISTAKES-COVERAGE.json` — 자동 처리 카운트",
    "",
    "---",
    "",
    "## 💀 진짜 부주의 (3개)",
    "",
    "코드 작성자가 명백히 실수한 경우.",
    "",
  ];
  for (const it of groups.user) {
    lines.push(`### ${it.id} — ${it.summary}`);
    lines.push("");
    if (it.code) lines.push("```lisp\n" + it.code + "\n```");
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## 💡 다른 언어 습관 (20개)");
  lines.push("");
  lines.push("AI/사용자가 다른 언어 습관으로 잘못된 함수명을 쓰는 경우. **모두 ALIAS hint 자동 처리됨**.");
  lines.push("");
  lines.push("| # | 잘못된 호출 | 올바른 호출 | 출처 |");
  lines.push("|---|------------|------------|------|");
  for (const it of groups.learning) {
    lines.push(`| ${it.id} | ${it.summary} | ALIAS 처리 | ${it.fix || "—"} |`);
  }
  lines.push("");
  lines.push("→ `freelang-smart`로 실행하면 자동 hint.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 🚧 언어 미구현 (5개)");
  lines.push("");
  lines.push("기능 자체가 미구현이라 *대안*을 알아야 하는 경우. Phase Y 대상.");
  lines.push("");
  for (const it of groups.missing) {
    lines.push(`### ${it.id} — ${it.summary}`);
    lines.push("");
    if (it.code) lines.push("```lisp\n" + it.code + "\n```");
    lines.push("");
    if (it.fix) lines.push(`**Fix**: ${it.fix}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// LEARNING.md — Lisp/FreeLang 학습 (정상 동작)
// ─────────────────────────────────────────────────────────────
function genLearning() {
  const lines = [
    "# FreeLang v11 — 학습 자료 (정상 동작)",
    "",
    "> 다른 언어와 다른 동작이지만 **FreeLang에서 정상**. 25개.",
    "> 실수가 아닌 *학습 사항*. JS/Python 출신이 헷갈리는 패턴.",
    "",
    "관련 문서:",
    "- `MISTAKES.md` — 진짜 실수",
    "- `LANGUAGE-FAULTS.md` — 언어 결함 (다음 메이저에서 수정)",
    "",
    "---",
    "",
    "## 📚 Lisp/함수형 표준 동작",
    "",
  ];
  for (const it of groups.normal) {
    lines.push(`### ${it.id} — ${it.summary}`);
    lines.push("");
    if (it.code) lines.push("```lisp\n" + it.code + "\n```");
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## 📝 문서 오류 (3개)");
  lines.push("");
  lines.push("MISTAKES-100에서 *틀린 코드*라고 표시했지만 **실제로는 작동**하는 경우.");
  lines.push("문서가 outdated. 정정 예정.");
  lines.push("");
  for (const it of groups.doc) {
    lines.push(`### ${it.id} — ${it.summary}`);
    lines.push("");
    if (it.code) lines.push("```lisp\n" + it.code + "\n```");
    lines.push("");
    if (it.fix) lines.push(`**Fix**: ${it.fix}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// LANGUAGE-FAULTS.md — 언어 디자인 결함
// ─────────────────────────────────────────────────────────────
function genFaults() {
  const lines = [
    "# FreeLang v11 — 언어 디자인 결함 (44개)",
    "",
    "> *사용자가 실수하는 게 아니라 언어가 일관성 없게 만들어졌다.*",
    "> Phase X (v12) 대상. Breaking change + 마이그레이션 도구.",
    "",
    "관련 문서:",
    "- `MISTAKES.md` — 진짜 사용자 실수",
    "- `LEARNING.md` — Lisp 학습 자료",
    "- `ROADMAP.md` Phase X — v12 통일 계획",
    "",
    "---",
    "",
    "## 🔧 분류",
    "",
    "| 분류 | 개수 | 핵심 문제 |",
    "|-----|------|----------|",
    "| 인자 순서 | 10 | fn-first vs col-first vs key-first 혼재 |",
    "| HTTP API | 10 | 반환 구조체 vs 직접 / 시그니처 비일관 |",
    "| 상태 관리 | 5  | atom 의무화 / set! 클로저 미반영 |",
    "| 함수 선언 | 4  | $ 접두사 / [FUNC] deprecated |",
    "| 작명 비일관 | 5 | kebab vs snake / suffix `?` 임의 |",
    "| 데이터 타입 | 3 | 키워드 키 강제 / 깊은 동등성 미지원 |",
    "| 기타 | 7 | (str map) → \"[object]\" 등 |",
    "| **합계** | **44** | — |",
    "",
    "---",
    "",
    "## 모든 항목 (44개)",
    "",
    "각 항목의 **fix**는 v12 Phase X 작업 항목.",
    "",
  ];
  for (const it of groups.design) {
    lines.push(`### ${it.id} — ${it.summary}`);
    lines.push("");
    if (it.code) lines.push("```lisp\n" + it.code + "\n```");
    if (it.fix) {
      lines.push("");
      lines.push(`**v12 fix**: ${it.fix}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// 쓰기
fs.writeFileSync(path.join(docsDir, "MISTAKES.md"),         genMistakes());
fs.writeFileSync(path.join(docsDir, "LEARNING.md"),         genLearning());
fs.writeFileSync(path.join(docsDir, "LANGUAGE-FAULTS.md"),  genFaults());

console.log("✓ docs/MISTAKES.md          생성");
console.log("✓ docs/LEARNING.md          생성");
console.log("✓ docs/LANGUAGE-FAULTS.md   생성");
console.log();
console.log("분류 카운트:");
for (const [type, info] of Object.entries(cls._categories)) {
  console.log(`  ${info.icon} ${info.label.padEnd(20)} ${(groups[type]?.length || 0).toString().padStart(2)}`);
}
