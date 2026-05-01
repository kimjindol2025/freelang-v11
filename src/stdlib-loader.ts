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
import { createWscModule } from "./stdlib-wsc";          // WebSocket 클라이언트
import { requireModule, getAvailableModules, isModuleLoaded } from "./stdlib-lazy-registry"; // Lazy Loading

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
