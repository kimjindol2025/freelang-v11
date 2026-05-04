// FreeLang v11: AI Helpers — MISTAKES-100 자동 처리
// Phase G: 실수 50개를 언어가 자동 처리
//
// 제공 함수:
//   G-1: 에러 추천
//     - suggest-fn / suggest_fn: 유사 함수명 추천 [string]
//     - alias-of / alias_of: 알려진 별칭 → {:correct :usage}
//     - help-text / help_text: 사람용 도움말 string
//
//   G-2: 인자 자동 수정
//     - smart-map / smart_map: (fn arr) 또는 (arr fn) 자동 감지
//     - smart-filter / smart_filter
//     - smart-get / smart_get: (col key) 또는 (key col)
//     - smart-assoc / smart_assoc
//
//   G-3-A: HTTP 래퍼
//     - http-get-json / http_get_json: body 추출 + JSON 파싱
//     - http-post-json / http_post_json: body JSON 자동 + 응답 파싱
//     - http-status / http_status: status 코드만 반환
//
//   G-3-B: try-call (Result 패턴)
//     - try-call / try_call: fn() 안전 호출 → {:ok :value} or {:ok=false :error}
//     - try-call-1 / try_call_1: fn(arg) 안전 호출
//     - ok? / err? / unwrap / unwrap-or / unwrap_or

type CallFnValue = (fn: any, args: any[]) => any;
type HttpGetFn = (url: string, opts?: any) => any;

// ─────────────────────────────────────────────────────────────
// G-1: 별칭 매핑 — _aliases.json (wrapper와 공유)
// ─────────────────────────────────────────────────────────────
import * as ALIASES_RAW from "./_aliases.json";

const HELPER_ALIASES: Record<string, { correct: string; usage: string; mistake?: string | null }> = {};
for (const [k, v] of Object.entries(ALIASES_RAW as any)) {
  if (k.startsWith("_")) continue;
  HELPER_ALIASES[k] = v as any;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const COMMON_FUNCTIONS = [
  "println", "print", "map", "filter", "reduce", "append", "get", "assoc", "dissoc",
  "str", "length", "nil?", "if", "cond", "let", "do", "defn", "fn", "define",
  "server_start", "server_get", "server_post", "server_put", "server_delete",
  "server_json", "server_html", "server_text", "server_status", "server_redirect",
  "mariadb_connect", "mariadb_query", "mariadb_one", "mariadb_exec",
  "http_get", "json_parse", "json_stringify",
  "file_read", "file_write", "file_exists",
  "auth_jwt_sign", "auth_jwt_verify", "auth_hash_password",
];

function suggestSimilarFn(name: string, candidates: string[] = COMMON_FUNCTIONS, limit = 3): string[] {
  const scored = candidates
    .map((c) => ({ name: c, dist: levenshtein(name, c) }))
    .filter((s) => s.dist <= Math.max(2, Math.floor(name.length / 3)))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit);
  return scored.map((s) => s.name);
}

const isFnValue = (x: any) =>
  typeof x === "function" || (x !== null && typeof x === "object" && x.kind === "function-value");
const isArr = (x: any) => Array.isArray(x);
const isMap = (x: any) =>
  x instanceof Map ||
  (x !== null && typeof x === "object" && !Array.isArray(x) && x.kind !== "function-value");
const isCol = (x: any) =>
  Array.isArray(x) || x instanceof Map || (x !== null && typeof x === "object" && x.kind !== "function-value");
const truthy = (v: any) => v !== false && v !== null && v !== undefined && v !== 0 && v !== "";

function callFn(fn: any, args: any[], cfv?: CallFnValue): any {
  if (typeof fn === "function") return fn(...args);
  if (cfv) return cfv(fn, args);
  throw new Error("호출 가능한 함수가 아닙니다");
}

function extractBody(resp: any): any {
  if (resp == null) return null;
  if (resp instanceof Map) return resp.get("body");
  if (typeof resp === "object") return resp.body;
  return resp;
}

function extractStatus(resp: any): number {
  if (resp == null) return 0;
  if (resp instanceof Map) return Number(resp.get("status") || 0);
  if (typeof resp === "object") return Number(resp.status || 0);
  return 0;
}

function maybeParseJson(body: any): any {
  if (typeof body !== "string") return body;
  try { return JSON.parse(body); } catch { return body; }
}

// 기존 FreeLang Result 타입 (Phase 96)에 맞춤
// Ok: {_tag: 'Ok', value: T}
// Err: {_tag: 'Err', code, message, category, recoverable}
function buildOk(value: any): any {
  return { _tag: "Ok", value };
}
function buildErr(message: string, code = "E_TRY_CALL", category = "runtime-error"): any {
  return {
    _tag: "Err",
    code,
    message,
    category,
    recoverable: true,
  };
}

