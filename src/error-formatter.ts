// FreeLang v9: Error Formatter
// Phase 59: 위치 정보 + 소스 강조 + 유사 함수 힌트
// Phase A (2026-04-25): ErrorCode + context + 자동 복구 힌트

import { RECOVERY_HINTS } from "./errors";

export interface FreeLangError {
  message: string;
  file?: string;
  line?: number;
  col?: number;
  source?: string;   // 전체 소스 코드 (줄 강조용)
  hint?: string;     // 수정 제안
  code?: string;     // Phase A: ErrorCode (예: "E_TYPE_NIL")
  context?: Record<string, any>;  // Phase A: throw 시점 컨텍스트
}

/**
 * 레벤슈타인 거리 계산 (간단 구현, npm 패키지 불필요)
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * 유사 이름 추천
 * - 짧은 이름(≤4자): 거리 ≤ 2
 * - 긴 이름(>4자): 거리 ≤ 3 (예: compute-tax vs compute-rate = 3)
 * @param name 찾지 못한 이름
 * @param candidates 후보 목록
 * @returns 가장 가까운 후보 또는 null
 */
// AI-First #4: 알려진 잘못된 이름 → 정답 + 사용법 매핑
export const KNOWN_ALIASES: Record<string, { correct: string; usage: string }> = {
  // 환경변수
  "env":              { correct: "shell_env",    usage: '(shell_env "KEY")' },
  "get_env":          { correct: "shell_env",    usage: '(shell_env "KEY")' },
  "get-env":          { correct: "shell_env",    usage: '(shell_env "KEY")' },
  "get_env_or":       { correct: "shell_env",    usage: '(or (shell_env "KEY") "default")' },
  // 맵 조작
  "obj_merge":        { correct: "assoc",        usage: '(assoc map "key" value)' },
  "obj-merge":        { correct: "assoc",        usage: '(assoc map "key" value)' },
  "merge":            { correct: "assoc",        usage: '(assoc map "key" value)' },
  "obj_omit":         { correct: "dissoc",       usage: '(dissoc map "key")' },
  "obj-omit":         { correct: "dissoc",       usage: '(dissoc map "key")' },
  "obj_pick":         { correct: "get",          usage: '(get map "key")' },
  "dict":             { correct: "map-set",      usage: '(map-set {} "key" value)' },
  // 문자열
  "str_length":       { correct: "length",       usage: '(length "hello")' },
  "string_length":    { correct: "length",       usage: '(length "hello")' },
  "str_concat":       { correct: "str",          usage: '(str "a" "b" "c")' },
  "str_to_int":       { correct: "str_to_num",   usage: '(str_to_num "42")' },
  "parse_int":        { correct: "str_to_num",   usage: '(str_to_num "42")' },
  "int_to_str":       { correct: "num_to_str",   usage: '(num_to_str 42)' },
  "to_string":        { correct: "str",          usage: '(str value)' },
  "to_str":           { correct: "str",          usage: '(str value)' },
  // 타입 체크
  "is_null":          { correct: "nil?",         usage: '(nil? value)' },
  "is_nil":           { correct: "nil?",         usage: '(nil? value)' },
  "null?":            { correct: "nil?",         usage: '(nil? value)' },
  "is_array":         { correct: "array?",       usage: '(array? value)' },
  "is_string":        { correct: "string?",      usage: '(string? value)' },
  "is_number":        { correct: "number?",      usage: '(number? value)' },
  // 배열
  "push":             { correct: "append",       usage: '(append arr item)' },
  "list_append":      { correct: "append",       usage: '(append arr item)' },
  "array_push":       { correct: "append",       usage: '(append arr item)' },
  "array_length":     { correct: "length",       usage: '(length arr)' },
  "first":            { correct: "get",          usage: '(get arr 0)' },
  "head":             { correct: "get",          usage: '(get arr 0)' },
  // 출력
  "console_log":      { correct: "println",      usage: '(println value)' },
  "console.log":      { correct: "println",      usage: '(println value)' },
  "print":            { correct: "println",      usage: '(println value)' },
  "log":              { correct: "println",      usage: '(println value)' },
  // DB
  "mariadb_all":      { correct: "mariadb_query", usage: '(mariadb_query db "SELECT ..." [params])' },
  "db_query":         { correct: "mariadb_query", usage: '(mariadb_query db "SELECT ..." [params])' },
  // HTTP
  "http_post":        { correct: "http_get",     usage: '(http_get url {:method "POST" :body data})' },
  "fetch":            { correct: "http_get",     usage: '(http_get url)' },
  // 서버
  "server_listen":    { correct: "server_start", usage: '(server_start 40000)' },
  "listen":           { correct: "server_start", usage: '(server_start 40000)' },
  // 에러
  "raise":            { correct: "error",        usage: '(error "메시지")' },
  "panic":            { correct: "error",        usage: '(error "메시지")' },
};

