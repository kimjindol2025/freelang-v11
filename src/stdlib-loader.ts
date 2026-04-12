// FreeLang v9: Stdlib Loader
// Phase 58: interpreter.ts constructor에서 분리된 stdlib 모듈 등록 로직

import { createFileModule } from "./stdlib-file";        // Phase 10: File I/O
import { createErrorModule } from "./stdlib-error";      // Phase 11: Error handling
import { createHttpModule } from "./stdlib-http";        // Phase 12: HTTP Client
import { createShellModule } from "./stdlib-shell";      // Phase 12: Shell execution
import { createDataModule } from "./stdlib-data";        // Phase 13: Data Transform
import { createCollectionModule } from "./stdlib-collection"; // Phase 14: Collection + Control
import { createAgentModule } from "./stdlib-agent";      // Phase 15: AI Agent State Machine
import { createTimeModule } from "./stdlib-time";        // Phase 16: Time + Logging + Monitoring
import { createCryptoModule } from "./stdlib-crypto";    // Phase 17: Crypto + UUID + Regex
import { createWorkflowModule } from "./stdlib-workflow"; // Phase 18: Workflow Engine
import { createResourceModule } from "./stdlib-resource"; // Phase 19: Server Resource Search
import { createHttpServerModule } from "./stdlib-http-server"; // Phase 4a: Pure HTTP Server (Express-free)
import { createDbModule } from "./stdlib-db";            // Phase 20: DB Driver
import { createWsModule } from "./stdlib-ws";            // Phase 21: WebSocket
import { createWscModule } from "./stdlib-wsc";          // Phase 57: WebSocket Client (Tunnel)
import { createAuthModule } from "./stdlib-auth";        // Phase 21: Auth (JWT, API key, hash)
import { createCacheModule } from "./stdlib-cache";      // Phase 21: In-memory TTL cache
import { createPubSubModule } from "./stdlib-pubsub";    // Phase 21: Pub/Sub events
import { createProcessModule } from "./stdlib-process";  // Phase 22: Process (env + SIGTERM)
import { createAsyncModule } from "./stdlib-async";      // Phase 23: Async/await primitives
import { createModuleSystem } from "./stdlib-module";    // Phase 24: Module system
import { pgBuiltins } from "./stdlib-pg";                // PostgreSQL + JWT + AI
import { createChannelModule } from "./stdlib-channel";  // Phase 67: 채널 기반 동시성
import { createImmutableModule } from "./immutable";      // Phase 70: 이뮤터블 데이터 구조
import { createAiNativeModule } from "./stdlib-ai-native"; // Phase 71: AI 네이티브 블록
import { createTestModule } from "./stdlib-test";           // Phase 76: FL 네이티브 테스트 러너

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
    (n, a) => interp.callUserFunction(n, a),
    (fnValue, a) => interp.callFunctionValue(fnValue, a)
  ));
  interp.registerModule(createDbModule());
  interp.registerModule(createWsModule((n, a) => interp.callUserFunction(n, a)));
  interp.registerModule(createWscModule((n, a) => interp.callUserFunction(n, a))); // Phase 57: WebSocket Client
  interp.registerModule(createAuthModule());
  interp.registerModule(createCacheModule());
  interp.registerModule(createPubSubModule((n, a) => interp.callUserFunction(n, a)));
  interp.registerModule(createProcessModule());  // Phase 22: env_load, on_sigterm
  interp.registerModule(createAsyncModule((n, a) => interp.callUserFunction(n, a))); // Phase 23: async_call, promise_*
  interp.registerModule(createModuleSystem());   // Phase 24: module_*, namespace_*
  interp.registerModule(pgBuiltins);             // PostgreSQL + JWT + AI
  interp.registerModule(createChannelModule());  // Phase 67: chan, chan-send, chan-recv
  interp.registerModule(createImmutableModule()); // Phase 70: imm-map, imm-vec, ...
  interp.registerModule(createAiNativeModule());  // Phase 71: ai-call, rag-search, embed, similarity
  interp.registerModule(createTestModule(         // Phase 76: deftest, describe, assert-eq, ...
    (fnValue, args) => interp.callFunctionValue(fnValue, args)
  ));
}
