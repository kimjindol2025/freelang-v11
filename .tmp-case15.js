// ═══════════════════════════════════════════════════════
// FreeLang v11 Runtime Helpers (Enhanced 2026-04-30)
// ═══════════════════════════════════════════════════════

// ─ 산술 및 논리 연산자 (stdlib) ─
function _plus(...args) { if (args.length === 0) return 0; if (args.length === 1) return args[0]; return args.reduce((a, b) => a + b); }
function _minus(...args) { if (args.length === 0) return 0; if (args.length === 1) return -args[0]; return args.reduce((a, b) => a - b); }
function _star(...args) { if (args.length === 0) return 1; if (args.length === 1) return args[0]; return args.reduce((a, b) => a * b); }
function _slash(...args) { if (args.length === 0) return 1; if (args.length === 1) return 1/args[0]; return args.reduce((a, b) => a / b); }
function _gt(a, b) { return a > b; }
function _lt(a, b) { return a < b; }
function _eq(a, b) { return a === b; }
function _gt_eq(a, b) { return a >= b; }
function _lt_eq(a, b) { return a <= b; }
function _not(a) { return !a; }
function _and(...args) { for(let a of args) if(!a) return false; return args.length > 0 ? args[args.length-1] : true; }
function _or(...args) { for(let a of args) if(a) return a; return false; }
function _concat(...args) { 
  if (args.length === 0) return "";
  if (Array.isArray(args[0])) return [].concat(...args);
  return args.join("");
}

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
    let idx = parseInt(k);
    if (!isNaN(idx)) return obj[idx] !== undefined ? obj[idx] : (dflt || null);
  }
  
  if (typeof obj === "object") {
    if (obj[k] !== undefined) return obj[k];
    if (obj[":" + k] !== undefined) return obj[":" + k];
  }
  return dflt || null;
}
function _fl_first(l) { return (l && l.length > 0) ? l[0] : null; }
function _fl_last(l) { return (l && l.length > 0) ? l[l.length - 1] : null; }
function _fl_rest(l) { return (l && l.length > 0) ? l.slice(1) : []; }
function _fl_append(l, x) { return [...(l || []), x]; }
function _fl_keys(o) { return o ? Object.keys(o) : []; }
function _fl_values(o) { return o ? Object.values(o) : []; }
function _fl_entries(o) { return o ? Object.entries(o).map(([k,v])=>[k,v]) : []; }
function _fl_map_set(o, k, v) { return {...o, [k]: v}; }
function _fl_has_key_q(o, k) { return o ? (String(k) in o) : false; }

// ─ 문자열 조작 ─
function _fl_str(...xs) { return xs.map(x => x === null || x === undefined ? "" : (typeof x === "object" ? JSON.stringify(x) : String(x))).join(""); }
function _fl_char_at(s, i) { return (s && s[i]) || null; }
function _fl_substring(s, a, b) { return s ? (b === undefined ? s.slice(a) : s.slice(a, b)) : ""; }
function _fl_lower(s) { return String(s || "").toLowerCase(); }
function _fl_upper(s) { return String(s || "").toUpperCase(); }
function _fl_trim(s) { return String(s || "").trim(); }
function _fl_replace(s, a, b) { return String(s || "").split(a).join(b); }
function _fl_str_index_of(s, sub) { return (s || "").indexOf(sub); }
function _fl_contains_q(s, sub) { return (s || "").includes(sub); }
function _fl_join(arr, sep) { return (arr || []).join(sep !== undefined ? sep : ""); }
function _fl_split(s, sep) { return (s || "").split(sep !== undefined ? sep : ""); }
function _fl_repeat(s, n) { return (s || "").repeat(n || 0); }
function _fl_range(a, b, s) { let r = []; let start = b === undefined ? 0 : a; let end = b === undefined ? a : b; let step = s || 1; if (step > 0) { for (let i = start; i < end; i += step) r.push(i); } else { for (let i = start; i > end; i += step) r.push(i); } return r; }

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

// ─ 시간 ─
const now_ms = () => Date.now();
const now_iso = () => new Date().toISOString();
const now_unix = () => Math.floor(Date.now() / 1000);

// ─ 셸 실행 ─
const shell_exec = (cmd, inp) => { try { const {execSync} = require("child_process"); const opts = {encoding: "utf8"}; if (inp) opts["input"] = inp; return execSync(cmd, opts); } catch(e) { return ""; } };

// ─ 수학 ─
var math_sqrt = (n) => Math.sqrt(n);
var math_pow = (a, b) => Math.pow(a, b);
var math_pi = Math.PI;

// ─ 컬렉션 확장 ─
var take = (n, arr) => (arr || []).slice(0, n);
var drop = (n, arr) => (arr || []).slice(n);
var zip = (a, b) => { const r = []; const l = Math.min((a || []).length, (b || []).length); for (let i = 0; i < l; i++) r.push([a[i], b[i]]); return r; };
var flatten = (arr) => (arr || []).flat();
var sort = (arr, fn) => fn ? [...(arr || [])].sort((a, b) => fn(a, b) ? -1 : 1) : [...(arr || [])].sort();

// ─ 문자열 확장 ─
var str_upper = (s) => String(s || "").toUpperCase();
var str_lower = (s) => String(s || "").toLowerCase();
var str_contains = (s, sub) => String(s || "").includes(String(sub || ""));
var str_replace = (s, a, b) => { if (s == null) return ""; return String(s).split(String(a || "")).join(String(b || "")); };
var str_starts_with = (s, p) => String(s || "").startsWith(String(p || ""));
var str_ends_with = (s, sf) => String(s || "").endsWith(String(sf || ""));
var str_trim = (s) => String(s || "").trim();
var str_length = (s) => String(s || "").length;
var str_split = (s, sep) => String(s || "").split(sep);

// ─ 타입 확장 ─
const list_q = (v) => Array.isArray(v);
const map_q = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const fn_q = (v) => typeof v === "function";

// ─ IIFE 폴백 ─
var unknown = (...a) => a[a.length - 1];

// ─ 글로벌 바인딩 ─
let __argv__ = _fl_get_argv();

// ═══════════════════════════════════════════════════════

function _fl_map(arr, fn) { return (arr || []).map(fn); }
function _fl_filter(arr, fn) { return (arr || []).filter(fn); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce(fn, init); }
function _fl_print(v) { console.log(v); return v; }

const _fl_entries = (m) => _fl_map(_fl_keys(m), ((k) => [k, _fl_get(m, k)]))
const prompt_template = (template, vars) => _fl_reduce(_fl_entries(vars), ((acc, array) => str_replace(acc, _fl_str("{", key, "}"), _fl_str(val))), template)
const test_ai_template = () => _fl_print([prompt_template("User: {user}", ({ user: "Alice" }))])
test_ai_template()