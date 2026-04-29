/**
 * FreeLang v11 Runtime Helpers
 * 자체호스팅을 위한 필수 헬퍼 함수 모음
 *
 * 생성: 2026-04-29
 * 목표: bootstrap.js에서 자동 추출한 _fl_* 헬퍼 36개를 TS로 재구현
 *
 * 사용법:
 * - codegen의 프리앰블에 이 파일을 주입
 * - stage1-new.js 빌드 시 esbuild로 번들링
 * - self-host compile/run 검증
 */

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────

type FlValue = any;
type FlFn = (...args: any[]) => any;
type FlArray = FlValue[];
type FlMap = Record<string, FlValue>;

// ─────────────────────────────────────────────────────
// 카테고리 1: 타입 체크 (8개)
// ─────────────────────────────────────────────────────

export function _fl_null_q(v: FlValue): boolean {
  return v === null || v === undefined;
}

export function _fl_true_q(v: FlValue): boolean {
  return v === true;
}

export function _fl_false_q(v: FlValue): boolean {
  return v === false;
}

export function _fl_number_q(v: FlValue): boolean {
  return typeof v === 'number';
}

export function _fl_string_q(v: FlValue): boolean {
  return typeof v === 'string';
}

export function _fl_list_q(v: FlValue): boolean {
  return Array.isArray(v);
}

export function _fl_map_q(v: FlValue): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function _fl_fn_q(v: FlValue): boolean {
  return typeof v === 'function' || (v && typeof v === 'object' && v.__fn === true);
}

// ─────────────────────────────────────────────────────
// 카테고리 2: 배열 조작 (8개)
// ─────────────────────────────────────────────────────

export function _fl_length(arr: FlValue): number {
  if (Array.isArray(arr)) return arr.length;
  if (typeof arr === 'object' && arr !== null) return Object.keys(arr).length;
  if (typeof arr === 'string') return arr.length;
  return 0;
}

export function _fl_first(arr: FlArray): FlValue {
  return Array.isArray(arr) ? arr[0] : null;
}

export function _fl_last(arr: FlArray): FlValue {
  return Array.isArray(arr) ? arr[arr.length - 1] : null;
}

export function _fl_rest(arr: FlArray): FlArray {
  return Array.isArray(arr) ? arr.slice(1) : [];
}

export function _fl_append(arr: FlArray, item: FlValue): FlArray {
  return Array.isArray(arr) ? [...arr, item] : [item];
}

export function _fl_get(obj: FlValue, key: FlValue, defaultVal?: FlValue): FlValue {
  if (Array.isArray(obj) && typeof key === 'number') {
    return obj[key] ?? defaultVal ?? null;
  }
  if (typeof obj === 'object' && obj !== null) {
    const result = obj[String(key)];
    return result !== undefined ? result : (defaultVal ?? null);
  }
  return defaultVal ?? null;
}

export function _fl_map_set(obj: FlMap, key: FlValue, value: FlValue): FlMap {
  return { ...obj, [String(key)]: value };
}

export function _fl_keys(obj: FlValue): string[] {
  if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj);
  }
  return [];
}

// ─────────────────────────────────────────────────────
// 카테고리 3: 문자열 조작 (5개)
// ─────────────────────────────────────────────────────

export function _fl_str(...args: FlValue[]): string {
  return args.map(v => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }).join('');
}

export function _fl_lower(s: string): string {
  return String(s).toLowerCase();
}

export function _fl_upper(s: string): string {
  return String(s).toUpperCase();
}

export function _fl_trim(s: string): string {
  return String(s).trim();
}

export function _fl_contains_q(s: string, substr: string): boolean {
  return String(s).includes(String(substr));
}

// ─────────────────────────────────────────────────────
// 카테고리 4: 문자 분류 (5개)
// ─────────────────────────────────────────────────────

export function _fl_is_alpha_q(c: string): boolean {
  const ch = String(c)[0];
  return /[a-zA-Z]/.test(ch);
}

