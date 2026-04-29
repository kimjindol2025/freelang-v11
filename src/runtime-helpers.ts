// FreeLang v11 Runtime Helpers
// 자가 호스팅 및 런타임 실행을 위한 필수 JS 함수들

export function generateRuntimePreamble(): string {
  return `
// ═══════════════════════════════════════════════════════
// FreeLang v11 Runtime Helpers (auto-generated 2026-04-29)
// ═══════════════════════════════════════════════════════

// ─ 타입 체크 ─
function _fl_null_q(v) { return v === null || v === undefined; }
function _fl_true_q(v) { return v === true; }
function _fl_false_q(v) { return v === false; }
function _fl_number_q(v) { return typeof v === 'number'; }
function _fl_string_q(v) { return typeof v === 'string'; }
function _fl_list_q(v) { return Array.isArray(v); }
function _fl_array_q(v) { return Array.isArray(v); }
function _fl_map_q(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function _fl_fn_q(v) { return typeof v === 'function'; }

// ─ 데이터 접근 및 조작 ─
function _fl_length(v) { if(v==null) return 0; return v.length !== undefined ? v.length : 0; }
function _fl_get(obj, key, dflt) {
  if (obj === null || obj === undefined) return dflt || null;
  if (obj instanceof Map) return obj.has(key) ? obj.get(key) : (dflt || null);
  
  let k = (typeof key === "object" && key !== null) ? (key.name || key.value || String(key)) : String(key);
  if (k.startsWith(":")) k = k.slice(1);

  if (Array.isArray(obj)) {
    if (typeof key === "number") return obj[key] !== undefined ? obj[key] : (dflt || null);
    if (k === "length") return obj.length;
    // 인덱스가 숫자가 아닐 때 (문자열로 들어온 경우) 처리
    let idx = parseInt(k);
    if (!isNaN(idx)) return obj[idx] !== undefined ? obj[idx] : (dflt || null);
  }
  
  if (typeof obj === "object") {
    if (obj[k] !== undefined) return obj[k];
    // 혹시라도 콜론이 포함된 키로 저장되어 있을 경우 대비
    if (obj[":" + k] !== undefined) return obj[":" + k];
  }
  return dflt || null;
}
function _fl_first(l) { return (l && l.length > 0) ? l[0] : null; }
function _fl_last(l) { return (l && l.length > 0) ? l[l.length - 1] : null; }
function _fl_rest(l) { return (l && l.length > 0) ? l.slice(1) : []; }
function _fl_append(l, x) { return [...(l || []), x]; }
function _fl_keys(o) { return o ? Object.keys(o) : []; }
function _fl_map_set(o, k, v) { return {...o, [k]: v}; }
function _fl_has_key_q(o, k) { return o ? (String(k) in o) : false; }

// ─ 문자열 조작 ─
function _fl_str(...xs) { return xs.map(x => x === null || x === undefined ? "" : (typeof x === "object" ? JSON.stringify(x) : String(x))).join(""); }
function _fl_char_at(s, i) { return (s && s[i]) || null; }
function _fl_substring(s, a, b) { return s ? (b === undefined ? s.slice(a) : s.slice(a, b)) : ""; }
function _fl_lower(s) { return String(s || "").toLowerCase(); }
function _fl_upper(s) { return String(s || "").toUpperCase(); }
function _fl_trim(s) { return String(s || "").trim(); }

// ─ 고차 함수 (Null-safe & Spread) ─
function _fl_map(arr, fn) { return (arr || []).map(x => fn(x)); }
function _fl_filter(arr, fn) { return (arr || []).filter(x => { const r = fn(x); return r !== false && r !== null; }); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce((a, x) => fn(a, x), init); }

// ─ 데이터 접근 및 조작 보조 ─
function _fl_slice(l, a, b) { return (l || []).slice(a, b); }

// ─ 시스템 및 I/O ─
function _fl_print(v) { console.log(v); return v; }
function _fl_get_argv() { return (typeof process !== "undefined" ? process.argv.slice(2) : []); }
function _fl_file_read(p) { return require("fs").readFileSync(p, "utf8"); }
function _fl_file_write(p, c) { return require("fs").writeFileSync(p, c); }
function _fl_file_exists(p) { return require("fs").existsSync(p); }
function _fl_shell_capture(cmd) {
  try {
    const {execSync} = require("child_process");
    return {stdout: execSync(cmd, {encoding: "utf8"}), stderr: "", code: 0, ok: true};
  } catch(e) {
    return {stdout: "", stderr: String(e), code: 1, ok: false};
  }
}

// ─ 기타 ─
function _while(condFn, bodyFn) { while(condFn()) { bodyFn(); } }

// ═══════════════════════════════════════════════════════
`.trim();
}

