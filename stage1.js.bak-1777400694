function _fl_is_digit_q() { return (_fl_null_q(c) ? false : ((c >= "0") && (c <= "9"))); }
function _fl_is_alpha_q() { return (_fl_null_q(c) ? false : (((c >= "a") && (c <= "z")) || ((c >= "A") && (c <= "Z")))); }
function _fl_is_alnum_q() { return (_fl_is_digit_q(c) || _fl_is_alpha_q(c)); }
function _fl_is_space_q() { return or((c === " "), (c === "\t"), (c === "\n"), (c === "\r")); }
function _fl_is_symbol_char_q() { return (_fl_null_q(c) ? false : or(_fl_is_alnum_q(c), (c === "-"), (c === "_"), (c === "?"), (c === "!"), (c === "/"), (c === "."), (c === "<"), (c === ">"), (c === "="), (c === "+"), (c === "*"), (c === "%"), (c === "&"), (c === "|"), (c === "^"), (c === "~"))); }
function make_state() { return {}; }
function peek_at() { return (() => { let src = _fl_get(st, "src"); let i = (_fl_get(st, "idx") + offset); return ((i >= _fl_length(src)) ? null : char_at(src, i)); })(); }
function peek() { return peek_at(st, 0); }
function at_end_q() { return (_fl_get(st, "idx") >= _fl_length(_fl_get(st, "src"))); }
function advance() { return (() => { let c = peek(st); return ((c === "\n") ? {} : {}); })(); }
function emit() { return {}; }
function skip_comment() { return (at_end_q(st) ? st : (() => { let c = peek(st); return ((c === "\n") ? advance(st) : skip_comment(advance(st))); })()); }
function skip_ws() { return (at_end_q(st) ? st : (() => { let c = peek(st); return cond([ _fl_is_space_q(c), skip_ws(advance(st)) ], [ (c === ";"), skip_ws(skip_comment(st)) ], [ true, st ]); })()); }
function read_number_body() { return (at_end_q(st) ? emit(st, "Number", acc, line, col) : (() => { let c = peek(st); return cond([ _fl_is_digit_q(c), read_number_body(advance(st), _fl_str(acc, c), has_dot, line, col) ], [ ((c === ".") && (!has_dot)), read_number_body(advance(st), _fl_str(acc, c), true, line, col) ], [ true, emit(st, "Number", acc, line, col) ]); })()); }
function read_number() { return read_number_body(st, "", false, _fl_get(st, "line"), _fl_get(st, "col")); }
function translate_esc() { return cond([ (c === "n"), "\n" ], [ (c === "t"), "\t" ], [ (c === "r"), "\r" ], [ (c === "\""), "\"" ], [ (c === "\\"), "\\" ], [ true, c ]); }
function read_string_body() { return (at_end_q(st) ? emit(st, "String", acc, line, col) : (() => { let c = peek(st); return cond([ (c === "\""), emit(advance(st), "String", acc, line, col) ], [ (c === "\\"), (() => { let st2 = advance(st); let c2 = peek(st2); return read_string_body(advance(st2), _fl_str(acc, translate_esc(c2)), line, col); })() ], [ true, read_string_body(advance(st), _fl_str(acc, c), line, col) ]); })()); }
function read_string() { return (() => { let line = _fl_get(st, "line"); let col = _fl_get(st, "col"); let st1 = advance(st); return read_string_body(st1, "", line, col); })(); }
function read_symbol_body_kind() { return (at_end_q(st) ? emit(st, kind, acc, line, col) : (() => { let c = peek(st); return (_fl_is_symbol_char_q(c) ? read_symbol_body_kind(advance(st), _fl_str(acc, c), line, col, kind) : emit(st, kind, acc, line, col)); })()); }
function read_symbol() { return read_symbol_body_kind(st, "", _fl_get(st, "line"), _fl_get(st, "col"), "Symbol"); }
function read_variable() { return (() => { let line = _fl_get(st, "line"); let col = _fl_get(st, "col"); let st1 = advance(st); return read_symbol_body_kind(st1, "", line, col, "Variable"); })(); }
function read_keyword() { return (() => { let line = _fl_get(st, "line"); let col = _fl_get(st, "col"); let st1 = advance(st); return read_symbol_body_kind(st1, "", line, col, "Keyword"); })(); }
function read_token() { return (() => { let st1 = skip_ws(st); return (at_end_q(st1) ? st1 : (() => { let c = peek(st1); let line = _fl_get(st1, "line"); let col = _fl_get(st1, "col"); return cond([ (c === "("), emit(advance(st1), "LParen", c, line, col) ], [ (c === ")"), emit(advance(st1), "RParen", c, line, col) ], [ (c === "["), emit(advance(st1), "LBracket", c, line, col) ], [ (c === "]"), emit(advance(st1), "RBracket", c, line, col) ], [ (c === "{"), emit(advance(st1), "LBrace", c, line, col) ], [ (c === "}"), emit(advance(st1), "RBrace", c, line, col) ], [ (c === "\""), read_string(st1) ], [ (c === "$"), read_variable(st1) ], [ (c === ":"), read_keyword(st1) ], [ _fl_is_digit_q(c), read_number(st1) ], [ ((c === "-") && _fl_is_digit_q(peek_at(st1, 1))), read_number_body(advance(st1), "-", false, line, col) ], [ _fl_is_symbol_char_q(c), read_symbol(st1) ], [ true, emit(advance(st1), "Unknown", c, line, col) ]); })()); })(); }
function lex_loop() { return (() => { let st1 = skip_ws(st); return (at_end_q(st1) ? _fl_get(st1, "tokens") : lex_loop(read_token(st1))); })(); }
function lex() { return lex_loop(make_state(src)); }
function make_literal() { return {}; }
function make_variable() { return {}; }
function make_keyword() { return {}; }
function make_sexpr() { return {}; }
function make_number() { return make_literal("number", v, line); }
function make_string() { return make_literal("string", v, line); }
function make_bool() { return make_literal("boolean", v, line); }
function make_null() { return make_literal("null", null, line); }
function make_symbol() { return make_literal("symbol", v, line); }
function make_block() { return {}; }
function make_array_block() { return make_block("Array", null, {  }, line); }
function make_map_block() { return make_block("Map", null, {  }, line); }
function make_pattern_literal() { return {}; }
function make_pattern_variable() { return {}; }
function make_pattern_wildcard() { return {}; }
function make_pattern_list() { return {  }; }
function make_pattern_struct() { return {}; }
function make_pattern_or() { return {}; }
function make_pattern_range() { return {}; }
function make_pattern_match() { return {}; }
function make_match_case() { return {}; }
function make_function_value() { return {}; }
function make_type_class() { return {}; }
function make_type_class_instance() { return {}; }
function make_module_block() { return {}; }
function make_import_block() { return {}; }
function make_open_block() { return {}; }
function make_search_block() { return {}; }
function make_learn_block() { return {}; }
function make_reasoning_block() { return {}; }
function make_async_function() { return {}; }
function make_await() { return {}; }
function make_try() { return {}; }
function make_catch() { return {}; }
function make_throw() { return {}; }
function make_template_string() { return {}; }
function make_page() { return {}; }
function make_route() { return {}; }
function make_component() { return {}; }
function make_form() { return {}; }
function deep_equal_q() { return cond([ (_fl_null_q(a) && _fl_null_q(b)), true ], [ (_fl_null_q(a) || _fl_null_q(b)), false ], [ (_fl_list_q(a) && _fl_list_q(b)), deep_equal_list_q(a, b, 0) ], [ (_fl_map_q(a) && _fl_map_q(b)), deep_equal_map_q(a, b) ], [ true, (a === b) ]); }
function deep_equal_list_q() { return cond([ (!(_fl_length(a) === _fl_length(b))), false ], [ (i >= _fl_length(a)), true ], [ (!deep_equal_q(_fl_get(a, i), _fl_get(b, i))), false ], [ true, deep_equal_list_q(a, b, (i + 1)) ]); }
function deep_equal_map_q() { return (() => { let ka = keys_no_line(a); let kb = keys_no_line(b); return ((!(_fl_length(ka) === _fl_length(kb))) ? false : deep_equal_map_keys_q(a, b, ka, 0)); })(); }
function keys_no_line() { return __fl_filter((() => (!(k === "line"))), json_keys(m)); }
function deep_equal_map_keys_q() { return cond([ (i >= _fl_length(ks)), true ], [ (() => { let k = _fl_get(ks, i); return (!deep_equal_q(_fl_get(a, k), _fl_get(b, k))); })(), false ], [ true, deep_equal_map_keys_q(a, b, ks, (i + 1)) ]); }
function _fl_list_q() { return (_fl_null_q(v) ? false : (str_to_num(_fl_str("[", v)) === null)); }
function _fl_map_q() { return (_fl_null_q(v) ? false : (!_fl_null_q(_fl_get(v, "kind")))); }
function p_make() { return {}; }
function p_peek() { return (() => { let i = _fl_get(p, "idx"); let t = _fl_get(p, "tokens"); return ((i >= _fl_length(t)) ? null : _fl_get(t, i)); })(); }
function p_peek_at() { return (() => { let i = (_fl_get(p, "idx") + offset); let t = _fl_get(p, "tokens"); return ((i >= _fl_length(t)) ? null : _fl_get(t, i)); })(); }
function p_end_q() { return (_fl_get(p, "idx") >= _fl_length(_fl_get(p, "tokens"))); }
function p_advance() { return {}; }
function p_with_ast() { return {}; }
function p_append_ast() { return p_with_ast(p, _fl_append(_fl_get(p, "ast"), [node])); }
function r_pair() { return {}; }
function string_contains_q() { return (!(_1 === str_index_of(s, substr))); }
function parse_atom() { return (() => { let t = p_peek(p); let k = _fl_get(t, "kind"); let v = _fl_get(t, "value"); let line = _fl_get(t, "line"); return cond([ (k === "Number"), r_pair(p_advance(p), make_literal("number", v, line)) ], [ (k === "String"), (string_contains_q(v, "${") ? r_pair(p_advance(p), make_template_string(v, [], line)) : r_pair(p_advance(p), make_literal("string", v, line))) ], [ (k === "Symbol"), r_pair(p_advance(p), make_literal("symbol", v, line)) ], [ (k === "Variable"), r_pair(p_advance(p), make_variable(v, line)) ], [ (k === "Keyword"), r_pair(p_advance(p), make_keyword(v, line)) ], [ true, r_pair(p_advance(p), make_literal("unknown", v, line)) ]); })(); }
function parse_expr() { return (() => { let t = p_peek(p); let k = _fl_get(t, "kind"); return cond([ (k === "LParen"), parse_sexpr(p) ], [ (k === "LBracket"), parse_bracket(p) ], [ (k === "LBrace"), parse_map(p) ], [ true, parse_atom(p) ]); })(); }
function parse_sexpr() { return (() => { let start_tok = p_peek(p); let line = _fl_get(start_tok, "line"); let p1 = p_advance(p); let _fl_first = parse_args(p1, [  ]); let p2 = _fl_get(_fl_first, "p"); let args = _fl_get(_fl_first, "node"); return ((_fl_length(args) === 0) ? r_pair(parse_consume_rparen(p2), make_sexpr("", [], line)) : (() => { let op_node = _fl_get(args, 0); let op = ((_fl_get(op_node, "kind") === "literal") ? _fl_get(op_node, "value") : ((_fl_get(op_node, "kind") === "variable") ? _fl_str("$", _fl_get(op_node, "name")) : "unknown")); let _fl_rest = slice(args, 1, _fl_length(args)); return ((op === "try") ? (() => { let body = ((_fl_length(_fl_rest) > 0) ? _fl_get(_fl_rest, 0) : null); let catch_clause = ((_fl_length(_fl_rest) > 1) ? _fl_get(_fl_rest, 1) : null); let finally_clause = ((_fl_length(_fl_rest) > 2) ? _fl_get(_fl_rest, 2) : null); return r_pair(parse_consume_rparen(p2), make_try(body, catch_clause, finally_clause, line)); })() : r_pair(parse_consume_rparen(p2), make_sexpr(op, _fl_rest, line))); })()); })(); }
function parse_consume_rparen() { return (() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RParen")) ? p_advance(p) : p); })(); }
function parse_args() { return (() => { let t = p_peek(p); return cond([ _fl_null_q(t), r_pair(p, acc) ], [ (_fl_get(t, "kind") === "RParen"), r_pair(p, acc) ], [ (_fl_get(t, "kind") === "RBracket"), r_pair(p, acc) ], [ (_fl_get(t, "kind") === "RBrace"), r_pair(p, acc) ], [ true, (() => { let one = parse_expr(p); return parse_args(_fl_get(one, "p"), _fl_append(acc, [_fl_get(one, "node")])); })() ]); })(); }
function parse_bracket() { return (() => { let tok = p_peek(p); let line = _fl_get(tok, "line"); let p1 = p_advance(p); let next = p_peek(p1); return (and((!_fl_null_q(next)), (_fl_get(next, "kind") === "Symbol"), is_block_type_q(_fl_get(next, "value")), (_fl_get(next, "value") === upper_case(_fl_get(next, "value")))) ? parse_named_block(p1, line) : parse_array(p1, line)); })(); }
function is_block_type_q() { return (() => { let c = char_at(s, 0); return ((c >= "A") && (c <= "Z")); })(); }
function upper_case() { return s; }
function parse_array() { return (() => { let collected = parse_args(p, [  ]); let p2 = _fl_get(collected, "p"); let items = _fl_get(collected, "node"); return r_pair(parse_consume_rbracket(p2), make_array_block(items, line)); })(); }
function parse_consume_rbracket() { return (() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RBracket")) ? p_advance(p) : p); })(); }
function parse_named_block() { return (() => { let type_tok = p_peek(p); let type = _fl_get(type_tok, "value"); let p1 = p_advance(p); let name_info = parse_optional_name(p1); let p2 = _fl_get(name_info, "p"); let name = _fl_get(name_info, "node"); let fields_info = parse_block_fields(p2, {}); let p3 = _fl_get(fields_info, "p"); let fields = _fl_get(fields_info, "node"); return r_pair(parse_consume_rbracket(p3), make_block(type, name, fields, line)); })(); }
function parse_optional_name() { return (() => { let t = p_peek(p); return (and((!_fl_null_q(t)), (_fl_get(t, "kind") === "Symbol"), (!(char_at(_fl_get(t, "value"), 0) === ":"))) ? r_pair(p_advance(p), _fl_get(t, "value")) : r_pair(p, null)); })(); }
function parse_block_fields() { return (() => { let t = p_peek(p); return cond([ _fl_null_q(t), r_pair(p, acc) ], [ (_fl_get(t, "kind") === "RBracket"), r_pair(p, acc) ], [ (_fl_get(t, "kind") === "Keyword"), (() => { let key = _fl_get(t, "value"); let p1 = p_advance(p); let val = parse_expr(p1); let p2 = _fl_get(val, "p"); let v = _fl_get(val, "node"); return parse_block_fields(p2, json_set(acc, key, v)); })() ], [ true, r_pair(p_advance(p), acc) ]); })(); }
function parse_map() { return (() => { let tok = p_peek(p); let line = _fl_get(tok, "line"); let p1 = p_advance(p); let collected = parse_args(p1, [  ]); let p2 = _fl_get(collected, "p"); let items = _fl_get(collected, "node"); return r_pair(parse_consume_rbrace(p2), make_map_block(items, line)); })(); }
function parse_consume_rbrace() { return (() => { let t = p_peek(p); return (((!_fl_null_q(t)) && (_fl_get(t, "kind") === "RBrace")) ? p_advance(p) : p); })(); }
function parse_all() { return (p_end_q(p) ? _fl_get(p, "ast") : (() => { let one = parse_expr(p); let p2 = p_append_ast(_fl_get(one, "p"), _fl_get(one, "node")); return parse_all(p2); })()); }
function parse() { return parse_all(p_make(tokens)); }
function esc_1() { return replace(s, "\\", "\\\\"); }
function esc_2() { return replace(s, "\"", "\\\""); }
function esc_3() { return replace(s, "\n", "\\n"); }
function esc_4() { return replace(s, "\r", "\\r"); }
function esc_5() { return replace(s, "\t", "\\t"); }
function js_esc_inner() { return esc_5(esc_4(esc_3(esc_2(esc_1(s))))); }
function js_esc() { return _fl_str("\"", js_esc_inner(s), "\""); }
function fl_reserved_q() { return or((n === "loop"), (n === "recur"), (n === "fn"), (n === "defn"), (n === "defun"), (n === "if"), (n === "cond"), (n === "do"), (n === "begin"), (n === "progn"), (n === "while"), (n === "and"), (n === "or"), (n === "let"), (n === "set!"), (n === "define"), (n === "async"), (n === "await"), (n === "try"), (n === "catch"), (n === "finally"), (n === "throw"), (n === "quote"), (n === "compose"), (n === "pipe"), (n === "->"), (n === "->>"), (n === "|>")); }
function js_reserved_q() { return or((n === "default"), (n === "class"), (n === "const"), (n === "let"), (n === "if"), (n === "else"), (n === "switch"), (n === "case"), (n === "break"), (n === "continue"), (n === "for"), (n === "while"), (n === "function"), (n === "return"), (n === "throw"), (n === "try"), (n === "catch"), (n === "new"), (n === "delete"), (n === "typeof"), (n === "instanceof"), (n === "var"), (n === "in"), (n === "of"), (n === "this"), (n === "super"), (n === "void"), (n === "yield"), (n === "async"), (n === "await"), (n === "import"), (n === "export"), (n === "enum"), (n === "do"), (n === "with"), (n === "finally"), (n === "null"), (n === "true"), (n === "false")); }
function rename_1() { return replace(n, "-", "_"); }
function rename_2() { return replace(n, "?", "_q"); }
function rename_3() { return replace(n, "!", "_x"); }
function rename_4() { return replace(n, ">", "_gt"); }
function rename_5() { return replace(n, "<", "_lt"); }
function rename_6() { return replace(n, "*", "_st"); }
function rename_7() { return replace(n, "+", "_pl"); }
function js_name_inner() { return (() => { let g = rename_7(rename_6(rename_5(rename_4(rename_3(rename_2(rename_1(n))))))); return (js_reserved_q(g) ? _fl_str(g, "_") : g); })(); }
function js_name() { return (_fl_null_q(n) ? "_" : js_name_inner(n)); }
function cg() { return cond([ _fl_null_q(n), "null" ], [ (_fl_get(n, "kind") === "literal"), cg_literal(n) ], [ (_fl_get(n, "kind") === "variable"), js_name(_fl_get(n, "name")) ], [ (_fl_get(n, "kind") === "keyword"), js_esc(_fl_get(n, "name")) ], [ (_fl_get(n, "kind") === "template-string"), cg_template_string(n) ], [ (_fl_get(n, "kind") === "try"), cg_try(n) ], [ (_fl_get(n, "kind") === "sexpr"), cg_sexpr(n) ], [ (_fl_get(n, "kind") === "block"), cg_block(n) ], [ (_fl_get(n, "kind") === "pattern-match"), cg_match(n) ], [ (_fl_get(n, "kind") === "await"), _fl_str("(await ", cg(_fl_get(n, "argument")), ")") ], [ (_fl_get(n, "kind") === "throw"), _fl_str("(()=>{throw new Error(String(", cg(_fl_get(n, "argument")), "))})()") ], [ true, "null" ]); }
function js_esc_for_template() { return (() => { let s1 = replace(s, "\\", "\\\\"); return replace(s1, "`", "`"); })(); }
function cg_template_string() { return _fl_str("`", js_esc_for_template(_fl_get(n, "value")), "`"); }
function cg_try() { return (() => { let body = _fl_get(n, "body"); let catch_node = _fl_get(n, "catch"); let finally_node = _fl_get(n, "finally"); let body_code = cg(body); let catch_code = (_fl_null_q(catch_node) ? "" : cg_catch_clause(catch_node)); let finally_code = (_fl_null_q(finally_node) ? "" : _fl_str("finally{", cg(finally_node), "}")); return _fl_str("(()=>{try{return ", body_code, "}catch(err){", catch_code, "}", finally_code, "})()"); })(); }
function cg_catch_clause() { return (() => { let param = ((_fl_get(catch_node, "kind") === "sexpr") ? (() => { let args = _fl_get(catch_node, "args"); return ((_fl_length(args) > 0) ? js_name(_fl_str(_fl_get(_fl_get(args, 0), "name"))) : "err"); })() : "err"); let body = ((_fl_get(catch_node, "kind") === "sexpr") ? (() => { let args = _fl_get(catch_node, "args"); return ((_fl_length(args) > 1) ? cg(_fl_get(args, 1)) : "null"); })() : cg(catch_node)); return _fl_str("let ", param, "=err;return ", body, ";"); })(); }
function cg_literal_dispatch() { return cond([ (t === "number"), v ], [ (t === "string"), js_esc(v) ], [ (t === "boolean"), (v ? "true" : "false") ], [ (t === "symbol"), cond([ (v === "true"), "true" ], [ (v === "false"), "false" ], [ (v === "null"), "null" ], [ (v === "nil"), "null" ], [ true, js_name(v) ]) ], [ true, "null" ]); }
function cg_literal() { return cg_literal_dispatch(_fl_get(n, "type"), _fl_get(n, "value")); }
function cg_block_dispatch() { return cond([ (t === "Array"), _fl_str("[", cg_args(_fl_get(fields, "items")), "]") ], [ (t === "Map"), _fl_str("({", cg_map_entries(fields), "})") ], [ true, "null" ]); }
function cg_block() { return (() => { let t = _fl_get(n, "type"); let fields = _fl_get(n, "fields"); return ((t === "FUNC") ? cg_func_block(n) : cg_block_dispatch(t, fields)); })(); }
function cg_map_entries_dispatch() { return (_fl_array_q(items_val) ? cg_map_flat_loop(items_val, 0, "") : cg_map_loop(map_entries(fields), 0, "")); }
function cg_map_entries() { return cg_map_entries_dispatch(_fl_get(fields, "items"), fields); }
function cg_map_loop_inner() { return (() => { let k = _fl_get(e, 0); let v = cg(_fl_get(e, 1)); let pair = _fl_str(js_esc(k), ":", v); return cg_map_loop(entries, (i + 1), ((i === 0) ? pair : _fl_str(acc, ",", pair))); })(); }
function cg_map_loop() { return ((i >= _fl_length(entries)) ? acc : cg_map_loop_inner(entries, i, acc, _fl_get(entries, i))); }
function cg_map_flat_loop_inner() { return (() => { let k_str = cg_keyword_key(k_n); let v_js = _fl_str(cg(v_n)); let pair = _fl_str(k_str, ":", v_js); return cg_map_flat_loop(items, (i + 2), ((i === 0) ? pair : _fl_str(acc, ",", pair))); })(); }
function cg_map_flat_loop() { return ((i >= _fl_length(items)) ? acc : cg_map_flat_loop_inner(items, i, acc, _fl_get(items, i), _fl_get(items, (i + 1)))); }
function cg_keyword_key() { return cond([ (_fl_get(n, "kind") === "keyword"), js_esc(_fl_get(n, "name")) ], [ (_fl_get(n, "kind") === "literal"), js_esc(_fl_str(_fl_get(n, "value"))) ], [ true, "\"_anon\"" ]); }
function cg_func_block_inner() { return (() => { let pitems = (_fl_null_q(pnode) ? [] : _fl_get(_fl_get(pnode, "fields"), "items")); let ps = extract_params(pitems); return _fl_str("const ", name, " = (", ps, ")=>", cg(body), ";"); })(); }
function cg_func_block() { return (() => { let name = js_name(_fl_get(n, "name")); let fields = _fl_get(n, "fields"); return cg_func_block_inner(name, fields, _fl_get(fields, "params"), _fl_get(fields, "body")); })(); }
function cg_if() { return _fl_str("(", cg(_fl_get(args, 0)), "?", cg(_fl_get(args, 1)), ":", ((_fl_length(args) >= 3) ? cg(_fl_get(args, 2)) : "null"), ")"); }
function cg_fn() { return (() => { let pnode = _fl_get(args, 0); let body = _fl_get(args, 1); let ps = extract_params(_fl_get(_fl_get(pnode, "fields"), "items")); return _fl_str("((", ps, ")=>", cg(body), ")"); })(); }
function cg_defn() { return (() => { let name_n = _fl_get(args, 0); let pnode = _fl_get(args, 1); let body = _fl_get(args, 2); let name = extract_name(name_n); let ps = extract_params(_fl_get(_fl_get(pnode, "fields"), "items")); let warning = (fl_reserved_q(name) ? _fl_str("// ⚠️  RESERVED NAME: ", name) : ""); return _fl_str(warning, (fl_reserved_q(name) ? "\n" : ""), "const ", name, " = (", ps, ")=>", cg(body)); })(); }
function cg_define() { return ((_fl_length(args) === 2) ? _fl_str("const ", extract_name(_fl_get(args, 0)), " = ", cg(_fl_get(args, 1))) : cg_defn(args)); }
function cg_let() { return (() => { let bnode = _fl_get(args, 0); let items = _fl_get(_fl_get(bnode, "fields"), "items"); let first_item = (_fl_null_q(items) ? null : _fl_get(items, 0)); let inner_items = (_fl_null_q(first_item) ? null : (((_fl_get(first_item, "kind") === "block") && (_fl_get(first_item, "type") === "Array")) ? _fl_get(_fl_get(first_item, "fields"), "items") : null)); let nested = and((!_fl_null_q(inner_items)), (_fl_length(inner_items) > 0), (_fl_get(_fl_get(inner_items, 0), "kind") === "block"), (_fl_get(_fl_get(inner_items, 0), "type") === "Array")); let bindings = (nested ? cg_let_2d(items, 0, "", 0) : cg_let_1d(items, 0, "", 0)); let body_args = slice(args, 1, _fl_length(args)); let body_js = cg_do_body(body_args, 0, ""); return _fl_str("((()=>{", bindings, body_js, "})())"); })(); }
function cg_let_binding() { return (() => { let kind = _fl_get(pat_node, "kind"); let type = _fl_get(pat_node, "type"); return cond([ (kind === "variable"), _fl_str("let ", js_name(_fl_get(pat_node, "name")), "=", val_js, ";") ], [ ((kind === "block") && (type === "Map")), (() => { let pat_fields = _fl_get(pat_node, "fields"); let pat_entries = map_entries(pat_fields); let pat_bindings = cg_map_pattern_bindings_from_entries(pat_entries, tmpvar, 0, ""); return _fl_str(((val_js === tmpvar) ? "" : _fl_str("let ", tmpvar, "=", val_js, ";")), pat_bindings); })() ], [ ((kind === "block") && (type === "Array")), (() => { let items = _fl_get(_fl_get(pat_node, "fields"), "items"); let first_pat = (_fl_null_q(items) ? null : _fl_get(items, 0)); let tmpvar_next = _fl_str(tmpvar, "_inner"); return (_fl_null_q(first_pat) ? "" : _fl_str("let ", tmpvar, "=", val_js, "[0];", cg_let_binding(first_pat, tmpvar, tmpvar_next))); })() ], [ true, _fl_str("let ", extract_name(pat_node), "=", val_js, ";") ]); })(); }
function cg_let_1d() { return ((i >= _fl_length(items)) ? acc : (() => { let pat_n = ((i < _fl_length(items)) ? _fl_get(items, i) : null); let v_n = (((i + 1) < _fl_length(items)) ? _fl_get(items, (i + 1)) : null); return ((_fl_null_q(pat_n) || _fl_null_q(v_n)) ? cg_let_1d(items, (i + 2), acc, (counter + 1)) : (() => { let val = cg(v_n); let tmpvar = _fl_str("__v", ((counter === 0) ? "" : counter)); return cg_let_1d(items, (i + 2), _fl_str(acc, cg_let_binding(pat_n, val, tmpvar)), (counter + 1)); })()); })()); }
function cg_let_2d() { return ((i >= _fl_length(items)) ? acc : (() => { let pair = _fl_get(items, i); let pair_fields = (_fl_null_q(pair) ? null : _fl_get(pair, "fields")); let pitems = (_fl_null_q(pair_fields) ? null : _fl_get(pair_fields, "items")); let k_n = (((!_fl_null_q(pitems)) && (_fl_length(pitems) > 0)) ? _fl_get(pitems, 0) : null); let v_n = (((!_fl_null_q(pitems)) && (_fl_length(pitems) > 1)) ? _fl_get(pitems, 1) : null); return ((_fl_null_q(k_n) || _fl_null_q(v_n)) ? cg_let_2d(items, (i + 1), acc, (counter + 1)) : (() => { let val = cg(v_n); let tmpvar = _fl_str("__v", ((counter === 0) ? "" : counter)); return cg_let_2d(items, (i + 1), _fl_str(acc, cg_let_binding(k_n, val, tmpvar)), (counter + 1)); })()); })()); }
function cg_do() { return ((_fl_length(args) === 0) ? "null" : _fl_str("(()=>{", cg_do_body(args, 0, ""), "})()")); }
function cg_do_body() { return ((i >= _fl_length(args)) ? acc : (() => { let _fl_last = (i === (_fl_length(args) - 1)); let c = cg(_fl_get(args, i)); let sep = (_fl_last ? "return " : ""); return cg_do_body(args, (i + 1), _fl_str(acc, sep, c, ";")); })()); }
function get_clause_items() { return (() => { let fields = _fl_get(clause, "fields"); let items = _fl_get(fields, "items"); return (_fl_array_q(items) ? items : [_fl_get(fields, 0), _fl_get(fields, 1)]); })(); }
function cg_cond() { return cg_cond_loop(args, 0); }
function cg_cond_loop() { return loop([ j, (_fl_length(args) - 1), acc, "null" ], ((j < 0) ? acc : (() => { let clause = _fl_get(args, j); let citems = get_clause_items(clause); let test = cg(_fl_get(citems, 0)); let result = cg(_fl_get(citems, 1)); return recur((j - 1), _fl_str("(", test, "?", result, ":", acc, ")")); })())); }
function cg_and() { return ((_fl_length(args) === 0) ? "true" : _fl_str("(", and_loop(args, 0, ""), ")")); }
function and_loop() { return ((i >= _fl_length(args)) ? acc : (() => { let c = _fl_str(cg(_fl_get(args, i))); return and_loop(args, (i + 1), ((i === 0) ? c : _fl_str(acc, "&&", c))); })()); }
function cg_or() { return ((_fl_length(args) === 0) ? "false" : _fl_str("(", or_loop(args, 0, ""), ")")); }
function or_loop() { return ((i >= _fl_length(args)) ? acc : (() => { let c = _fl_str(cg(_fl_get(args, i))); return or_loop(args, (i + 1), ((i === 0) ? c : _fl_str(acc, "||", c))); })()); }
function cg_quote() { return ((_fl_length(args) === 0) ? "null" : js_esc(_fl_str(cg(_fl_get(args, 0))))); }
function cg_set_bang() { return _fl_str("(", extract_name(_fl_get(args, 0)), "=", cg(_fl_get(args, 1)), ")"); }
function cg_throw() { return (() => { let m = ((_fl_length(args) === 0) ? "\"error\"" : cg(_fl_get(args, 0))); return _fl_str("(()=>{throw new Error(String(", m, "))})()"); })(); }
function cg_while() { return (() => { let cond = cg(_fl_get(args, 0)); let body_args = slice(args, 1, _fl_length(args)); let body = while_body(body_args, 0, ""); return _fl_str("(()=>{while(", cond, "){", body, "}})()"); })(); }
function while_body() { return ((i >= _fl_length(args)) ? acc : while_body(args, (i + 1), _fl_str(acc, cg(_fl_get(args, i)), ";"))); }
function cg_loop() { return (() => { let bnode = _fl_get(args, 0); let items = _fl_get(_fl_get(bnode, "fields"), "items"); let _fl_first = (_fl_null_q(items) ? null : _fl_get(items, 0)); let nested = (_fl_null_q(_fl_first) ? false : ((_fl_get(_fl_first, "kind") === "block") && (_fl_get(_fl_first, "type") === "Array"))); let bindings = (nested ? loop_inits_2d(items, 0, "") : loop_inits_1d(items, 0, "")); let names = (nested ? loop_names_2d(items, 0, "") : loop_names_1d(items, 0, "")); let body_args = slice(args, 1, _fl_length(args)); let body_js = cg_do_body(body_args, 0, ""); return _fl_str("((()=>{", bindings, "while(true){let __r=(()=>{", body_js, "})();", "if(__r&&__r.__recur){[", names, "]=__r.a;continue;}", "return __r;}})())"); })(); }
function loop_inits_1d() { return ((i >= _fl_length(items)) ? acc : (() => { let k = _fl_get(items, i); let v = _fl_get(items, (i + 1)); return loop_inits_1d(items, (i + 2), _fl_str(acc, "let ", extract_name(k), "=", cg(v), ";")); })()); }
function loop_inits_2d() { return ((i >= _fl_length(items)) ? acc : (() => { let pair = _fl_get(items, i); let pit = _fl_get(_fl_get(pair, "fields"), "items"); return loop_inits_2d(items, (i + 1), _fl_str(acc, "let ", extract_name(_fl_get(pit, 0)), "=", cg(_fl_get(pit, 1)), ";")); })()); }
function loop_names_1d() { return ((i >= _fl_length(items)) ? acc : (() => { let k = _fl_get(items, i); let n = extract_name(k); return loop_names_1d(items, (i + 2), ((_fl_length(acc) === 0) ? n : _fl_str(acc, ",", n))); })()); }
function loop_names_2d() { return ((i >= _fl_length(items)) ? acc : (() => { let pair = _fl_get(items, i); let pit = _fl_get(_fl_get(pair, "fields"), "items"); let n = extract_name(_fl_get(pit, 0)); return loop_names_2d(items, (i + 1), ((_fl_length(acc) === 0) ? n : _fl_str(acc, ",", n))); })()); }
function cg_recur() { return _fl_str("{__recur:true,a:[", cg_args(args), "]}"); }
function cg_match() { return (() => { let val = cg(_fl_get(n, "value")); let cases = _fl_get(n, "cases"); let default_n = _fl_get(n, "defaultCase"); let _default = (_fl_null_q(default_n) ? "null" : cg(default_n)); let cases_js = match_cases_loop(cases, 0, ""); return _fl_str("((__v)=>{", cases_js, "return ", _default, ";})(", val, ")"); })(); }
function match_cases_loop() { return ((i >= _fl_length(cases)) ? acc : (() => { let c = _fl_get(cases, i); let pat = _fl_get(c, "pattern"); let body = cg(_fl_get(c, "body")); let guard_n = _fl_get(c, "guard"); let test = pattern_test(pat, "__v"); let bind = pattern_bindings(pat, "__v"); let guard_js = (_fl_null_q(guard_n) ? "true" : cg(guard_n)); let inner = (_fl_null_q(guard_n) ? _fl_str(bind, "return ", body, ";") : _fl_str(bind, "if(", guard_js, "){return ", body, ";}")); return match_cases_loop(cases, (i + 1), _fl_str(acc, "if(", test, "){", inner, "}")); })()); }
function pattern_test_dispatch() { return cond([ (k === "wildcard-pattern"), "true" ], [ (k === "variable-pattern"), "true" ], [ (k === "literal-pattern"), _fl_str("(", v, "===", literal_to_js(_fl_get(pat, "type"), _fl_get(pat, "value")), ")") ], [ (k === "or-pattern"), or_pattern_test(_fl_get(pat, "patterns"), v, 0, "") ], [ (k === "range-pattern"), _fl_str("(", v, ">=", _fl_get(pat, "min"), "&&", v, "<=", _fl_get(pat, "max"), ")") ], [ (k === "struct-pattern"), struct_pattern_test(_fl_get(pat, "fields"), v, 0, null, "") ], [ true, "false" ]); }
function pattern_test() { return pattern_test_dispatch(_fl_get(pat, "kind"), pat, v); }
function literal_to_js() { return cond([ (t === "number"), v ], [ (t === "string"), js_esc(v) ], [ (t === "symbol"), cond([ (v === "true"), "true" ], [ (v === "false"), "false" ], [ (v === "null"), "null" ], [ true, js_esc(v) ]) ], [ true, "null" ]); }
function or_pattern_test() { return ((i >= _fl_length(pats)) ? ((_fl_length(acc) === 0) ? "false" : _fl_str("(", acc, ")")) : (() => { let t = pattern_test(_fl_get(pats, i), v); return or_pattern_test(pats, v, (i + 1), ((_fl_length(acc) === 0) ? t : _fl_str(acc, "||", t))); })()); }
function struct_pattern_test() { return (nil_q(_fl_keys) ? (() => { let ks = json_keys(fields); return struct_pattern_test(fields, v, 0, ks, ""); })() : ((i >= _fl_length(_fl_keys)) ? ((_fl_length(acc) === 0) ? _fl_str("(", v, "!==null&&typeof ", v, "===\"object\")") : _fl_str("(", v, "!==null&&typeof ", v, "===\"object\"&&", acc, ")")) : (() => { let k = _fl_get(_fl_keys, i); let pat = _fl_get(fields, k); let k_clean = ((char_at(k, 0) === ":") ? substring(k, 1) : k); let t = pattern_test(pat, _fl_str(v, "[", js_esc(k_clean), "]")); return struct_pattern_test(fields, v, (i + 1), _fl_keys, ((_fl_length(acc) === 0) ? t : _fl_str(acc, "&&", t))); })())); }
function pattern_bindings_dispatch() { return cond([ ((k === "variable-pattern") || (k === "variable")), _fl_str("let ", js_name(_fl_get(pat, "name")), "=", v, ";") ], [ ((k === "struct-pattern") || (k === "block")), struct_pattern_bindings(_fl_get(pat, "fields"), v, 0, null, "") ], [ true, "" ]); }
function struct_pattern_bindings_from_entries() { return ((i >= _fl_length(entries)) ? acc : (() => { let e = _fl_get(entries, i); let k = _fl_get(e, 0); let pat = _fl_get(e, 1); let k_clean = ((char_at(k, 0) === ":") ? substring(k, 1) : k); let access = _fl_str(v, "[", js_esc(k_clean), "]"); let pat_kind = _fl_get(pat, "kind"); let binding_raw = cond([ (pat_kind === "variable"), _fl_str("let ", js_name(_fl_get(pat, "name")), "=", access, ";") ], [ (pat_kind === "block"), (() => { let v_next = _fl_str(v, "_", i); return _fl_str("let ", v_next, "=", access, ";", struct_pattern_bindings_from_entries(map_entries(_fl_get(pat, "fields")), v_next, 0, "")); })() ], [ true, "" ]); let binding = ((_fl_length(binding_raw) === 0) ? "" : binding_raw); return struct_pattern_bindings_from_entries(entries, v, (i + 1), _fl_str(acc, binding)); })()); }
function cg_map_pattern_bindings_from_entries() { return ((i >= _fl_length(entries)) ? acc : (() => { let e = _fl_get(entries, i); let k = _fl_get(e, 0); let pat = _fl_get(e, 1); let k_clean = ((char_at(k, 0) === ":") ? substring(k, 1) : k); let access = _fl_str(v, "[", js_esc(k_clean), "]"); let binding = pattern_bindings_dispatch(_fl_get(pat, "kind"), pat, access); return cg_map_pattern_bindings_from_entries(entries, v, (i + 1), _fl_str(acc, binding)); })()); }
function struct_pattern_bindings() { return (nil_q(_fl_keys) ? (() => { let ks = json_keys(fields); return (_fl_empty_q(ks) ? struct_pattern_bindings_from_entries(map_entries(fields), v, 0, "") : struct_pattern_bindings(fields, v, 0, ks, "")); })() : ((i >= _fl_length(_fl_keys)) ? acc : (() => { let k = _fl_get(_fl_keys, i); let pat = _fl_get(fields, k); let k_clean = ((char_at(k, 0) === ":") ? substring(k, 1) : k); let field_bindings = pattern_bindings(pat, _fl_str(v, "[", js_esc(k_clean), "]")); return struct_pattern_bindings(fields, v, (i + 1), _fl_keys, _fl_str(acc, field_bindings)); })())); }
function pattern_bindings() { return pattern_bindings_dispatch(_fl_get(pat, "kind"), pat, v); }
function cg_compose() { return _fl_str("((__x)=>", compose_nest(args, (_fl_length(args) - 1), "__x"), ")"); }
function compose_nest() { return ((i < 0) ? acc : (() => { let f = _fl_str(cg(_fl_get(args, i))); return compose_nest(args, (i - 1), _fl_str(f, "(", acc, ")")); })()); }
function cg_pipe() { return _fl_str("((__x)=>", pipe_nest(args, 0, "__x"), ")"); }
function pipe_nest() { return ((i >= _fl_length(args)) ? acc : (() => { let f = _fl_str(cg(_fl_get(args, i))); return pipe_nest(args, (i + 1), _fl_str(f, "(", acc, ")")); })()); }
function cg_thread_first() { return (() => { let init = _fl_str(cg(_fl_get(args, 0))); return thread_first_loop(args, 1, init); })(); }
function thread_first_loop() { return ((i >= _fl_length(args)) ? acc : thread_first_loop(args, (i + 1), thread_apply(_fl_get(args, i), acc, true))); }
function cg_thread_last() { return (() => { let init = _fl_str(cg(_fl_get(args, 0))); return thread_last_loop(args, 1, init); })(); }
function thread_last_loop() { return ((i >= _fl_length(args)) ? acc : thread_last_loop(args, (i + 1), thread_apply(_fl_get(args, i), acc, false))); }
function thread_apply() { return cond([ (_fl_get(step, "kind") === "sexpr"), (() => { let op = js_name(_fl_get(step, "op")); let a = _fl_get(step, "args"); return (fst ? _fl_str(op, "(", acc, ((_fl_length(a) === 0) ? "" : _fl_str(",", cg_args(a))), ")") : _fl_str(op, "(", ((_fl_length(a) === 0) ? "" : _fl_str(cg_args(a), ",")), acc, ")")); })() ], [ true, _fl_str(_fl_str(cg(step)), "(", acc, ")") ]); }
function cg_call_form() { return (() => { let fn = _fl_str(cg(_fl_get(args, 0))); let _fl_rest = slice(args, 1, _fl_length(args)); return _fl_str(fn, "(", cg_args(_fl_rest), ")"); })(); }
function cg_async() { return _fl_str("(async()=>{", cg_do_body(args, 0, ""), "})()"); }
function cg_await() { return _fl_str("(await ", cg(_fl_get(args, 0)), ")"); }
function cg_defstruct() { return (() => { let name_n = _fl_get(args, 0); let name = extract_name(name_n); let fields = slice(args, 1, _fl_length(args)); let params = struct_field_list(fields, 0, ""); let init = struct_init_list(fields, 0, ""); return _fl_str("const ", name, " = (", params, ")=>({__struct:\"", name, "\",", init, "})"); })(); }
function struct_field_list() { return ((i >= _fl_length(fs)) ? acc : (() => { let n = extract_name(_fl_get(fs, i)); return struct_field_list(fs, (i + 1), ((_fl_length(acc) === 0) ? n : _fl_str(acc, ",", n))); })()); }
function struct_init_list() { return ((i >= _fl_length(fs)) ? acc : (() => { let n = extract_name(_fl_get(fs, i)); return struct_init_list(fs, (i + 1), ((_fl_length(acc) === 0) ? n : _fl_str(acc, ",", n))); })()); }
function cg_args() { return args_loop(args, 0, ""); }
function args_loop() { return ((i >= _fl_length(args)) ? acc : (() => { let c = _fl_str(cg(_fl_get(args, i))); return args_loop(args, (i + 1), ((i === 0) ? c : _fl_str(acc, ",", c))); })()); }
function cg_binop() { return cond([ (_fl_length(args) === 0), zero ], [ (_fl_length(args) === 1), _fl_str(cg(_fl_get(args, 0))) ], [ true, _fl_str("(", binop_loop(args, 0, "", op), ")") ]); }
function binop_loop() { return ((i >= _fl_length(args)) ? acc : (() => { let c = _fl_str(cg(_fl_get(args, i))); return binop_loop(args, (i + 1), ((i === 0) ? c : _fl_str(acc, op, c)), op); })()); }
function cg_pair() { return _fl_str("(", cg(_fl_get(args, 0)), op, cg(_fl_get(args, 1)), ")"); }
function cg_sub() { return cond([ (_fl_length(args) === 0), "0" ], [ (_fl_length(args) === 1), _fl_str("(-", cg(_fl_get(args, 0)), ")") ], [ true, _fl_str("(", binop_loop(args, 0, "", "-"), ")") ]); }
function extract_name() { return cond([ (_fl_get(n, "kind") === "variable"), js_name(_fl_get(n, "name")) ], [ (_fl_get(n, "kind") === "literal"), js_name(_fl_get(n, "value")) ], [ true, "_anon" ]); }
function extract_params() { return param_loop(items, 0, ""); }
function param_loop() { return (_fl_null_q(items) ? acc : ((i >= _fl_length(items)) ? acc : (() => { let cur = _fl_get(items, i); let cur_val = ((_fl_get(cur, "kind") === "literal") ? _fl_get(cur, "value") : ""); return ((cur_val === "&") ? (((i + 1) >= _fl_length(items)) ? acc : (() => { let rest_name = extract_name(_fl_get(items, (i + 1))); let entry = _fl_str("...", rest_name); return param_loop(items, (i + 2), ((i === 0) ? entry : _fl_str(acc, ",", entry))); })()) : (() => { let name = extract_name(cur); return param_loop(items, (i + 1), ((i === 0) ? name : _fl_str(acc, ",", name))); })()); })())); }
function cg_native_dispatch() { return cond([ (op === "str"), _fl_str("_fl_str(", as, ")") ], [ (op === "concat"), _fl_str("_fl_str(", as, ")") ], [ (op === "length"), _fl_str("_fl_length(", as, ")") ], [ (op === "substring"), _fl_str("_fl_substring(", as, ")") ], [ (op === "char-at"), _fl_str("_fl_char_at(", as, ")") ], [ (op === "replace"), _fl_str("_fl_replace(", as, ")") ], [ (op === "starts-with?"), _fl_str("_fl_starts_with(", as, ")") ], [ (op === "ends-with?"), _fl_str("_fl_ends_with(", as, ")") ], [ (op === "contains?"), _fl_str("_fl_contains(", as, ")") ], [ (op === "split"), _fl_str("_fl_split(", as, ")") ], [ (op === "join"), _fl_str("_fl_join(", as, ")") ], [ (op === "trim"), _fl_str("_fl_trim(", as, ")") ], [ (op === "upper"), _fl_str("_fl_upper(", as, ")") ], [ (op === "lower"), _fl_str("_fl_lower(", as, ")") ], [ (op === "repeat"), _fl_str("_fl_repeat(", as, ")") ], [ (op === "index-of"), _fl_str("_fl_index_of(", as, ")") ], [ (op === "first"), _fl_str("_fl_first(", as, ")") ], [ (op === "last"), _fl_str("_fl_last(", as, ")") ], [ (op === "rest"), _fl_str("_fl_rest(", as, ")") ], [ (op === "append"), _fl_str("_fl_append(", as, ")") ], [ (op === "slice"), _fl_str("_fl_slice(", as, ")") ], [ (op === "list"), _fl_str("[", as, "]") ], [ (op === "map"), _fl_str("_fl_map(", as, ")") ], [ (op === "filter"), _fl_str("_fl_filter(", as, ")") ], [ (op === "reduce"), _fl_str("_fl_reduce(", as, ")") ], [ (op === "find"), _fl_str("_fl_find(", as, ")") ], [ (op === "every?"), _fl_str("_fl_every(", as, ")") ], [ (op === "some?"), _fl_str("_fl_some(", as, ")") ], [ (op === "sort"), _fl_str("_fl_sort(", as, ")") ], [ (op === "reverse"), _fl_str("_fl_reverse(", as, ")") ], [ (op === "flatten"), _fl_str("_fl_flatten(", as, ")") ], [ (op === "distinct"), _fl_str("_fl_distinct(", as, ")") ], [ (op === "range"), _fl_str("_fl_range(", as, ")") ], [ (op === "take"), _fl_str("_fl_take(", as, ")") ], [ (op === "drop"), _fl_str("_fl_drop(", as, ")") ], [ (op === "count"), _fl_str("_fl_length(", as, ")") ], [ (op === "get"), _fl_str("_fl_get(", as, ")") ], [ (op === "keys"), _fl_str("_fl_keys(", as, ")") ], [ (op === "values"), _fl_str("_fl_values(", as, ")") ], [ (op === "entries"), _fl_str("_fl_entries(", as, ")") ], [ (op === "has-key?"), _fl_str("_fl_has_key(", as, ")") ], [ (op === "map-set"), _fl_str("_fl_map_set(", as, ")") ], [ (op === "map-delete"), _fl_str("_fl_map_delete(", as, ")") ], [ (op === "merge"), _fl_str("_fl_merge(", as, ")") ], [ (op === "json_set"), _fl_str("_fl_map_set(", as, ")") ], [ (op === "json-parse"), _fl_str("JSON.parse(", as, ")") ], [ (op === "json-stringify"), _fl_str("JSON.stringify(", as, ")") ], [ (op === "json_parse"), _fl_str("JSON.parse(", as, ")") ], [ (op === "json_stringify"), _fl_str("JSON.stringify(", as, ")") ], [ (op === "null?"), _fl_str("(", as, "==null)") ], [ (op === "nil?"), _fl_str("_fl_nil_q(", as, ")") ], [ (op === "nil-or-empty?"), _fl_str("_fl_nil_or_empty_q(", as, ")") ], [ (op === "not"), _fl_str("(!", as, ")") ], [ (op === "empty?"), _fl_str("_fl_empty_q(", as, ")") ], [ (op === "true?"), _fl_str("(", as, "===true)") ], [ (op === "false?"), _fl_str("(", as, "===false)") ], [ (op === "string?"), _fl_str("(typeof ", as, "===\"string\")") ], [ (op === "number?"), _fl_str("(typeof ", as, "===\"number\")") ], [ (op === "list?"), _fl_str("Array.isArray(", as, ")") ], [ (op === "array?"), _fl_str("Array.isArray(", as, ")") ], [ (op === "map?"), _fl_str("_fl_is_map(", as, ")") ], [ (op === "fn?"), _fl_str("(typeof ", as, "===\"function\")") ], [ (op === "boolean?"), _fl_str("(typeof ", as, "===\"boolean\")") ], [ (op === "type-of"), _fl_str("_fl_type_of(", as, ")") ], [ (op === "min"), _fl_str("Math.min(", as, ")") ], [ (op === "max"), _fl_str("Math.max(", as, ")") ], [ (op === "abs"), _fl_str("Math.abs(", as, ")") ], [ (op === "sqrt"), _fl_str("Math.sqrt(", as, ")") ], [ (op === "pow"), _fl_str("Math.pow(", as, ")") ], [ (op === "floor"), _fl_str("Math.floor(", as, ")") ], [ (op === "ceil"), _fl_str("Math.ceil(", as, ")") ], [ (op === "round"), _fl_str("Math.round(", as, ")") ], [ (op === "mod"), cg_pair(args, "%") ], [ (op === "neg"), _fl_str("(-", as, ")") ], [ (op === "sign"), _fl_str("Math.sign(", as, ")") ], [ (op === "random"), _fl_str("Math.random()") ], [ (op === "log"), _fl_str("Math.log(", as, ")") ], [ (op === "exp"), _fl_str("Math.exp(", as, ")") ], [ (op === "sin"), _fl_str("Math.sin(", as, ")") ], [ (op === "cos"), _fl_str("Math.cos(", as, ")") ], [ (op === "str-to-num"), _fl_str("Number(", as, ")") ], [ (op === "num-to-str"), _fl_str("String(", as, ")") ], [ (op === "println"), _fl_str("console.log(", as, ")") ], [ (op === "print"), _fl_str("process.stdout.write(String(", as, "))") ], [ (op === "file_read"), _fl_str("_fl_file_read(", as, ")") ], [ (op === "file_write"), _fl_str("_fl_file_write(", as, ")") ], [ (op === "file_exists"), _fl_str("_fl_file_exists(", as, ")") ], [ (op === "exit"), _fl_str("process.exit(", as, ")") ], [ (op === "shell_capture"), _fl_str("_fl_shell_capture(", as, ")") ], [ (op === "now"), _fl_str("now()") ], [ (op === "now_ms"), _fl_str("now_ms()") ], [ (op === "now_iso"), _fl_str("now_iso()") ], [ (op === "now_unix"), _fl_str("now_unix()") ], [ (op === "time_diff"), _fl_str("((t1,t2)=>t2-t1)(", as, ")") ], [ (op === "time_since"), _fl_str("((ts)=>Date.now()-ts)(", as, ")") ], [ (op === "sleep_ms"), _fl_str("((ms)=>{const start=Date.now();while(Date.now()-start<ms){}})(", as, ")") ], [ (op === "timer_start"), _fl_str("{__timer:{label:", as, ",start:Date.now(),laps:[]}}") ], [ (op === "timer_elapsed"), _fl_str("((t)=>Date.now()-t.__timer.start)(", as, ")") ], [ (op === "timer_lap"), _fl_str("((t,l)=>{t.__timer.laps.push({label:l,ms:Date.now()-t.__timer.start});return t;})(", as, ")") ], [ (op === "starts-with?"), _fl_str("_fl_starts_with(", as, ")") ], [ (op === "ends-with?"), _fl_str("_fl_ends_with(", as, ")") ], [ (op === "contains?"), _fl_str("_fl_contains(", as, ")") ], [ (op === "split"), _fl_str("_fl_split(", as, ")") ], [ (op === "join"), _fl_str("_fl_join(", as, ")") ], [ (op === "trim"), _fl_str("_fl_trim(", as, ")") ], [ (op === "upper"), _fl_str("_fl_upper(", as, ")") ], [ (op === "lower"), _fl_str("_fl_lower(", as, ")") ], [ (op === "repeat"), _fl_str("_fl_repeat(", as, ")") ], [ (op === "index-of"), _fl_str("_fl_index_of(", as, ")") ], [ (op === "map"), _fl_str("_fl_map(", as, ")") ], [ (op === "filter"), _fl_str("_fl_filter(", as, ")") ], [ (op === "reduce"), _fl_str("_fl_reduce(", as, ")") ], [ (op === "find"), _fl_str("_fl_find(", as, ")") ], [ (op === "every?"), _fl_str("_fl_every(", as, ")") ], [ (op === "some?"), _fl_str("_fl_some(", as, ")") ], [ (op === "sort"), _fl_str("_fl_sort(", as, ")") ], [ (op === "reverse"), _fl_str("_fl_reverse(", as, ")") ], [ (op === "flatten"), _fl_str("_fl_flatten(", as, ")") ], [ (op === "distinct"), _fl_str("_fl_distinct(", as, ")") ], [ (op === "pg_exec"), _fl_str("_fl_pg_exec(", as, ")") ], [ (op === "pg_query"), _fl_str("_fl_pg_query(", as, ")") ], [ (op === "pg_connect"), _fl_str("_fl_pg_connect(", as, ")") ], [ (op === "mariadb_exec"), _fl_str("_fl_mariadb_exec(", as, ")") ], [ (op === "mariadb_query"), _fl_str("_fl_mariadb_query(", as, ")") ], [ (op === "mariadb_one"), _fl_str("_fl_mariadb_one(", as, ")") ], [ (op === "db_query"), _fl_str("_fl_db_query(", as, ")") ], [ (op === "db_exec"), _fl_str("_fl_db_exec(", as, ")") ], [ (op === "server_post"), _fl_str("_fl_server_post(", as, ")") ], [ (op === "server_get"), _fl_str("_fl_server_get(", as, ")") ], [ (op === "server_put"), _fl_str("_fl_server_put(", as, ")") ], [ (op === "server_delete"), _fl_str("_fl_server_delete(", as, ")") ], [ (op === "server_start"), _fl_str("_fl_server_start(", as, ")") ], [ (op === "server_stop"), _fl_str("_fl_server_stop(", as, ")") ], [ (op === "http_get"), _fl_str("_fl_http_get(", as, ")") ], [ (op === "http_post"), _fl_str("_fl_http_post(", as, ")") ], [ (op === "ws_send"), _fl_str("_fl_ws_send(", as, ")") ], [ true, _fl_str(js_name(((char_at(op, 0) === "$") ? substring(op, 1, _fl_length(op)) : op)), "(", as, ")") ]); }
function cg_native() { return cg_native_dispatch(op, cg_args(args)); }
function cg_call() { return (() => { let fn_name = js_name(((char_at(op, 0) === "$") ? substring(op, 1, _fl_length(op)) : op)); return _fl_str(fn_name, "(", cg_args(args), ")"); })(); }
function cg_sexpr_dispatch() { return cond([ (op === "if"), cg_if(args) ], [ (op === "fn"), cg_fn(args) ], [ (op === "defn"), cg_defn(args) ], [ (op === "define"), cg_define(args) ], [ (op === "let"), cg_let(args) ], [ (op === "do"), cg_do(args) ], [ (op === "begin"), cg_do(args) ], [ (op === "cond"), cg_cond(args) ], [ (op === "and"), cg_and(args) ], [ (op === "or"), cg_or(args) ], [ (op === "quote"), cg_quote(args) ], [ (op === "set!"), cg_set_bang(args) ], [ (op === "throw"), cg_throw(args) ], [ (op === "try"), cg_try(args) ], [ (op === "while"), cg_while(args) ], [ (op === "loop"), cg_loop(args) ], [ (op === "recur"), cg_recur(args) ], [ (op === "defstruct"), cg_defstruct(args) ], [ (op === "compose"), cg_compose(args) ], [ (op === "pipe"), cg_pipe(args) ], [ (op === "->"), cg_thread_first(args) ], [ (op === "->>"), cg_thread_last(args) ], [ (op === "|>"), cg_thread_first(args) ], [ (op === "call"), cg_call_form(args) ], [ (op === "async"), cg_async(args) ], [ (op === "await"), cg_await(args) ], [ (op === "+"), cg_binop(args, "+", "0") ], [ (op === "-"), cg_sub(args) ], [ (op === "*"), cg_binop(args, "*", "1") ], [ (op === "/"), cg_pair(args, "/") ], [ (op === "%"), cg_pair(args, "%") ], [ (op === "<"), cg_pair(args, "<") ], [ (op === ">"), cg_pair(args, ">") ], [ (op === "<="), cg_pair(args, "<=") ], [ (op === ">="), cg_pair(args, ">=") ], [ (op === "="), cg_pair(args, "===") ], [ (op === "!="), cg_pair(args, "!==") ], [ true, cg_native(op, args) ]); }
function cg_sexpr() { return cg_sexpr_dispatch(_fl_get(n, "op"), _fl_get(n, "args")); }
function prelude_string() { return _fl_str("const _fl_str = (...xs) => xs.map(x => x==null?'null':String(x)).join('');", "const _fl_length = (x) => (x==null ? 0 : x.length);", "const _fl_substring = (s, a, b) => (b==null ? s.slice(a) : s.slice(a, b));", "const _fl_char_at = (s, i) => (s[i] || null);", "const _fl_replace = (s, a, b) => s.split(a).join(b);", "const _fl_starts_with = (s, p) => s.startsWith(p);", "const _fl_ends_with = (s, p) => s.endsWith(p);", "const _fl_contains = (s, p) => s.includes(p);", "const _fl_split = (s, sep) => s.split(sep);", "const _fl_join = (l, sep) => l.join(sep==null?'':sep);", "const _fl_trim = (s) => s.trim();", "const _fl_upper = (s) => s.toUpperCase();", "const _fl_lower = (s) => s.toLowerCase();", "const _fl_repeat = (s, n) => s.repeat(n);", "const _fl_index_of = (s, p) => s.indexOf(p);"); }
function prelude_list() { return _fl_str("const _fl_first = (l) => (l==null || l.length===0 ? null : l[0]);", "const _fl_last = (l) => (l==null || l.length===0 ? null : l[l.length-1]);", "const _fl_rest = (l) => (l==null || l.length===0 ? [] : l.slice(1));", "const _fl_append = (...xs) => xs.reduce((acc, x) => Array.isArray(x) ? [...acc, ...x] : [...acc, x], []);", "const _fl_slice = (l, a, b) => l.slice(a, b);", "const _fl_map = (f, l) => l.map(x => f(x));", "const _fl_filter = (f, l) => l.filter(x => f(x));", "const _fl_reduce = (f, init, l) => l.reduce((acc, x) => f(acc, x), init);", "const _fl_find = (f, l) => (l.find(x => f(x)) ?? null);", "const _fl_every = (f, l) => l.every(x => f(x));", "const _fl_some = (f, l) => l.some(x => f(x));", "const _fl_sort = (l, cmp) => [...l].sort(cmp || ((a,b)=>a<b?-1:a>b?1:0));", "const _fl_reverse = (l) => [...l].reverse();", "const _fl_flatten = (l) => l.flat(Infinity);", "const _fl_distinct = (l) => [...new Set(l)];", "const _fl_range = (a, b, s) => { let r=[]; let step=s||1; for(let i=a;i<b;i+=step)r.push(i); return r; };", "const _fl_take = (n, l) => l.slice(0, n);", "const _fl_drop = (n, l) => l.slice(n);"); }
function prelude_map() { return _fl_str("const _fl_get = (o, k) => (o==null ? null : (o[k]===undefined ? null : o[k]));", "const _fl_keys = (o) => (o==null ? [] : Object.keys(o));", "const _fl_values = (o) => (o==null ? [] : Object.values(o));", "const _fl_entries = (o) => (o==null ? [] : Object.entries(o).map(([k,v])=>[k,v]));", "const _fl_has_key = (o, k) => (o!=null && k in o);", "const _fl_map_set = (o, k, v) => ({...o, [k]: v});", "const _fl_map_delete = (o, k) => { const c={...o}; delete c[k]; return c; };", "const _fl_merge = (...os) => Object.assign({}, ...os);", "const _fl_is_map = (x) => (x!=null && typeof x==='object' && !Array.isArray(x));", "const _fl_type_of = (x) => (x==null?'null':Array.isArray(x)?'list':typeof x);", "const map_entries = (m) => m instanceof Map ? [...m.entries()] : (m && typeof m === 'object' && !Array.isArray(m) ? Object.entries(m) : []);", "const map_keys = (m) => m instanceof Map ? [...m.keys()] : (m && typeof m === 'object' && !Array.isArray(m) ? Object.keys(m) : []);", "const map_values = (m) => m instanceof Map ? [...m.values()] : (m && typeof m === 'object' && !Array.isArray(m) ? Object.values(m) : []);"); }
function prelude_time_regex() { return _fl_str("const now = () => Date.now();", "const now_ms = () => Date.now();", "const now_iso = () => new Date().toISOString();", "const now_unix = () => Math.floor(Date.now()/1000);", "const regex_match = (s, p) => new RegExp(p).test(s);", "const regex_find = (s, p) => { const m = s.match(new RegExp(p)); return m ? m[0] : null; };", "const regex_find_all = (s, p) => s.match(new RegExp(p, 'g')) || [];", "const regex_replace = (s, p, r) => s.replace(new RegExp(p, 'g'), r);", "const regex_split = (s, p) => s.split(new RegExp(p));", "const regex_count = (s, p) => (s.match(new RegExp(p, 'g')) || []).length;", "const regex_extract = (s, p) => { const m = s.match(new RegExp(p)); return m ? m.slice(1) : []; };"); }
function prelude_io_misc() { return _fl_str("const _fl_file_read = (p) => require('fs').readFileSync(p, 'utf8');", "const _fl_file_write = (p, c) => require('fs').writeFileSync(p, c);", "const _fl_file_exists = (p) => require('fs').existsSync(p);", "const _fl_shell_capture = (cmd) => { try { const {execSync}=require('child_process'); return {stdout:execSync(cmd,{encoding:'utf8'}),stderr:'',code:0}; } catch(e) { return {stdout:'',stderr:String(e),code:1}; } };", "const _fl_empty_q = (x) => (x==null || x.length===0);", "const _fl_nil_q = (x) => (x == null || x === undefined);", "const _fl_nil_or_empty_q = (x) => (x == null || x === undefined || (x && x.length === 0));", "const __argv__ = process.argv.slice(2);"); }
function prelude_db_server() { return _fl_str("const _fl_pg_exec = (db,sql,...args) => null;", "const _fl_pg_query = (db,sql,...args) => [];", "const _fl_pg_connect = (cfg) => null;", "const _fl_mariadb_exec = (db,sql,...args) => null;", "const _fl_mariadb_query = (db,sql,...args) => [];", "const _fl_mariadb_one = (db,sql,...args) => null;", "const _fl_db_query = (path,sql,...args) => [];", "const _fl_db_exec = (path,sql,...args) => null;", "const _fl_server_post = (path,fn) => null;", "const _fl_server_get = (path,fn) => null;", "const _fl_server_put = (path,fn) => null;", "const _fl_server_delete = (path,fn) => null;", "const _fl_server_start = (port) => null;", "const _fl_server_stop = () => null;", "const _fl_http_get = (url) => '';", "const _fl_http_post = (url,body) => '';", "const _fl_ws_send = (sid,data) => null;"); }
function prelude_parts() { return [ prelude_string(), prelude_list(), prelude_map(), prelude_time_regex(), prelude_io_misc(), prelude_db_server() ]; }
function runtime_prelude() { return _fl_str("const nil = null;", __fl_reduce((() => _fl_str(acc, part)), "", prelude_parts())); }
function fl__gtjs_code() { return __fl_reduce((() => _fl_str(acc, cg(node), ";\n")), "", ast); }
function fl__gtjs_with_prelude() { return (() => { let p = runtime_prelude(); return (() => { let c = fl__gtjs_code(ast); return _fl_str(p, "\n", c); })(); })(); }
function compile_file() { return (() => { let src = file_read(input); let tokens = lex(src); let ast = parse(tokens); let js = fl__gtjs_with_prelude(ast); return file_write(output, js)
__fl_print(_fl_str("compiled ", input, " -> ", output, " size=", _fl_length(js))); })(); }
(_fl_null_q(__argv__) ? null : ((_fl_length(__argv__) === 0) ? null : compile_file(_fl_get(__argv__, 0), ((_fl_length(__argv__) >= 2) ? _fl_get(__argv__, 1) : _fl_str(_fl_get(__argv__, 0), ".out.js")))))
function str_lines() { return split(s, "\n"); }
function str_words() { return split(_fl_trim(s), " "); }
function str_join_lines() { return str_join_loop(lines, 0, ""); }
function str_join_loop() { return ((i >= _fl_length(lst)) ? acc : str_join_loop(lst, (i + 1), ((i === 0) ? _fl_get(lst, 0) : _fl_str(acc, "\n", _fl_get(lst, i))))); }
function str_count() { return ((_fl_length(sub) === 0) ? 0 : str_count_loop(s, sub, 0, 0)); }
function str_count_loop() { return (() => { let _fl_rest = substring(s, pos, _fl_length(s)); let idx = index_of(_fl_rest, sub); return ((idx < 0) ? acc : str_count_loop(s, sub, _plus(pos, idx, _fl_length(sub)), (acc + 1))); })(); }
function csv_parse_line() { return split(line, ","); }
function csv_parse() { return (() => { let lines = split(csv, "\n"); return csv_parse_loop(lines, 0, []); })(); }
function csv_parse_loop() { return ((i >= _fl_length(lines)) ? acc : csv_parse_loop(lines, (i + 1), _fl_append(acc, csv_parse_line(_fl_get(lines, i))))); }
function str_repeat() { return ((n <= 0) ? "" : str_repeat_loop(s, n, 0, "")); }
function str_repeat_loop() { return ((i >= n) ? acc : str_repeat_loop(s, n, (i + 1), _fl_str(acc, s))); }
function data_json_parse() { return json_parse(s); }
function data_json_str() { return json_stringify(obj); }
function data_json_pretty() { return json_stringify(obj); }
function to_query_string() { return to_query_loop(_fl_keys(obj), obj, 0, []); }
function to_query_loop() { return ((i >= _fl_length(ks)) ? join(acc, "&") : (() => { let k = _fl_get(ks, i); let v = _fl_get(obj, k); return to_query_loop(ks, obj, (i + 1), _fl_append(acc, _fl_str(k, "=", v))); })()); }
function hash_simple() { return hash_simple_loop(_fl_str(s), 0, 5381, 0); }
function hash_simple_loop() { return ((i >= _fl_length(s)) ? (abs(hash) % 2147483647) : hash_simple_loop(s, (i + 1), ((hash * 33) + char_code_at(s, i)), (i + 1))); }
function hash_fnv1a() { return (() => { let fnv_offset = 2166136261; let fnv_prime = 16777619; return hash_fnv_loop(_fl_str(s), 0, fnv_offset); })(); }
function hash_fnv_loop() { return ((i >= _fl_length(s)) ? (abs(hash) % 2147483647) : hash_fnv_loop(s, (i + 1), (bit_xor(hash, char_code_at(s, i)) * 16777619))); }
function hash_djb2() { return hash_djb_loop(_fl_str(s), 0, 5381); }
function hash_djb_loop() { return ((i >= _fl_length(s)) ? (abs(hash) % 2147483647) : hash_djb_loop(s, (i + 1), ((hash * 33) + char_code_at(s, i)))); }
function hash_object() { return hash_simple(json_stringify(obj)); }
function hash_consistent() { return (() => { let h = hash_simple(s); return (((h * seed) + seed) % 2147483647); })(); }
function now_s() { return floor((now() / 1000)); }
function time_diff_ms() { return (t2 - t1); }
function time_elapsed() { return (now() - start); }
function date_parts() { return {}; }
function ts_to_s() { return floor((ts / 1000)); }
function s_to_ts() { return (s * 1000); }
function time_ago() { return (() => { let diff = (now() - ts); let s = floor((diff / 1000)); let m = floor((s / 60)); let h = floor((m / 60)); let d = floor((h / 24)); return cond([ (s < 60), _fl_str(s, "s ago") ], [ (m < 60), _fl_str(m, "m ago") ], [ (h < 24), _fl_str(h, "h ago") ], [ true, _fl_str(d, "d ago") ]); })(); }
function str_starts_with_q() { return ((_fl_length(prefix) > _fl_length(s)) ? false : (substring(s, 0, _fl_length(prefix)) === prefix)); }
function str_ends_with_q() { return ((_fl_length(suffix) > _fl_length(s)) ? false : (substring(s, (_fl_length(s) - _fl_length(suffix)), _fl_length(s)) === suffix)); }
function str_repeat() { return str_repeat_loop(s, n, ""); }
function str_repeat_loop() { return ((n <= 0) ? acc : str_repeat_loop(s, (n - 1), _fl_str(acc, s))); }
function str_pad_left() { return (() => { let diff = (n - _fl_length(s)); return ((diff <= 0) ? s : _fl_str(str_repeat(pad, diff), s)); })(); }
function str_pad_right() { return (() => { let diff = (n - _fl_length(s)); return ((diff <= 0) ? s : _fl_str(s, str_repeat(pad, diff))); })(); }
function file_read() { return file_read(_fl_str(path)); }
function file_write() { return file_write(_fl_str(path), _fl_str(content)); }
function file_append() { return file_append(_fl_str(path), _fl_str(content)); }
function file_exists_q() { return file_exists(_fl_str(path)); }
function file_delete() { return file_delete(_fl_str(path)); }
function file_copy() { return file_copy(_fl_str(src), _fl_str(dest)); }
function file_rename() { return file_rename(_fl_str(old), _fl_str(_new)); }
function file_size() { return file_size(_fl_str(path)); }
function file_modified() { return file_modified(_fl_str(path)); }
function file_json() { return json_parse(file_read(_fl_str(path))); }
function file_json_write() { return file_write(_fl_str(path), json_stringify(obj)); }
function file_lines() { return str_lines(file_read(_fl_str(path))); }
function file_mkdir() { return file_mkdir(_fl_str(path)); }
function file_rmdir() { return file_rmdir(_fl_str(path)); }
function file_list() { return file_list(_fl_str(path)); }
function file_is_file_q() { return file_is_file(_fl_str(path)); }
function file_is_dir_q() { return file_is_dir(_fl_str(path)); }
function process_run() { return process_run(_fl_str(cmd)); }
function process_run_args() { return process_run_args(_fl_str(cmd), args); }
function process_exec() { return process_exec(_fl_str(cmd)); }
function process_exec_args() { return process_exec_args(_fl_str(cmd), args); }
function process_spawn() { return process_spawn(_fl_str(cmd), args); }
function process_kill() { return process_kill(floor(pid)); }
function process_exists_q() { return process_exists(floor(pid)); }
function process_wait() { return process_wait(floor(pid)); }
function shell_run() { return process_exec(_fl_str(cmd)); }
function shell_pipe() { return process_exec(_fl_str(cmd1, " | ", cmd2)); }
function env_get() { return env_get(_fl_str(key)); }
function env_set() { return env_set(_fl_str(key), _fl_str(value)); }
function env_all() { return env_all(); }
function getcwd() { return process_getcwd(); }
function chdir() { return process_chdir(_fl_str(path)); }
function pid() { return process_pid(); }
function pid_parent() { return process_ppid(); }
__fl_print("\n═══════════════════════════════════════════")
__fl_print("  FL Self-Hosted Compiler (Phase 28)")
__fl_print("═══════════════════════════════════════════\n")
(() => { let input = _fl_get(__argv__, 0); let output = _fl_get(__argv__, 1); return ((_fl_null_q(input) || _fl_null_q(output)) ? __fl_print("Usage: node bootstrap.js run self/main.fl <input.fl> <output.js>") : (() => { let src = file_read(input); return (() => { let tokens = lex(src); return (() => { let ast = parse(tokens); return (() => { let js = fl__gtjs_with_prelude(ast); return (() => { __fl_print(_fl_str("📖 ", input, " → ", output)); __fl_print(_fl_str("   Lexed: ", _fl_length(tokens), " tokens")); __fl_print(_fl_str("   Parsed: ", _fl_length(ast), " nodes")); __fl_print(_fl_str("   Generated: ", _fl_length(js), " bytes")); file_write(output, js); return __fl_print("✨ Success!"); })(); })(); })(); })(); })()); })()
module.exports = {
  _fl_is_digit_q: _fl_is_digit_q,
  _fl_is_alpha_q: _fl_is_alpha_q,
  _fl_is_alnum_q: _fl_is_alnum_q,
  _fl_is_space_q: _fl_is_space_q,
  _fl_is_symbol_char_q: _fl_is_symbol_char_q,
  make_state: make_state,
  peek_at: peek_at,
  peek: peek,
  at_end_q: at_end_q,
  advance: advance,
  emit: emit,
  skip_comment: skip_comment,
  skip_ws: skip_ws,
  read_number_body: read_number_body,
  read_number: read_number,
  translate_esc: translate_esc,
  read_string_body: read_string_body,
  read_string: read_string,
  read_symbol_body_kind: read_symbol_body_kind,
  read_symbol: read_symbol,
  read_variable: read_variable,
  read_keyword: read_keyword,
  read_token: read_token,
  lex_loop: lex_loop,
  lex: lex,
  make_literal: make_literal,
  make_variable: make_variable,
  make_keyword: make_keyword,
  make_sexpr: make_sexpr,
  make_number: make_number,
  make_string: make_string,
  make_bool: make_bool,
  make_null: make_null,
  make_symbol: make_symbol,
  make_block: make_block,
  make_array_block: make_array_block,
  make_map_block: make_map_block,
  make_pattern_literal: make_pattern_literal,
  make_pattern_variable: make_pattern_variable,
  make_pattern_wildcard: make_pattern_wildcard,
  make_pattern_list: make_pattern_list,
  make_pattern_struct: make_pattern_struct,
  make_pattern_or: make_pattern_or,
  make_pattern_range: make_pattern_range,
  make_pattern_match: make_pattern_match,
  make_match_case: make_match_case,
  make_function_value: make_function_value,
  make_type_class: make_type_class,
  make_type_class_instance: make_type_class_instance,
  make_module_block: make_module_block,
  make_import_block: make_import_block,
  make_open_block: make_open_block,
  make_search_block: make_search_block,
  make_learn_block: make_learn_block,
  make_reasoning_block: make_reasoning_block,
  make_async_function: make_async_function,
  make_await: make_await,
  make_try: make_try,
  make_catch: make_catch,
  make_throw: make_throw,
  make_template_string: make_template_string,
  make_page: make_page,
  make_route: make_route,
  make_component: make_component,
  make_form: make_form,
  deep_equal_q: deep_equal_q,
  deep_equal_list_q: deep_equal_list_q,
  deep_equal_map_q: deep_equal_map_q,
  keys_no_line: keys_no_line,
  deep_equal_map_keys_q: deep_equal_map_keys_q,
  _fl_list_q: _fl_list_q,
  _fl_map_q: _fl_map_q,
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
  parse: parse,
  esc_1: esc_1,
  esc_2: esc_2,
  esc_3: esc_3,
  esc_4: esc_4,
  esc_5: esc_5,
  js_esc_inner: js_esc_inner,
  js_esc: js_esc,
  fl_reserved_q: fl_reserved_q,
  js_reserved_q: js_reserved_q,
  rename_1: rename_1,
  rename_2: rename_2,
  rename_3: rename_3,
  rename_4: rename_4,
  rename_5: rename_5,
  rename_6: rename_6,
  rename_7: rename_7,
  js_name_inner: js_name_inner,
  js_name: js_name,
  cg: cg,
  js_esc_for_template: js_esc_for_template,
  cg_template_string: cg_template_string,
  cg_try: cg_try,
  cg_catch_clause: cg_catch_clause,
  cg_literal_dispatch: cg_literal_dispatch,
  cg_literal: cg_literal,
  cg_block_dispatch: cg_block_dispatch,
  cg_block: cg_block,
  cg_map_entries_dispatch: cg_map_entries_dispatch,
  cg_map_entries: cg_map_entries,
  cg_map_loop_inner: cg_map_loop_inner,
  cg_map_loop: cg_map_loop,
  cg_map_flat_loop_inner: cg_map_flat_loop_inner,
  cg_map_flat_loop: cg_map_flat_loop,
  cg_keyword_key: cg_keyword_key,
  cg_func_block_inner: cg_func_block_inner,
  cg_func_block: cg_func_block,
  cg_if: cg_if,
  cg_fn: cg_fn,
  cg_defn: cg_defn,
  cg_define: cg_define,
  cg_let: cg_let,
  cg_let_binding: cg_let_binding,
  cg_let_1d: cg_let_1d,
  cg_let_2d: cg_let_2d,
  cg_do: cg_do,
  cg_do_body: cg_do_body,
  get_clause_items: get_clause_items,
  cg_cond: cg_cond,
  cg_cond_loop: cg_cond_loop,
  cg_and: cg_and,
  and_loop: and_loop,
  cg_or: cg_or,
  or_loop: or_loop,
  cg_quote: cg_quote,
  cg_set_bang: cg_set_bang,
  cg_throw: cg_throw,
  cg_while: cg_while,
  while_body: while_body,
  cg_loop: cg_loop,
  loop_inits_1d: loop_inits_1d,
  loop_inits_2d: loop_inits_2d,
  loop_names_1d: loop_names_1d,
  loop_names_2d: loop_names_2d,
  cg_recur: cg_recur,
  cg_match: cg_match,
  match_cases_loop: match_cases_loop,
  pattern_test_dispatch: pattern_test_dispatch,
  pattern_test: pattern_test,
  literal_to_js: literal_to_js,
  or_pattern_test: or_pattern_test,
  struct_pattern_test: struct_pattern_test,
  pattern_bindings_dispatch: pattern_bindings_dispatch,
  struct_pattern_bindings_from_entries: struct_pattern_bindings_from_entries,
  cg_map_pattern_bindings_from_entries: cg_map_pattern_bindings_from_entries,
  struct_pattern_bindings: struct_pattern_bindings,
  pattern_bindings: pattern_bindings,
  cg_compose: cg_compose,
  compose_nest: compose_nest,
  cg_pipe: cg_pipe,
  pipe_nest: pipe_nest,
  cg_thread_first: cg_thread_first,
  thread_first_loop: thread_first_loop,
  cg_thread_last: cg_thread_last,
  thread_last_loop: thread_last_loop,
  thread_apply: thread_apply,
  cg_call_form: cg_call_form,
  cg_async: cg_async,
  cg_await: cg_await,
  cg_defstruct: cg_defstruct,
  struct_field_list: struct_field_list,
  struct_init_list: struct_init_list,
  cg_args: cg_args,
  args_loop: args_loop,
  cg_binop: cg_binop,
  binop_loop: binop_loop,
  cg_pair: cg_pair,
  cg_sub: cg_sub,
  extract_name: extract_name,
  extract_params: extract_params,
  param_loop: param_loop,
  cg_native_dispatch: cg_native_dispatch,
  cg_native: cg_native,
  cg_call: cg_call,
  cg_sexpr_dispatch: cg_sexpr_dispatch,
  cg_sexpr: cg_sexpr,
  prelude_string: prelude_string,
  prelude_list: prelude_list,
  prelude_map: prelude_map,
  prelude_time_regex: prelude_time_regex,
  prelude_io_misc: prelude_io_misc,
  prelude_db_server: prelude_db_server,
  prelude_parts: prelude_parts,
  runtime_prelude: runtime_prelude,
  fl__gtjs_code: fl__gtjs_code,
  fl__gtjs_with_prelude: fl__gtjs_with_prelude,
  compile_file: compile_file,
  str_lines: str_lines,
  str_words: str_words,
  str_join_lines: str_join_lines,
  str_join_loop: str_join_loop,
  str_count: str_count,
  str_count_loop: str_count_loop,
  csv_parse_line: csv_parse_line,
  csv_parse: csv_parse,
  csv_parse_loop: csv_parse_loop,
  str_repeat: str_repeat,
  str_repeat_loop: str_repeat_loop,
  data_json_parse: data_json_parse,
  data_json_str: data_json_str,
  data_json_pretty: data_json_pretty,
  to_query_string: to_query_string,
  to_query_loop: to_query_loop,
  hash_simple: hash_simple,
  hash_simple_loop: hash_simple_loop,
  hash_fnv1a: hash_fnv1a,
  hash_fnv_loop: hash_fnv_loop,
  hash_djb2: hash_djb2,
  hash_djb_loop: hash_djb_loop,
  hash_object: hash_object,
  hash_consistent: hash_consistent,
  now_s: now_s,
  time_diff_ms: time_diff_ms,
  time_elapsed: time_elapsed,
  date_parts: date_parts,
  ts_to_s: ts_to_s,
  s_to_ts: s_to_ts,
  time_ago: time_ago,
  str_starts_with_q: str_starts_with_q,
  str_ends_with_q: str_ends_with_q,
  str_repeat: str_repeat,
  str_repeat_loop: str_repeat_loop,
  str_pad_left: str_pad_left,
  str_pad_right: str_pad_right,
  file_read: file_read,
  file_write: file_write,
  file_append: file_append,
  file_exists_q: file_exists_q,
  file_delete: file_delete,
  file_copy: file_copy,
  file_rename: file_rename,
  file_size: file_size,
  file_modified: file_modified,
  file_json: file_json,
  file_json_write: file_json_write,
  file_lines: file_lines,
  file_mkdir: file_mkdir,
  file_rmdir: file_rmdir,
  file_list: file_list,
  file_is_file_q: file_is_file_q,
  file_is_dir_q: file_is_dir_q,
  process_run: process_run,
  process_run_args: process_run_args,
  process_exec: process_exec,
  process_exec_args: process_exec_args,
  process_spawn: process_spawn,
  process_kill: process_kill,
  process_exists_q: process_exists_q,
  process_wait: process_wait,
  shell_run: shell_run,
  shell_pipe: shell_pipe,
  env_get: env_get,
  env_set: env_set,
  env_all: env_all,
  getcwd: getcwd,
  chdir: chdir,
  pid: pid,
  pid_parent: pid_parent
};