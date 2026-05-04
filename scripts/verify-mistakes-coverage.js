#!/usr/bin/env node
// MISTAKES-100 자동 처리 커버리지 측정
// 사용: node scripts/verify-mistakes-coverage.js

const path = require("path");
const fs = require("fs");

const aliasesPath = path.resolve(__dirname, "..", "src", "_aliases.json");
const raw = JSON.parse(fs.readFileSync(aliasesPath, "utf-8"));

// MISTAKES-100 항목별 분류
const COVERAGE = {
  // 자동 처리 (코드 그대로 동작 — wrapper preprocessing or alias hint)
  AUTO_BY_WRAPPER: new Set([
    "#23",  // (let [$x 1] body) → 자동 수정
    "#26",  // [FUNC] deprecated → defn 변환 hint
  ]),

  // 옵션 헬퍼 호출 시 (smart-* / http-*-json / try-call)
  OPTIONAL_HELPER: new Set([
    "#1", "#2", "#5", "#9",  // smart-map/filter/assoc/get
    "#11", "#12", "#13", "#15",  // http-*-json
  ]),
};

// _aliases.json 분석 — mistake 필드 매핑
const ALIAS_MISTAKES = new Set();
for (const [k, v] of Object.entries(raw)) {
  if (k.startsWith("_")) continue;
  if (v.mistake) ALIAS_MISTAKES.add(v.mistake);
}

// MISTAKES-100 전체 (1~100)
const ALL_MISTAKES = new Set();
for (let i = 1; i <= 100; i++) ALL_MISTAKES.add(`#${i}`);

// 합집합
const COVERED = new Set([
  ...COVERAGE.AUTO_BY_WRAPPER,
  ...COVERAGE.OPTIONAL_HELPER,
  ...ALIAS_MISTAKES,
]);

const uncovered = [...ALL_MISTAKES].filter((m) => !COVERED.has(m));

// 카테고리별 (대략적)
const CATEGORY_RANGES = [
  ["Cat 1 인자 순서",      1, 10],
  ["Cat 2 HTTP 응답",      11, 15],
  ["Cat 3 atom",           16, 20],
  ["Cat 4 let",            21, 25],
  ["Cat 5 함수 선언",      26, 31],
  ["Cat 6 함수명 오류",    32, 45],
  ["Cat 7 HTTP 서버",      46, 54],
  ["Cat 8 데이터 타입",    55, 60],
  ["Cat 9 조건문",         61, 65],
  ["Cat 10 DB",            66, 70],
  ["Cat 11 파일/환경",     71, 75],
  ["Cat 12 문자열",        76, 82],
  ["Cat 13 배열",          83, 88],
  ["Cat 14 에러 처리",     89, 92],
  ["Cat 15 기타",          93, 100],
];

console.log("\n═══ MISTAKES-100 자동 처리 커버리지 ═══\n");

let totalCovered = 0;
for (const [name, start, end] of CATEGORY_RANGES) {
  const items = [];
  for (let i = start; i <= end; i++) items.push(`#${i}`);
  const cov = items.filter((m) => COVERED.has(m));
  const pct = items.length === 0 ? 0 : Math.round((cov.length / items.length) * 100);
  totalCovered += cov.length;
  const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
  console.log(`  ${name.padEnd(22)} ${cov.length}/${items.length} ${bar} ${pct}%`);
  if (cov.length > 0) {
    console.log(`    └─ ${cov.join(", ")}`);
  }
}

console.log("─".repeat(50));
console.log(`총합: ${totalCovered} / 100 = ${totalCovered}%`);
console.log("─".repeat(50));

console.log(`\n분류:`);
console.log(`  • Wrapper 자동 처리:    ${COVERAGE.AUTO_BY_WRAPPER.size}`);
console.log(`  • ALIAS hint 처리:      ${ALIAS_MISTAKES.size}`);
console.log(`  • 옵션 헬퍼 호출 시:    ${COVERAGE.OPTIONAL_HELPER.size}`);
console.log(`  • 미처리:               ${uncovered.length}`);

console.log(`\n[ALIASES 매핑 mistake#]`);
console.log(`  ${[...ALIAS_MISTAKES].sort((a,b) => parseInt(a.slice(1)) - parseInt(b.slice(1))).join(", ")}`);

console.log(`\n[Wrapper 자동]`);
console.log(`  ${[...COVERAGE.AUTO_BY_WRAPPER].sort().join(", ")}`);

console.log(`\n[옵션 헬퍼]`);
console.log(`  ${[...COVERAGE.OPTIONAL_HELPER].sort((a,b) => parseInt(a.slice(1)) - parseInt(b.slice(1))).join(", ")}`);

console.log(`\n[미처리 86개 → 75개]`);
console.log(`  ${uncovered.slice(0, 30).join(", ")} ...`);

// 결과 JSON 출력 (CI/문서용)
const result = {
  total: 100,
  covered: totalCovered,
  percent: totalCovered,
  by_type: {
    wrapper_auto: COVERAGE.AUTO_BY_WRAPPER.size,
    alias_hint: ALIAS_MISTAKES.size,
    optional_helper: COVERAGE.OPTIONAL_HELPER.size,
  },
  covered_items: [...COVERED].sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))),
  uncovered_items: uncovered.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))),
  generated_at: new Date().toISOString(),
};

const outPath = path.resolve(__dirname, "..", "MISTAKES-COVERAGE.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\n✓ 결과 저장: ${outPath}`);
