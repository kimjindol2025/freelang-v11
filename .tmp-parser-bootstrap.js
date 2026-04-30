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
function _fl_str_index_of(s, sub) { return (s || "").indexOf(sub); }

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

// ─ 글로벌 바인딩 ─
let __argv__ = _fl_get_argv();

// ═══════════════════════════════════════════════════════

function p_make(tokens) { return { tokens: tokens, idx: 0, ast: [] }; }
function p_peek(p) { return (() => { let i = _fl_get(p, "idx"); let t = _fl_get(p, "tokens"); return ((i >= _fl_length(t)) ? null : _fl_get(t, i)); })(); }
function p_peek_at(p, offset) { return (() => { let i = (_fl_get(p, "idx") + offset); let t = _fl_get(p, "tokens"); return ((i >= _fl_length(t)) ? null : _fl_get(t, i)); })(); }
function p_end_q(p) { return (_fl_get(p, "idx") >= _fl_length(_fl_get(p, "tokens"))); }
function p_advance(p) { return { tokens: _fl_get(p, "tokens"), idx: (_fl_get(p, "idx") + 1), ast: _fl_get(p, "ast") }; }
function p_with_ast(p, ast) { return { tokens: _fl_get(p, "tokens"), idx: _fl_get(p, "idx"), ast: ast }; }
function p_append_ast(p, node) { return p_with_ast(p, _fl_append(_fl_get(p, "ast"), [node])); }
function r_pair(p, node) { return { p: p, node: node }; }
function string_contains_q(s, substr) { return (!(-1 === _fl_str_index_of(s, substr))); }
function parse_atom(p) { return (() => { let t = p_peek(p); let k = _fl_get(t, "kind"); let v = _fl_get(t, "value"); let line = _fl_get(t, "line"); return ((k === "Number") ? r_pair(p_advance(p), make_literal("number", v, line)) : ((k === "String") ? (string_contains_q(v, _fl_str("$", "{")) ? r_pair(p_advance(p), make_template_string(v, [], line)) : r_pair(p_advance(p), make_literal("string", v, line))) : ((k === "Symbol") ? r_pair(p_advance(p), make_literal("symbol", v, line)) : ((k === "Variable") ? r_pair(p_advance(p), make_variable(v, line)) : ((k === "Keyword") ? r_pair(p_advance(p), make_keyword(v, line)) : (true ? r_pair(p_advance(p), make_literal("unknown", v, line)) : null)))))); })(); }
function parse_expr(p) { return (() => { let t = p_peek(p); let k = _fl_get(t, "kind"); return ((k === "LParen") ? parse_sexpr(p) : ((k === "LBracket") ? parse_bracket(p) : ((k === "LBrace") ? parse_map(p) : (true ? parse_atom(p) : null)))); })(); }
function parse_sexpr(p) { return (() => { let start_tok = p_peek(p); let line = _fl_get(start_tok, "line"); let p1 = p_advance(p); let _fl_first = parse_args(p1, []); let p2 = _fl_get(_fl_first, "p"); let args = _fl_get(_fl_first, "node"); return ((_fl_length(args) === 0) ? r_pair(parse_consume_rparen(p2), make_sexpr("", [], line)) : (() => { let op_node = _fl_get(args, 0); let op = ((_fl_get(op_node, "kind") === "literal") ? _fl_get(op_node, "value") : ((_fl_get(op_node, "kind") === "variable") ? _fl_str("$", _fl_get(op_node, "name")) : "unknown")); let _fl_rest = _fl_slice(args, 1, _fl_length(args)); return ((op === "try") ? (() => { let body = ((_fl_length(_fl_rest) > 0) ? _fl_get(_fl_rest, 0) : null); let catch_clause = ((_fl_length(_fl_rest) > 1) ? _fl_get(_fl_rest, 1) : null); let finally_clause = ((_fl_length(_fl_rest) > 2) ? _fl_get(_fl_rest, 2) : null); return r_pair(parse_consume_rparen(p2), make_try(body, catch_clause, finally_clause, line)); })() : ((op === "loop") ? (() => { let loop_array = ((_fl_length(_fl_rest) > 0) ? _fl_get(_fl_rest, 0) : null); let body_start = ((_fl_length(_fl_rest) > 1) ? _fl_get(_fl_rest, 1) : null); return (_fl_null_q(loop_array) ? r_pair(parse_consume_rparen(p2), make_sexpr("loop", [], line)) : ((!(_fl_get(loop_array, "kind") === "array")) ? r_pair(parse_consume_rparen(p2), make_sexpr("loop", [], line)) : (() => { let items = _fl_get(loop_array, "items"); let init = ((_fl_length(items) > 0) ? _fl_get(items, 0) : null); let condition = ((_fl_length(items) > 1) ? _fl_get(items, 1) : null); let update = ((_fl_length(items) > 2) ? _fl_get(items, 2) : null); let body_exprs = _fl_slice(_fl_rest, 1, _fl_length(_fl_rest)); return r_pair(parse_consume_rparen(p2), make_loop(init, condition, update, ((_fl_length(body_exprs) === 1) ? _fl_get(body_exprs, 0) : make_sexpr("do", body_exprs, line)), line)); })())); })() : (true ? r_pair(parse_consume_rparen(p2), make_sexpr(op, _fl_rest, line)) : null))); })()); })(); }
function parse_consume_rparen(p) { return (() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RParen")) ? p_advance(p) : p); })(); }
function parse_args(p, acc) { return (() => { let t = p_peek(p); return (_fl_null_q(t) ? r_pair(p, acc) : ((_fl_get(t, "kind") === "RParen") ? r_pair(p, acc) : ((_fl_get(t, "kind") === "RBracket") ? r_pair(p, acc) : ((_fl_get(t, "kind") === "RBrace") ? r_pair(p, acc) : (true ? (() => { let one = parse_expr(p); return parse_args(_fl_get(one, "p"), _fl_append(acc, [_fl_get(one, "node")])); })() : null))))); })(); }
function parse_bracket(p) { return (() => { let tok = p_peek(p); let line = _fl_get(tok, "line"); let p1 = p_advance(p); let next = p_peek(p1); return (((!_fl_null_q(next)) && (_fl_get(next, "kind") === "Symbol") && is_block_type_q(_fl_get(next, "value")) && (_fl_get(next, "value") === upper_case(_fl_get(next, "value")))) ? parse_named_block(p1, line) : parse_array(p1, line)); })(); }
function is_block_type_q(s) { return (() => { let c = _fl_char_at(s, 0); return ((c >= "A") && (c <= "Z")); })(); }
function upper_case(s) { return s; }
function parse_array(p, line) { return (() => { let collected = parse_args(p, []); let p2 = _fl_get(collected, "p"); let items = _fl_get(collected, "node"); return r_pair(parse_consume_rbracket(p2), make_array_block(items, line)); })(); }
function parse_consume_rbracket(p) { return (() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RBracket")) ? p_advance(p) : p); })(); }
function parse_named_block(p, line) { return (() => { let type_tok = p_peek(p); let type = _fl_get(type_tok, "value"); let p1 = p_advance(p); let name_info = parse_optional_name(p1); let p2 = _fl_get(name_info, "p"); let name = _fl_get(name_info, "node"); let fields_info = parse_block_fields(p2, {  }); let p3 = _fl_get(fields_info, "p"); let fields = _fl_get(fields_info, "node"); return r_pair(parse_consume_rbracket(p3), make_block(type, name, fields, line)); })(); }
function parse_optional_name(p) { return (() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "Symbol") && (!(_fl_char_at(_fl_get(t, "value"), 0) === ":"))) ? r_pair(p_advance(p), _fl_get(t, "value")) : r_pair(p, null)); })(); }
function parse_block_fields(p, acc) { return (() => { let cur = p; let res_acc = acc; let running = true; return (() => { (() => { while(((!p_end_q(cur)) && running)) { (() => { let t = p_peek(cur); return ((_fl_get(t, "kind") === "Keyword") ? (() => { let key = _fl_get(t, "value"); let p1 = p_advance(cur); let val = parse_expr(p1); return (() => { (res_acc = _fl_map_set(res_acc, key, _fl_get(val, "node"))); return (cur = _fl_get(val, "p")); })(); })() : (running = false)); })() } })(); return r_pair(cur, res_acc); })(); })(); }
function parse_map(p) { return (() => { let tok = p_peek(p); let line = _fl_get(tok, "line"); let p1 = p_advance(p); let collected = parse_args(p1, []); let p2 = _fl_get(collected, "p"); let items = _fl_get(collected, "node"); return r_pair(parse_consume_rbrace(p2), make_map_block(items, line)); })(); }
function parse_consume_rbrace(p) { return (() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RBrace")) ? p_advance(p) : p); })(); }
function parse_all(p) { return (p_end_q(p) ? _fl_get(p, "ast") : (() => { let one = parse_expr(p); let p2 = p_append_ast(_fl_get(one, "p"), _fl_get(one, "node")); return parse_all(p2); })()); }
function parse(tokens) { return parse_all(p_make(tokens)); }
module.exports = {
  p_make: p_make,
  p_peek: p_peek,
  p_peek_at: p_peek_at,
  p_end_q: p_end_q,
  p_advance: p_advance,
  p_with_ast: p_with_ast,
  p_append_ast: p_append_ast,
  r_pair: r_pair,
  string_contains_q: string_contains_q,
  parse_atom: parse_atom,
  parse_expr: parse_expr,
  parse_sexpr: parse_sexpr,
  parse_consume_rparen: parse_consume_rparen,
  parse_args: parse_args,
  parse_bracket: parse_bracket,
  is_block_type_q: is_block_type_q,
  upper_case: upper_case,
  parse_array: parse_array,
  parse_consume_rbracket: parse_consume_rbracket,
  parse_named_block: parse_named_block,
  parse_optional_name: parse_optional_name,
  parse_block_fields: parse_block_fields,
  parse_map: parse_map,
  parse_consume_rbrace: parse_consume_rbrace,
  parse_all: parse_all,
  parse: parse
};