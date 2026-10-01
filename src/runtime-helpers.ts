/**
 * src/runtime-helpers.ts
 *
 * Runtime helper functions for FreeLang
 * Extracted and enhanced for self-hosting L2 Fixpoint
 */

/**
 * 런타임 헬퍼 함수 프리앰블 생성
 * Stage1.js 최상단에 주입되어 JavaScript 코드 실행 지원
 */
export function generateRuntimePreamble(): string {
  return `
// ═══════════════════════════════════════════════════════
// FreeLang v11 Runtime Helpers (Enhanced 2026-04-30)
// ═══════════════════════════════════════════════════════

// ─ 산술 및 논리 연산자 (stdlib) ─
function _plus(...args) { if (args.length === 0) return 0; if (args.length === 1) return args[0]; return args.reduce((a, b) => a + b); }
function _minus(...args) { if (args.length === 0) return 0; if (args.length === 1) return -args[0]; return args.reduce((a, b) => a - b); }
function _star(...args) { if (args.length === 0) return 1; if (args.length === 1) return args[0]; return args.reduce((a, b) => a * b); }
function _slash(...args) { if (args.length === 0) return 1; if (args.length === 1) return 1/args[0]; return args.reduce((a, b) => a / b); }
const rem = (a, b) => a % b;
const mod = rem;
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
function _fl_boolean_q(v) { return typeof v === 'boolean'; }
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
const push = _fl_append;
const append = _fl_append;
function _fl_concat(a, b) { return Array.isArray(a) && Array.isArray(b) ? [...a, ...b] : String(a || "") + String(b || ""); }
function _fl_keys(o) { return o ? Object.keys(o) : []; }
function _fl_values(o) { return o ? Object.values(o) : []; }
var _fl_entries = (o) => o ? Object.entries(o).map(([k,v]) => [k,v]) : [];
var map_entries = _fl_entries;
var map_keys = _fl_keys;
var map_values = _fl_values;
function _fl_map_set(o, ...args) { const result = {...(o || {})}; for (let i = 0; i + 1 < args.length; i += 2) { result[args[i]] = args[i + 1]; } return result; }
function _fl_dissoc(o, ...keys) {
  if (o != null && (typeof o !== "object" || Array.isArray(o))) throw new Error("dissoc: expected map");
  const result = {...(o || {})};
  for (const rawKey of keys) {
    const key = typeof rawKey === "string" && rawKey.startsWith(":") ? rawKey.slice(1) : String(rawKey);
    delete result[key];
  }
  return result;
}
function _fl_has_key_q(o, k) { return o ? (String(k) in o) : false; }
function _fl_atom(v) { return { value: v }; }
function _fl_atom_deref(a) { return a == null ? null : a.value; }
function _fl_atom_reset(a, v) { if (a == null) return v; a.value = v; return v; }
function _fl_atom_swap(a, fn, ...args) { return _fl_atom_reset(a, fn(_fl_atom_deref(a), ...args)); }
const atom = _fl_atom;
const deref = _fl_atom_deref;
const reset_bang = _fl_atom_reset;
const swap_bang = _fl_atom_swap;

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
function _fl_str_starts_with(s, prefix) { return String(s || "").startsWith(String(prefix || "")); }
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
const _fl_host_functions = Object.create(null);
function _fl_register_host_functions(functions) { Object.assign(_fl_host_functions, functions); }
let _fl_generated_http_host = null;
function _fl_http_host_call(method, ...args) {
  if (_fl_generated_http_host === null) {
    const root = process.env.FREELANG_V11_ROOT;
    if (!root) throw new Error("generated HTTP requires FREELANG_V11_ROOT");
    const filename = require("path").join(root, "generated-http-host.cjs");
    const factory = require(filename).createGeneratedHttpHost;
    _fl_generated_http_host = factory((name, values) => {
      const callback = _fl_host_functions[name];
      if (typeof callback !== "function") throw new Error("FreeLang HTTP callback not found: " + name);
      return callback(...values);
    });
  }
  const methodFn = _fl_generated_http_host[method];
  if (typeof methodFn !== "function") throw new Error("FreeLang HTTP host method not found: " + method);
  return methodFn(...args);
}
function _fl_server_post(...args) { return _fl_http_host_call("server_post", ...args); }
function _fl_server_get(...args) { return _fl_http_host_call("server_get", ...args); }
function _fl_server_delete(...args) { return _fl_http_host_call("server_delete", ...args); }
function _fl_server_sse(...args) { return _fl_http_host_call("server_sse", ...args); }
function _fl_server_body_limit(...args) { return _fl_http_host_call("server_body_limit", ...args); }
function _fl_server_start(...args) { return _fl_http_host_call("server_start", ...args); }
function _fl_sse_alive(...args) { return _fl_http_host_call("sse_alive", ...args); }
function _fl_sse_send(...args) { return _fl_http_host_call("sse_send", ...args); }
function _fl_sse_close(...args) { return _fl_http_host_call("sse_close", ...args); }
function _fl_set_interval(...args) { return _fl_http_host_call("set_interval", ...args); }
function _fl_http_get_bounded(...args) { return _fl_http_host_call("http_get_bounded", ...args); }
function _fl_uuid_v4(...args) { return _fl_http_host_call("uuid_v4", ...args); }
function _fl_now_unix(...args) { return _fl_http_host_call("now_unix", ...args); }
function _fl_base64url_decode(...args) { return _fl_http_host_call("base64url_decode", ...args); }
function _fl_auth_jwt_verify(...args) { return _fl_http_host_call("auth_jwt_verify", ...args); }
function _fl_file_read(p) { return require("fs").readFileSync(p, "utf8"); }
function _fl_utf8_decode_strict(base64) {
  if (typeof base64 !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error("binary: invalid base64 buffer");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64) throw new Error("binary: non-canonical base64 buffer");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function _fl_file_read_base64(p, maxBytes) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1048576) {
    throw new Error("file_read_base64 requires a 1..1048576 byte limit");
  }
  const fs = require("fs");
  const path = require("path");
  const base = process.env.FL_FILE_BASE;
  const resolved = path.resolve(p);
  if (base) {
    const root = path.resolve(base);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error("file_read_base64 path outside FL_FILE_BASE");
    }
  }
  const fd = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > maxBytes) {
      throw new Error("file_read_base64 file is not a bounded regular file");
    }
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    for (;;) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
      if (length > maxBytes) throw new Error("file_read_base64 byte limit exceeded");
    }
    return buffer.subarray(0, length).toString("base64");
  } finally {
    fs.closeSync(fd);
  }
}
function _fl_shell_cwd() { return process.cwd(); }
function _fl_crypto_rsa_verify(publicKey, data, signature) {
  try {
    const verifier = require("crypto").createVerify("RSA-SHA256");
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKey, Buffer.from(signature, "base64url"));
  } catch { return false; }
}
function _fl_crypto_rsa_verify_jwk(jwk, data, signature) {
  try {
    if (!jwk || jwk.kty !== "RSA" || typeof jwk.n !== "string" || typeof jwk.e !== "string" ||
        (jwk.alg != null && jwk.alg !== "RS256") || (jwk.use != null && jwk.use !== "sig") ||
        typeof data !== "string" || typeof signature !== "string" ||
        !/^[A-Za-z0-9_-]+$/.test(signature)) return false;
    const key = require("crypto").createPublicKey({key: {kty: "RSA", n: jwk.n, e: jwk.e}, format: "jwk"});
    return _fl_crypto_rsa_verify(key, data, signature);
  } catch { return false; }
}
function _fl_shell_safe(program, args) {
  if (typeof program !== "string" || !program) throw new Error("shell_safe: program must be a string");
  if (!Array.isArray(args)) throw new Error("shell_safe: args must be an array");
  const result = require("child_process").spawnSync(program, args.map(String), { timeout: 30000, encoding: "utf8" });
  if (result.error) throw new Error("shell_safe failed: " + result.error.message);
  if (result.status !== 0) throw new Error("shell_safe failed (exit " + result.status + "): " + String(result.stderr || "").trim());
  return result.stdout || "";
}
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
function _fl_run_inherit(cmd) { require("child_process").spawnSync(cmd,{shell:true,stdio:"inherit"}); }
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
  if (prompt !== undefined && prompt !== null && prompt !== "") process.stderr.write(String(prompt));
  const fs = require("fs");
  const bytes = [];
  const byte = Buffer.allocUnsafe(1);
  const maxBytes = 1024 * 1024;
  while (true) {
    let count;
    try {
      count = fs.readSync(process.stdin.fd, byte, 0, 1, null);
    } catch (error) {
      if (error?.code === "EAGAIN" || error?.code === "EWOULDBLOCK") {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        continue;
      }
      throw new Error("read-line: stdin read failed: " + error.message);
    }
    if (count === 0 && bytes.length === 0) return null;
    if (count === 0 || byte[0] === 10) {
      if (count !== 0 && bytes[bytes.length - 1] === 13) bytes.pop();
      try {
        return new (require("util").TextDecoder)("utf-8", { fatal: true }).decode(Buffer.from(bytes));
      } catch {
        throw new Error("read-line: invalid UTF-8");
      }
    }
    bytes.push(byte[0]);
    if (bytes.length > maxBytes) throw new RangeError("read-line: line exceeds " + maxBytes + " bytes");
  }
}
function _fl_stdin_on_line(callback, tickMs) {
  if (typeof callback !== "function") throw new Error("stdin-on-line: callback required");
  if (tickMs !== undefined && (!Number.isInteger(tickMs) || tickMs < 1 || tickMs > 60000))
    throw new Error("stdin-on-line: invalid tick interval");
  const maxBytes = 1024 * 1024;
  const Decoder = require("util").TextDecoder;
  let pending = Buffer.alloc(0);
  let ended = false;
  let timer;
  const stop = () => {
    if (timer) clearInterval(timer);
    process.stdin.removeListener("data", onData);
    process.stdin.removeListener("end", onEnd);
    process.stdin.removeListener("error", onError);
    process.stdin.pause();
  };
  const fail = (message) => {
    if (ended) return;
    ended = true;
    stop();
    process.stderr.write(message + "\\n");
    process.exitCode = 1;
    callback({kind: "error", message});
  };
  const deliver = (bytes) => {
    if (bytes.length > maxBytes) { fail("stdin-on-line: line exceeds " + maxBytes + " bytes"); return; }
    const line = bytes.length > 0 && bytes[bytes.length - 1] === 13 ? bytes.subarray(0, -1) : bytes;
    let decoded;
    try { decoded = new Decoder("utf-8", {fatal: true}).decode(line); }
    catch { fail("stdin-on-line: invalid UTF-8"); return; }
    callback({kind: "line", line: decoded});
  };
  const onData = (chunk) => {
    let start = 0;
    for (let index = 0; index < chunk.length && !ended; index++) {
      if (chunk[index] !== 10) continue;
      deliver(Buffer.concat([pending, chunk.subarray(start, index)]));
      pending = Buffer.alloc(0);
      start = index + 1;
    }
    if (ended) return;
    pending = Buffer.concat([pending, chunk.subarray(start)]);
    if (pending.length > maxBytes) fail("stdin-on-line: line exceeds " + maxBytes + " bytes");
  };
  const onEnd = () => {
    if (ended) return;
    if (pending.length > 0) deliver(pending);
    if (ended) return;
    ended = true;
    stop();
    callback({kind: "eof"});
  };
  const onError = (error) => fail("stdin-on-line: stdin read failed: " + error.message);
  process.stdin.on("data", onData);
  process.stdin.on("end", onEnd);
  process.stdin.on("error", onError);
  if (tickMs !== undefined) timer = setInterval(() => callback({kind: "tick"}), tickMs);
  process.stdin.resume();
  return null;
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
`.trim();
}

