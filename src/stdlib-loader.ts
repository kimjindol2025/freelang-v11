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
import { createPerfModule } from "./stdlib-perf";        // Phase F-2: AI 성능 프로파일링
import { createVerifyModule } from "./stdlib-verify";    // Phase F-2: AI 코드 검증
import { createHttpMacroModule } from "./stdlib-http-macro"; // Phase F-3: HTTP 1줄 매크로
import { createDbQueryModule } from "./stdlib-db-query";     // Phase F-3: DB 쿼리 빌더
import { createOptionalModule } from "./stdlib-optional";    // Phase F-4: 선택적 npm 브릿지
import { createRestCrudModule } from "./stdlib-rest-crud";   // Phase F-4: REST CRUD 라우팅
import { createCaptureErrorModule } from "./stdlib-capture-error"; // Phase F-4: 에러 추적
import { createCryptoModule } from "./stdlib-crypto";    // Phase 17: Crypto + UUID + Regex
import { createWorkflowModule } from "./stdlib-workflow"; // Phase 18: Workflow Engine (core)
import { createResourceModule } from "./stdlib-resource"; // Phase 19: Server Resource Search
import { createHttpServerModule } from "./stdlib-http-server"; // Phase 4a: Pure HTTP Server
import { createDbModule } from "./stdlib-db";            // Phase 20: DB Driver (SQLite)
import { createAuthModule } from "./stdlib-auth";        // Phase 21: Auth (JWT, API key, hash)
import { createCryptoUtilsModule } from "./stdlib-crypto-utils"; // Phase 25: AES-256-GCM + hashing
import { createCacheModule } from "./stdlib-cache";      // Phase 21: In-memory TTL cache
import { createPubSubModule } from "./stdlib-pubsub";    // Phase 21: Pub/Sub events
import { createProcessModule } from "./stdlib-process";  // Phase 22: Process (env + SIGTERM)
import { createModuleSystem } from "./stdlib-module";    // Phase 24: Module system
import { createTestModule } from "./stdlib-test";        // Phase 76: FL 테스트 러너
import { createMaybeModule } from "./maybe-type";        // Phase 91: 불확실성 타입
import { createTestEnhancedModule } from "./stdlib-test-enhanced";
import { fnMetaRegistry } from "./eval-special-forms";   // AI-Native Phase 1
import { propRegistry, runProp, createPropertyModule } from "./stdlib-property"; // AI-Native Phase 4
import { requireModule, getAvailableModules, isModuleLoaded } from "./stdlib-lazy-registry"; // Lazy Loading
import { createImageModule } from "./stdlib-image";     // Phase A: Image Processing
import { createMongodbModule } from "./stdlib-mongodb"; // Phase A: MongoDB Driver
import { createHelpersModule } from "./stdlib-helpers"; // Phase G: MISTAKES-100 자동 처리
import { createKebabAliasesModule } from "./stdlib-kebab-aliases"; // v11.5.0: snake → kebab alias
import { createMariadbModule } from "./stdlib-mariadb";          // Universal db-query/db-exec wrapper

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
  // v11.5.0: stateless 모듈은 변수에 캡처 — kebab alias 생성용
  const fileModule = createFileModule();
  const fdModule = createFdModule();
  const bitsModule = createBitsModule();
  const errorModule = createErrorModule();
  const httpModule = createHttpModule();

  interp.registerModule(fileModule);
  interp.registerModule(fdModule);
  interp.registerModule(bitsModule);
  interp.registerModule(createTimerModule(interp)); // Pass interp for callback invocation
  interp.registerModule(errorModule);
  interp.registerModule(httpModule);
  const shellModule = createShellModule();
  const dataModule = createDataModule();
  const collectionModule = createCollectionModule();
  const agentModule = createAgentModule();
  const timeModule = createTimeModule();
  interp.registerModule(shellModule);
  interp.registerModule(dataModule);
  interp.registerModule(collectionModule);
  interp.registerModule(agentModule);
  interp.registerModule(timeModule);
  interp.registerModule(createPerfModule(             // Phase F-2: 성능 프로파일링
    (fn, args) => interp.callFunctionValue(fn, args)
  ));
  const verifyModule = createVerifyModule();
  const httpMacroModule = createHttpMacroModule();
  const dbQueryModule = createDbQueryModule();
  const optionalModule = createOptionalModule();
  const restCrudModule = createRestCrudModule();
  interp.registerModule(verifyModule);        // Phase F-2: AI 코드 자동 검증
  interp.registerModule(httpMacroModule);    // Phase F-3: HTTP JSON 매크로
  interp.registerModule(dbQueryModule);      // Phase F-3: DB 쿼리 빌더
  interp.registerModule(optionalModule);     // Phase F-4: 선택적 npm 브릿지
  interp.registerModule(restCrudModule);     // Phase F-4: REST CRUD 라우팅
  interp.registerModule(createCaptureErrorModule(   // Phase F-4: 에러 추적 + retry
    (fn, args) => interp.callFunctionValue(fn, args)
  ));
  const cryptoModule = createCryptoModule();
  const workflowModule = createWorkflowModule();
  const resourceModule = createResourceModule();
  interp.registerModule(cryptoModule);
  interp.registerModule(workflowModule);
  interp.registerModule(resourceModule);
  // Phase 4a: Pure HTTP Server — callUserFunction/callFunctionValue 콜백 필요
  interp.registerModule(createHttpServerModule(
    (n: string, a: any[]) => interp.callUserFunction(n, a),
    (fnValue: any, a: any[]) => interp.callFunctionValue(fnValue, a)
  ));
  const dbModule = createDbModule();
  const authModule = createAuthModule();
  const cryptoUtilsModule = createCryptoUtilsModule();
  const cacheModule = createCacheModule();
  interp.registerModule(dbModule);
  interp.registerModule(authModule);
  interp.registerModule(cryptoUtilsModule);
  interp.registerModule(cacheModule);
  interp.registerModule(createPubSubModule((n, a) => interp.callUserFunction(n, a)));
  const processModule = createProcessModule();
  const moduleSystem = createModuleSystem();
  interp.registerModule(processModule);  // Phase 22: env_load, on_sigterm
  interp.registerModule(moduleSystem);   // Phase 24: module_*, namespace_*
  interp.registerModule(createTestModule(         // Phase 76: deftest, describe, assert-eq, ...
    (fnValue, args) => interp.callFunctionValue(fnValue, args)
  ));
  interp.registerModule(createMaybeModule(         // Phase 91: 불확실성 타입 (maybe/none/confident)
    (fnValue, args) => interp.callFunctionValue(fnValue, args),
    (name, args) => interp.callUserFunction(name, args)
  ));
  interp.registerModule(createTestEnhancedModule());
  const imageModule = createImageModule();
  const mongodbModule = createMongodbModule();
  interp.registerModule(imageModule);    // Phase A
  interp.registerModule(mongodbModule); // Phase A

  // Phase G: MISTAKES-100 자동 처리 헬퍼
  const helpersModule = createHelpersModule(
    (fnValue: any, args: any[]) => interp.callFunctionValue(fnValue, args),
    (httpModule as any).http_get,
    (httpModule as any).http_post
  );
  interp.registerModule(helpersModule);

  // ─────────────────────────────────────────────────────────────
  // v11.5.0: 모든 stdlib에 kebab-case alias 자동 등록
  // 예: str_to_num → str-to-num, json_parse → json-parse
  // 기존 snake_case 함수는 그대로 작동 (호환성 유지)
  // ─────────────────────────────────────────────────────────────
  const aliasSourceModules = [
    fileModule, fdModule, bitsModule, errorModule, httpModule,
    shellModule, dataModule, collectionModule, agentModule, timeModule,
    verifyModule, httpMacroModule, dbQueryModule, optionalModule, restCrudModule,
    cryptoModule, cryptoUtilsModule, workflowModule, resourceModule,
    dbModule, authModule, cacheModule,
    processModule, moduleSystem,
    imageModule, mongodbModule,
    helpersModule,
  ];
  interp.registerModule(createKebabAliasesModule(aliasSourceModules));

  // Universal DB wrapper — db-query/db-exec/db-transaction (MariaDB + SQLite routing)
  // 등록은 kebab alias 이후 → db-exec alias(db_exec)를 이 버전으로 덮어씀
  interp.registerModule(createMariadbModule(
    (fn: any, args: any[]) => interp.callFunctionValue(fn, args)
  ));

  // ── fl_require builtin 등록 ─────────────────────────────────────
  // (fl_require "audit")   → audit_log 등 즉시 사용 가능
  // (fl_require? "audit")  → 로드 여부 확인 (true/false)
  // (fl_modules)           → 사용 가능 모듈 목록
  // 주의: "require"는 Node.js 내장과 충돌 → fl_require 사용
  interp.registerModule({
    "fl_require":  (name: string): boolean => requireModule(name, interp as any),
    "fl_require?": (name: string): boolean => isModuleLoaded(name),
    "fl_modules":  (): string[] => getAvailableModules(),
    // fl_load "path/to/lib.fl" → 다른 FL 파일을 현재 컨텍스트에 로드
    // 상대경로: 현재 실행 파일 기준이 아닌 process.cwd() 기준
    // 이미 로드된 파일은 캐싱으로 중복 실행 방지 (importedFiles 공유)
    "fl_load": (filePath: string): boolean => {
      const fs = require("fs");
      const path = require("path");
      const { lex } = require("./lexer");
      const { parse } = require("./parser");
      const resolved = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(resolved)) {
        console.error(`❌ [fl_load] 파일 없음: ${resolved}`);
        return false;
      }
      const loadedFiles: Set<string> = (interp as any).importedFiles ?? new Set();
      if (loadedFiles.has(resolved)) return true;
      loadedFiles.add(resolved);
      (interp as any).importedFiles = loadedFiles;
      try {
        const src = fs.readFileSync(resolved, "utf-8");
        (interp as any).interpret((parse as any)(lex(src)));
        return true;
      } catch (e: any) {
        loadedFiles.delete(resolved);
        console.error(`❌ [fl_load] "${resolved}" 로드 실패:`, e.message);
        return false;
      }
    },
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
    // ── format (sprintf 스타일) ──────────────────────────────────────────────
    // (format "%.2f" 3.14) → "3.14"  (format "%d items" 5) → "5 items"
    "format": (fmt: string, ...args: any[]): string => {
      let i = 0;
      return String(fmt).replace(/%([-+]?\d*\.?\d*)?([dfsoxXbeE%])/g, (_, flags, spec) => {
        if (spec === "%") return "%";
        const val = args[i++];
        const precMatch = (flags ?? "").match(/\.(\d+)/);
        const prec = precMatch ? parseInt(precMatch[1]) : 6;
        const width = parseInt((flags ?? "").replace(/\.\d+/, "")) || 0;
        const pad = (s: string) => width > 0 ? s.padStart(width) : width < 0 ? s.padEnd(-width) : s;
        switch (spec) {
          case "d": return pad(String(Math.trunc(Number(val))));
          case "f": return pad(Number(val).toFixed(prec));
          case "e": return pad(Number(val).toExponential(prec));
          case "E": return pad(Number(val).toExponential(prec).toUpperCase());
          case "s": return pad(String(val ?? ""));
          case "o": return pad(Number(val).toString(8));
          case "x": return pad(Number(val).toString(16));
          case "X": return pad(Number(val).toString(16).toUpperCase());
          case "b": return pad(Number(val).toString(2));
          default:  return pad(String(val));
        }
      });
    },

    // ── date-format / date-add ──────────────────────────────────────────────
    // (date-format ts-ms "yyyy-MM-dd") → "2026-05-08"
    "date-format": (ts: number, fmt: string): string => {
      const d = new Date(Number(ts));
      return String(fmt)
        .replace("yyyy", String(d.getFullYear()))
        .replace("MM",   String(d.getMonth() + 1).padStart(2, "0"))
        .replace("dd",   String(d.getDate()).padStart(2, "0"))
        .replace("HH",   String(d.getHours()).padStart(2, "0"))
        .replace("mm",   String(d.getMinutes()).padStart(2, "0"))
        .replace("ss",   String(d.getSeconds()).padStart(2, "0"))
        .replace("SSS",  String(d.getMilliseconds()).padStart(3, "0"));
    },
    // (date-add ts-ms :days 7) → new ts-ms
    "date-add": (ts: number, unit: string, amount: number): number => {
      const d = new Date(Number(ts));
      const u = String(unit).replace(/^:/, "");
      if (u === "days"    || u === "day")    d.setDate(d.getDate() + Number(amount));
      else if (u === "hours"   || u === "hour")   d.setHours(d.getHours() + Number(amount));
      else if (u === "minutes" || u === "minute") d.setMinutes(d.getMinutes() + Number(amount));
      else if (u === "months"  || u === "month")  d.setMonth(d.getMonth() + Number(amount));
      else if (u === "years"   || u === "year")   d.setFullYear(d.getFullYear() + Number(amount));
      else if (u === "seconds" || u === "second") d.setSeconds(d.getSeconds() + Number(amount));
      else if (u === "weeks"   || u === "week")   d.setDate(d.getDate() + Number(amount) * 7);
      return d.getTime();
    },
    // (date-diff ts1-ms ts2-ms :days) → number
    "date-diff": (ts1: number, ts2: number, unit: string): number => {
      const ms = Number(ts2) - Number(ts1);
      const u = String(unit).replace(/^:/, "");
      if (u === "days")    return Math.floor(ms / 86400000);
      if (u === "hours")   return Math.floor(ms / 3600000);
      if (u === "minutes") return Math.floor(ms / 60000);
      if (u === "seconds") return Math.floor(ms / 1000);
      if (u === "weeks")   return Math.floor(ms / 604800000);
      return ms;
    },
    // (date-parse "2026-05-08") → ts-ms
    "date-parse": (s: string): number => {
      const ts = Date.parse(String(s));
      return isNaN(ts) ? 0 : ts;
    },

    // ── regex 별칭 (re-* → Clojure 스타일) ───────────────────────────────────
    // re-match: 첫 번째 매치 문자열 반환 (nil if no match) — v11.6.7 변경
    "re-match":   (pattern: string, s: string): string | null => {
      try { const m = String(s).match(new RegExp(pattern)); return m ? m[0] : null; } catch { return null; }
    },
    // re-test: boolean 체크 (기존 re-match 동작)
    "re-test": (pattern: string, s: string): boolean => {
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
      try { const m = String(s).match(new RegExp(pattern)); return m ? [...m] : null; } catch { return null; }
    },

    // v11.7.4: 정규식 함수 snake_case alias + 함수 기반 치환
    "re_match":    (pattern: string, s: string): string | null => _aliases["re-match"](pattern, s),
    "re_test":     (pattern: string, s: string): boolean => _aliases["re-test"](pattern, s),
    "re_find":     (pattern: string, s: string): string | null => _aliases["re-find"](pattern, s),
    "re_find_all": (pattern: string, s: string): string[] => _aliases["re-find-all"](pattern, s),
    "re_replace":  (pattern: string, replacement: string, s: string): string => _aliases["re-replace"](pattern, replacement, s),
    "re_split":    (pattern: string, s: string): string[] => _aliases["re-split"](pattern, s),
    "re_groups":   (pattern: string, s: string): (string | null)[] | null => _aliases["re-groups"](pattern, s),

    // v11.7.5: 포맷팅 헬퍼 (문자열 & 숫자)
    "str-pad-left": (s: any, len: number, char: string = " "): string => {
      return String(s).padStart(Math.abs(len), String(char).charAt(0));
    },
    "str_pad_left": (s: any, len: number, char?: string) => _aliases["str-pad-left"](s, len, char),
    "str-pad-right": (s: any, len: number, char: string = " "): string => {
      return String(s).padEnd(Math.abs(len), String(char).charAt(0));
    },
    "str_pad_right": (s: any, len: number, char?: string) => _aliases["str-pad-right"](s, len, char),
    "str-truncate": (s: any, len: number, suffix: string = "..."): string => {
      const str = String(s);
      return str.length > len ? str.substring(0, Math.max(0, len - suffix.length)) + suffix : str;
    },
    "str_truncate": (s: any, len: number, suffix?: string) => _aliases["str-truncate"](s, len, suffix),
    "format-number": (n: any, decimals: number = 0): string => {
      const num = Number(n);
      return num.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
    },
    "format_number": (n: any, decimals?: number) => _aliases["format-number"](n, decimals),
    "format-decimal": (n: any, places: number = 2): string => {
      return Number(n).toFixed(Math.max(0, places));
    },
    "format_decimal": (n: any, places?: number) => _aliases["format-decimal"](n, places),
    "format-percent": (n: any, decimals: number = 1): string => {
      const num = Number(n);
      return (num * 100).toFixed(Math.max(0, decimals)) + "%";
    },
    "format_percent": (n: any, decimals?: number) => _aliases["format-percent"](n, decimals),

    // v11.7.6: 간단한 헬퍼 함수들
    "str-repeat-n": (s: string, n: number): string => {
      return String(s).repeat(Math.max(0, n));
    },
    "str_repeat_n": (s: string, n: number) => _aliases["str-repeat-n"](s, n),
    "nth-last": (arr: any[], n: number): any => {
      const a = Array.isArray(arr) ? arr : [];
      const idx = a.length - (Math.max(0, n) + 1);
      return idx >= 0 ? a[idx] : null;
    },
    "nth_last": (arr: any[], n: number) => _aliases["nth-last"](arr, n),
    "take-last": (arr: any[], n: number): any[] => {
      const a = Array.isArray(arr) ? arr : [];
      const count = Math.max(0, n);
      return count >= a.length ? a : a.slice(-count);
    },
    "take_last": (arr: any[], n: number) => _aliases["take-last"](arr, n),
    "starts-with": (s: string, prefix: string): boolean => {
      return String(s).startsWith(String(prefix));
    },
    "starts_with": (s: string, prefix: string) => _aliases["starts-with"](s, prefix),
    "ends-with": (s: string, suffix: string): boolean => {
      return String(s).endsWith(String(suffix));
    },
    "ends_with": (s: string, suffix: string) => _aliases["ends-with"](s, suffix),

    // v11.7.7: 배열 헬퍼 (중복제거, 1단계 펴기)
    "unique": (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [];
      const seen = new Set();
      const result: any[] = [];
      for (const item of arr) {
        const key = typeof item === "object" ? JSON.stringify(item) : item;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
      return result;
    },

    "flatten-one": (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [];
      const result: any[] = [];
      for (const item of arr) {
        if (Array.isArray(item)) {
          result.push(...item);
        } else {
          result.push(item);
        }
      }
      return result;
    },
    "flatten_one": (arr: any[]) => _aliases["flatten-one"](arr),

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
      if (meta.doc)      m.set("doc",      meta.doc);      // v11.7.3
      if (meta.returns)  m.set("returns",  meta.returns);
      if (meta.context)  m.set("context",  meta.context);
      if (meta.effects)  m.set("effects",  meta.effects);
      if (meta.examples) m.set("examples", meta.examples);
      return m;
    },
    "fn_meta": (name: string): any => _aliases["fn-meta"](name),

    // v11.7.3: 타입 검증 헬퍼
    "check-arg-type": (arg: any, expectedType: string): any => {
      const actual = typeof arg === "number" ? "number"
        : typeof arg === "string" ? "string"
        : typeof arg === "boolean" ? "boolean"
        : arg === null ? "nil"
        : Array.isArray(arg) ? "array"
        : typeof arg === "function" ? "function"
        : "map";
      if (actual !== expectedType) {
        const err = new Error(`Expected ${expectedType}, got ${actual}`);
        (err as any).code = "TYPE_MISMATCH";
        (err as any).context = { expectedType, actualType: actual, value: arg };
        throw err;
      }
      return arg;
    },
    "check_arg_type": function(arg: any, expectedType: string): any {
      return this["check-arg-type"](arg, expectedType);
    },

    "validate-args": (args: any[], types: any[]): any[] => {
      const argsArray = Array.isArray(args) ? args : [args];
      const typesArray = Array.isArray(types) ? types : [types];
      for (let i = 0; i < Math.min(argsArray.length, typesArray.length); i++) {
        const actual = typeof argsArray[i] === "number" ? "number"
          : typeof argsArray[i] === "string" ? "string"
          : typeof argsArray[i] === "boolean" ? "boolean"
          : argsArray[i] === null ? "nil"
          : Array.isArray(argsArray[i]) ? "array"
          : typeof argsArray[i] === "function" ? "function"
          : "map";
        if (actual !== typesArray[i]) {
          const err = new Error(`Argument ${i}: expected ${typesArray[i]}, got ${actual}`);
          (err as any).code = "TYPE_MISMATCH";
          (err as any).context = { argIndex: i, expectedType: typesArray[i], actualType: actual };
          throw err;
        }
      }
      return argsArray;
    },
    "validate_args": function(args: any[], types: any[]): any[] {
      return this["validate-args"](args, types);
    },

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
    // ── 레벨별 로깅 (console 출력) ──────────────────────────────────
    // stdlib-time.ts의 Logger 패턴(log_info logger msg)과 공존:
    // 첫 번째 인자가 Logger 객체(.entries 배열)이면 시간 기반 Logger 패턴으로 위임,
    // 아니면 단순 console 출력
    "log-info": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries)) {
        const logger = args[0]; const msg = String(args[1]);
        return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "info", msg }] };
      }
      console.log(`[INFO]  ${args.map(String).join(" ")}`); return null;
    },
    "log_info": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries)) {
        const logger = args[0]; const msg = String(args[1]);
        return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "info", msg }] };
      }
      console.log(`[INFO]  ${args.map(String).join(" ")}`); return null;
    },
    "log-warn": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries)) {
        const logger = args[0]; const msg = String(args[1]);
        return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "warn", msg }] };
      }
      console.warn(`[WARN]  ${args.map(String).join(" ")}`); return null;
    },
    "log_warn": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries)) {
        const logger = args[0]; const msg = String(args[1]);
        return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "warn", msg }] };
      }
      console.warn(`[WARN]  ${args.map(String).join(" ")}`); return null;
    },
    "log-error": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries)) {
        const logger = args[0]; const msg = String(args[1]);
        return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "error", msg }] };
      }
      console.error(`[ERROR] ${args.map(String).join(" ")}`); return null;
    },
    "log_error": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries)) {
        const logger = args[0]; const msg = String(args[1]);
        return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "error", msg }] };
      }
      console.error(`[ERROR] ${args.map(String).join(" ")}`); return null;
    },
    // ── validate ────────────────────────────────────────────────────
    // (validate body schema) → null(성공) or ["field: msg", ...]
    // schema: Map or plain object. values: :required :number :string :boolean :email :min-N :max-N
    "validate": (body: any, schema: any): string[] | null => {
      const errs: string[] = [];
      const rules: [string, any][] = schema instanceof Map
        ? [...schema.entries()]
        : Object.entries(schema ?? {});
      const val = body instanceof Map
        ? (k: string) => body.get(k) ?? body.get(":" + k)
        : (k: string) => (body ?? {})[k];
      for (const [field, spec] of rules) {
        const f = String(field).replace(/^:/, "");
        const v = val(f);
        const specs = Array.isArray(spec) ? spec : [spec];
        for (const s of specs) {
          const rule = String(s ?? "").replace(/^:/, "");
          if (rule === "required" && (v === null || v === undefined || v === "")) {
            errs.push(`${f}: required`);
          } else if (rule === "number" && v !== null && v !== undefined && typeof v !== "number" && isNaN(Number(v))) {
            errs.push(`${f}: must be number`);
          } else if (rule === "string" && v !== null && v !== undefined && typeof v !== "string") {
            errs.push(`${f}: must be string`);
          } else if (rule === "boolean" && v !== null && v !== undefined && typeof v !== "boolean") {
            errs.push(`${f}: must be boolean`);
          } else if (rule === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
            errs.push(`${f}: must be valid email`);
          } else if (rule.startsWith("min-")) {
            const mn = Number(rule.slice(4));
            if (typeof v === "string" && v.length < mn) errs.push(`${f}: min length ${mn}`);
            else if (typeof v === "number" && v < mn) errs.push(`${f}: min value ${mn}`);
          } else if (rule.startsWith("max-")) {
            const mx = Number(rule.slice(4));
            if (typeof v === "string" && v.length > mx) errs.push(`${f}: max length ${mx}`);
            else if (typeof v === "number" && v > mx) errs.push(`${f}: max value ${mx}`);
          }
        }
      }
      return errs.length > 0 ? errs : null;
    },
    // ── list-min / list-max ─────────────────────────────────────────
    "list-min": (arr: any[]): number | null => Array.isArray(arr) && arr.length > 0 ? Math.min(...arr.map(Number)) : null,
    "list_min": (arr: any[]): number | null => Array.isArray(arr) && arr.length > 0 ? Math.min(...arr.map(Number)) : null,
    "list-max": (arr: any[]): number | null => Array.isArray(arr) && arr.length > 0 ? Math.max(...arr.map(Number)) : null,
    "list_max": (arr: any[]): number | null => Array.isArray(arr) && arr.length > 0 ? Math.max(...arr.map(Number)) : null,
    // 문자열 포함
    "str-contains?": (s: string, sub: string) => typeof s === "string" && typeof sub === "string" ? s.includes(sub) : false,
    "str-contains":  (s: string, sub: string) => typeof s === "string" && typeof sub === "string" ? s.includes(sub) : false,
    "str_contains":  (s: string, sub: string) => typeof s === "string" && typeof sub === "string" ? s.includes(sub) : false,
    "includes?":      (s: string, sub: string) => typeof s === "string" ? s.includes(String(sub)) : Array.isArray(s) ? (s as any[]).includes(sub) : false,
    "includes-item":  (arr: any[], item: any) => Array.isArray(arr) ? arr.includes(item) : false,
    // str-pad (s width [char] [dir]) — dir: "right"(기본)/"left"
    "str-pad": (s: string, width: number, ch?: string, dir?: string): string => {
      const str = String(s ?? ""); const w = Number(width); const c = (String(ch ?? " ")[0]) ?? " ";
      if (str.length >= w) return str;
      const pad = c.repeat(w - str.length);
      return (dir === "left" || dir === ":left") ? pad + str : str + pad;
    },
    "str_pad": (s: string, width: number, ch?: string, dir?: string): string => {
      const str = String(s ?? ""); const w = Number(width); const c = (String(ch ?? " ")[0]) ?? " ";
      if (str.length >= w) return str;
      const pad = c.repeat(w - str.length);
      return (dir === "left" || dir === ":left") ? pad + str : str + pad;
    },
    // str-repeat s n
    "str-repeat": (s: string, n: number): string => String(s ?? "").repeat(Math.max(0, Math.trunc(Number(n)))),
    "str_repeat": (s: string, n: number): string => String(s ?? "").repeat(Math.max(0, Math.trunc(Number(n)))),
    // flatten — 1단계 중첩 해제
    "flatten": (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [arr];
      return (arr as any[]).reduce((acc: any[], v: any) => Array.isArray(v) ? acc.concat(v) : (acc.push(v), acc), []);
    },
    // distinct — 중복 제거 (순서 유지)
    "distinct": (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [];
      const seen = new Set<any>(); const out: any[] = [];
      for (const v of arr) {
        const k = (v !== null && typeof v === "object") ? JSON.stringify(v) : v;
        if (!seen.has(k)) { seen.add(k); out.push(v); }
      }
      return out;
    },
    // zip keys vals → Map
    "zip": (keys: any[], vals: any[]): Map<any, any> => {
      const m = new Map<any, any>();
      const ks = Array.isArray(keys) ? keys : []; const vs = Array.isArray(vals) ? vals : [];
      for (let i = 0; i < ks.length; i++) m.set(ks[i], vs[i] ?? null);
      return m;
    },
    // ── nil-or / or-default — nil coalescing ──────────────────────
    // (nil-or val default) → val이 nil이면 default 반환
    "nil-or":       (v: any, d: any) => (v === null || v === undefined) ? d : v,
    "nil_or":       (v: any, d: any) => (v === null || v === undefined) ? d : v,
    "or-default":   (v: any, d: any) => (v === null || v === undefined) ? d : v,
    "or_default":   (v: any, d: any) => (v === null || v === undefined) ? d : v,
    "coalesce":     (...args: any[]) => args.find(v => v !== null && v !== undefined) ?? null,
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
  // ── auth 친숙한 별칭 (기존 auth_* 함수를 찾아 위임) ─────────────────
  // 등록된 auth 함수를 래핑해서 bcrypt-*/jwt-* 이름으로 노출
  const _authAliases: Record<string, string> = {
    "bcrypt-hash":   "auth_hash_password",
    "bcrypt_hash":   "auth_hash_password",
    "bcrypt-verify": "auth_verify_password",
    "bcrypt_verify": "auth_verify_password",
    "jwt-sign":      "auth_jwt_sign",
    "jwt_sign":      "auth_jwt_sign",
    "jwt-verify":    "auth_jwt_verify",
    "jwt_verify":    "auth_jwt_verify",
    "jwt-decode":    "auth_jwt_decode",
    "jwt_decode":    "auth_jwt_decode",
    "password-hash":   "auth_hash_password",
    "password_hash":   "auth_hash_password",
    "password-verify": "auth_verify_password",
    "password_verify": "auth_verify_password",
  };
  for (const [name, fn] of Object.entries(_aliases)) {
    if (!interp.context.functions.has(name)) {
      interp.context.functions.set(name, { name, params: [], body: fn });
    }
  }
  // ── process/signal 별칭 ────────────────────────────────────────────
  const _processAliases: Record<string, string> = {
    "on-shutdown": "on_sigterm",
    "on_shutdown": "on_sigterm",
    "on-exit":     "on_exit",
  };
  for (const [alias, target] of Object.entries(_processAliases)) {
    if (!interp.context.functions.has(alias) && interp.context.functions.has(target)) {
      const orig = interp.context.functions.get(target)!;
      interp.context.functions.set(alias, { ...orig, name: alias });
    }
  }
  // ── auth 별칭 등록 (auth_* 함수가 이미 등록된 후 별칭 추가) ──────────
  for (const [alias, target] of Object.entries(_authAliases)) {
    if (!interp.context.functions.has(alias) && interp.context.functions.has(target)) {
      const orig = interp.context.functions.get(target)!;
      interp.context.functions.set(alias, { ...orig, name: alias });
    }
  }
  // ── 강제 override: _aliases보다 우선 등록되어야 할 함수들 ────────────
  // (timeModule의 log_info 등이 먼저 등록되어 _aliases가 무시됨 → 여기서 덮어씀)
  const _overrides: Record<string, (...a: any[]) => any> = {
    "log-info": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries))
        return { ...args[0], entries: [...args[0].entries, { ts: Date.now(), level: "info", msg: String(args[1]) }] };
      console.log(`[INFO]  ${args.map(String).join(" ")}`); return null;
    },
    "log_info": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries))
        return { ...args[0], entries: [...args[0].entries, { ts: Date.now(), level: "info", msg: String(args[1]) }] };
      console.log(`[INFO]  ${args.map(String).join(" ")}`); return null;
    },
    "log-warn": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries))
        return { ...args[0], entries: [...args[0].entries, { ts: Date.now(), level: "warn", msg: String(args[1]) }] };
      console.warn(`[WARN]  ${args.map(String).join(" ")}`); return null;
    },
    "log_warn": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries))
        return { ...args[0], entries: [...args[0].entries, { ts: Date.now(), level: "warn", msg: String(args[1]) }] };
      console.warn(`[WARN]  ${args.map(String).join(" ")}`); return null;
    },
    "log-error": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries))
        return { ...args[0], entries: [...args[0].entries, { ts: Date.now(), level: "error", msg: String(args[1]) }] };
      console.error(`[ERROR] ${args.map(String).join(" ")}`); return null;
    },
    "log_error": (...args: any[]): any => {
      if (args.length === 2 && args[0] && Array.isArray(args[0].entries))
        return { ...args[0], entries: [...args[0].entries, { ts: Date.now(), level: "error", msg: String(args[1]) }] };
      console.error(`[ERROR] ${args.map(String).join(" ")}`); return null;
    },
    "stdlib-list": (): string[] => [...interp.context.functions.keys()].sort(),
    "stdlib_list": (): string[] => [...interp.context.functions.keys()].sort(),
    "fn-where": (name: string): string => {
      const key = String(name).replace(/-/g, "_");
      const altKey = String(name).replace(/_/g, "-");
      const found = interp.context.functions.has(String(name)) ? String(name)
        : interp.context.functions.has(key) ? key
        : interp.context.functions.has(altKey) ? altKey : null;
      if (!found) return `not-found: ${name}`;
      const fn = interp.context.functions.get(found);
      if (typeof fn?.body === "function") return `native:${found}`;
      return `fl-defined:${found}`;
    },
    "fn_where": (name: string): string => {
      const key = String(name).replace(/-/g, "_");
      const altKey = String(name).replace(/_/g, "-");
      const found = interp.context.functions.has(String(name)) ? String(name)
        : interp.context.functions.has(key) ? key
        : interp.context.functions.has(altKey) ? altKey : null;
      if (!found) return `not-found: ${name}`;
      const fn = interp.context.functions.get(found);
      if (typeof fn?.body === "function") return `native:${found}`;
      return `fl-defined:${found}`;
    },
    "fn-exists?": (name: string): boolean => {
      const s = String(name);
      if (interp.context.functions.has(s)
        || interp.context.functions.has(s.replace(/-/g, "_"))
        || interp.context.functions.has(s.replace(/_/g, "-"))) return true;
      const _builtins = new Set(["abs","agent-broadcast","agent-history","agent-inbox-size","agent-list","agent-process","agent-recv","agent-send","agent-spawn","and","append","array?","assert-type","assoc","atom","begin","bind","block-items","bool","bool?","boolean?","bson-decode-native","bson-encode-native","call","ceil","char-at","char-code","clamp","cli-args","closure?","comp","complement","concat","cons","constantly","contains?","cos","cosine-sim","cosine_sim","ctx-add","ctx-all","ctx-get","ctx-has-room?","ctx-new","ctx-remove","ctx-stats","ctx-trim","define","deref","dir-exists?","dir-list","dissoc","distinct","do","dot-product","drop","echo","empty?","ends-with?","err","err?","error","euclidean-dist","even?","exp","export","failure","false?","file-append","file-exists?","file-mkdir","file_append","file_mkdir","filter","filter-lazy","find","first","first-or","first_or","fl-concepts","fl-env-get","fl-example-count","fl-examples","fl-exec-op","fl-fix-env","fl-interp","fl-learn","fl-parse","fl-special-op?","flat-map","flatten","float?","floor","fn","fn?","function?","get","get-or","has-key?","help","html-escape","html-response","http-get","http_get","identity","if","if-let","includes?","index-of","inspect","int?","is-digit?","is-symbol?","is-whitespace?","iterate","join","js-escape","json-response","juxt","keys","last","last-or","last_or","lazy-head","lazy-seq","lazy-tail","lazy?","left","length","let","lex","list","list-tools","list?","load","log","lower","lower-case","lowercase","map","map-entries","map-err","map-lazy","map-ok","map-set","map?","map_entries","match","math-abs","math-pow","math-sqrt","math_abs","math_sqrt","max","maybe-bind","maybe-chain","maybe-combine","maybe-filter","maybe-map","maybe-select","mem-episode","mem-forget","mem-keys","mem-purge","mem-recall","mem-remember","mem-remember-short","mem-search-episodes","mem-search-tag","mem-stats","mem-working-clear","mem-working-get","mem-working-set","merge","min","mod","nan?","neg?","negative?","net-connect","net-sendrecv","net-sendrecv-pool","nil-or-empty?","nil?","none","not","not-nil?","now","now-iso","now_iso","null?","num","num-to-str","number?","obj-entries","obj-keys","obj-merge","obj-omit","obj-pick","obj-values","obj_entries","obj_keys","obj_merge","obj_omit","obj_pick","obj_values","odd?","ok","ok?","omit","or","parse","pick","pop","pos?","positive?","pow","print","print-err","println","promise","prompt-compile","prompt-from-code","prompt-target","prompt-tokens","pure","pure-writer","push","quality-check","quality-feedback","quality-passed?","rag-add","rag-query","rag-remove","rag-retrieve","rag-size","random","range","read-file","recover","reduce","repeat","replace","repr","require","reset!","rest","result-classify","result-explain","return-writer","reverse","right","round","sdk-features","sdk-snippet","sdk-supports","sdk-validate","sdk-version","server-uptime","set!","set-timeout","shell-exec","shell-exec-result","shift","sin","slice","sleep","some","some?","sort","sort-by","sort_by","split","sqrt","starts-with?","str","str-char-at","str-ends-with?","str-join","str-split","str-starts-with?","str-to-num","str_trim","stream-chunk-count","stream-chunks","stream-collect","stream-create","stream-delete","stream-done?","stream-end","stream-text","stream-write","string?","string_trim","strlen","substring","success","swap!","take","take-while","tan","tell","to-hex","trace-add","trace-create","trace-enter","trace-exit","trace-markdown","trace-node-count","trace-tree","trim","true?","try","try-reason","try-with-fallback","type-of","typeof","unique","unshift","unwrap","unwrap-or","upper","upper-case","uppercase","use-tool","uuid","uuid4","vals","values","vec-add","vec-dist","vec-dot","vec-magnitude","vec-norm","vec-normalize","vec-scale","vec-top-k","when","write-file","zero?","zip","zip-with","cond","catch","includes-item","flatten"]);
      return _builtins.has(s) || _builtins.has(s.replace(/_/g,"-"));
    },
    "fn_exists": (name: string): boolean => {
      const s = String(name);
      if (interp.context.functions.has(s)
        || interp.context.functions.has(s.replace(/-/g, "_"))
        || interp.context.functions.has(s.replace(/_/g, "-"))) return true;
      const _builtins = new Set(["abs","agent-broadcast","agent-history","agent-inbox-size","agent-list","agent-process","agent-recv","agent-send","agent-spawn","and","append","array?","assert-type","assoc","atom","begin","bind","block-items","bool","bool?","boolean?","bson-decode-native","bson-encode-native","call","ceil","char-at","char-code","clamp","cli-args","closure?","comp","complement","concat","cons","constantly","contains?","cos","cosine-sim","cosine_sim","ctx-add","ctx-all","ctx-get","ctx-has-room?","ctx-new","ctx-remove","ctx-stats","ctx-trim","define","deref","dir-exists?","dir-list","dissoc","distinct","do","dot-product","drop","echo","empty?","ends-with?","err","err?","error","euclidean-dist","even?","exp","export","failure","false?","file-append","file-exists?","file-mkdir","file_append","file_mkdir","filter","filter-lazy","find","first","first-or","first_or","fl-concepts","fl-env-get","fl-example-count","fl-examples","fl-exec-op","fl-fix-env","fl-interp","fl-learn","fl-parse","fl-special-op?","flat-map","flatten","float?","floor","fn","fn?","function?","get","get-or","has-key?","help","html-escape","html-response","http-get","http_get","identity","if","if-let","includes?","index-of","inspect","int?","is-digit?","is-symbol?","is-whitespace?","iterate","join","js-escape","json-response","juxt","keys","last","last-or","last_or","lazy-head","lazy-seq","lazy-tail","lazy?","left","length","let","lex","list","list-tools","list?","load","log","lower","lower-case","lowercase","map","map-entries","map-err","map-lazy","map-ok","map-set","map?","map_entries","match","math-abs","math-pow","math-sqrt","math_abs","math_sqrt","max","maybe-bind","maybe-chain","maybe-combine","maybe-filter","maybe-map","maybe-select","mem-episode","mem-forget","mem-keys","mem-purge","mem-recall","mem-remember","mem-remember-short","mem-search-episodes","mem-search-tag","mem-stats","mem-working-clear","mem-working-get","mem-working-set","merge","min","mod","nan?","neg?","negative?","net-connect","net-sendrecv","net-sendrecv-pool","nil-or-empty?","nil?","none","not","not-nil?","now","now-iso","now_iso","null?","num","num-to-str","number?","obj-entries","obj-keys","obj-merge","obj-omit","obj-pick","obj-values","obj_entries","obj_keys","obj_merge","obj_omit","obj_pick","obj_values","odd?","ok","ok?","omit","or","parse","pick","pop","pos?","positive?","pow","print","print-err","println","promise","prompt-compile","prompt-from-code","prompt-target","prompt-tokens","pure","pure-writer","push","quality-check","quality-feedback","quality-passed?","rag-add","rag-query","rag-remove","rag-retrieve","rag-size","random","range","read-file","recover","reduce","repeat","replace","repr","require","reset!","rest","result-classify","result-explain","return-writer","reverse","right","round","sdk-features","sdk-snippet","sdk-supports","sdk-validate","sdk-version","server-uptime","set!","set-timeout","shell-exec","shell-exec-result","shift","sin","slice","sleep","some","some?","sort","sort-by","sort_by","split","sqrt","starts-with?","str","str-char-at","str-ends-with?","str-join","str-split","str-starts-with?","str-to-num","str_trim","stream-chunk-count","stream-chunks","stream-collect","stream-create","stream-delete","stream-done?","stream-end","stream-text","stream-write","string?","string_trim","strlen","substring","success","swap!","take","take-while","tan","tell","to-hex","trace-add","trace-create","trace-enter","trace-exit","trace-markdown","trace-node-count","trace-tree","trim","true?","try","try-reason","try-with-fallback","type-of","typeof","unique","unshift","unwrap","unwrap-or","upper","upper-case","uppercase","use-tool","uuid","uuid4","vals","values","vec-add","vec-dist","vec-dot","vec-magnitude","vec-norm","vec-normalize","vec-scale","vec-top-k","when","write-file","zero?","zip","zip-with","cond","catch","includes-item","flatten"]);
      return _builtins.has(s) || _builtins.has(s.replace(/_/g,"-"));
    },
  };
  for (const [name, fn] of Object.entries(_overrides)) {
    interp.context.functions.set(name, { name, params: [], body: fn });
  }
}
