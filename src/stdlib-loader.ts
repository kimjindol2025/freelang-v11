// FreeLang v9: Stdlib Loader
// Phase 58: interpreter.ts constructor에서 분리된 stdlib 모듈 등록 로직

import { createHash, createHmac } from "crypto";         // Node.js crypto (static import — runtime require 충돌 방지)
import { createFileModule } from "./stdlib-file";        // Phase 10: File I/O
import { createFdModule } from "./stdlib-fd";            // Phase 11.5: File Descriptor (NEW)
import { createBitsModule } from "./stdlib-bits";        // Phase 11.6: Bitwise Operations (NEW)
import { createTimerModule } from "./stdlib-timer";      // Phase 11.7: Timer (NEW)
import { createErrorModule } from "./stdlib-error";      // Phase 11: Error handling
import { createHttpModule } from "./stdlib-http";        // Phase 12: HTTP Client
import { createShellModule } from "./stdlib-shell";      // Phase 12: Shell execution
import { createDataModule } from "./stdlib-data";        // Phase 13: Data Transform
import { createCollectionModule } from "./stdlib-collection"; // Phase 14: Collection + Control
import { createAgentModule } from "./stdlib-agent";      // Phase 15: AI Agent State Machine
import { createTimeModule } from "./stdlib-time";        // Phase 16: Time + Logging + Monitoring
import { createCryptoModule } from "./stdlib-crypto";    // Phase 17: Crypto + UUID + Regex
import { createWorkflowModule } from "./stdlib-workflow"; // Phase 18: Workflow Engine (core)
import { createResourceModule } from "./stdlib-resource"; // Phase 19: Server Resource Search
import { createHttpServerModule } from "./stdlib-http-server"; // Phase 4a: Pure HTTP Server
import { createDbModule } from "./stdlib-db";            // Phase 20: DB Driver (SQLite)
import { createAuthModule } from "./stdlib-auth";        // Phase 21: Auth (JWT, API key, hash)
import { createCacheModule } from "./stdlib-cache";      // Phase 21: In-memory TTL cache
import { createPubSubModule } from "./stdlib-pubsub";    // Phase 21: Pub/Sub events
import { createProcessModule } from "./stdlib-process";  // Phase 22: Process (env + SIGTERM)
import { createModuleSystem } from "./stdlib-module";    // Phase 24: Module system
import { createTestModule } from "./stdlib-test";        // Phase 76: FL 테스트 러너
import { createMaybeModule } from "./maybe-type";        // Phase 91: 불확실성 타입
import { createTestEnhancedModule } from "./stdlib-test-enhanced";
import { createWsModule } from "./stdlib-ws";            // WebSocket 서버
import { fnMetaRegistry } from "./eval-special-forms";   // AI-Native Phase 1
import { propRegistry, runProp, createPropertyModule } from "./stdlib-property"; // AI-Native Phase 4
import { createWscModule } from "./stdlib-wsc";          // WebSocket 클라이언트
import { requireModule, getAvailableModules, isModuleLoaded } from "./stdlib-lazy-registry"; // Lazy Loading
import { createImageModule } from "./stdlib-image"; // Phase A: Image Processing

// Minimal Interpreter interface (순환 import 방지)
interface InterpreterLike {
  registerModule(module: Record<string, unknown>): void;
  callUserFunction(name: string, args: any[]): any;
  callFunctionValue(fnValue: any, args: any[]): any;
}

/**
 * 20개 stdlib 모듈을 interpreter에 등록
 * interpreter.ts constructor 대신 이 함수 한 줄로 호출
 */