/**
 * 헬퍼 함수 목록
 */
export const HELPER_FUNCTIONS = [
  '_plus', '_minus', '_star', '_slash', '_gt', '_lt', '_eq', '_gt_eq', '_lt_eq', '_not', '_and', '_or', '_concat',
  '_fl_null_q', '_fl_true_q', '_fl_false_q', '_fl_number_q', '_fl_boolean_q', '_fl_string_q', '_fl_list_q', '_fl_array_q', '_fl_map_q', '_fl_fn_q',
  '_fl_length', '_fl_get', '_fl_first', '_fl_last', '_fl_rest', '_fl_append', '_fl_concat', '_fl_keys', '_fl_values', '_fl_entries', '_fl_map_set', '_fl_dissoc', '_fl_has_key_q',
  '_fl_atom', '_fl_atom_deref', '_fl_atom_reset', '_fl_atom_swap',
  '_fl_str', '_fl_char_at', '_fl_substring', '_fl_lower', '_fl_upper', '_fl_trim', '_fl_replace', '_fl_str_index_of', '_fl_contains_q', '_fl_str_starts_with', '_fl_str_to_num', '_fl_join', '_fl_split', '_fl_repeat', '_fl_range',
  '_fl_map', '_fl_filter', '_fl_reduce', '_fl_slice', '_fl_print', '_fl_get_argv', '_fl_readline', '_fl_stdin_on_line', '_fl_file_read', '_fl_file_read_base64', '_fl_utf8_decode_strict', '_fl_file_write', '_fl_file_exists', '_fl_shell_cwd', '_fl_shell_safe', '_fl_shell_capture', '_fl_crypto_rsa_verify', '_fl_crypto_rsa_verify_jwk',
  '_fl_register_host_functions', '_fl_http_host_call', '_fl_server_post', '_fl_server_get', '_fl_server_delete', '_fl_server_sse', '_fl_server_body_limit', '_fl_server_start', '_fl_sse_alive', '_fl_sse_send', '_fl_sse_close', '_fl_set_interval', '_fl_http_get_bounded', '_fl_uuid_v4', '_fl_now_unix', '_fl_base64url_decode', '_fl_auth_jwt_verify',
  '_fl_take', '_fl_drop', '_fl_zip', '_fl_flatten', '_fl_reverse', '_fl_sort'
];

export const HELPER_COUNT = HELPER_FUNCTIONS.length;