export function _fl_is_digit_q(c: string): boolean {
  const ch = String(c)[0];
  return /[0-9]/.test(ch);
}

export function _fl_is_alnum_q(c: string): boolean {
  const ch = String(c)[0];
  return /[a-zA-Z0-9]/.test(ch);
}

export function _fl_is_space_q(c: string): boolean {
  const ch = String(c)[0];
  return /\s/.test(ch);
}

export function _fl_is_symbol_char_q(c: string): boolean {
  const ch = String(c)[0];
  return /[!@#$%^&*\-_+=]/.test(ch);
}

// ─────────────────────────────────────────────────────
// 카테고리 5: 고차 함수 (3개)
// ─────────────────────────────────────────────────────

export function _fl_map(fn: FlFn, arr: FlArray): FlArray {
  return arr.map(item => fn([item]));
}

export function _fl_filter(arr: FlArray, fn: FlFn): FlArray {
  return arr.filter(item => {
    const result = fn([item]);
    return result !== false && result !== null;
  });
}

export function _fl_reduce(fn: FlFn, init: FlValue, arr: FlArray): FlValue {
  return arr.reduce((acc, item) => fn([acc, item]), init);
}

// ─────────────────────────────────────────────────────
// 카테고리 6: 조건부 로직 (2개)
// ─────────────────────────────────────────────────────

export function _fl_empty_q(v: FlValue): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  if (typeof v === 'string') return v === '';
  return false;
}

export function _fl_has_key_q(obj: FlValue, key: FlValue): boolean {
  if (typeof obj === 'object' && obj !== null) {
    return String(key) in obj;
  }
  return false;
}

// ─────────────────────────────────────────────────────
// 카테고리 7: I/O (2개)
// ─────────────────────────────────────────────────────

export function _fl_print(msg: FlValue): FlValue {
  console.log(msg);
  return msg;
}

export function _fl_array_q(v: FlValue): boolean {
  return Array.isArray(v);
}

// ─────────────────────────────────────────────────────
// 카테고리 8: HTTP (2개) — 자체호스팅용 스텁
// ─────────────────────────────────────────────────────

export function _fl_request(obj: FlMap): FlMap {
  // HTTP 요청 처리 (서버 모드용 스텁)
  return { status: 200, body: '{}', error: null };
}

export function _fl_response(obj: FlMap): FlMap {
  // HTTP 응답 처리 (서버 모드용 스텁)
  return obj;
}

// ─────────────────────────────────────────────────────
// 카테고리 9: 기타 (1개)
// ─────────────────────────────────────────────────────

export function _fl_wait_and_respond(fn: FlFn, timeout?: number): FlValue {
  // 비동기 작업 (현재 동기로 처리)
  return fn([]);
}

// ─────────────────────────────────────────────────────
// 헬퍼 맵 (codegen 주입용)
// ─────────────────────────────────────────────────────

export const RUNTIME_HELPERS: Record<string, FlFn> = {
  _fl_null_q,
  _fl_true_q,
  _fl_false_q,
  _fl_number_q,
  _fl_string_q,
  _fl_list_q,
  _fl_map_q,
  _fl_fn_q,
  _fl_length,
  _fl_first,
  _fl_last,
  _fl_rest,
  _fl_append,
  _fl_get,
  _fl_map_set,
  _fl_keys,
  _fl_str,
  _fl_lower,
  _fl_upper,
  _fl_trim,
  _fl_contains_q,
  _fl_is_alpha_q,
  _fl_is_digit_q,
  _fl_is_alnum_q,
  _fl_is_space_q,
  _fl_is_symbol_char_q,
  _fl_map,
  _fl_filter,
  _fl_reduce,
  _fl_empty_q,
  _fl_has_key_q,
  _fl_print,
  _fl_array_q,
  _fl_request,
  _fl_response,
  _fl_wait_and_respond,
};

export default RUNTIME_HELPERS;
