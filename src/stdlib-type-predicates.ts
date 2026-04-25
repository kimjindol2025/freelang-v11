// FreeLang v11: 타입 Predicate 통일 정의 (Phase B, 2026-04-25)
//
// 목적:
// - 타입 체크 함수가 여러 파일에 분산되어 single source of truth 부재였던 문제 해결
// - 표준 이름과 alias 매핑을 한 곳에 명시 → audit/문서/IDE 자동완성에 활용
// - 실제 등록은 여전히 eval-builtins.ts에서 case 패턴으로 수행 (호환성 유지)
//
// 향후 점진적 리팩토링:
// - eval-builtins.ts에서 이 모듈을 import해서 등록 자동화
// - 새 predicate 추가 시 이 파일만 수정하면 됨
//
// 사용처:
// - linter / lsp-server: "function?"는 "fn?"의 alias임을 인식
// - error-formatter: "did you mean ___?" 후보 풀
// - codegen: cg-native-dispatch가 표준 이름만 인식해도 alias가 자동 변환

/** 표준 predicate 정의 — 각 항목에 표준 이름 + 구현 + alias 목록 */
export interface PredicateDef {
  name: string;       // 표준 이름 (canonical)
  aliases: string[];  // 같은 의미의 다른 이름들
  test: (v: any) => boolean;
  doc: string;        // 한 줄 설명
}

export const TYPE_PREDICATES: PredicateDef[] = [
  {
    name: "null?",
    aliases: ["nil?"],
    test: (v) => v === null || v === undefined,
    doc: "값이 null 또는 undefined인지",
  },
  {
    name: "empty?",
    aliases: [],
    test: (v) =>
      Array.isArray(v) ? v.length === 0
      : typeof v === "string" ? v.length === 0
      : (v === null || v === undefined),
    doc: "빈 배열·문자열·nil",
  },
  {
    name: "string?",
    aliases: [],
    test: (v) => typeof v === "string",
    doc: "문자열 타입",
  },
  {
    name: "number?",
    aliases: [],
    test: (v) => typeof v === "number",
    doc: "숫자 타입 (int/float)",
  },
  {
    name: "boolean?",
    aliases: ["bool?"],
    test: (v) => typeof v === "boolean",
    doc: "참/거짓 타입",
  },
  {
    name: "list?",
    aliases: ["array?"],
    test: (v) => Array.isArray(v),
    doc: "배열(리스트) 타입",
  },
  {
    name: "map?",
    aliases: [],
    test: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
    doc: "맵(객체) 타입",
  },
  {
    name: "fn?",
    aliases: ["function?"],
    test: (v) => typeof v === "function",
    doc: "함수 타입",
  },
  {
    name: "zero?",
    aliases: [],
    test: (v) => v === 0,
    doc: "정확히 0",
  },
  {
    name: "true?",
    aliases: [],
    test: (v) => v === true,
    doc: "정확히 true",
  },
  {
    name: "false?",
    aliases: [],
    test: (v) => v === false,
    doc: "정확히 false",
  },
];

/** 모든 predicate 이름 (표준 + alias) — IDE 자동완성·linter용 */
export const ALL_PREDICATE_NAMES: string[] = TYPE_PREDICATES.flatMap(
  (p) => [p.name, ...p.aliases]
);

/** alias → canonical 이름 매핑 */
export const ALIAS_TO_CANONICAL: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const p of TYPE_PREDICATES) {
    m[p.name] = p.name;
    for (const alias of p.aliases) m[alias] = p.name;
  }
  return m;
})();

/** 이름으로 predicate 정의 조회 (alias도 인식) */
export function getPredicate(name: string): PredicateDef | null {
  const canonical = ALIAS_TO_CANONICAL[name];
  if (!canonical) return null;
  return TYPE_PREDICATES.find((p) => p.name === canonical) ?? null;
}

/** 표준 predicate 직접 호출 — 동적 dispatch 필요 시 */
export function evalPredicate(name: string, value: any): boolean | null {
  const p = getPredicate(name);
  if (!p) return null;
  return p.test(value);
}