// ─────────────────────────────────────────────────────────────
// 메인 모듈
// ─────────────────────────────────────────────────────────────
export function createHelpersModule(callFnValue?: CallFnValue, httpGet?: HttpGetFn) {
  const cfv = callFnValue;

  // ── G-1: 에러 추천 ─────────────────────────────────────────
  const suggest_fn = (name: string): string[] => {
    const a = HELPER_ALIASES[name];
    if (a) return [a.correct];
    return suggestSimilarFn(name);
  };
  const alias_of = (name: string): any => {
    const a = HELPER_ALIASES[name];
    if (!a) return null;
    const m = new Map<string, any>();
    m.set("correct", a.correct);
    m.set("usage", a.usage);
    return m;
  };
  const help_text = (name: string): string => {
    const a = HELPER_ALIASES[name];
    if (a) return `'${name}'은(는) 없습니다. 대신 ${a.correct} 사용: ${a.usage}`;
    const sim = suggestSimilarFn(name);
    if (sim.length > 0) return `'${name}'을 찾을 수 없습니다. 혹시: ${sim.join(", ")} ?`;
    return `'${name}'에 대한 정보가 없습니다.`;
  };

  // ── G-2: 인자 자동 수정 ────────────────────────────────────
  const smart_map = (a: any, b: any): any => {
    if (isFnValue(a) && isArr(b)) return b.map((x: any) => callFn(a, [x], cfv));
    if (isArr(a) && isFnValue(b)) return a.map((x: any) => callFn(b, [x], cfv));
    throw new Error("smart-map: [fn, arr] 또는 [arr, fn]");
  };
  const smart_filter = (a: any, b: any): any => {
    if (isFnValue(a) && isArr(b)) return b.filter((x: any) => truthy(callFn(a, [x], cfv)));
    if (isArr(a) && isFnValue(b)) return a.filter((x: any) => truthy(callFn(b, [x], cfv)));
    throw new Error("smart-filter: [fn, arr] 또는 [arr, fn]");
  };
  const smart_get = (a: any, b: any): any => {
    // (col key)
    if (isCol(a) && !isFnValue(a)) {
      if (a instanceof Map) return a.get(b);
      if (Array.isArray(a)) return a[b];
      return a[b];
    }
    // (key col) → 자동 수정
    if (isCol(b) && !isFnValue(b)) {
      if (b instanceof Map) return b.get(a);
      if (Array.isArray(b)) return b[a];
      return b[a];
    }
    throw new Error("smart-get: 컬렉션과 키가 필요합니다");
  };
  const smart_assoc = (a: any, b: any, c: any): any => {
    // (map key val)
    if (isMap(a)) {
      if (a instanceof Map) {
        const m = new Map(a);
        m.set(b, c);
        return m;
      }
      return { ...a, [b]: c };
    }
    // (key val map) → 자동 수정
    if (isMap(c)) {
      if (c instanceof Map) {
        const m = new Map(c);
        m.set(a, b);
        return m;
      }
      return { ...c, [a]: b };
    }
    throw new Error("smart-assoc: map + key + value");
  };

  // ── G-3-A: HTTP 래퍼 ───────────────────────────────────────
  const http_get_json = (url: string, opts?: any): any => {
    if (!httpGet) throw new Error("http-get-json: http_get 미연결");
    const resp = httpGet(url, opts);
    return maybeParseJson(extractBody(resp));
  };
  const http_post_json = (url: string, body: any): any => {
    if (!httpGet) throw new Error("http-post-json: http_get 미연결");
    const opts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    };
    const resp = httpGet(url, opts);
    return maybeParseJson(extractBody(resp));
  };
  const http_status = (url: string, opts?: any): number => {
    if (!httpGet) throw new Error("http-status: http_get 미연결");
    const resp = httpGet(url, opts);
    return extractStatus(resp);
  };

  // ── G-3-B: try-call (기존 Result 타입과 호환) ─────────────
  // 기존 ok?/err?/unwrap/unwrap-or 그대로 사용 가능
  const try_call = (fn: any): any => {
    try {
      return buildOk(callFn(fn, [], cfv));
    } catch (err: any) {
      return buildErr(err?.message || String(err));
    }
  };
  const try_call_1 = (fn: any, arg: any): any => {
    try {
      return buildOk(callFn(fn, [arg], cfv));
    } catch (err: any) {
      return buildErr(err?.message || String(err));
    }
  };

  return {
    // G-1
    "suggest-fn": suggest_fn,
    "suggest_fn": suggest_fn,
    "alias-of": alias_of,
    "alias_of": alias_of,
    "help-text": help_text,
    "help_text": help_text,
    // G-2
    "smart-map": smart_map,
    "smart_map": smart_map,
    "smart-filter": smart_filter,
    "smart_filter": smart_filter,
    "smart-get": smart_get,
    "smart_get": smart_get,
    "smart-assoc": smart_assoc,
    "smart_assoc": smart_assoc,
    // G-3-A
    "http-get-json": http_get_json,
    "http_get_json": http_get_json,
    "http-post-json": http_post_json,
    "http_post_json": http_post_json,
    "http-status": http_status,
    "http_status": http_status,
    // G-3-B (기존 ok?/err?/unwrap/unwrap-or와 호환)
    "try-call": try_call,
    "try_call": try_call,
    "try-call-1": try_call_1,
    "try_call_1": try_call_1,
  };
}