export function suggestSimilar(name: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;

  // 이름 길이에 따라 임계값 조정
  const threshold = name.length > 4 ? 3 : 2;

  for (const candidate of candidates) {
    const dist = levenshtein(name.toLowerCase(), candidate.toLowerCase());
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  return best;
}

/**
 * 에러 포매팅 — 파일:줄:컬럼 헤더 + 소스 강조 (±2줄) + 힌트
 */
export function formatError(err: FreeLangError): string {
  const lines: string[] = [];

  // 1) 헤더 줄
  let header = `FreeLang 실행 오류`;
  if (err.file) {
    header += `  ${err.file}`;
    if (err.line != null) {
      header += `:${err.line}`;
      if (err.col != null) {
        header += `:${err.col}`;
      }
    }
  }
  lines.push(header);

  // 2) 소스 강조 (±2줄)
  if (err.source && err.line != null) {
    const srcLines = err.source.split("\n");
    const targetLine = err.line; // 1-based
    const startLine = Math.max(1, targetLine - 2);
    const endLine = Math.min(srcLines.length, targetLine + 2);

    for (let i = startLine; i <= endLine; i++) {
      const lineNum = String(i).padStart(3, " ");
      const srcLine = srcLines[i - 1] ?? "";
      lines.push(`  ${lineNum} │ ${srcLine}`);

      // 오류 줄 아래에 캐럿(^^^) 표시
      if (i === targetLine) {
        const col = err.col != null ? err.col : 1;
        const prefix = " ".repeat(7 + (col - 1)); // "  NNN │ " = 7자
        let caretLen = 1;
        // 오류 토큰 길이: message에서 따옴표 안 이름 추출 시도
        const tokenMatch = err.message.match(/['"`]([^'"`]+)['"`]/);
        if (tokenMatch) caretLen = tokenMatch[1].length;
        lines.push(prefix + "^".repeat(caretLen));
      }
    }
  }

  // 3) 에러 메시지
  lines.push(`오류: ${err.message}`);

  // 3.5) Phase A: 컨텍스트 (fn, arg, expected, got 등)
  if (err.context && Object.keys(err.context).length > 0) {
    const ctxParts: string[] = [];
    if (err.context.fn) ctxParts.push(`fn=${err.context.fn}`);
    if (err.context.arg != null) ctxParts.push(`arg=${err.context.arg}`);
    if (err.context.expected) ctxParts.push(`expected=${err.context.expected}`);
    if (err.context.got) ctxParts.push(`got=${err.context.got}`);
    if (err.context.varName) ctxParts.push(`var=${err.context.varName}`);
    if (ctxParts.length > 0) {
      lines.push(`컨텍스트: ${ctxParts.join("  ")}`);
    }
  }

  // 4) 힌트 — 명시적 hint 우선, 없으면 ErrorCode 기반 자동 복구 힌트
  const autoHint = err.code && !err.hint ? RECOVERY_HINTS[err.code] : null;
  if (err.hint) {
    lines.push(`힌트: ${err.hint}`);
  } else if (autoHint) {
    lines.push(`힌트: ${autoHint}`);
  }

  return lines.join("\n");
}
