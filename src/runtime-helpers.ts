/**
 * FreeLang v11 Runtime Helpers Preamble Generator
 * codegen-js.ts가 각 생성 파일의 헤더에 주입하는 헬퍼 함수 모음
 */

export function generateRuntimePreamble(): string {
  return `
// ═══════════════════════════════════════════════════════
// FreeLang v11 Runtime Helpers (auto-generated 2026-04-29)
// ═══════════════════════════════════════════════════════

// ─ 타입 체크 (9개) ─
function _fl_null_q(v) { return v === null || v === undefined; }
function _fl_true_q(v) { return v === true; }
function _fl_false_q(v) { return v === false; }
function _fl_number_q(v) { return typeof v === 'number'; }
function _fl_string_q(v) { return typeof v === 'string'; }
function _fl_list_q(v) { return Array.isArray(v); }
function _fl_array_q(v) { return Array.isArray(v); }
function _fl_map_q(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function _fl_fn_q(v) { return typeof v === 'function'; }

// ─ 배열 조작 (8개) ─
function _fl_length(arr) { return Array.isArray(arr) ? arr.length : (typeof arr === 'string' ? arr.length : 0); }
function _fl_first(arr) { return Array.isArray(arr) ? arr[0] : null; }
function _fl_last(arr) { return Array.isArray(arr) ? arr[arr.length - 1] : null; }
function _fl_rest(arr) { return Array.isArray(arr) ? arr.slice(1) : []; }
function _fl_append(arr, item) { return Array.isArray(arr) ? [...arr, item] : [item]; }
function _fl_get(obj, key, dflt) {
  if (Array.isArray(obj) && typeof key === 'number') return obj[key] !== undefined ? obj[key] : (dflt || null);
  if (typeof obj === 'object' && obj !== null) return obj[String(key)] !== undefined ? obj[String(key)] : (dflt || null);
  return dflt || null;
}
function _fl_map_set(obj, key, val) { return { ...obj, [String(key)]: val }; }
function _fl_keys(obj) { return typeof obj === 'object' && obj !== null ? Object.keys(obj) : []; }

// ─ 문자열 조작 (5개) ─
function _fl_str(...args) { return args.map(v => v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(''); }
function _fl_lower(s) { return String(s).toLowerCase(); }
function _fl_upper(s) { return String(s).toUpperCase(); }
function _fl_trim(s) { return String(s).trim(); }
function _fl_contains_q(s, sub) { return String(s).includes(String(sub)); }

// ─ 문자 분류 (5개) ─
function _fl_is_alpha_q(c) { const ch = String(c)[0]; return /[a-zA-Z]/.test(ch); }
function _fl_is_digit_q(c) { const ch = String(c)[0]; return /[0-9]/.test(ch); }
function _fl_is_alnum_q(c) { const ch = String(c)[0]; return /[a-zA-Z0-9]/.test(ch); }
function _fl_is_space_q(c) { const ch = String(c)[0]; return /\\s/.test(ch); }
function _fl_is_symbol_char_q(c) { const ch = String(c)[0]; return /[!@#$%^&*\\-_+=]/.test(ch); }

// ─ 고차 함수 (3개) ─
function _fl_map(fn, arr) { return arr.map(item => fn([item])); }
function _fl_filter(arr, fn) { return arr.filter(item => { const res = fn([item]); return res !== false && res !== null; }); }
function _fl_reduce(fn, init, arr) { return arr.reduce((acc, item) => fn([acc, item]), init); }

// ─ 조건부 & I/O (4개) ─
function _fl_empty_q(v) { if (v === null || v === undefined) return true; if (Array.isArray(v)) return v.length === 0; if (typeof v === 'object') return Object.keys(v).length === 0; return v === ''; }
function _fl_has_key_q(obj, key) { return typeof obj === 'object' && obj !== null && String(key) in obj; }
function _fl_print(msg) { console.log(msg); return msg; }
function _fl_request(obj) { return obj; }
function _fl_response(obj) { return obj; }
function _fl_wait_and_respond(fn) { return fn([]); }

// ═══════════════════════════════════════════════════════
`.trim();
}
