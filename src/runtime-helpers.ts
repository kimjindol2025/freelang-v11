/**
 * src/runtime-helpers.ts
 *
 * Runtime helper functions for FreeLang self-hosting
 * Used in generated JavaScript code from stage1.js
 */

/**
 * 런타임 헬퍼 함수 프리앰플 생성
 * Stage1.js 최상단에 주입되어 JavaScript 코드 실행 지원
 */
export function generateRuntimePreamble(): string {
  return `
// ===== FreeLang Runtime Helpers =====
function _fl_null_q(x) { return x === null || x === undefined; }
function _fl_true_q(x) { return x === true; }
function _fl_false_q(x) { return x === false; }
function _fl_number_q(x) { return typeof x === 'number'; }
function _fl_string_q(x) { return typeof x === 'string'; }
function _fl_list_q(x) { return Array.isArray(x); }
function _fl_array_q(x) { return Array.isArray(x); }
function _fl_map_q(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function _fl_fn_q(x) { return typeof x === 'function' || (x && x.kind === 'function-value'); }
function _fl_empty_q(x) { return x === null || x === undefined || (Array.isArray(x) ? x.length === 0 : typeof x === 'object' ? Object.keys(x).length === 0 : typeof x === 'string' ? x.length === 0 : false); }
function _fl_length(x) { return x && typeof x.length === 'number' ? x.length : Array.isArray(x) ? x.length : 0; }
function _fl_get(obj, key) { return obj && obj[key] !== undefined ? obj[key] : null; }
function _fl_str(...parts) { return parts.map(p => p === null || p === undefined ? '' : String(p)).join(''); }
function _fl_first(arr) { return Array.isArray(arr) && arr.length > 0 ? arr[0] : null; }
function _fl_last(arr) { return Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null; }
function _fl_rest(arr) { return Array.isArray(arr) ? arr.slice(1) : []; }
function _fl_append(arr, ...items) { return Array.isArray(arr) ? [...arr, ...items] : [arr, ...items]; }
function _fl_map(fn, arr) { return Array.isArray(arr) ? arr.map(x => typeof fn === 'function' ? fn(x) : null) : []; }
function _fl_filter(arr, fn) { return Array.isArray(arr) ? arr.filter(x => typeof fn === 'function' ? fn(x) : false) : []; }
function _fl_reduce(fn, init, arr) { return Array.isArray(arr) ? arr.reduce((acc, x) => typeof fn === 'function' ? fn(acc, x) : acc, init) : init; }
function _fl_contains_q(arr, item) { return Array.isArray(arr) ? arr.includes(item) : false; }
function _fl_keys(obj) { return obj && typeof obj === 'object' ? Object.keys(obj) : []; }
function _fl_has_key_q(obj, key) { return obj && obj.hasOwnProperty(key); }
function _fl_map_set(obj, key, val) { return Object.assign({}, obj, { [key]: val }); }
function _fl_upper(s) { return typeof s === 'string' ? s.toUpperCase() : String(s); }
function _fl_lower(s) { return typeof s === 'string' ? s.toLowerCase() : String(s); }
function _fl_trim(s) { return typeof s === 'string' ? s.trim() : String(s); }
function _fl_is_digit_q(c) { return c && c >= '0' && c <= '9'; }
function _fl_is_alpha_q(c) { return c && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')); }
function _fl_is_alnum_q(c) { return _fl_is_digit_q(c) || _fl_is_alpha_q(c); }
function _fl_is_space_q(c) { return c === ' ' || c === '\\t' || c === '\\n' || c === '\\r'; }
function _fl_is_symbol_char_q(c) { return c && /[a-zA-Z0-9_\\-?!\\/<>=+*%&|^~.]/.test(c); }
function _fl_print(...args) { console.log(...args); return null; }
// ===== End Runtime Helpers =====
`;
}

export const HELPER_FUNCTIONS = [
  '_fl_null_q', '_fl_true_q', '_fl_false_q', '_fl_number_q', '_fl_string_q',
  '_fl_list_q', '_fl_array_q', '_fl_map_q', '_fl_fn_q', '_fl_empty_q',
  '_fl_length', '_fl_get', '_fl_str', '_fl_first', '_fl_last', '_fl_rest',
  '_fl_append', '_fl_map', '_fl_filter', '_fl_reduce', '_fl_contains_q',
  '_fl_keys', '_fl_has_key_q', '_fl_map_set', '_fl_upper', '_fl_lower', '_fl_trim',
  '_fl_is_digit_q', '_fl_is_alpha_q', '_fl_is_alnum_q', '_fl_is_space_q',
  '_fl_is_symbol_char_q', '_fl_print',
];

export const HELPER_COUNT = HELPER_FUNCTIONS.length;
