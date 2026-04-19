function is-digit?() { return (null?(c) ? false : ((c >= "0") && (c <= "9"))); }
function is-alpha?() { return (null?(c) ? false : (((c >= "a") && (c <= "z")) || ((c >= "A") && (c <= "Z")))); }
function is-alnum?() { return (is-digit?(c) || is-alpha?(c)); }
function is-space?() { return or((c === " "), (c === "\t"), (c === "\n"), (c === "\r")); }
function is-symbol-char?() { return (null?(c) ? false : or(is-alnum?(c), (c === "-"), (c === "_"), (c === "?"), (c === "!"), (c === "/"), (c === "."), (c === "<"), (c === ">"), (c === "="), (c === "+"), (c === "*"), (c === "%"), (c === "&"), (c === "|"), (c === "^"), (c === "~"))); }
function make-state() { return /* unsupported block: Map */; }
function peek-at() { return let $unknown = ((i >= length(src)) ? "null" : char-at(src, i));; }
function peek() { return peek-at(st, 0); }
function at-end?() { return (get(st, "idx") >= length(get(st, "src"))); }
function advance() { return let $unknown = ((c === "\n") ? /* unsupported block: Map */ : /* unsupported block: Map */);; }
function emit() { return /* unsupported block: Map */; }
function skip-comment() { return (at-end?(st) ? st : let $unknown = ((c === "\n") ? advance(st) : skip-comment(advance(st)));); }
function skip-ws() { return (at-end?(st) ? st : let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);); }
function read-number-body() { return (at-end?(st) ? emit(st, "Number", acc, line, col) : let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);); }
function read-number() { return read-number-body(st, "", false, get(st, "line"), get(st, "col")); }
function translate-esc() { return cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */); }
function read-string-body() { return (at-end?(st) ? emit(st, "String", acc, line, col) : let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);); }
function read-string() { return let $unknown = read-string-body(st1, "", line, col);; }
function read-symbol-body-kind() { return (at-end?(st) ? emit(st, kind, acc, line, col) : let $unknown = (is-symbol-char?(c) ? read-symbol-body-kind(advance(st), str(acc, c), line, col, kind) : emit(st, kind, acc, line, col));); }
function read-symbol() { return read-symbol-body-kind(st, "", get(st, "line"), get(st, "col"), "Symbol"); }
function read-variable() { return let $unknown = read-symbol-body-kind(st1, "", line, col, "Variable");; }
function read-keyword() { return let $unknown = read-symbol-body-kind(st1, "", line, col, "Keyword");; }
function read-token() { return let $unknown = (at-end?(st1) ? st1 : let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */););; }
function lex-loop() { return let $unknown = (at-end?(st1) ? get(st1, "tokens") : lex-loop(read-token(st1)));; }
function lex() { return lex-loop(make-state(src)); }
function make-literal() { return /* unsupported block: Map */; }
function make-variable() { return /* unsupported block: Map */; }
function make-keyword() { return /* unsupported block: Map */; }
function make-sexpr() { return /* unsupported block: Map */; }
function make-array-block() { return /* unsupported block: Map */; }
function make-map-block() { return /* unsupported block: Map */; }
function make-block() { return /* unsupported block: Map */; }
function p-make() { return /* unsupported block: Map */; }
function p-peek() { return let $unknown = ((i >= length(t)) ? "null" : get(t, i));; }
function p-peek-at() { return let $unknown = ((i >= length(t)) ? "null" : get(t, i));; }
function p-end?() { return (get(p, "idx") >= length(get(p, "tokens"))); }
function p-advance() { return /* unsupported block: Map */; }
function p-with-ast() { return /* unsupported block: Map */; }
function p-append-ast() { return p-with-ast(p, append(get(p, "ast"), [node])); }
function r-pair() { return /* unsupported block: Map */; }
function parse-atom() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function parse-expr() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function parse-sexpr() { return let $unknown = ((length(args) === 0) ? r-pair(parse-consume-rparen(p2), make-sexpr("", [], line)) : let $unknown = r-pair(parse-consume-rparen(p2), make-sexpr(op, rest, line)););; }
function parse-consume-rparen() { return let $unknown = (((!null?(t)) && (get(t, "kind") === "RParen")) ? p-advance(p) : p);; }
function parse-args() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function parse-bracket() { return let $unknown = (and((!null?(next)), (get(next, "kind") === "Symbol"), is-block-type?(get(next, "value")), (get(next, "value") === upper-case(get(next, "value")))) ? parse-named-block(p1, line) : parse-array(p1, line));; }
function is-block-type?() { return let $unknown = ((c >= "A") && (c <= "Z"));; }
function upper-case() { return s; }
function parse-array() { return let $unknown = r-pair(parse-consume-rbracket(p2), make-array-block(items, line));; }
function parse-consume-rbracket() { return let $unknown = (((!null?(t)) && (get(t, "kind") === "RBracket")) ? p-advance(p) : p);; }
function parse-named-block() { return let $unknown = r-pair(parse-consume-rbracket(p3), make-block(type, name, fields, line));; }
function parse-optional-name() { return let $unknown = (and((!null?(t)), (get(t, "kind") === "Symbol"), (!(char-at(get(t, "value"), 0) === ":"))) ? r-pair(p-advance(p), get(t, "value")) : r-pair(p, "null"));; }
function parse-block-fields() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function parse-map() { return let $unknown = r-pair(parse-consume-rbrace(p2), make-map-block(items, line));; }
function parse-consume-rbrace() { return let $unknown = (((!null?(t)) && (get(t, "kind") === "RBrace")) ? p-advance(p) : p);; }
function parse-all() { return (p-end?(p) ? get(p, "ast") : let $unknown = parse-all(p2);); }
function parse() { return parse-all(p-make(tokens)); }
function esc-1() { return replace(s, "\\", "\\\\"); }
function esc-2() { return replace(s, "\"", "\\\""); }
function esc-3() { return replace(s, "\n", "\\n"); }
function esc-4() { return replace(s, "\r", "\\r"); }
function esc-5() { return replace(s, "\t", "\\t"); }
function js-esc-inner() { return esc-5(esc-4(esc-3(esc-2(esc-1(s))))); }
function js-esc() { return str("\"", js-esc-inner(s), "\""); }
function js-reserved?() { return or((n === "default"), (n === "class"), (n === "const"), (n === "let"), (n === "if"), (n === "else"), (n === "switch"), (n === "case"), (n === "break"), (n === "continue"), (n === "for"), (n === "while"), (n === "function"), (n === "return"), (n === "throw"), (n === "try"), (n === "catch"), (n === "new"), (n === "delete"), (n === "typeof"), (n === "instanceof"), (n === "var"), (n === "in"), (n === "of"), (n === "this"), (n === "super"), (n === "void"), (n === "yield"), (n === "async"), (n === "await"), (n === "import"), (n === "export"), (n === "enum"), (n === "do"), (n === "with"), (n === "finally"), (n === "null"), (n === "true"), (n === "false")); }
function rename-1() { return replace(n, "-", "_"); }
function rename-2() { return replace(n, "?", "_q"); }
function rename-3() { return replace(n, "!", "_x"); }
function rename-4() { return replace(n, ">", "_gt"); }
function rename-5() { return replace(n, "<", "_lt"); }
function rename-6() { return replace(n, "*", "_st"); }
function rename-7() { return replace(n, "+", "_pl"); }
function js-name-inner() { return let $unknown = (js-reserved?(g) ? str(g, "_") : g);; }
function js-name() { return (null?(n) ? "_" : js-name-inner(n)); }
function cg() { return cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */); }
function cg-literal() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function cg-block() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function cg-map-entries() { return cond(/* unsupported block: Array */, /* unsupported block: Array */); }
function cg-map-loop-inner() { return let $unknown = cg-map-loop(entries, (i + 1), ((i === 0) ? pair : str(acc, ",", pair)));; }
function cg-map-loop() { return ((i >= length(entries)) ? acc : cg-map-loop-inner(entries, i, acc, get(entries, i))); }
function cg-map-flat-loop-inner() { return let $unknown = cg-map-flat-loop(items, (i + 2), ((i === 0) ? pair : str(acc, ",", pair)));; }
function cg-map-flat-loop() { return ((i >= length(items)) ? acc : cg-map-flat-loop-inner(items, i, acc, get(items, i), get(items, (i + 1)))); }
function cg-keyword-key() { return cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */); }
function cg-func-block-inner() { return let $unknown = str("const ", name, " = (", ps, ")=>", cg(body), ";");; }
function cg-func-block() { return let $unknown = cg-func-block-inner(name, fields, get(fields, "params"), get(fields, "body"));; }
function cg-if() { return str("(", cg(get(args, 0)), "?", cg(get(args, 1)), ":", ((length(args) >= 3) ? cg(get(args, 2)) : "null"), ")"); }
function cg-fn() { return let $unknown = str("((", ps, ")=>", cg(body), ")");; }
function cg-defn() { return let $unknown = str("const ", name, " = (", ps, ")=>", cg(body));; }
function cg-define() { return ((length(args) === 2) ? str("const ", extract-name(get(args, 0)), " = ", cg(get(args, 1))) : cg-defn(args)); }
function cg-let() { return let $unknown = str("((()=>{", bindings, body-js, "})())");; }
function cg-let-1d() { return ((i >= length(items)) ? acc : let $unknown = cg-let-1d(items, (i + 2), str(acc, "let ", name, "=", val, ";"));); }
function cg-let-2d() { return ((i >= length(items)) ? acc : let $unknown = cg-let-2d(items, (i + 1), str(acc, "let ", name, "=", val, ";"));); }
function cg-do() { return ((length(args) === 0) ? "null" : str("(()=>{", cg-do-body(args, 0, ""), "})()")); }
function cg-do-body() { return ((i >= length(args)) ? acc : let $unknown = cg-do-body(args, (i + 1), str(acc, sep, c, ";"));); }
function cg-cond() { return cg-cond-loop(args, 0); }
function cg-cond-loop() { return ((i >= length(args)) ? "null" : let $unknown = str("(", test, "?", result, ":", rest, ")");); }
function cg-and() { return ((length(args) === 0) ? "true" : str("(", and-loop(args, 0, ""), ")")); }
function and-loop() { return ((i >= length(args)) ? acc : let $unknown = and-loop(args, (i + 1), ((i === 0) ? c : str(acc, "&&", c)));); }
function cg-or() { return ((length(args) === 0) ? "false" : str("(", or-loop(args, 0, ""), ")")); }
function or-loop() { return ((i >= length(args)) ? acc : let $unknown = or-loop(args, (i + 1), ((i === 0) ? c : str(acc, "||", c)));); }
function cg-quote() { return ((length(args) === 0) ? "null" : js-esc(str(cg(get(args, 0))))); }
function cg-set!() { return str("(", extract-name(get(args, 0)), "=", cg(get(args, 1)), ")"); }
function cg-throw() { return let $unknown = str("(()=>{throw new Error(String(", m, "))})()");; }
function cg-try() { return let $unknown = str("(()=>{try{return ", body, ";}catch(", evar, "){return ", ebody, ";}})()");; }
function extract-catch() { return let $unknown = /* unsupported block: Map */;; }
function cg-while() { return let $unknown = str("(()=>{while(", cond, "){", body, "}})()");; }
function while-body() { return ((i >= length(args)) ? acc : while-body(args, (i + 1), str(acc, cg(get(args, i)), ";"))); }
function cg-loop() { return let $unknown = str("((()=>{", bindings, "while(true){let __r=(()=>{", body-js, "})();", "if(__r&&__r.__recur){[", names, "]=__r.a;continue;}", "return __r;}})())");; }
function loop-inits-1d() { return ((i >= length(items)) ? acc : let $unknown = loop-inits-1d(items, (i + 2), str(acc, "let ", extract-name(k), "=", cg(v), ";"));); }
function loop-inits-2d() { return ((i >= length(items)) ? acc : let $unknown = loop-inits-2d(items, (i + 1), str(acc, "let ", extract-name(get(pit, 0)), "=", cg(get(pit, 1)), ";"));); }
function loop-names-1d() { return ((i >= length(items)) ? acc : let $unknown = loop-names-1d(items, (i + 2), ((length(acc) === 0) ? n : str(acc, ",", n)));); }
function loop-names-2d() { return ((i >= length(items)) ? acc : let $unknown = loop-names-2d(items, (i + 1), ((length(acc) === 0) ? n : str(acc, ",", n)));); }
function cg-recur() { return str("{__recur:true,a:[", cg-args(args), "]}"); }
function cg-match() { return let $unknown = str("((__v)=>{", cases-js, "return ", default, ";})(", val, ")");; }
function match-cases-loop() { return ((i >= length(cases)) ? acc : let $unknown = match-cases-loop(cases, (i + 1), str(acc, "if(", test, "){", inner, "}"));); }
function pattern-test() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function literal-to-js() { return cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */); }
function or-pattern-test() { return ((i >= length(pats)) ? ((length(acc) === 0) ? "false" : str("(", acc, ")")) : let $unknown = or-pattern-test(pats, v, (i + 1), ((length(acc) === 0) ? t : str(acc, "||", t)));); }
function pattern-bindings() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */);; }
function cg-compose() { return str("((__x)=>", compose-nest(args, (length(args) - 1), "__x"), ")"); }
function compose-nest() { return ((i < 0) ? acc : let $unknown = compose-nest(args, (i - 1), str(f, "(", acc, ")"));); }
function cg-pipe() { return str("((__x)=>", pipe-nest(args, 0, "__x"), ")"); }
function pipe-nest() { return ((i >= length(args)) ? acc : let $unknown = pipe-nest(args, (i + 1), str(f, "(", acc, ")"));); }
function cg-thread-first() { return let $unknown = thread-first-loop(args, 1, init);; }
function thread-first-loop() { return ((i >= length(args)) ? acc : thread-first-loop(args, (i + 1), thread-apply(get(args, i), acc, true))); }
function cg-thread-last() { return let $unknown = thread-last-loop(args, 1, init);; }
function thread-last-loop() { return ((i >= length(args)) ? acc : thread-last-loop(args, (i + 1), thread-apply(get(args, i), acc, false))); }
function thread-apply() { return cond(/* unsupported block: Array */, /* unsupported block: Array */); }
function cg-call-form() { return let $unknown = str(fn, "(", cg-args(rest), ")");; }
function cg-async() { return str("(async()=>{", cg-do-body(args, 0, ""), "})()"); }
function cg-await() { return str("(await ", cg(get(args, 0)), ")"); }
function cg-defstruct() { return let $unknown = str("const ", name, " = (", params, ")=>({__struct:\"", name, "\",", init, "})");; }
function struct-field-list() { return ((i >= length(fs)) ? acc : let $unknown = struct-field-list(fs, (i + 1), ((length(acc) === 0) ? n : str(acc, ",", n)));); }
function struct-init-list() { return ((i >= length(fs)) ? acc : let $unknown = struct-init-list(fs, (i + 1), ((length(acc) === 0) ? n : str(acc, ",", n)));); }
function cg-args() { return args-loop(args, 0, ""); }
function args-loop() { return ((i >= length(args)) ? acc : let $unknown = args-loop(args, (i + 1), ((i === 0) ? c : str(acc, ",", c)));); }
function cg-binop() { return cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */); }
function binop-loop() { return ((i >= length(args)) ? acc : let $unknown = binop-loop(args, (i + 1), ((i === 0) ? c : str(acc, op, c)), op);); }
function cg-pair() { return str("(", cg(get(args, 0)), op, cg(get(args, 1)), ")"); }
function cg-sub() { return ((length(args) === 1) ? str("(-", cg(get(args, 0)), ")") : str("(", cg(get(args, 0)), "-", cg(get(args, 1)), ")")); }
function extract-name() { return cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */); }
function extract-params() { return param-loop(items, 0, ""); }
function param-loop() { return (null?(items) ? acc : ((i >= length(items)) ? acc : let $unknown = param-loop(items, (i + 1), ((i === 0) ? name : str(acc, ",", name)));)); }
function cg-native() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function cg-call() { return let $unknown = str(fn-name, "(", cg-args(args), ")");; }
function cg-sexpr() { return let $unknown = cond(/* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */, /* unsupported block: Array */);; }
function runtime-prelude() { return str("const _fl_str = (...xs) => xs.map(x => x==null?'null':String(x)).join('');", "const _fl_length = (x) => (x==null ? 0 : x.length);", "const _fl_substring = (s, a, b) => (b==null ? s.slice(a) : s.slice(a, b));", "const _fl_char_at = (s, i) => (s[i] || null);", "const _fl_replace = (s, a, b) => s.split(a).join(b);", "const _fl_starts_with = (s, p) => s.startsWith(p);", "const _fl_ends_with = (s, p) => s.endsWith(p);", "const _fl_contains = (s, p) => s.includes(p);", "const _fl_split = (s, sep) => s.split(sep);", "const _fl_join = (l, sep) => l.join(sep==null?'':sep);", "const _fl_trim = (s) => s.trim();", "const _fl_upper = (s) => s.toUpperCase();", "const _fl_lower = (s) => s.toLowerCase();", "const _fl_repeat = (s, n) => s.repeat(n);", "const _fl_index_of = (s, p) => s.indexOf(p);", "const _fl_first = (l) => (l==null || l.length===0 ? null : l[0]);", "const _fl_last = (l) => (l==null || l.length===0 ? null : l[l.length-1]);", "const _fl_rest = (l) => (l==null || l.length===0 ? [] : l.slice(1));", "const _fl_append = (a, b) => (Array.isArray(b) ? [...a, ...b] : [...a, b]);", "const _fl_slice = (l, a, b) => l.slice(a, b);", "const _fl_map = (f, l) => l.map(x => f(x));", "const _fl_filter = (f, l) => l.filter(x => f(x));", "const _fl_reduce = (f, init, l) => l.reduce((acc, x) => f(acc, x), init);", "const _fl_find = (f, l) => (l.find(x => f(x)) ?? null);", "const _fl_every = (f, l) => l.every(x => f(x));", "const _fl_some = (f, l) => l.some(x => f(x));", "const _fl_sort = (l, cmp) => [...l].sort(cmp || ((a,b)=>a<b?-1:a>b?1:0));", "const _fl_reverse = (l) => [...l].reverse();", "const _fl_flatten = (l) => l.flat(Infinity);", "const _fl_distinct = (l) => [...new Set(l)];", "const _fl_range = (a, b, s) => { let r=[]; let step=s||1; for(let i=a;i<b;i+=step)r.push(i); return r; };", "const _fl_take = (n, l) => l.slice(0, n);", "const _fl_drop = (n, l) => l.slice(n);", "const _fl_get = (o, k) => (o==null ? null : (o[k]===undefined ? null : o[k]));", "const _fl_keys = (o) => (o==null ? [] : Object.keys(o));", "const _fl_values = (o) => (o==null ? [] : Object.values(o));", "const _fl_entries = (o) => (o==null ? [] : Object.entries(o).map(([k,v])=>[k,v]));", "const _fl_has_key = (o, k) => (o!=null && k in o);", "const _fl_map_set = (o, k, v) => ({...o, [k]: v});", "const _fl_map_delete = (o, k) => { const c={...o}; delete c[k]; return c; };", "const _fl_merge = (...os) => Object.assign({}, ...os);", "const _fl_is_map = (x) => (x!=null && typeof x==='object' && !Array.isArray(x));", "const _fl_type_of = (x) => (x==null?'null':Array.isArray(x)?'list':typeof x);", "const map_entries = (m) => m instanceof Map ? [...m.entries()] : (m && typeof m === 'object' && !Array.isArray(m) ? Object.entries(m) : []);", "const map_keys = (m) => m instanceof Map ? [...m.keys()] : (m && typeof m === 'object' && !Array.isArray(m) ? Object.keys(m) : []);", "const map_values = (m) => m instanceof Map ? [...m.values()] : (m && typeof m === 'object' && !Array.isArray(m) ? Object.values(m) : []);", "const now = () => Date.now();", "const now_ms = () => Date.now();", "const now_iso = () => new Date().toISOString();", "const now_unix = () => Math.floor(Date.now()/1000);", "const regex_match = (s, p) => new RegExp(p).test(s);", "const regex_find = (s, p) => { const m = s.match(new RegExp(p)); return m ? m[0] : null; };", "const regex_find_all = (s, p) => s.match(new RegExp(p, 'g')) || [];", "const regex_replace = (s, p, r) => s.replace(new RegExp(p, 'g'), r);", "const regex_split = (s, p) => s.split(new RegExp(p));", "const regex_count = (s, p) => (s.match(new RegExp(p, 'g')) || []).length;", "const regex_extract = (s, p) => { const m = s.match(new RegExp(p)); return m ? m.slice(1) : []; };", "const _fl_file_read = (p) => require('fs').readFileSync(p, 'utf8');", "const _fl_file_write = (p, c) => require('fs').writeFileSync(p, c);", "const _fl_file_exists = (p) => require('fs').existsSync(p);", "const _fl_shell_capture = (cmd) => { try { const {execSync}=require('child_process'); return {stdout:execSync(cmd,{encoding:'utf8'}),stderr:'',code:0}; } catch(e) { return {stdout:'',stderr:String(e),code:1}; } };", "const _fl_empty_q = (x) => (x==null || x.length===0);", "const __argv__ = process.argv.slice(2);", "const _fl_pg_exec = (db,sql,...args) => null;", "const _fl_pg_query = (db,sql,...args) => [];", "const _fl_pg_connect = (cfg) => null;", "const _fl_mariadb_exec = (db,sql,...args) => null;", "const _fl_mariadb_query = (db,sql,...args) => [];", "const _fl_mariadb_one = (db,sql,...args) => null;", "const _fl_db_query = (path,sql,...args) => [];", "const _fl_db_exec = (path,sql,...args) => null;", "const _fl_server_post = (path,fn) => null;", "const _fl_server_get = (path,fn) => null;", "const _fl_server_put = (path,fn) => null;", "const _fl_server_delete = (path,fn) => null;", "const _fl_server_start = (port) => null;", "const _fl_server_stop = () => null;", "const _fl_http_get = (url) => '';", "const _fl_http_post = (url,body) => '';", "const _fl_ws_send = (sid,data) => null;"); }
function codegen-loop() { return ((i >= length(ast)) ? acc : codegen-loop(ast, (i + 1), str(acc, cg(get(ast, i)), ";\n"))); }
function fl->js-code() { return codegen-loop(ast, 0, ""); }
function fl->js-with-prelude() { return str(runtime-prelude(), "\n", codegen-loop(ast, 0, "")); }
function compile-file() { return let $unknown = file_write(output, js);; }
(null?(__argv__) ? "null" : ((length(__argv__) === 0) ? "null" : compile-file(get(__argv__, 0), ((length(__argv__) >= 2) ? get(__argv__, 1) : str(get(__argv__, 0), ".out.js")))))
module.exports = {
  is: is,
  is: is,
  is: is,
  is: is,
  is: is,
  make: make,
  peek: peek,
  peek: peek,
  at: at,
  advance: advance,
  emit: emit,
  skip: skip,
  skip: skip,
  read: read,
  read: read,
  translate: translate,
  read: read,
  read: read,
  read: read,
  read: read,
  read: read,
  read: read,
  read: read,
  lex: lex,
  lex: lex,
  make: make,
  make: make,
  make: make,
  make: make,
  make: make,
  make: make,
  make: make,
  p: p,
  p: p,
  p: p,
  p: p,
  p: p,
  p: p,
  p: p,
  r: r,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  is: is,
  upper: upper,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  parse: parse,
  esc: esc,
  esc: esc,
  esc: esc,
  esc: esc,
  esc: esc,
  js: js,
  js: js,
  js: js,
  rename: rename,
  rename: rename,
  rename: rename,
  rename: rename,
  rename: rename,
  rename: rename,
  rename: rename,
  js: js,
  js: js,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  and: and,
  cg: cg,
  or: or,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  extract: extract,
  cg: cg,
  while: while,
  cg: cg,
  loop: loop,
  loop: loop,
  loop: loop,
  loop: loop,
  cg: cg,
  cg: cg,
  match: match,
  pattern: pattern,
  literal: literal,
  or: or,
  pattern: pattern,
  cg: cg,
  compose: compose,
  cg: cg,
  pipe: pipe,
  cg: cg,
  thread: thread,
  cg: cg,
  thread: thread,
  thread: thread,
  cg: cg,
  cg: cg,
  cg: cg,
  cg: cg,
  struct: struct,
  struct: struct,
  cg: cg,
  args: args,
  cg: cg,
  binop: binop,
  cg: cg,
  cg: cg,
  extract: extract,
  extract: extract,
  param: param,
  cg: cg,
  cg: cg,
  cg: cg,
  runtime: runtime,
  codegen: codegen,
  fl: fl,
  fl: fl,
  compile: compile
};