export function loadAllStdlib(interp: InterpreterLike): void {
  interp.registerModule(createFileModule());
  interp.registerModule(createFdModule());
  interp.registerModule(createBitsModule());
  interp.registerModule(createTimerModule(interp)); // Pass interp for callback invocation
  interp.registerModule(createErrorModule());
  interp.registerModule(createHttpModule());
  interp.registerModule(createShellModule());
  interp.registerModule(createDataModule());
  interp.registerModule(createCollectionModule());
  interp.registerModule(createAgentModule());
  interp.registerModule(createTimeModule());
  interp.registerModule(createCryptoModule());
  interp.registerModule(createWorkflowModule());
  interp.registerModule(createResourceModule());
  // Phase 4a: Pure HTTP Server — callUserFunction/callFunctionValue 콜백 필요
  interp.registerModule(createHttpServerModule(
    (n: string, a: any[]) => interp.callUserFunction(n, a),
    (fnValue: any, a: any[]) => interp.callFunctionValue(fnValue, a)
  ));
  interp.registerModule(createDbModule());
  interp.registerModule(createAuthModule());
  interp.registerModule(createCacheModule());
  interp.registerModule(createPubSubModule((n, a) => interp.callUserFunction(n, a)));
  interp.registerModule(createProcessModule());  // Phase 22: env_load, on_sigterm
  interp.registerModule(createModuleSystem());   // Phase 24: module_*, namespace_*
  interp.registerModule(createTestModule(         // Phase 76: deftest, describe, assert-eq, ...
    (fnValue, args) => interp.callFunctionValue(fnValue, args)
  ));
  interp.registerModule(createMaybeModule(         // Phase 91: 불확실성 타입 (maybe/none/confident)
    (fnValue, args) => interp.callFunctionValue(fnValue, args),
    (name, args) => interp.callUserFunction(name, args)
  ));
  interp.registerModule(createTestEnhancedModule());
  interp.registerModule(createWsModule(
    (n: string, a: any[]) => interp.callUserFunction(n, a)
  ));
  interp.registerModule(createWscModule(
    (n: string, a: any[]) => interp.callUserFunction(n, a)
  ));
  interp.registerModule(createImageModule()); // Phase A: image_info/resize/thumbnail/convert/watermark/crop

  // ── fl_require builtin 등록 ─────────────────────────────────────
  // (fl_require "audit")   → audit_log 등 즉시 사용 가능
  // (fl_require? "audit")  → 로드 여부 확인 (true/false)
  // (fl_modules)           → 사용 가능 모듈 목록
  // 주의: "require"는 Node.js 내장과 충돌 → fl_require 사용
  interp.registerModule({
    "fl_require":  (name: string): boolean => requireModule(name, interp as any),
    "fl_require?": (name: string): boolean => isModuleLoaded(name),
    "fl_modules":  (): string[] => getAvailableModules(),
  });

  // 네이밍 alias: 자주 쓰는 함수들의 대체 이름
  const _aliases: Record<string, (...a: any[]) => any> = {
    // ── get-in / assoc-in / update-in (깊은 접근 + 업데이트) ─────────────────
    "get-in": (m: any, path: any[]): any => {
      let cur = m;
      for (const k of path) {
        if (cur === null || cur === undefined) return null;
        cur = cur instanceof Map ? (cur.get(k) ?? cur.get(String(k)) ?? null)
              : (cur?.[k] ?? null);
      }
      return cur ?? null;
    },
    "assoc-in": (m: any, path: any[], val: any): any => {
      if (!path || path.length === 0) return val;
      const key = path[0];
      const rest = path.slice(1);
      const child = m instanceof Map ? (m.get(key) ?? m.get(String(key)))
                    : (m?.[key]);
      const updated = rest.length > 0 ? _aliases["assoc-in"](child ?? new Map(), rest, val) : val;
      if (m instanceof Map) { const r = new Map(m); r.set(key, updated); return r; }
      return Object.assign({}, m ?? {}, { [String(key)]: updated });
    },
    "update-in": (m: any, path: any[], fn: any, ...args: any[]): any => {
      const cur = _aliases["get-in"](m, path);
      let newVal: any;
      if (typeof fn === "function") {
        newVal = fn(cur, ...args);
      } else if (fn?.kind === "function-value" || fn?.kind === "async-function-value") {
        newVal = (interp as any).callFunctionValue(fn, [cur, ...args]);
      } else if (typeof fn?.body === "function") {
        newVal = fn.body(cur, ...args);
      } else if (typeof fn === "string") {
        newVal = (interp as any).callUserFunction(fn, [cur, ...args]);
      } else {
        newVal = cur;
      }
      return _aliases["assoc-in"](m, path, newVal);
    },
    // ── regex 별칭 (re-* → Clojure 스타일) ───────────────────────────────────
    "re-match":   (pattern: string, s: string): boolean => {
      try { return new RegExp(pattern).test(String(s)); } catch { return false; }
    },
    "re-find":    (pattern: string, s: string): string | null => {
      try { const m = String(s).match(new RegExp(pattern)); return m ? m[0] : null; } catch { return null; }
    },
    "re-find-all": (pattern: string, s: string): string[] => {
      try { return [...String(s).matchAll(new RegExp(pattern, "g"))].map(m => m[0]); } catch { return []; }
    },
    "re-replace": (pattern: string, replacement: string, s: string): string => {
      try { return String(s).replace(new RegExp(pattern, "g"), replacement); } catch { return String(s); }
    },
    "re-split":   (pattern: string, s: string): string[] => {
      try { return String(s).split(new RegExp(pattern)); } catch { return [String(s)]; }
    },
    "re-groups":  (pattern: string, s: string): (string | null)[] | null => {
      try { const m = String(s).match(new RegExp(pattern)); return m ? [...m].slice(1) : null; } catch { return null; }
    },
    // ── 구조화 로깅 (log/info, log/warn, log/error) ────────────────────────
    "log/info":  (msg: string, ctx?: any): null => {
      const ts = new Date().toISOString();
      const ctxStr = ctx ? " " + JSON.stringify(ctx instanceof Map ? Object.fromEntries(ctx) : ctx) : "";
      process.stdout.write(`\x1b[32m[INFO]\x1b[0m  ${ts} ${msg}${ctxStr}\n`);
      return null;
    },
    "log/warn":  (msg: string, ctx?: any): null => {
      const ts = new Date().toISOString();
      const ctxStr = ctx ? " " + JSON.stringify(ctx instanceof Map ? Object.fromEntries(ctx) : ctx) : "";
      process.stderr.write(`\x1b[33m[WARN]\x1b[0m  ${ts} ${msg}${ctxStr}\n`);
      return null;
    },
    "log/error": (msg: string, ctx?: any): null => {
      const ts = new Date().toISOString();
      const rawCtx = ctx instanceof Map ? Object.fromEntries(ctx) : ctx;
      // $e 에러 맵이면 message 꺼냄
      const errCtx = (rawCtx?.raw instanceof Error)
        ? { ...rawCtx, raw: rawCtx.raw.message }
        : rawCtx;
      const ctxStr = errCtx ? " " + JSON.stringify(errCtx) : "";
      process.stderr.write(`\x1b[31m[ERROR]\x1b[0m ${ts} ${msg}${ctxStr}\n`);
      return null;
    },
    "log/debug": (msg: string, ctx?: any): null => {
      if (!process.env.FL_DEBUG && !process.env.FL_LOG_DEBUG) return null;
      const ts = new Date().toISOString();
      const ctxStr = ctx ? " " + JSON.stringify(ctx instanceof Map ? Object.fromEntries(ctx) : ctx) : "";
      process.stderr.write(`\x1b[2m[DEBUG]\x1b[0m ${ts} ${msg}${ctxStr}\n`);
      return null;
    },
    // AI-Native Phase 1: fn-meta — 사용자 정의 함수의 메타 조회
    "fn-meta": (name: string): any => {
      const meta = fnMetaRegistry.get(name);
      if (!meta) return null;
      const m = new Map<string, any>();
      if (meta.returns)  m.set("returns",  meta.returns);
      if (meta.context)  m.set("context",  meta.context);
      if (meta.effects)  m.set("effects",  meta.effects);
      if (meta.examples) m.set("examples", meta.examples);
      return m;
    },
    "fn_meta": (name: string): any => _aliases["fn-meta"](name),

    // AI-Native Phase 4: property-based testing 런타임 함수
    "run-props": (): any => {
      const results: any[] = [];
      let totalPassed = 0;
      let totalFailed = 0;

      for (const [, prop] of propRegistry) {
        const result = runProp(
          prop,
          (fnName, args) => {
            // 사용자 정의 함수 호출
            const fnVal = (interp as any).context?.variables?.get(fnName)
              ?? (interp as any).context?.variables?.get("$" + fnName);
            if (!fnVal) throw new Error(`함수 없음: ${fnName}`);
            return (interp as any).callFunctionValue(fnVal, args);
          },
          (checkFn, args) => {
            if (!checkFn) return true;
            return (interp as any).callFunctionValue(checkFn, args);
          }
        );
        totalPassed += result.passed;
        totalFailed += result.failed;

        const ok = result.failed === 0;
        const status = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✖\x1b[0m";
        process.stdout.write(
          `  ${status}  ${result.name}  \x1b[2m(${result.fn}, ${result.passed}/${result.samples} passed, ${result.durationMs}ms)\x1b[0m\n`
        );
        if (!ok && result.firstFailure) {
          const f = result.firstFailure;
          process.stdout.write(
            `     \x1b[31m반례\x1b[0m: args=${JSON.stringify(f.args)}` +
            (f.error ? ` error=${f.error}` : ` result=${JSON.stringify(f.result)}`) + "\n"
          );
        }

        const m = new Map<string, any>();
        m.set("name", result.name);
        m.set("fn", result.fn);
        m.set("passed", result.passed);
        m.set("failed", result.failed);
        m.set("ok", result.failed === 0);
        results.push(m);
      }

      if (propRegistry.size > 0) {
        const allOk = totalFailed === 0;
        process.stdout.write(
          `\n  ${allOk ? "\x1b[32m[PROPS PASS]\x1b[0m" : "\x1b[31m[PROPS FAIL]\x1b[0m"}` +
          `  ${propRegistry.size}개 property, ${totalPassed} passed, ${totalFailed} failed\n`
        );
      }
      return results;
    },
    "run_props": (): any => _aliases["run-props"](),
    "props-list": (): string[] => [...propRegistry.keys()],

    // 숫자 변환
    "mod":           (a: number, b: number) => a % b,
    "number":        (v: any) => { const n = Number(v); return isNaN(n) ? null : n; },
    "to-number":     (v: any) => { const n = Number(v); return isNaN(n) ? null : n; },
    "to_number":     (v: any) => { const n = Number(v); return isNaN(n) ? null : n; },
    "parse-int":     (v: any, radix?: number) => { const n = parseInt(v, radix ?? 10); return isNaN(n) ? null : n; },
    "parse_int":     (v: any, radix?: number) => { const n = parseInt(v, radix ?? 10); return isNaN(n) ? null : n; },
    "parse-float":   (v: any) => { const n = parseFloat(v); return isNaN(n) ? null : n; },
    "parse_float":   (v: any) => { const n = parseFloat(v); return isNaN(n) ? null : n; },
    "number?":       (v: any) => typeof v === "number" && !isNaN(v),
    // 문자열 포함
    "str-contains?": (s: string, sub: string) => typeof s === "string" && typeof sub === "string" ? s.includes(sub) : false,
    "str-contains":  (s: string, sub: string) => typeof s === "string" && typeof sub === "string" ? s.includes(sub) : false,
    "str_contains":  (s: string, sub: string) => typeof s === "string" && typeof sub === "string" ? s.includes(sub) : false,
    "includes?":     (s: string, sub: string) => typeof s === "string" ? s.includes(String(sub)) : Array.isArray(s) ? (s as any[]).includes(sub) : false,
    // 숫자 inc/dec (Clojure 스타일, swap! 콜백으로 자주 쓰임)
    "inc":           (n: number) => (typeof n === "number" ? n + 1 : Number(n) + 1),
    "dec":           (n: number) => (typeof n === "number" ? n - 1 : Number(n) - 1),
    // Map 유틸 — PUT 패턴에서 자주 쓰임
    "dissoc-nil":    (m: any): any => {
      // nil/undefined 값을 가진 키 제거 — (merge existing (dissoc-nil body)) 패턴
      if (m instanceof Map) {
        const result = new Map(m);
        result.forEach((v, k) => { if (v === null || v === undefined) result.delete(k); });
        return result;
      }
      if (m && typeof m === "object" && !Array.isArray(m)) {
        return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== null && v !== undefined));
      }
      return m ?? new Map();
    },
    "dissoc_nil":    (m: any): any => {
      if (m instanceof Map) {
        const result = new Map(m);
        result.forEach((v, k) => { if (v === null || v === undefined) result.delete(k); });
        return result;
      }
      if (m && typeof m === "object" && !Array.isArray(m)) {
        return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== null && v !== undefined));
      }
      return m ?? new Map();
    },
    "merge":         (...maps: any[]): any => {
      // (merge m1 m2 m3 ...) — 오른쪽이 우선, nil 값은 건너뜀
      const result = new Map();
      for (const m of maps) {
        if (m instanceof Map) m.forEach((v, k) => { if (v !== null && v !== undefined) result.set(k, v); });
        else if (m && typeof m === "object" && !Array.isArray(m)) {
          for (const [k, v] of Object.entries(m)) { if (v !== null && v !== undefined) result.set(k, v); }
        }
      }
      return result;
    },
    "merge-all":     (...maps: any[]): any => {
      // (merge-all m1 m2) — nil 포함 그대로 덮어씀 (merge와 차이)
      const result = new Map();
      for (const m of maps) {
        if (m instanceof Map) m.forEach((v, k) => result.set(k, v));
        else if (m && typeof m === "object" && !Array.isArray(m)) {
          for (const [k, v] of Object.entries(m)) result.set(k, v);
        }
      }
      return result;
    },
    // crypto 별칭 (kebab ↔ snake)
    "hash-sha256":   (v: string) => createHash("sha256").update(v, "utf8").digest("hex"),
    "hmac-sha256":   (key: string, msg: string) => createHmac("sha256", key).update(msg, "utf8").digest("hex"),
    "hash_md5":      (v: string) => createHash("md5").update(v, "utf8").digest("hex"),
    "hash-md5":      (v: string) => createHash("md5").update(v, "utf8").digest("hex"),
  };
  for (const [name, fn] of Object.entries(_aliases)) {
    if (!interp.context.functions.has(name)) {
      interp.context.functions.set(name, { name, params: [], body: fn });
    }
  }
}
