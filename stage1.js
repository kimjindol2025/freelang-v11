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
function _fl_concat(a, b) { return Array.isArray(a) && Array.isArray(b) ? [...a, ...b] : String(a || "") + String(b || ""); }
function _fl_keys(o) { return o ? Object.keys(o) : []; }
function _fl_values(o) { return o ? Object.values(o) : []; }
var _fl_entries = (o) => o ? Object.entries(o).map(([k,v]) => [k,v]) : [];
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
function _fl_str_to_num(s) { const n = Number(s); return isNaN(n) ? null : n; }
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
function _fl_file_delete(p) { try { require("fs").unlinkSync(p); } catch(e) {} }
function _fl_file_append(p, c) { require("fs").appendFileSync(p, String(c)); }
function _fl_file_copy(s, d) { require("fs").copyFileSync(s, d); }
function _fl_file_rename(o, n) { require("fs").renameSync(o, n); }
function _fl_file_size(p) { try { return require("fs").statSync(p).size; } catch(e) { return 0; } }
function _fl_file_modified(p) { try { return require("fs").statSync(p).mtimeMs; } catch(e) { return 0; } }
function _fl_file_mkdir(p) { try { require("fs").mkdirSync(p, { recursive: true }); } catch(e) {} }
function _fl_file_rmdir(p) { try { require("fs").rmSync(p, { recursive: true, force: true }); } catch(e) {} }
function _fl_file_list(p) { try { return require("fs").readdirSync(p); } catch(e) { return []; } }
function _fl_process_run(cmd) { try { const {execSync}=require("child_process"); return execSync(cmd,{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_run_args(cmd, args) { try { const {execSync}=require("child_process"); return execSync(cmd+" "+(args||[]).join(" "),{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_exec(cmd) { try { const {execSync}=require("child_process"); return execSync(cmd,{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_exec_args(cmd, args) { try { const {execSync}=require("child_process"); return execSync(cmd+" "+(args||[]).join(" "),{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_spawn(cmd, args) { try { const {spawnSync}=require("child_process"); const r=spawnSync(cmd,args||[],{encoding:"utf8"}); return r.stdout||""; } catch(e) { return ""; } }
function _fl_process_kill(pid) { try { process.kill(pid); } catch(e) {} }
function _fl_process_wait(pid) { return null; }
function _fl_env_get(k) { return process.env[k] || null; }
function _fl_env_set(k, v) { process.env[k] = String(v); }
function _fl_env_all() { return process.env; }
function _fl_file_is_file(p) { try { return require("fs").statSync(p).isFile(); } catch(e) { return false; } }
function _fl_file_is_dir(p) { try { return require("fs").statSync(p).isDirectory(); } catch(e) { return false; } }
function _fl_process_exists(pid) { try { process.kill(pid, 0); return true; } catch(e) { return false; } }
function _fl_process_getcwd() { return process.cwd(); }
function _fl_process_chdir(p) { try { process.chdir(p); } catch(e) {} }
function _fl_process_pid() { return process.pid; }
function _fl_process_ppid() { return process.ppid || null; }
function _fl_readline(prompt) {
  if (prompt) process.stdout.write(prompt);
  try {
    const fs = require("fs");
    const parts = [];
    const b = Buffer.alloc(1);
    while (true) {
      const n = fs.readSync(process.stdin.fd, b, 0, 1);
      if (n === 0) return parts.length === 0 ? null : parts.join("");
      const c = b[0];
      if (c === 10) break;
      if (c !== 13) parts.push(String.fromCharCode(c));
    }
    return parts.join("");
  } catch(e) { return null; }
}
function _fl_shell_capture(cmd) {
  try {
    const {execSync} = require("child_process");
    return {stdout: execSync(cmd, {encoding: "utf8"}), stderr: "", code: 0, ok: true};
  } catch(e) {
    return {stdout: "", stderr: String(e), code: 1, ok: false};
  }
}

// ─ 타입 ─
function _fl_type_of(v) { if (v === null || v === undefined) return "nil"; if (Array.isArray(v)) return "list"; return typeof v; }

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
var round = (n) => Math.round(n);
var floor = (n) => Math.floor(n);
var ceil = (n) => Math.ceil(n);
var abs = (n) => Math.abs(n);
var min = (...args) => Math.min(...args);
var max = (...args) => Math.max(...args);

// ─ 컬렉션 확장 ─
function _fl_take(n, arr) { return (arr || []).slice(0, n); }
function _fl_drop(n, arr) { return (arr || []).slice(n); }
function _fl_zip(a, b) { const r = []; const l = Math.min((a || []).length, (b || []).length); for (let i = 0; i < l; i++) r.push([a[i], b[i]]); return r; }
function _fl_flatten(arr) { return (arr || []).flat(); }
function _fl_reverse(arr) { return Array.isArray(arr) ? [...arr].reverse() : arr; }
function _fl_sort(arr, fn) { return fn ? [...(arr || [])].sort((a, b) => fn(a, b) ? -1 : 1) : [...(arr || [])].sort(); }

// ─ 문자열 공개 별칭 ─
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
var list_q = (v) => Array.isArray(v);
var map_q = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var fn_q = (v) => typeof v === "function";

// ─ IIFE 폴백 ─
var unknown = (...a) => a[a.length - 1];

// ─ 글로벌 바인딩 ─
let __argv__ = _fl_get_argv();

// ═══════════════════════════════════════════════════════

function _fl_map(arr, fn) { return (arr || []).map(fn); }
function _fl_filter(arr, fn) { return (arr || []).filter(fn); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce(fn, init); }
function _fl_print(v) { console.log(v); return v; }

const _fl_is_digit_q = (c) => (_fl_null_q(c) ? false : ((c >= "0") && (c <= "9")));
const _fl_is_alpha_q = (c) => (_fl_null_q(c) ? false : (((c >= "a") && (c <= "z")) || ((c >= "A") && (c <= "Z"))));
const _fl_is_alnum_q = (c) => (_fl_is_digit_q(c) || _fl_is_alpha_q(c));
const _fl_is_space_q = (c) => ((c === " ") || (c === "\t") || (c === "\n") || (c === "\r"));
const _fl_is_symbol_char_q = (c) => (_fl_null_q(c) ? false : (_fl_is_alnum_q(c) || (c === "-") || (c === "_") || (c === "?") || (c === "!") || (c === "/") || (c === ".") || (c === "<") || (c === ">") || (c === "=") || (c === "+") || (c === "*") || (c === "%") || (c === "&") || (c === "|") || (c === "^") || (c === "~")));
const make_state = (src) => ({ src: src, idx: 0, line: 1, col: 1, tokens: [] });
const peek_at = (st, offset) => ((() => { let src = _fl_get(st, "src"); let i = (_fl_get(st, "idx") + offset); return ((i >= _fl_length(src)) ? null : _fl_char_at(src, i)); })());
const peek = (st) => peek_at(st, 0);
const at_end_q = (st) => (_fl_get(st, "idx") >= _fl_length(_fl_get(st, "src")));
const advance = (st) => ((() => { let c = peek(st); return ((c === "\n") ? ({ src: _fl_get(st, "src"), idx: (_fl_get(st, "idx") + 1), line: (_fl_get(st, "line") + 1), col: 1, tokens: _fl_get(st, "tokens") }) : ({ src: _fl_get(st, "src"), idx: (_fl_get(st, "idx") + 1), line: _fl_get(st, "line"), col: (_fl_get(st, "col") + 1), tokens: _fl_get(st, "tokens") })); })());
const emit = (st, kind, value, sl, sc) => ({ src: _fl_get(st, "src"), idx: _fl_get(st, "idx"), line: _fl_get(st, "line"), col: _fl_get(st, "col"), tokens: _fl_append(_fl_get(st, "tokens"), ({ kind: kind, type: kind, value: value, line: sl, col: sc })) });
const skip_comment_loop = (cur) => ((at_end_q(cur) || (peek(cur) === "\n")) ? (at_end_q(cur) ? cur : advance(cur)) : skip_comment_loop(advance(cur)));
const skip_comment = (st) => skip_comment_loop(st);
const skip_ws_loop = (cur) => (at_end_q(cur) ? cur : ((() => { let c = peek(cur); return (_fl_is_space_q(c) ? skip_ws_loop(advance(cur)) : ((c === ";") ? skip_ws_loop(skip_comment(cur)) : (true ? cur : null))); })()));
const skip_ws = (st) => skip_ws_loop(st);
const read_number_iter = (cur, res_acc, dot, line, col) => (at_end_q(cur) ? emit(cur, "Number", res_acc, line, col) : ((() => { let c = peek(cur); return (_fl_is_digit_q(c) ? read_number_iter(advance(cur), _fl_str(res_acc, c), dot, line, col) : (((c === ".") && (!dot)) ? read_number_iter(advance(cur), _fl_str(res_acc, c), true, line, col) : (true ? emit(cur, "Number", res_acc, line, col) : null))); })()));
const read_number_body = (st, acc, has_dot, line, col) => read_number_iter(st, acc, has_dot, line, col);
const read_number = (st) => read_number_body(st, "", false, _fl_get(st, "line"), _fl_get(st, "col"));
const translate_esc = (c) => ((c === "n") ? "\n" : ((c === "t") ? "\t" : ((c === "r") ? "\r" : ((c === "\"") ? "\"" : ((c === "\\") ? "\\" : (true ? c : null))))));
const read_string_iter = (cur, res_acc, line, col) => (at_end_q(cur) ? emit(cur, "String", res_acc, line, col) : ((() => { let c = peek(cur); return ((c === "\"") ? emit(advance(cur), "String", res_acc, line, col) : ((c === "\\") ? ((() => { let st2 = advance(cur); let c2 = peek(st2); return read_string_iter(advance(st2), _fl_str(res_acc, translate_esc(c2)), line, col); })()) : (true ? read_string_iter(advance(cur), _fl_str(res_acc, c), line, col) : null))); })()));
const read_string_body = (st, acc, line, col) => read_string_iter(st, acc, line, col);
const read_string = (st) => ((() => { let line = _fl_get(st, "line"); let col = _fl_get(st, "col"); let st1 = advance(st); return read_string_body(st1, "", line, col); })());
const read_symbol_iter = (cur, res_acc, line, col, kind) => (at_end_q(cur) ? emit(cur, kind, res_acc, line, col) : ((() => { let c = peek(cur); return (_fl_is_symbol_char_q(c) ? read_symbol_iter(advance(cur), _fl_str(res_acc, c), line, col, kind) : emit(cur, kind, res_acc, line, col)); })()));
const read_symbol_body_kind = (st, acc, line, col, kind) => read_symbol_iter(st, acc, line, col, kind);
const read_symbol = (st) => read_symbol_body_kind(st, "", _fl_get(st, "line"), _fl_get(st, "col"), "Symbol");
const read_variable = (st) => ((() => { let line = _fl_get(st, "line"); let col = _fl_get(st, "col"); let st1 = advance(st); return read_symbol_body_kind(st1, "", line, col, "Variable"); })());
const read_keyword = (st) => ((() => { let line = _fl_get(st, "line"); let col = _fl_get(st, "col"); let st1 = advance(st); return read_symbol_body_kind(st1, "", line, col, "Keyword"); })());
const read_token = (st) => ((() => { let st1 = skip_ws(st); return (at_end_q(st1) ? st1 : ((() => { let c = peek(st1); let line = _fl_get(st1, "line"); let col = _fl_get(st1, "col"); return ((c === "(") ? emit(advance(st1), "LParen", c, line, col) : ((c === ")") ? emit(advance(st1), "RParen", c, line, col) : ((c === "[") ? emit(advance(st1), "LBracket", c, line, col) : ((c === "]") ? emit(advance(st1), "RBracket", c, line, col) : ((c === "{") ? emit(advance(st1), "LBrace", c, line, col) : ((c === "}") ? emit(advance(st1), "RBrace", c, line, col) : ((c === "\"") ? read_string(st1) : ((c === "$") ? read_variable(st1) : ((c === ":") ? read_keyword(st1) : (_fl_is_digit_q(c) ? read_number(st1) : (((c === "-") && _fl_is_digit_q(peek_at(st1, 1))) ? read_number_body(advance(st1), "-", false, line, col) : (_fl_is_symbol_char_q(c) ? read_symbol(st1) : (true ? emit(advance(st1), "Unknown", c, line, col) : null))))))))))))); })())); })());
const lex_loop = (cur) => ((() => { let ws = skip_ws(cur); return (at_end_q(ws) ? _fl_get(ws, "tokens") : lex_loop(read_token(ws))); })());
const lex = (src) => lex_loop(make_state(src));
const make_literal = (type, value, line) => ({ kind: "literal", type: type, value: value, line: line });
const make_variable = (name, line) => ({ kind: "variable", name: name, line: line });
const make_keyword = (name, line) => ({ kind: "keyword", name: name, line: line });
const make_sexpr = (op, args, line) => ({ kind: "sexpr", op: op, args: args, line: line });
const make_number = (v, line) => make_literal("number", v, line);
const make_string = (v, line) => make_literal("string", v, line);
const make_bool = (v, line) => make_literal("boolean", v, line);
const make_null = (line) => make_literal("null", null, line);
const make_symbol = (v, line) => make_literal("symbol", v, line);
const make_block = (type, name, fields, line) => ({ kind: "block", type: type, name: name, fields: fields, line: line });
const make_array_block = (items, line) => make_block("Array", null, ({ items: items }), line);
const make_map_block = (items, line) => make_block("Map", null, ({ items: items }), line);
const make_pattern_literal = (value, line) => ({ kind: "pattern-literal", value: value, line: line });
const make_pattern_variable = (name, line) => ({ kind: "pattern-variable", name: name, line: line });
const make_pattern_wildcard = (line) => ({ kind: "pattern-wildcard", line: line });
const make_pattern_list = (items, _fl_rest, line) => ({ kind: "pattern-list", items: items, rest: _fl_rest, line: line });
const make_pattern_struct = (type_name, fields, line) => ({ kind: "pattern-struct", type: type_name, fields: fields, line: line });
const make_pattern_or = (alternatives, line) => ({ kind: "pattern-or", alternatives: alternatives, line: line });
const make_pattern_range = (start, end, line) => ({ kind: "pattern-range", start: start, end: end, line: line });
const make_pattern_match = (value, cases, line) => ({ kind: "pattern-match", value: value, cases: cases, line: line });
const make_match_case = (pattern, guard, body, line) => ({ kind: "match-case", pattern: pattern, guard: guard, body: body, line: line });
const make_function_value = (params, body, captured_env, name) => ({ kind: "function-value", params: params, body: body, capturedEnv: captured_env, name: name });
const make_type_class = (name, generics, methods, line) => ({ kind: "type-class", name: name, generics: generics, methods: methods, line: line });
const make_type_class_instance = (class_name, type_name, impls, line) => ({ kind: "type-class-instance", class: class_name, type: type_name, impls: impls, line: line });
const make_module_block = (name, exports, body, line) => ({ kind: "module", name: name, exports: exports, body: body, line: line });
const make_import_block = (path, alias, names, line) => ({ kind: "import", path: path, alias: alias, names: names, line: line });
const make_open_block = (module_name, line) => ({ kind: "open", module: module_name, line: line });
const make_search_block = (query, fields, line) => ({ kind: "search-block", query: query, fields: fields, line: line });
const make_learn_block = (topic, fields, line) => ({ kind: "learn-block", topic: topic, fields: fields, line: line });
const make_reasoning_block = (name, fields, line) => ({ kind: "reasoning-block", name: name, fields: fields, line: line });
const make_async_function = (name, params, body, line) => ({ kind: "async-function", name: name, params: params, body: body, line: line });
const make_await = (expr, line) => ({ kind: "await", expr: expr, line: line });
const make_try = (body, _catch, _finally, line) => ({ kind: "try", body: body, catch: _catch, finally: _finally, line: line });
const make_catch = (param, body, line) => ({ kind: "catch", param: param, body: body, line: line });
const make_throw = (expr, line) => ({ kind: "throw", expr: expr, line: line });
const make_template_string = (parts, expressions, line) => ({ kind: "template-string", parts: parts, expressions: expressions, line: line });
const make_loop = (init, condition, update, body, line) => ({ kind: "loop", init: init, condition: condition, update: update, body: body, line: line });
const make_page = (name, path, fields, line) => ({ kind: "page", name: name, path: path, fields: fields, line: line });
const make_route = (method, path, handler, line) => ({ kind: "route", method: method, path: path, handler: handler, line: line });
const make_component = (name, fields, line) => ({ kind: "component", name: name, fields: fields, line: line });
const make_form = (name, fields, line) => ({ kind: "form", name: name, fields: fields, line: line });
const deep_equal_q = (a, b) => ((_fl_null_q(a) && _fl_null_q(b)) ? true : ((_fl_null_q(a) || _fl_null_q(b)) ? false : ((_fl_list_q(a) && _fl_list_q(b)) ? deep_equal_list_q(a, b, 0) : ((_fl_map_q(a) && _fl_map_q(b)) ? deep_equal_map_q(a, b) : (true ? (a === b) : null)))));
const deep_equal_list_q = (a, b, i) => ((!(_fl_length(a) === _fl_length(b))) ? false : ((i >= _fl_length(a)) ? true : ((!deep_equal_q(_fl_get(a, i), _fl_get(b, i))) ? false : (true ? deep_equal_list_q(a, b, (i + 1)) : null))));
const deep_equal_map_q = (a, b) => ((() => { let ka = keys_no_line(a); let kb = keys_no_line(b); return ((!(_fl_length(ka) === _fl_length(kb))) ? false : deep_equal_map_keys_q(a, b, ka, 0)); })());
const keys_no_line = (m) => _fl_filter(_fl_keys(m), ((k) => (!(k === "line"))));
const deep_equal_map_keys_q = (a, b, ks, i) => ((i >= _fl_length(ks)) ? true : (((() => { let k = _fl_get(ks, i); return (!deep_equal_q(_fl_get(a, k), _fl_get(b, k))); })()) ? false : (true ? deep_equal_map_keys_q(a, b, ks, (i + 1)) : null)));
const json_keys = (m) => obj_keys(m);
const p_make = (tokens) => ({ tokens: tokens, idx: 0, ast: [] });
const p_peek = (p) => ((() => { let i = _fl_get(p, "idx"); let t = _fl_get(p, "tokens"); return ((i >= _fl_length(t)) ? null : _fl_get(t, i)); })());
const p_peek_at = (p, offset) => ((() => { let i = (_fl_get(p, "idx") + offset); let t = _fl_get(p, "tokens"); return ((i >= _fl_length(t)) ? null : _fl_get(t, i)); })());
const p_end_q = (p) => (_fl_get(p, "idx") >= _fl_length(_fl_get(p, "tokens")));
const p_advance = (p) => ({ tokens: _fl_get(p, "tokens"), idx: (_fl_get(p, "idx") + 1), ast: _fl_get(p, "ast") });
const p_with_ast = (p, ast) => ({ tokens: _fl_get(p, "tokens"), idx: _fl_get(p, "idx"), ast: ast });
const p_append_ast = (p, node) => p_with_ast(p, _fl_append(_fl_get(p, "ast"), node));
const r_pair = (p, node) => ({ p: p, node: node });
const string_contains_q = (s, substr) => (!(-1 === _fl_str_index_of(s, substr)));
const parse_atom = (p) => ((() => { let t = p_peek(p); let k = _fl_get(t, "kind"); let v = _fl_get(t, "value"); let line = _fl_get(t, "line"); return ((k === "Number") ? r_pair(p_advance(p), make_literal("number", v, line)) : ((k === "String") ? (string_contains_q(v, _fl_str("$", "{")) ? r_pair(p_advance(p), make_template_string(v, [], line)) : r_pair(p_advance(p), make_literal("string", v, line))) : ((k === "Symbol") ? r_pair(p_advance(p), make_literal("symbol", v, line)) : ((k === "Variable") ? r_pair(p_advance(p), make_variable(v, line)) : ((k === "Keyword") ? r_pair(p_advance(p), make_keyword(v, line)) : (true ? r_pair(p_advance(p), make_literal("unknown", v, line)) : null)))))); })());
const parse_expr = (p) => ((() => { let t = p_peek(p); let k = _fl_get(t, "kind"); return ((k === "LParen") ? parse_sexpr(p) : ((k === "LBracket") ? parse_bracket(p) : ((k === "LBrace") ? parse_map(p) : (true ? parse_atom(p) : null)))); })());
const parse_sexpr = (p) => ((() => { let start_tok = p_peek(p); let line = _fl_get(start_tok, "line"); let p1 = p_advance(p); let _fl_first = parse_args(p1, []); let p2 = _fl_get(_fl_first, "p"); let args = _fl_get(_fl_first, "node"); return ((_fl_length(args) === 0) ? r_pair(parse_consume_rparen(p2), make_sexpr("", [], line)) : ((() => { let op_node = _fl_get(args, 0); let op = ((_fl_get(op_node, "kind") === "literal") ? _fl_get(op_node, "value") : ((_fl_get(op_node, "kind") === "variable") ? _fl_str("$", _fl_get(op_node, "name")) : "unknown")); let _fl_rest = _fl_slice(args, 1, _fl_length(args)); return ((op === "try") ? ((() => { let body = ((_fl_length(_fl_rest) > 0) ? _fl_get(_fl_rest, 0) : null); let catch_clause = ((_fl_length(_fl_rest) > 1) ? _fl_get(_fl_rest, 1) : null); let finally_clause = ((_fl_length(_fl_rest) > 2) ? _fl_get(_fl_rest, 2) : null); return r_pair(parse_consume_rparen(p2), make_try(body, catch_clause, finally_clause, line)); })()) : ((op === "loop") ? ((() => { let loop_array = ((_fl_length(_fl_rest) > 0) ? _fl_get(_fl_rest, 0) : null); let body_start = ((_fl_length(_fl_rest) > 1) ? _fl_get(_fl_rest, 1) : null); return (_fl_null_q(loop_array) ? r_pair(parse_consume_rparen(p2), make_sexpr("loop", [], line)) : ((!(_fl_get(loop_array, "kind") === "array")) ? r_pair(parse_consume_rparen(p2), make_sexpr("loop", _fl_rest, line)) : ((() => { let items = _fl_get(loop_array, "items"); let init = ((_fl_length(items) > 0) ? _fl_get(items, 0) : null); let condition = ((_fl_length(items) > 1) ? _fl_get(items, 1) : null); let update = ((_fl_length(items) > 2) ? _fl_get(items, 2) : null); let body_exprs = _fl_slice(_fl_rest, 1, _fl_length(_fl_rest)); return r_pair(parse_consume_rparen(p2), make_loop(init, condition, update, ((_fl_length(body_exprs) === 1) ? _fl_get(body_exprs, 0) : make_sexpr("do", body_exprs, line)), line)); })()))); })()) : (true ? r_pair(parse_consume_rparen(p2), make_sexpr(op, _fl_rest, line)) : null))); })())); })());
const parse_consume_rparen = (p) => ((() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RParen")) ? p_advance(p) : p); })());
const parse_args = (p, acc) => ((() => { let t = p_peek(p); return (_fl_null_q(t) ? r_pair(p, acc) : ((_fl_get(t, "kind") === "RParen") ? r_pair(p, acc) : ((_fl_get(t, "kind") === "RBracket") ? r_pair(p, acc) : ((_fl_get(t, "kind") === "RBrace") ? r_pair(p, acc) : (true ? ((() => { let one = parse_expr(p); return parse_args(_fl_get(one, "p"), _fl_append(acc, _fl_get(one, "node"))); })()) : null))))); })());
const parse_bracket = (p) => ((() => { let tok = p_peek(p); let line = _fl_get(tok, "line"); let p1 = p_advance(p); let next = p_peek(p1); return (((!_fl_null_q(next)) && (_fl_get(next, "kind") === "Symbol") && is_block_type_q(_fl_get(next, "value")) && (_fl_get(next, "value") === upper_case(_fl_get(next, "value")))) ? parse_named_block(p1, line) : parse_array(p1, line)); })());
const is_block_type_q = (s) => ((() => { let c = _fl_char_at(s, 0); return ((c >= "A") && (c <= "Z")); })());
const upper_case = (s) => s;
const parse_array = (p, line) => ((() => { let collected = parse_args(p, []); let p2 = _fl_get(collected, "p"); let items = _fl_get(collected, "node"); return r_pair(parse_consume_rbracket(p2), make_array_block(items, line)); })());
const parse_consume_rbracket = (p) => ((() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RBracket")) ? p_advance(p) : p); })());
const parse_named_block = (p, line) => ((() => { let type_tok = p_peek(p); let type = _fl_get(type_tok, "value"); let p1 = p_advance(p); let name_info = parse_optional_name(p1); let p2 = _fl_get(name_info, "p"); let name = _fl_get(name_info, "node"); let fields_info = parse_block_fields(p2, ({  })); let p3 = _fl_get(fields_info, "p"); let fields = _fl_get(fields_info, "node"); return r_pair(parse_consume_rbracket(p3), make_block(type, name, fields, line)); })());
const parse_optional_name = (p) => ((() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "Symbol") && (!(_fl_char_at(_fl_get(t, "value"), 0) === ":"))) ? r_pair(p_advance(p), _fl_get(t, "value")) : r_pair(p, null)); })());
const parse_block_fields = (p, acc) => (p_end_q(p) ? r_pair(p, acc) : ((() => { let t = p_peek(p); return ((_fl_get(t, "kind") === "Keyword") ? ((() => { let key = _fl_get(t, "value"); let p1 = p_advance(p); let val = parse_expr(p1); return parse_block_fields(_fl_get(val, "p"), _fl_map_set(acc, key, _fl_get(val, "node"))); })()) : r_pair(p, acc)); })()));
const parse_map = (p) => ((() => { let tok = p_peek(p); let line = _fl_get(tok, "line"); let p1 = p_advance(p); let collected = parse_args(p1, []); let p2 = _fl_get(collected, "p"); let items = _fl_get(collected, "node"); return r_pair(parse_consume_rbrace(p2), make_map_block(items, line)); })());
const parse_consume_rbrace = (p) => ((() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RBrace")) ? p_advance(p) : p); })());
const parse_all = (p) => (p_end_q(p) ? _fl_get(p, "ast") : ((() => { let one = parse_expr(p); let p2 = p_append_ast(_fl_get(one, "p"), _fl_get(one, "node")); return parse_all(p2); })()));
const parse = (tokens) => parse_all(p_make(tokens));
const js_reserved_q = (n) => ((n === "default") || (n === "class") || (n === "const") || (n === "let") || (n === "if") || (n === "else") || (n === "switch") || (n === "case") || (n === "break") || (n === "continue") || (n === "for") || (n === "while") || (n === "function") || (n === "return") || (n === "throw") || (n === "try") || (n === "catch") || (n === "new") || (n === "delete") || (n === "typeof") || (n === "instanceof") || (n === "var") || (n === "in") || (n === "of") || (n === "this") || (n === "super") || (n === "void") || (n === "yield") || (n === "async") || (n === "await") || (n === "import") || (n === "export") || (n === "enum") || (n === "do") || (n === "with") || (n === "finally") || (n === "null") || (n === "true") || (n === "false"));
const js_name_inner = (n) => ((() => { let g = _fl_replace(_fl_replace(_fl_replace(_fl_replace(_fl_replace(_fl_replace(_fl_replace(n, "-", "_"), "?", "_q"), "!", "_x"), ">", "_gt"), "<", "_lt"), "*", "_st"), "+", "_pl"); return (js_reserved_q(g) ? _fl_str(g, "_") : g); })());
const js_name = (n) => (_fl_null_q(n) ? "_" : js_name_inner(n));
const js_esc_inner = (s) => _fl_replace(_fl_replace(_fl_replace(_fl_replace(_fl_replace(s, "\\", "\\\\"), "\"", "\\\""), "\n", "\\n"), "\r", "\\r"), "\t", "\\t");
const js_esc = (s) => _fl_str("\"", js_esc_inner(s), "\"");
const get_block_items = (node) => (_fl_null_q(node) ? [] : (((_fl_get(node, "kind") === "block") && (_fl_get(node, "type") === "Array")) ? _fl_get(_fl_get(node, "fields"), "items") : node));
const cg = (n) => (_fl_null_q(n) ? "null" : ((_fl_get(n, "kind") === "literal") ? cg_literal(n) : ((_fl_get(n, "kind") === "variable") ? js_name(_fl_get(n, "name")) : ((_fl_get(n, "kind") === "keyword") ? js_esc(_fl_get(n, "name")) : ((_fl_get(n, "kind") === "template-string") ? cg_template_string(n) : ((_fl_get(n, "kind") === "try") ? cg_try(n) : ((_fl_get(n, "kind") === "loop") ? cg_loop(n) : ((_fl_get(n, "kind") === "sexpr") ? cg_sexpr(n) : ((_fl_get(n, "kind") === "block") ? cg_block(n) : ((_fl_get(n, "kind") === "and") ? cg_and(_fl_get(n, "args")) : ((_fl_get(n, "kind") === "or") ? cg_or(_fl_get(n, "args")) : ((_fl_get(n, "kind") === "pattern-match") ? cg_match(n) : ((_fl_get(n, "kind") === "await") ? _fl_str("(await ", cg(_fl_get(n, "argument")), ")") : ((_fl_get(n, "kind") === "throw") ? _fl_str("((()=>{throw new Error(String(", cg(_fl_get(n, "argument")), "))})())") : (true ? "null" : null)))))))))))))));
const cg_literal = (n) => ((() => { let t = _fl_get(n, "type"); let v = _fl_get(n, "value"); return ((t === "number") ? _fl_str(v) : ((t === "string") ? js_esc(v) : ((t === "boolean") ? (v ? "true" : "false") : ((t === "symbol") ? ((v === "true") ? "true" : ((v === "false") ? "false" : ((v === "null") ? "null" : ((v === "nil") ? "null" : (true ? js_name(v) : null))))) : (true ? "null" : null))))); })());
const cg_template_string = (n) => _fl_str("`", _fl_replace(_fl_replace(_fl_get(n, "value"), "\\", "\\\\"), "`", "\\`"), "`");
const cg_try = (n) => ((() => { let body = cg(_fl_get(n, "body")); let _catch = _fl_get(n, "catch"); let _finally = _fl_get(n, "finally"); let c_code = (_fl_null_q(_catch) ? "" : cg_catch_clause(_catch)); let f_code = (_fl_null_q(_finally) ? "" : _fl_str("finally{", cg(_finally), "}")); return _fl_str("(()=>{try{return ", body, "}catch(err){", c_code, "}", f_code, "})()"); })());
const cg_catch_clause = (c) => ((() => { let is_sexpr = (_fl_get(c, "kind") === "sexpr"); let param = (is_sexpr ? js_name(_fl_get(_fl_get(_fl_get(c, "args"), 0), "name")) : "err"); let body = (is_sexpr ? cg(_fl_get(_fl_get(c, "args"), 1)) : cg(c)); return _fl_str("let ", param, "=err;return ", body, ";"); })());
const cg_func_block = (n) => ((() => { let name = js_name(_fl_get(n, "name")); let f = _fl_get(n, "fields"); let params_block = _fl_get(f, "params"); let body_node = _fl_get(f, "body"); let ps_info = extract_params(get_block_items(params_block)); let body = cg(body_node); let pre = _fl_get(ps_info, "preamble"); let final_body = ((_fl_length(pre) === 0) ? body : _fl_str("((() => { ", pre, " return ", body, "; })())")); return _fl_str("function ", name, "(", _fl_get(ps_info, "params"), ") { return ", final_body, "; }"); })());
const cg_block = (n) => ((() => { let t = _fl_get(n, "type"); let f = _fl_get(n, "fields"); return ((t === "FUNC") ? cg_func_block(n) : ((t === "Map") ? _fl_str("({", cg_map_entries(f), "})") : ((t === "Array") ? _fl_str("[", cg_args(_fl_get(f, "items")), "]") : (true ? "null" : null)))); })());
const cg_map_entries = (f) => ((() => { let items = _fl_get(f, "items"); return (_fl_array_q(items) ? cg_map_flat_loop(items, 0, "") : cg_map_loop(map_entries(f), 0, "")); })());
const cg_map_loop = (e, i, acc) => ((i >= _fl_length(e)) ? acc : ((() => { let pair = _fl_str(js_esc(_fl_get(_fl_get(e, i), 0)), ":", cg(_fl_get(_fl_get(e, i), 1))); return cg_map_loop(e, (i + 1), ((i === 0) ? pair : _fl_str(acc, ",", pair))); })()));
const cg_map_flat_loop = (it, i, acc) => ((i >= _fl_length(it)) ? acc : ((() => { let k = _fl_get(it, i); let v = _fl_get(it, (i + 1)); let key = ((_fl_get(k, "kind") === "keyword") ? js_esc(_fl_get(k, "name")) : ((_fl_get(k, "kind") === "literal") ? js_esc(_fl_str(_fl_get(k, "value"))) : (true ? "\"_anon\"" : null))); let pair = _fl_str(key, ":", cg(v)); return cg_map_flat_loop(it, (i + 2), ((i === 0) ? pair : _fl_str(acc, ",", pair))); })()));
const cg_sexpr = (n) => ((() => { let op = _fl_get(n, "op"); return (_fl_string_q(op) ? cg_sexpr_dispatch(op, _fl_get(n, "args")) : _fl_str("(", cg(op), ")(", cg_args(_fl_get(n, "args")), ")")); })());
const cg_sexpr_dispatch = (op, args) => ((op === "if") ? _fl_str("(", cg(_fl_get(args, 0)), "?", cg(_fl_get(args, 1)), ":", ((_fl_length(args) >= 3) ? cg(_fl_get(args, 2)) : "null"), ")") : ((op === "fn") ? cg_fn(args) : ((op === "defn") ? cg_defn(args) : ((op === "let") ? cg_let(args) : ((op === "do") ? _fl_str("(()=>{", cg_do_body(args, 0, ""), "})()") : ((op === "cond") ? cg_cond(args) : ((op === "loop") ? cg_loop(args) : ((op === "recur") ? _fl_str("{__recur:true,a:[", cg_args(args), "]}") : ((op === "and") ? _fl_str("(", _fl_join(_fl_map(args, ((a) => cg(a))), "&&"), ")") : ((op === "or") ? _fl_str("(", _fl_join(_fl_map(args, ((a) => cg(a))), "||"), ")") : ((op === "+") ? ((_fl_length(args) === 0) ? "0" : _fl_str("(", binop_loop(args, 0, "", "+"), ")")) : ((op === "-") ? ((_fl_length(args) === 1) ? _fl_str("(-", cg(_fl_get(args, 0)), ")") : _fl_str("(", binop_loop(args, 0, "", "-"), ")")) : ((op === "*") ? ((_fl_length(args) === 0) ? "1" : _fl_str("(", binop_loop(args, 0, "", "*"), ")")) : ((op === "/") ? _fl_str("(", cg(_fl_get(args, 0)), "/", cg(_fl_get(args, 1)), ")") : ((op === "=") ? _fl_str("(", cg(_fl_get(args, 0)), "===", cg(_fl_get(args, 1)), ")") : ((op === "<") ? _fl_str("(", cg(_fl_get(args, 0)), "<", cg(_fl_get(args, 1)), ")") : ((op === ">") ? _fl_str("(", cg(_fl_get(args, 0)), ">", cg(_fl_get(args, 1)), ")") : ((op === "<=") ? _fl_str("(", cg(_fl_get(args, 0)), "<=", cg(_fl_get(args, 1)), ")") : ((op === ">=") ? _fl_str("(", cg(_fl_get(args, 0)), ">=", cg(_fl_get(args, 1)), ")") : ((op === "!=") ? _fl_str("(", cg(_fl_get(args, 0)), "!==", cg(_fl_get(args, 1)), ")") : ((op === "%") ? _fl_str("(", cg(_fl_get(args, 0)), "%", cg(_fl_get(args, 1)), ")") : ((op === "while") ? _fl_str("(()=>{ while(", cg(_fl_get(args, 0)), ") { ", cg_stmts(_fl_slice(args, 1, _fl_length(args)), 0, ""), " } })()") : ((op === "set!") ? _fl_str("(", js_name(_fl_get(_fl_get(args, 0), "name")), " = ", cg(_fl_get(args, 1)), ")") : ((op === "define") ? _fl_str("const ", extract_name(_fl_get(args, 0)), "=", cg(_fl_get(args, 1))) : (true ? cg_native_dispatch(op, cg_args(args)) : null)))))))))))))))))))))))));
const cg_fn = (args) => ((() => { let ps_info = extract_params(get_block_items(_fl_get(args, 0))); let body = cg(_fl_get(args, 1)); let pre = _fl_get(ps_info, "preamble"); let final_body = ((_fl_length(pre) === 0) ? body : _fl_str("((() => { ", pre, " return ", body, "; })())")); return _fl_str("((", _fl_get(ps_info, "params"), ") => ", final_body, ")"); })());
const cg_defn = (args) => ((() => { let ps_info = extract_params(get_block_items(_fl_get(args, 1))); let body = cg(_fl_get(args, 2)); let pre = _fl_get(ps_info, "preamble"); let final_body = ((_fl_length(pre) === 0) ? body : _fl_str("((() => { ", pre, " return ", body, "; })())")); return _fl_str("var ", extract_name(_fl_get(args, 0)), " = (", _fl_get(ps_info, "params"), ") => ", final_body); })());
const cg_let = (args) => ((() => { let items = get_block_items(_fl_get(args, 0)); let _fl_first = _fl_get(items, 0); let nested = ((_fl_get(_fl_first, "kind") === "block") && (_fl_get(_fl_first, "type") === "Array")); let bindings = (nested ? cg_let_2d(items, 0, "") : cg_let_1d(items, 0, "")); let body = cg_do_body(_fl_slice(args, 1, _fl_length(args)), 0, ""); return _fl_str("((()=>{", bindings, body, "})())"); })());
const cg_let_1d = (it, i, acc) => ((i >= _fl_length(it)) ? acc : cg_let_1d(it, (i + 2), _fl_str(acc, "let ", extract_name(_fl_get(it, i)), "=", cg(_fl_get(it, (i + 1))), ";")));
const cg_let_2d = (it, i, acc) => ((i >= _fl_length(it)) ? acc : ((() => { let p = get_block_items(_fl_get(it, i)); return cg_let_2d(it, (i + 1), _fl_str(acc, "let ", extract_name(_fl_get(p, 0)), "=", cg(_fl_get(p, 1)), ";")); })()));
const cg_do_body = (args, i, acc) => ((i >= _fl_length(args)) ? acc : ((() => { let _fl_last = (i === (_fl_length(args) - 1)); let c = cg(_fl_get(args, i)); let sep = (_fl_last ? "return " : ""); return cg_do_body(args, (i + 1), _fl_str(acc, sep, c, ";")); })()));
const cg_stmts = (args, i, acc) => ((i >= _fl_length(args)) ? acc : cg_stmts(args, (i + 1), _fl_str(acc, cg(_fl_get(args, i)), ";")));
const cg_cond = (args) => ((_fl_length(args) === 0) ? "null" : ((() => { let _fl_first = _fl_get(args, 0); let nested = ((_fl_get(_fl_first, "kind") === "block") && (_fl_get(_fl_first, "type") === "Array")); return (nested ? cg_cond_nested(args, (_fl_length(args) - 1), "null") : cg_cond_flat(args, 0, "null")); })()));
const cg_cond_nested = (args, i, acc) => ((i < 0) ? acc : ((() => { let items = get_block_items(_fl_get(args, i)); return cg_cond_nested(args, (i - 1), _fl_str("(", cg(_fl_get(items, 0)), "?", cg(_fl_get(items, 1)), ":", acc, ")")); })()));
const cg_cond_flat = (args, i, acc) => ((() => { let len = _fl_length(args); return ((i >= len) ? acc : ((i === (len - 1)) ? _fl_str("(", cg(_fl_get(args, i)), ")") : _fl_str("(", cg(_fl_get(args, i)), "?", cg(_fl_get(args, (i + 1))), ":", cg_cond_flat(args, (i + 2), acc), ")"))); })());
const cg_loop = (args) => ((() => { let items = get_block_items(_fl_get(args, 0)); let _fl_first = _fl_get(items, 0); let nested = ((_fl_get(_fl_first, "kind") === "block") && (_fl_get(_fl_first, "type") === "Array")); let inits = (nested ? loop_inits_2d(items, 0, "") : loop_inits_1d(items, 0, "")); let names = (nested ? loop_names_2d(items, 0, "") : loop_names_1d(items, 0, "")); let body = cg_do_body(_fl_slice(args, 1, _fl_length(args)), 0, ""); return _fl_str("((()=>{", inits, "while(true){let __r=(()=>{", body, "})();if(__r&&__r.__recur){", ((_fl_length(names) === 0) ? "" : _fl_str("[", names, "]=__r.a;")), "continue;}return __r;}})())"); })());
const loop_inits_1d = (it, i, acc) => ((i >= _fl_length(it)) ? acc : loop_inits_1d(it, (i + 2), _fl_str(acc, "let ", extract_name(_fl_get(it, i)), "=", cg(_fl_get(it, (i + 1))), ";")));
const loop_inits_2d = (it, i, acc) => ((i >= _fl_length(it)) ? acc : ((() => { let p = get_block_items(_fl_get(it, i)); return loop_inits_2d(it, (i + 1), _fl_str(acc, "let ", extract_name(_fl_get(p, 0)), "=", cg(_fl_get(p, 1)), ";")); })()));
const loop_names_1d = (it, i, acc) => ((i >= _fl_length(it)) ? acc : ((() => { let n = extract_name(_fl_get(it, i)); return loop_names_1d(it, (i + 2), ((_fl_length(acc) === 0) ? n : _fl_str(acc, ",", n))); })()));
const loop_names_2d = (it, i, acc) => ((i >= _fl_length(it)) ? acc : ((() => { let p = get_block_items(_fl_get(it, i)); let n = extract_name(_fl_get(p, 0)); return loop_names_2d(it, (i + 1), ((_fl_length(acc) === 0) ? n : _fl_str(acc, ",", n))); })()));
const cg_args = (args) => args_loop(args, 0, "");
const args_loop = (args, i, acc) => ((_fl_null_q(args) || (i >= _fl_length(args))) ? acc : ((() => { let c = cg(_fl_get(args, i)); return args_loop(args, (i + 1), ((i === 0) ? c : _fl_str(acc, ",", c))); })()));
const binop_loop = (args, i, acc, op) => ((i >= _fl_length(args)) ? acc : ((() => { let c = cg(_fl_get(args, i)); return binop_loop(args, (i + 1), ((i === 0) ? c : _fl_str(acc, op, c)), op); })()));
const extract_name = (n) => ((_fl_get(n, "kind") === "variable") ? js_name(_fl_get(n, "name")) : ((_fl_get(n, "kind") === "literal") ? js_name(_fl_get(n, "value")) : (true ? "_anon" : null)));
const extract_params = (it) => extract_params_loop(it, 0, "", "", 0);
const extract_params_loop = (it, i, ps, pre, tc) => ((_fl_null_q(it) || (i >= _fl_length(it))) ? ({ params: ps, preamble: pre }) : ((() => { let c = _fl_get(it, i); let k = _fl_get(c, "kind"); return (((k === "variable") || (k === "literal")) ? extract_params_loop(it, (i + 1), ((_fl_length(ps) === 0) ? extract_name(c) : _fl_str(ps, ",", extract_name(c))), pre, tc) : (((k === "block") && (_fl_get(c, "type") === "Array")) ? ((() => { let t = _fl_str("_arg", tc); let sub = _fl_get(_fl_get(c, "fields"), "items"); return extract_params_loop(it, (i + 1), ((_fl_length(ps) === 0) ? t : _fl_str(ps, ",", t)), _fl_str(pre, destructure_loop(sub, t, 0)), (tc + 1)); })()) : extract_params_loop(it, (i + 1), ((_fl_length(ps) === 0) ? "p" : _fl_str(ps, ",p")), pre, tc))); })()));
const destructure_loop = (it, t, i) => ((i >= _fl_length(it)) ? "" : _fl_str("let ", extract_name(_fl_get(it, i)), "=", t, "[", i, "]; ", destructure_loop(it, t, (i + 1))));
const cg_native_dispatch = (op, as) => ((op === "str") ? _fl_str("_fl_str(", as, ")") : ((op === "length") ? _fl_str("_fl_length(", as, ")") : ((op === "println") ? _fl_str("_fl_print(", as, ")") : ((op === "print") ? _fl_str("_fl_print(", as, ")") : (true ? _fl_str(js_name(op), "(", as, ")") : null)))));
const prelude_parts = () => ["const _fl_str = (...xs) => xs.map(x => x==null?'':String(x)).join('');", "const _fl_length = (x) => (x?x.length:0);", "const _fl_get = (o,k,d) => { if(o==null)return d||null; let ks=String(k).startsWith(':')?k.slice(1):String(k); if(Array.isArray(o)){let idx=parseInt(ks);if(!isNaN(idx))return o[idx]!==undefined?o[idx]:(d||null);if(ks==='length')return o.length;} if(typeof o==='object'){if(o[ks]!==undefined)return o[ks];} return d||null; }", "const _fl_null_q = (v) => v===null||v===undefined;", "const _fl_keys = (o) => o?Object.keys(o):[];", "const _fl_map_set = (o,k,v) => ({...o,[k]:v});", "const _fl_has_key_q = (o,k) => o?(String(k) in o):false;", "const _fl_append = (l,x) => [...(l||[]),x];", "const list = (...args) => [...args];", "const append = (l,x) => [...(l||[]),x];", "const _fl_first = (l) => (l&&l.length>0)?l[0]:null;", "const _fl_last = (l) => (l&&l.length>0)?l[l.length-1]:null;", "const _fl_rest = (l) => (l&&l.length>0)?l.slice(1):[];", "const _fl_slice = (l,a,b) => (l||[]).slice(a,b);", "const _fl_map = (arr,fn) => (arr||[]).map(x=>fn(x));", "const _fl_filter = (arr,fn) => (arr||[]).filter(x=>{const r=fn(x);return r!==false&&r!==null;});", "const _fl_reduce = (arr,fn,init) => (arr||[]).reduce((a,x)=>fn(a,x),init);", "const _fl_some = (f,l) => (l||[]).some(x=>f(x));", "const _fl_every = (f,l) => (l||[]).every(x=>f(x));", "const _fl_file_read = (p) => require('fs').readFileSync(p,'utf8');", "const _fl_file_write = (p,c) => require('fs').writeFileSync(p,c);", "const _fl_file_exists = (p) => require('fs').existsSync(p);", "const _fl_file_delete = (p) => { try { require('fs').unlinkSync(p); } catch(e) {} };", "const _fl_file_append = (p,c) => require('fs').appendFileSync(p,String(c));", "const _fl_file_copy = (s,d) => require('fs').copyFileSync(s,d);", "const _fl_file_rename = (o,n) => require('fs').renameSync(o,n);", "const _fl_file_size = (p) => { try { return require('fs').statSync(p).size; } catch(e) { return 0; } };", "const _fl_file_modified = (p) => { try { return require('fs').statSync(p).mtimeMs; } catch(e) { return 0; } };", "const _fl_file_mkdir = (p) => { try { require('fs').mkdirSync(p,{recursive:true}); } catch(e) {} };", "const _fl_file_rmdir = (p) => { try { require('fs').rmSync(p,{recursive:true,force:true}); } catch(e) {} };", "const _fl_file_list = (p) => { try { return require('fs').readdirSync(p); } catch(e) { return []; } };", "const _fl_process_run = (cmd) => { try { return require('child_process').execSync(cmd,{encoding:'utf8'}); } catch(e) { return ''; } };", "const _fl_process_run_args = (cmd,args) => { try { return require('child_process').execSync(cmd+' '+(args||[]).join(' '),{encoding:'utf8'}); } catch(e) { return ''; } };", "const _fl_process_exec = (cmd) => { try { return require('child_process').execSync(cmd,{encoding:'utf8'}); } catch(e) { return ''; } };", "const _fl_process_exec_args = (cmd,args) => { try { return require('child_process').execSync(cmd+' '+(args||[]).join(' '),{encoding:'utf8'}); } catch(e) { return ''; } };", "const _fl_process_spawn = (cmd,args) => { try { const r=require('child_process').spawnSync(cmd,args||[],{encoding:'utf8'}); return r.stdout||''; } catch(e) { return ''; } };", "const _fl_process_kill = (pid) => { try { process.kill(pid); } catch(e) {} };", "const _fl_process_wait = (pid) => null;", "const _fl_env_get = (k) => process.env[k]||null;", "const _fl_env_set = (k,v) => { process.env[k]=String(v); };", "const _fl_env_all = () => process.env;", "const _fl_file_is_file = (p) => { try { return require('fs').statSync(p).isFile(); } catch(e) { return false; } };", "const _fl_file_is_dir = (p) => { try { return require('fs').statSync(p).isDirectory(); } catch(e) { return false; } };", "const _fl_process_exists = (pid) => { try { process.kill(pid,0); return true; } catch(e) { return false; } };", "const _fl_process_getcwd = () => process.cwd();", "const _fl_process_chdir = (p) => { try { process.chdir(p); } catch(e) {} };", "const _fl_process_pid = () => process.pid;", "const _fl_process_ppid = () => process.ppid||null;", "const file_read = (p) => _fl_file_read(String(p));", "const file_write = (p,c) => _fl_file_write(String(p),String(c));", "const file_exists = (p) => _fl_file_exists(String(p));", "const _fl_get_argv = () => (typeof process!=='undefined'?process.argv.slice(2):[]);", "const _fl_print = (v) => { console.log(v); return v; }", "const null_q = _fl_null_q;", "const some_q = _fl_some;", "const every_q = _fl_every;", "const cli_args = _fl_get_argv;", "const get = _fl_get;", "const keys = _fl_keys;", "const has_key_q = _fl_has_key_q;", "const slice = _fl_slice;", "const first = _fl_first;", "const last = _fl_last;", "const rest = _fl_rest;", "const map = (fn,arr) => (arr||[]).map(x=>fn(x));", "const filter = (fn,arr) => (arr||[]).filter(x=>{const r=fn(x);return r!==false&&r!==null;});", "const reduce = (fn,init,arr) => (arr||[]).reduce((a,x)=>fn(a,x),init);", "const print = _fl_print;", "const println = (v) => { console.log(v==null?'':String(v)); return v; }", "const str_replace = (s,ov,nv) => { if(s==null)return ''; const st=String(s); return st.split(String(ov)).join(nv==null?'':String(nv)); };", "const str_index_of = (s,sub) => (typeof s==='string'&&typeof sub==='string')?s.indexOf(sub):-1;", "const index_of = str_index_of;", "const str_slice = (s,a,b) => s?(b===undefined?s.slice(a):s.slice(a,b)):'';", "const substring = str_slice;", "const char_at = (s,i) => (s&&s[i])||null;", "const char_code_at = (s,i) => typeof s==='string'?s.charCodeAt(i):0;", "const trim = (s) => String(s||'').trim();", "const starts_with_q = (s,p) => String(s||'').startsWith(String(p||''));", "const ends_with_q = (s,sf) => String(s||'').endsWith(String(sf||''));", "const replace = (s,ov,nv) => { if(s==null)return ''; const st=String(s); if(ov instanceof RegExp)return st.replace(ov,nv==null?'':String(nv)); return st.split(String(ov)).join(nv==null?'':String(nv)); };", "const split = (s,sep) => String(s||'').split(sep);", "const str_join = (arr,sep) => (arr||[]).join(sep===undefined?'':sep);", "const join = str_join;", "const concat = (a,b) => (Array.isArray(a)&&Array.isArray(b))?[...a,...b]:String(a||'')+String(b||'');", "const push = (arr,v) => [...(arr||[]),v];", "const pop = (arr) => (arr&&arr.length>0)?arr.slice(0,-1):[];", "const reverse = (arr) => Array.isArray(arr)?[...arr].reverse():arr;", "const sort_by = (arr,fn) => Array.isArray(arr)?[...arr].sort((a,b)=>fn(a)<fn(b)?-1:fn(a)>fn(b)?1:0):arr;", "const flat_map = (arr,fn) => (arr||[]).flatMap(fn);", "const range = (s,e) => { const r=[]; let st=e===undefined?0:s; let en=e===undefined?s:e; for(let i=st;i<en;i++)r.push(i); return r; };", "const merge = (a,b) => Object.assign({},a,b);", "const assoc = (o,k,v) => { const r=Object.assign({},o); const key=typeof k==='string'&&k.startsWith(':')?k.slice(1):String(k); r[key]=v; return r; };", "const dissoc = (o,k) => { const r=Object.assign({},o); const key=typeof k==='string'&&k.startsWith(':')?k.slice(1):String(k); delete r[key]; return r; };", "var map_entries = (m) => m instanceof Map?[...m.entries()]:(m&&typeof m==='object'&&!Array.isArray(m)?Object.entries(m):[]);", "var map_keys = (m) => m instanceof Map?[...m.keys()]:(m&&typeof m==='object'&&!Array.isArray(m)?Object.keys(m):[]);", "var map_values = (m) => m instanceof Map?[...m.values()]:(m&&typeof m==='object'&&!Array.isArray(m)?Object.values(m):[]);", "const array_q = (v) => Array.isArray(v);", "var list_q = (v) => Array.isArray(v);", "var map_q = (v) => v!==null&&typeof v==='object'&&!Array.isArray(v);", "var fn_q = (v) => typeof v==='function';", "const number_q = (v) => typeof v==='number';", "const string_q = (v) => typeof v==='string';", "var str_upper = (s) => String(s||'').toUpperCase();", "var str_lower = (s) => String(s||'').toLowerCase();", "var str_contains = (s,sub) => String(s||'').includes(String(sub||''));", "var str_starts_with = (s,p) => String(s||'').startsWith(String(p||''));", "var str_ends_with = (s,sf) => String(s||'').endsWith(String(sf||''));", "var str_trim = (s) => String(s||'').trim();", "var str_length = (s) => String(s||'').length;", "var str_split = (s,sep) => String(s||'').split(sep);", "var take = (n,arr) => (arr||[]).slice(0,n);", "var drop = (n,arr) => (arr||[]).slice(n);", "var zip = (a,b) => { const r=[]; const l=Math.min((a||[]).length,(b||[]).length); for(let i=0;i<l;i++)r.push([a[i],b[i]]); return r; };", "var flatten = (arr) => (arr||[]).flat();", "var sort = (arr,fn) => fn?[...(arr||[])].sort((a,b)=>fn(a,b)?-1:1):[...(arr||[])].sort();", "var math_sqrt = (n) => Math.sqrt(n);", "var math_pi = Math.PI;", "var unknown = (...a) => a[a.length-1];", "function _fl_type_of(v) { if(v===null||v===undefined)return 'nil'; if(Array.isArray(v))return 'list'; return typeof v; }", "const not = (v) => !v;", "const abs = (n) => Math.abs(n);", "const floor = (n) => Math.floor(n);", "const ceil_val = (n) => Math.ceil(n);", "const round = (n) => Math.round(n);", "const max_val = (a,b) => a>b?a:b;", "const min_val = (a,b) => a<b?a:b;", "const error = (msg) => { throw new Error(String(msg)); };", "const now_ms = () => Date.now();", "const now_iso = () => new Date().toISOString();", "const now_unix = () => Math.floor(Date.now()/1000);", "const json_parse = (s) => { try{return JSON.parse(s);}catch(e){return null;} };", "const json_stringify = (v) => JSON.stringify(v);", "const shell_exec = (cmd,inp) => { try{const {execSync}=require('child_process');const opts={encoding:'utf8'};if(inp)opts.input=inp;return execSync(cmd,opts);}catch(e){return '';} };", "const __fl_routes = [];", "const _fl_server_get = (path,fn) => { __fl_routes.push({method:'GET',path,fn}); };", "const _fl_server_start = (port) => { const http=require('http'); http.createServer(async(req,res)=>{ const r=__fl_routes.find(r=>r.method===req.method&&r.path===require('url').parse(req.url).pathname); if(r){const result=await(typeof r.fn==='string'?eval(r.fn):r.fn)(req);res.end(String(result));}else{res.statusCode=404;res.end('Not Found');} }).listen(port);console.log('Server on '+port); };", "const server_get = _fl_server_get;", "const server_start = _fl_server_start;"];
const runtime_prelude = () => _fl_join(prelude_parts(), "\n");
const fl__gtjs_code = (ast) => _fl_reduce(ast, ((acc, n) => _fl_str(acc, cg(n), ";\n")), "");
const fl__gtjs_with_prelude = (ast) => _fl_str(runtime_prelude(), "\n", fl__gtjs_code(ast));
const compile_file = (input, output) => ((() => { let src = _fl_file_read(input); let tokens = lex(src); let ast = parse(tokens); let node_count = _fl_length(ast); let js = fl__gtjs_with_prelude(ast); return (() => { _fl_file_write(output, js); _fl_print(_fl_str("Parsed: ", node_count, " nodes")); return _fl_print(_fl_str("Compiled ", input, " -> ", output)); })(); })());
const str_lines = (s) => _fl_split(s, "\n");
const str_words = (s) => _fl_split(_fl_trim(s), " ");
const str_join_lines = (lines) => str_join_loop(lines, 0, "");
const str_join_loop = (lst, i, acc) => ((i >= _fl_length(lst)) ? acc : str_join_loop(lst, (i + 1), ((i === 0) ? _fl_get(lst, 0) : _fl_str(acc, "\n", _fl_get(lst, i)))));
const str_count = (s, sub) => ((_fl_length(sub) === 0) ? 0 : str_count_loop(s, sub, 0, 0));
const str_count_loop = (s, sub, pos, acc) => ((() => { let _fl_rest = _fl_substring(s, pos, _fl_length(s)); let idx = index_of(_fl_rest, sub); return ((idx < 0) ? acc : str_count_loop(s, sub, _plus(pos, idx, _fl_length(sub)), (acc + 1))); })());
const csv_parse_line = (line) => _fl_split(line, ",");
const csv_parse = (csv) => ((() => { let lines = _fl_split(csv, "\n"); return csv_parse_loop(lines, 0, []); })());
const csv_parse_loop = (lines, i, acc) => ((i >= _fl_length(lines)) ? acc : csv_parse_loop(lines, (i + 1), _fl_append(acc, csv_parse_line(_fl_get(lines, i)))));
const data_json_parse = (s) => JSON.parse(s);
const data_json_str = (obj) => JSON.stringify(obj);
const data_json_pretty = (obj) => JSON.stringify(obj);
const to_query_string = (obj) => to_query_loop(_fl_keys(obj), obj, 0, []);
const to_query_loop = (ks, obj, i, acc) => ((i >= _fl_length(ks)) ? _fl_join(acc, "&") : ((() => { let k = _fl_get(ks, i); let v = _fl_get(obj, k); return to_query_loop(ks, obj, (i + 1), _fl_append(acc, _fl_str(k, "=", v))); })()));
const hash_simple = (s) => hash_simple_loop(_fl_str(s), 0, 5381, 0);
const hash_simple_loop = (s, i, hash, max) => ((i >= _fl_length(s)) ? (abs(hash) % 2147483647) : hash_simple_loop(s, (i + 1), ((hash * 33) + char_code_at(s, i)), (i + 1)));
const hash_fnv1a = (s) => ((() => { let fnv_offset = 2166136261; let fnv_prime = 16777619; return hash_fnv_loop(_fl_str(s), 0, fnv_offset); })());
const hash_fnv_loop = (s, i, hash) => ((i >= _fl_length(s)) ? (abs(hash) % 2147483647) : hash_fnv_loop(s, (i + 1), (bit_xor(hash, char_code_at(s, i)) * 16777619)));
const hash_djb2 = (s) => hash_djb_loop(_fl_str(s), 0, 5381);
const hash_djb_loop = (s, i, hash) => ((i >= _fl_length(s)) ? (abs(hash) % 2147483647) : hash_djb_loop(s, (i + 1), ((hash * 33) + char_code_at(s, i))));
const hash_object = (obj) => hash_simple(JSON.stringify(obj));
const hash_consistent = (s, seed) => ((() => { let h = hash_simple(s); return (((h * seed) + seed) % 2147483647); })());
const now_s = () => floor((now() / 1000));
const time_diff_ms = (t1, t2) => (t2 - t1);
const time_elapsed = (start) => (now() - start);
const date_parts = (ts) => ({ ts: ts, s: floor((ts / 1000)), m: floor((ts / 60000)), h: floor((ts / 3600000)), d: floor((ts / 86400000)) });
const ts_to_s = (ts) => floor((ts / 1000));
const s_to_ts = (s) => (s * 1000);
const time_ago = (ts) => ((() => { let diff = (now() - ts); let s = floor((diff / 1000)); let m = floor((s / 60)); let h = floor((m / 60)); let d = floor((h / 24)); return ((s < 60) ? _fl_str(s, "s ago") : ((m < 60) ? _fl_str(m, "m ago") : ((h < 24) ? _fl_str(h, "h ago") : (true ? _fl_str(d, "d ago") : null)))); })());
const str_starts_with_q = (s, prefix) => ((_fl_length(prefix) > _fl_length(s)) ? false : (_fl_substring(s, 0, _fl_length(prefix)) === prefix));
const str_ends_with_q = (s, suffix) => ((_fl_length(suffix) > _fl_length(s)) ? false : (_fl_substring(s, (_fl_length(s) - _fl_length(suffix)), _fl_length(s)) === suffix));
const file_append = (path, content) => _fl_file_append(_fl_str(path), _fl_str(content));
const file_exists_q = (path) => _fl_file_exists(_fl_str(path));
const file_delete = (path) => _fl_file_delete(_fl_str(path));
const file_copy = (src, dest) => _fl_file_copy(_fl_str(src), _fl_str(dest));
const file_rename = (old, _new) => _fl_file_rename(_fl_str(old), _fl_str(_new));
const file_size = (path) => _fl_file_size(_fl_str(path));
const file_modified = (path) => _fl_file_modified(_fl_str(path));
const file_json = (path) => JSON.parse(_fl_file_read(_fl_str(path)));
const file_json_write = (path, obj) => _fl_file_write(_fl_str(path), JSON.stringify(obj));
const file_lines = (path) => str_lines(_fl_file_read(_fl_str(path)));
const file_mkdir = (path) => _fl_file_mkdir(_fl_str(path));
const file_rmdir = (path) => _fl_file_rmdir(_fl_str(path));
const file_list = (path) => _fl_file_list(_fl_str(path));
const file_is_file_q = (path) => _fl_file_is_file(_fl_str(path));
const file_is_dir_q = (path) => _fl_file_is_dir(_fl_str(path));
const process_run = (cmd) => _fl_process_run(_fl_str(cmd));
const process_run_args = (cmd, args) => _fl_process_run_args(_fl_str(cmd), args);
const process_exec = (cmd) => _fl_process_exec(_fl_str(cmd));
const process_exec_args = (cmd, args) => _fl_process_exec_args(_fl_str(cmd), args);
const process_spawn = (cmd, args) => _fl_process_spawn(_fl_str(cmd), args);
const process_kill = (pid) => _fl_process_kill(floor(pid));
const process_exists_q = (pid) => _fl_process_exists(floor(pid));
const process_wait = (pid) => _fl_process_wait(floor(pid));
const shell_run = (cmd) => process_exec(_fl_str(cmd));
const shell_pipe = (cmd1, cmd2) => process_exec(_fl_str(cmd1, " | ", cmd2));
const env_get = (key) => _fl_env_get(_fl_str(key));
const env_set = (key, value) => _fl_env_set(_fl_str(key), _fl_str(value));
const env_all = () => _fl_env_all();
const getcwd = () => _fl_process_getcwd();
const chdir = (path) => _fl_process_chdir(_fl_str(path));
const pid = () => _fl_process_pid();
const pid_parent = () => _fl_process_ppid();
const vector_add = (v1, v2) => _fl_map(_fl_range(0, _fl_length(v1)), ((i) => (_fl_get(v1, i) + _fl_get(v2, i))));
const vector_dot = (v1, v2) => _fl_reduce(_fl_range(0, _fl_length(v1)), ((acc, i) => (acc + (_fl_get(v1, i) * _fl_get(v2, i)))), 0);
const vector_magnitude = (v) => math_sqrt(_fl_reduce(v, ((acc, x) => (acc + (x * x))), 0));
const cosine_sim = (v1, v2) => ((() => { let dot = vector_dot(v1, v2); let mag1 = vector_magnitude(v1); let mag2 = vector_magnitude(v2); return (((mag1 === 0) || (mag2 === 0)) ? 0 : (dot / (mag1 * mag2))); })());
const do_run = (input, extra_args) => ((() => { let output = _fl_str("/tmp/fl-run-", now_ms(), ".js"); let args_str = _fl_join(extra_args, " "); return (() => { compile_file(input, output); shell_exec(_fl_str("node ", output, " ", args_str), "."); return file_delete(output); })(); })());
const cli_main = () => ((() => { let argv = _fl_get_argv(); return (_fl_null_q(argv) ? null : ((_fl_length(argv) === 0) ? null : ((() => { let cmd = _fl_get(argv, 0); return ((cmd === "run") ? ((() => { let input = _fl_get(argv, 1); let extra = _fl_slice(argv, 2, _fl_length(argv)); return do_run(input, extra); })()) : ((() => { let input = _fl_get(argv, 0); let output = ((_fl_length(argv) >= 2) ? _fl_get(argv, 1) : _fl_str(input, ".out.js")); return compile_file(input, output); })())); })()))); })());
cli_main();