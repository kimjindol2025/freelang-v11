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

// ─ 글로벌 바인딩 ─
let __argv__ = _fl_get_argv();

// ═══════════════════════════════════════════════════════

function _fl_map(arr, fn) { return (arr || []).map(fn); }
function _fl_filter(arr, fn) { return (arr || []).filter(fn); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce(fn, init); }
function _fl_print(v) { console.log(v); return v; }

function _fl_is_digit_q(c) { return (_fl_null_q(c) ? false : ((c >= "0") && (c <= "9"))); }
function _fl_is_alpha_q(c) { return (_fl_null_q(c) ? false : (((c >= "a") && (c <= "z")) || ((c >= "A") && (c <= "Z")))); }
function _fl_is_alnum_q(c) { return (_fl_is_digit_q(c) || _fl_is_alpha_q(c)); }
function _fl_is_space_q(c) { return ((c === " ") || (c === "\t") || (c === "\n") || (c === "\r")); }
function _fl_is_symbol_char_q(c) { return (_fl_null_q(c) ? false : (_fl_is_alnum_q(c) || (c === "-") || (c === "_") || (c === "?") || (c === "!") || (c === "/") || (c === ".") || (c === "<") || (c === ">") || (c === "=") || (c === "+") || (c === "*") || (c === "%") || (c === "&") || (c === "|") || (c === "^") || (c === "~"))); }
function make_state(src) { return { src: src, idx: 0, line: 1, col: 1, tokens: [] }; }
function peek(st) { return (() => { let src = _fl_get(st, "src"); let i = _fl_get(st, "idx"); return ((i >= _fl_length(src)) ? null : _fl_char_at(src, i)); })(); }
function at_end_q(st) { return (_fl_get(st, "idx") >= _fl_length(_fl_get(st, "src"))); }
function advance(st) { return (() => { let c = peek(st); return ((c === "\n") ? { src: _fl_get(st, "src"), idx: (_fl_get(st, "idx") + 1), line: (_fl_get(st, "line") + 1), col: 1, tokens: _fl_get(st, "tokens") } : { src: _fl_get(st, "src"), idx: (_fl_get(st, "idx") + 1), line: _fl_get(st, "line"), col: (_fl_get(st, "col") + 1), tokens: _fl_get(st, "tokens") }); })(); }
function emit(st, kind, value, sl, sc) { return { src: _fl_get(st, "src"), idx: _fl_get(st, "idx"), line: _fl_get(st, "line"), col: _fl_get(st, "col"), tokens: _fl_append(_fl_get(st, "tokens"), { kind: kind, type: kind, value: value, line: sl, col: sc }) }; }
function skip_ws(st) { return (() => {
        let cur = st;
        while (true) {
          const __r = (() => { return (at_end_q(cur) ? cur : (() => { let c = peek(cur); return (_fl_is_space_q(c) ? { __recur: true, a: [advance(cur)] } : ((c === ";") ? (() => { let next = (() => {
        let s = advance(cur);
        while (true) {
          const __r = (() => { return ((at_end_q(s) || (peek(s) === "\n")) ? s : { __recur: true, a: [advance(s)] }); })();
          if (__r && __r.__recur) {
            [s] = __r.a;
            continue;
          }
          return __r;
        }
      })(); return { __recur: true, a: [advance(next)] }; })() : (true ? cur : null))); })()); })();
          if (__r && __r.__recur) {
            [cur] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function read_number(st) { return (() => {
        let cur = st; let acc = ""; let dot = false;
        while (true) {
          const __r = (() => { return (() => { let c = peek(cur); return (_fl_is_digit_q(c) ? { __recur: true, a: [advance(cur), _fl_str(acc, c), dot] } : (((c === ".") && (!dot)) ? { __recur: true, a: [advance(cur), _fl_str(acc, c), true] } : (true ? emit(cur, "Number", acc, _fl_get(st, "line"), _fl_get(st, "col")) : null))); })(); })();
          if (__r && __r.__recur) {
            [cur, acc, dot] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function read_string(st) { return (() => { let st1 = advance(st); return (() => {
        let cur = st1; let acc = "";
        while (true) {
          const __r = (() => { return (() => { let c = peek(cur); return (_fl_null_q(c) ? emit(cur, "String", acc, _fl_get(st, "line"), _fl_get(st, "col")) : ((c === "\"") ? emit(advance(cur), "String", acc, _fl_get(st, "line"), _fl_get(st, "col")) : ((c === "\\") ? (() => { let st2 = advance(cur); let c2 = peek(st2); return { __recur: true, a: [advance(st2), _fl_str(acc, translate_esc(c2))] }; })() : (true ? { __recur: true, a: [advance(cur), _fl_str(acc, c)] } : null)))); })(); })();
          if (__r && __r.__recur) {
            [cur, acc] = __r.a;
            continue;
          }
          return __r;
        }
      })(); })(); }
function translate_esc(c) { return ((c === "n") ? "\n" : ((c === "t") ? "\t" : ((c === "r") ? "\r" : ((c === "\"") ? "\"" : ((c === "\\") ? "\\" : (true ? c : null)))))); }
function read_symbol(st, kind) { return (() => {
        let cur = st; let acc = "";
        while (true) {
          const __r = (() => { return (() => { let c = peek(cur); return (_fl_is_symbol_char_q(c) ? { __recur: true, a: [advance(cur), _fl_str(acc, c)] } : emit(cur, kind, acc, _fl_get(st, "line"), _fl_get(st, "col"))); })(); })();
          if (__r && __r.__recur) {
            [cur, acc] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function read_token(st) { return (() => { let st1 = skip_ws(st); return (at_end_q(st1) ? st1 : (() => { let c = peek(st1); let line = _fl_get(st1, "line"); let col = _fl_get(st1, "col"); return ((c === "(") ? emit(advance(st1), "LParen", c, line, col) : ((c === ")") ? emit(advance(st1), "RParen", c, line, col) : ((c === "[") ? emit(advance(st1), "LBracket", c, line, col) : ((c === "]") ? emit(advance(st1), "RBracket", c, line, col) : ((c === "{") ? emit(advance(st1), "LBrace", c, line, col) : ((c === "}") ? emit(advance(st1), "RBrace", c, line, col) : ((c === "\"") ? read_string(st1) : ((c === "$") ? read_symbol(advance(st1), "Variable") : ((c === ":") ? read_symbol(advance(st1), "Keyword") : (_fl_is_digit_q(c) ? read_number(st1) : (((c === "-") && (() => { let n = (() => { let src = _fl_get(st1, "src"); let i = (_fl_get(st1, "idx") + 1); return ((i >= _fl_length(src)) ? null : _fl_char_at(src, i)); })(); return _fl_is_digit_q(n); })()) ? read_number(st1) : (_fl_is_symbol_char_q(c) ? read_symbol(st1, "Symbol") : (true ? emit(advance(st1), "Unknown", c, line, col) : null))))))))))))); })()); })(); }
function lex(src) { return (() => {
        let cur = make_state(src);
        while (true) {
          const __r = (() => { return (at_end_q(skip_ws(cur)) ? _fl_get(cur, "tokens") : { __recur: true, a: [read_token(cur)] }); })();
          if (__r && __r.__recur) {
            [cur] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function make_node(kind, fields) { return _fl_map_set(fields, "kind", kind); }
function make_literal(type, val, line) { return make_node("literal", { type: type, value: val, line: line }); }
function make_variable(name, line) { return make_node("variable", { name: name, line: line }); }
function make_keyword(name, line) { return make_node("keyword", { name: name, line: line }); }
function make_sexpr(op, args, line) { return make_node("sexpr", { op: op, args: args, line: line }); }
function make_block(type, fields, line) { return make_node("block", { type: type, fields: fields, line: line }); }
function p_peek(p) { return (() => { let t = _fl_get(p, "tokens"); let i = _fl_get(p, "idx"); return ((i >= _fl_length(t)) ? null : _fl_get(t, i)); })(); }
function p_advance(p) { return _fl_map_set(p, "idx", (_fl_get(p, "idx") + 1)); }
function parse_expr(p) { return (() => { let t = p_peek(p); let k = _fl_get(t, "kind"); return (_fl_null_q(t) ? { p: p, node: null } : ((k === "LParen") ? parse_sexpr(p) : ((k === "LBracket") ? parse_bracket(p) : ((k === "LBrace") ? parse_map(p) : (true ? (() => { let line = _fl_get(t, "line"); let val = _fl_get(t, "value"); return { p: p_advance(p), node: ((k === "Number") ? make_literal("number", val, line) : ((k === "String") ? make_literal("string", val, line) : ((k === "Symbol") ? make_literal("symbol", val, line) : ((k === "Variable") ? make_variable(val, line) : ((k === "Keyword") ? make_keyword(val, line) : (true ? make_literal("unknown", val, line) : null)))))) }; })() : null))))); })(); }
function parse_args(p, acc, end_kind) { return (() => {
        let cur = p; let res = acc;
        while (true) {
          const __r = (() => { return (() => { let t = p_peek(cur); return ((_fl_null_q(t) || (_fl_get(t, "kind") === end_kind)) ? { p: p_advance(cur), node: res } : (() => { let one = parse_expr(cur); return { __recur: true, a: [_fl_get(one, "p"), _fl_append(res, _fl_get(one, "node"))] }; })()); })(); })();
          if (__r && __r.__recur) {
            [cur, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function parse_sexpr(p) { return (() => { let line = _fl_get(p_peek(p), "line"); let p1 = p_advance(p); let res = parse_args(p1, [], "RParen"); let args = _fl_get(res, "node"); let p2 = _fl_get(res, "p"); return ((_fl_length(args) === 0) ? { p: p2, node: make_sexpr("", [], line) } : (() => { let op_node = _fl_get(args, 0); let op = ((_fl_get(op_node, "kind") === "literal") ? _fl_get(op_node, "value") : ((_fl_get(op_node, "kind") === "variable") ? _fl_str("$", _fl_get(op_node, "name")) : (true ? "unknown" : null))); return { p: p2, node: make_sexpr(op, _fl_slice(args, 1, _fl_length(args)), line) }; })()); })(); }
function parse_bracket(p) { return (() => { let line = _fl_get(p_peek(p), "line"); let p1 = p_advance(p); let next = p_peek(p1); let val = _fl_get(next, "value"); return (((!_fl_null_q(next)) && (_fl_get(next, "kind") === "Symbol") && ((_fl_char_at(val, 0) >= "A") && (_fl_char_at(val, 0) <= "Z"))) ? (() => { let res = parse_fields(p_advance(p1), {  }); return { p: _fl_get(res, "p"), node: make_block(val, _fl_get(res, "node"), line) }; })() : (() => { let res = parse_args(p1, [], "RBracket"); return { p: _fl_get(res, "p"), node: make_block("Array", {  }, line) }; })()); })(); }
function parse_fields(p, acc) { return (() => {
        let cur = p; let res = acc;
        while (true) {
          const __r = (() => { return (() => { let t = p_peek(cur); return ((_fl_null_q(t) || (_fl_get(t, "kind") === "RBracket")) ? { p: p_advance(cur), node: res } : ((_fl_get(t, "kind") === "Keyword") ? (() => { let k = _fl_get(t, "value"); let v = parse_expr(p_advance(cur)); return { __recur: true, a: [_fl_get(v, "p"), _fl_map_set(res, k, _fl_get(v, "node"))] }; })() : { __recur: true, a: [_fl_get(parse_expr(cur), "p"), res] })); })(); })();
          if (__r && __r.__recur) {
            [cur, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function parse_map(p) { return (() => { let line = _fl_get(p_peek(p), "line"); let p1 = p_advance(p); let res = parse_args(p1, [], "RBrace"); return { p: _fl_get(res, "p"), node: make_block("Map", {  }, line) }; })(); }
function parse(tokens) { return (() => {
        let cur = { tokens: tokens, idx: 0 }; let ast = [];
        while (true) {
          const __r = (() => { return ((_fl_get(cur, "idx") >= _fl_length(tokens)) ? ast : (() => { let one = parse_expr(cur); return (_fl_null_q(_fl_get(one, "node")) ? ast : { __recur: true, a: [_fl_get(one, "p"), _fl_append(ast, _fl_get(one, "node"))] }); })()); })();
          if (__r && __r.__recur) {
            [cur, ast] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function js_name(n) { return (_fl_null_q(n) ? "_" : (() => { let clean = ((_fl_char_at(n, 0) === "$") ? _fl_substring(n, 1, _fl_length(n)) : n); let renamed = _fl_replace(_fl_replace(clean, "-", "_"), "?", "_q"); let reserved = ["default", "class", "const", "let", "function", "return", "null", "true", "false", "if", "else", "while", "for", "break", "continue"]; return (some_q(((r) => (r === renamed)), reserved) ? _fl_str(renamed, "_") : renamed); })()); }
function cg(n) { return (_fl_null_q(n) ? "null" : ((_fl_get(n, "kind") === "literal") ? cg_literal(n) : ((_fl_get(n, "kind") === "variable") ? js_name(_fl_get(n, "name")) : ((_fl_get(n, "kind") === "keyword") ? _fl_str("\"", _fl_get(n, "name"), "\"") : ((_fl_get(n, "kind") === "sexpr") ? cg_sexpr(n) : ((_fl_get(n, "kind") === "block") ? cg_block(n) : (true ? "null" : null))))))); }
function cg_literal(n) { return (() => { let t = _fl_get(n, "type"); let v = _fl_get(n, "value"); return ((t === "number") ? v : ((t === "string") ? _fl_str("\"", _fl_replace(_fl_replace(v, "\\", "\\\\"), "\"", "\\\""), "\"") : ((t === "boolean") ? (v ? "true" : "false") : ((t === "symbol") ? ((v === "true") ? "true" : ((v === "false") ? "false" : ((v === "nil") ? "null" : (true ? js_name(v) : null)))) : (true ? "null" : null))))); })(); }
function cg_block(n) { return (() => { let t = _fl_get(n, "type"); let f = _fl_get(n, "fields"); return ((t === "FUNC") ? (() => { let name = js_name(_fl_get(n, "name")); let ps = extract_params(_fl_get(f, "params")); let body = cg(_fl_get(f, "body")); return _fl_str("const ", name, " = (", ps, ") => ", body, ";"); })() : ((t === "Array") ? _fl_str("[", cg_args(_fl_get(f, "items")), "]") : ((t === "Map") ? _fl_str("({", cg_map(_fl_get(f, "items")), "})") : (true ? "null" : null)))); })(); }
function cg_map(items) { return (() => {
        let i = 0; let acc = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(items)) ? acc : (() => { let k = _fl_get(items, i); let v = _fl_get(items, (i + 1)); let ks = ((_fl_get(k, "kind") === "keyword") ? _fl_get(k, "name") : (true ? _fl_str(_fl_get(k, "value")) : null)); let pair = _fl_str("\"", ks, "\":", cg(v)); return { __recur: true, a: [(i + 2), ((i === 0) ? pair : _fl_str(acc, ",", pair))] }; })()); })();
          if (__r && __r.__recur) {
            [i, acc] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function extract_params(ps_node) { return (_fl_null_q(ps_node) ? "" : (() => {
        let i = 0; let acc = ""; let items = _fl_get(_fl_get(ps_node, "fields"), "items");
        while (true) {
          const __r = (() => { return ((i >= _fl_length(items)) ? acc : (() => { let node = _fl_get(items, i); let name = js_name(((_fl_get(node, "kind") === "variable") ? _fl_get(node, "name") : _fl_get(node, "value"))); return { __recur: true, a: [(i + 1), ((i === 0) ? name : _fl_str(acc, ",", name))] }; })()); })();
          if (__r && __r.__recur) {
            [i, acc, items] = __r.a;
            continue;
          }
          return __r;
        }
      })()); }
function cg_sexpr(n) { return cg_sexpr_dispatch(_fl_get(n, "op"), _fl_get(n, "args")); }
function cg_sexpr_dispatch(op, args) { return ((op === "if") ? _fl_str("(", cg(_fl_get(args, 0)), "?", cg(_fl_get(args, 1)), ":", ((_fl_length(args) >= 3) ? cg(_fl_get(args, 2)) : "null"), ")") : ((op === "let") ? (() => { let bindings = _fl_get(_fl_get(_fl_get(args, 0), "fields"), "items"); let inits = (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(bindings)) ? res : (() => { let p = _fl_get(bindings, i); let pitems = _fl_get(_fl_get(p, "fields"), "items"); let name = js_name(((_fl_get(_fl_get(pitems, 0), "kind") === "variable") ? _fl_get(_fl_get(pitems, 0), "name") : _fl_get(_fl_get(pitems, 0), "value"))); let val = cg(_fl_get(pitems, 1)); return { __recur: true, a: [(i + 1), _fl_str(res, "let ", name, "=", val, ";")] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(); let body = (() => {
        let i = 1; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? res : (() => { let _fl_last = (i === (_fl_length(args) - 1)); let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), _fl_str(res, (_fl_last ? "return " : ""), c, ";")] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(); return _fl_str("((()=>{", inits, body, "})())"); })() : ((op === "fn") ? (() => { let ps = extract_params(_fl_get(args, 0)); return _fl_str("((", ps, ") => ", cg(_fl_get(args, 1)), ")"); })() : ((op === "defn") ? (() => { let name = js_name(_fl_get(_fl_get(args, 0), "value")); let ps = extract_params(_fl_get(args, 1)); return _fl_str("const ", name, " = (", ps, ") => ", cg(_fl_get(args, 2)), ";"); })() : ((op === "do") ? _fl_str("((() => {", (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? res : (() => { let _fl_last = (i === (_fl_length(args) - 1)); let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), _fl_str(res, (_fl_last ? "return " : ""), c, ";")] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(), "})())") : ((op === "cond") ? (() => {
        let i = (_fl_length(args) - 1); let acc = "null";
        while (true) {
          const __r = (() => { return ((i < 0) ? acc : (() => { let pair = _fl_get(_fl_get(_fl_get(args, i), "fields"), "items"); let t = cg(_fl_get(pair, 0)); let b = cg(_fl_get(pair, 1)); return { __recur: true, a: [(i - 1), _fl_str("(", t, "?", b, ":", acc, ")")] }; })()); })();
          if (__r && __r.__recur) {
            [i, acc] = __r.a;
            continue;
          }
          return __r;
        }
      })() : ((op === "loop") ? (() => { let bindings = _fl_get(_fl_get(_fl_get(args, 0), "fields"), "items"); let inits = (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(bindings)) ? res : (() => { let p = _fl_get(bindings, i); let pitems = _fl_get(_fl_get(p, "fields"), "items"); let name = js_name(((_fl_get(_fl_get(pitems, 0), "kind") === "variable") ? _fl_get(_fl_get(pitems, 0), "name") : _fl_get(_fl_get(pitems, 0), "value"))); let val = cg(_fl_get(pitems, 1)); return { __recur: true, a: [(i + 1), _fl_str(res, "let ", name, "=", val, ";")] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(); let names = (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(bindings)) ? res : (() => { let p = _fl_get(bindings, i); let pitems = _fl_get(_fl_get(p, "fields"), "items"); let name = js_name(((_fl_get(_fl_get(pitems, 0), "kind") === "variable") ? _fl_get(_fl_get(pitems, 0), "name") : _fl_get(_fl_get(pitems, 0), "value"))); return { __recur: true, a: [(i + 1), ((i === 0) ? name : _fl_str(res, ",", name))] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(); let body = (() => {
        let i = 1; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? res : (() => { let _fl_last = (i === (_fl_length(args) - 1)); let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), _fl_str(res, (_fl_last ? "return " : ""), c, ";")] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(); return _fl_str("((()=>{", inits, "while(true){const __r=(()=>{", body, "})();if(__r&&__r.__recur){[", names, "]=__r.a;continue;}return __r;}})())"); })() : ((op === "recur") ? _fl_str("{__recur:true, a:[", cg_args(args), "]}") : ((op === "list") ? _fl_str("[", cg_args(args), "]") : ((op === "and") ? _fl_str("(", (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? res : (() => { let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), ((i === 0) ? c : _fl_str(res, "&&", c))] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(), ")") : ((op === "or") ? _fl_str("(", (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? res : (() => { let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), ((i === 0) ? c : _fl_str(res, "||", c))] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(), ")") : ((op === "not") ? _fl_str("(!", cg(_fl_get(args, 0)), ")") : ((op === "+") ? _fl_str("(", (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? ((_fl_length(args) === 0) ? "0" : res) : (() => { let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), ((i === 0) ? c : _fl_str(res, "+", c))] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(), ")") : ((op === "-") ? ((_fl_length(args) === 1) ? _fl_str("(-", cg(_fl_get(args, 0)), ")") : _fl_str("(", (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? res : (() => { let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), ((i === 0) ? c : _fl_str(res, "-", c))] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(), ")")) : ((op === "*") ? _fl_str("(", (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? ((_fl_length(args) === 0) ? "1" : res) : (() => { let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), ((i === 0) ? c : _fl_str(res, "*", c))] }; })()); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })(), ")") : ((op === "/") ? _fl_str("(", cg(_fl_get(args, 0)), "/", cg(_fl_get(args, 1)), ")") : ((op === "%") ? _fl_str("(", cg(_fl_get(args, 0)), "%", cg(_fl_get(args, 1)), ")") : ((op === "=") ? _fl_str("(", cg(_fl_get(args, 0)), "===", cg(_fl_get(args, 1)), ")") : ((op === "!=") ? _fl_str("(", cg(_fl_get(args, 0)), "!==", cg(_fl_get(args, 1)), ")") : ((op === "<") ? _fl_str("(", cg(_fl_get(args, 0)), "<", cg(_fl_get(args, 1)), ")") : ((op === ">") ? _fl_str("(", cg(_fl_get(args, 0)), ">", cg(_fl_get(args, 1)), ")") : ((op === "<=") ? _fl_str("(", cg(_fl_get(args, 0)), "<=", cg(_fl_get(args, 1)), ")") : ((op === ">=") ? _fl_str("(", cg(_fl_get(args, 0)), ">=", cg(_fl_get(args, 1)), ")") : (true ? (() => { let builtin_map = { println: "console.log", length: "_fl_length", get: "_fl_get", keys: "_fl_keys", append: "_fl_append", range: "_fl_range", slice: "_fl_slice", map: "_fl_map", filter: "_fl_filter", reduce: "_fl_reduce", str: "_fl_str", "str-upper": "_fl_upper", "str-lower": "_fl_lower", "str-contains": "_fl_contains_q", replace: "_fl_replace", "str-index-of": "_fl_str_index_of", "array?": "_fl_array_q", "list?": "_fl_array_q", "null?": "_fl_null_q", "nil?": "_fl_null_q" }; let js_op = _fl_get(builtin_map, op); return _fl_str((_fl_null_q(js_op) ? js_name(op) : js_op), "(", cg_args(args), ")"); })() : null)))))))))))))))))))))))); }
function cg_args(args) { return (() => {
        let i = 0; let acc = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(args)) ? acc : (() => { let c = cg(_fl_get(args, i)); return { __recur: true, a: [(i + 1), ((i === 0) ? c : _fl_str(acc, ",", c))] }; })()); })();
          if (__r && __r.__recur) {
            [i, acc] = __r.a;
            continue;
          }
          return __r;
        }
      })(); }
function runtime_prelude() { return _fl_str("const _fl_str = (...xs) => xs.map(x => x==null?'':String(x)).join('');", "const _fl_length = (x) => (x?x.length:0);", "const _fl_get = (o,k) => (o && o[k]!==undefined ? o[k] : null);", "const _fl_keys = (o) => (o?Object.keys(o):[]);", "const _fl_entries = (o) => (o?Object.entries(o):[]);", "const _fl_append = (l,x) => [...(l||[]), x];", "const _fl_range = (a,b) => { let r=[]; let s=(b===undefined?0:a); let e=(b===undefined?a:b); for(let i=s;i<e;i++) r.push(i); return r; };", "const _fl_slice = (l,a,b) => (l||[]).slice(a,b);", "const _fl_map = (l,f) => (l||[]).map(f);", "const _fl_filter = (l,f) => (l||[]).filter(f);", "const _fl_reduce = (l,f,i) => (l||[]).reduce(f,i);", "const _fl_upper = (s) => String(s||'').toUpperCase();", "const _fl_lower = (s) => String(s||'').toLowerCase();", "const _fl_contains_q = (s,p) => String(s||'').includes(p);", "const _fl_replace = (s,a,b) => String(s||'').split(a).join(b);", "const _fl_str_index_of = (s,p) => String(s||'').indexOf(p);", "const _fl_file_read = (p) => require('fs').readFileSync(p,'utf8');", "const _fl_file_write = (p,c) => require('fs').writeFileSync(p,c);", "const _fl_array_q = (x) => Array.isArray(x);", "const _fl_null_q = (x) => (x==null);", "const list = (...args) => args;", "const _fl_get_argv = () => process.argv.slice(2);"); }
function fl__gtjs(ast) { return _fl_str(runtime_prelude(), "\n", (() => {
        let i = 0; let res = "";
        while (true) {
          const __r = (() => { return ((i >= _fl_length(ast)) ? res : { __recur: true, a: [(i + 1), _fl_str(res, cg(_fl_get(ast, i)), ";\n")] }); })();
          if (__r && __r.__recur) {
            [i, res] = __r.a;
            continue;
          }
          return __r;
        }
      })()); }
function compile_file(input, output) { return (() => { let src = _fl_file_read(input); let tokens = lex(src); let ast = parse(tokens); let js = fl__gtjs(ast); return (() => { _fl_file_write(output, js); return _fl_print(_fl_str("✓ Compiled ", input, " -> ", output)); })(); })(); }
function cli_main() { return (() => { let argv = _fl_get_argv(); return ((_fl_null_q(argv) || (_fl_length(argv) === 0)) ? _fl_print("FreeLang v11.2 Self-hosted Compiler") : (() => { let cmd = _fl_get(argv, 0); return ((cmd === "version") ? _fl_print("FreeLang v11.2-RC1") : ((cmd === "compile") ? compile_file(_fl_get(argv, 1), ((_fl_length(argv) >= 3) ? _fl_get(argv, 2) : _fl_str(_fl_get(argv, 1), ".js"))) : (true ? compile_file(_fl_get(argv, 0), _fl_str(_fl_get(argv, 0), ".js")) : null))); })()); })(); }
cli_main()
module.exports = {
  _fl_is_digit_q: _fl_is_digit_q,
  _fl_is_alpha_q: _fl_is_alpha_q,
  _fl_is_alnum_q: _fl_is_alnum_q,
  _fl_is_space_q: _fl_is_space_q,
  _fl_is_symbol_char_q: _fl_is_symbol_char_q,
  make_state: make_state,
  peek: peek,
  at_end_q: at_end_q,
  advance: advance,
  emit: emit,
  skip_ws: skip_ws,
  read_number: read_number,
  read_string: read_string,
  translate_esc: translate_esc,
  read_symbol: read_symbol,
  read_token: read_token,
  lex: lex,
  make_node: make_node,
  make_literal: make_literal,
  make_variable: make_variable,
  make_keyword: make_keyword,
  make_sexpr: make_sexpr,
  make_block: make_block,
  p_peek: p_peek,
  p_advance: p_advance,
  parse_expr: parse_expr,
  parse_args: parse_args,
  parse_sexpr: parse_sexpr,
  parse_bracket: parse_bracket,
  parse_fields: parse_fields,
  parse_map: parse_map,
  parse: parse,
  js_name: js_name,
  cg: cg,
  cg_literal: cg_literal,
  cg_block: cg_block,
  cg_map: cg_map,
  extract_params: extract_params,
  cg_sexpr: cg_sexpr,
  cg_sexpr_dispatch: cg_sexpr_dispatch,
  cg_args: cg_args,
  runtime_prelude: runtime_prelude,
  fl__gtjs: fl__gtjs,
  compile_file: compile_file,
  cli_main: cli_main
};