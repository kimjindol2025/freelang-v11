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
import { createAuthModule } from "./stdlib-auth";        // Phase 21: Auth (JWT, API key, hash)
import { createCacheModule } from "./stdlib-cache";      // Phase 21: In-memory TTL cache
import { createPubSubModule } from "./stdlib-pubsub";    // Phase 21: Pub/Sub events
import { createProcessModule } from "./stdlib-process";  // Phase 22: Process (env + SIGTERM)
import { createAsyncModule } from "./stdlib-async";      // Phase 23: Async/await primitives
import { createModuleSystem } from "./stdlib-module";    // Phase 24: Module system
import { createChannelModule } from "./stdlib-channel";  // Phase 67: 채널 기반 동시성
import { createImmutableModule } from "./immutable";      // Phase 70: 이뮤터블 데이터 구조
import { createAiNativeModule } from "./stdlib-ai-native"; // Phase 71: AI 네이티브 블록
import { createTestModule } from "./stdlib-test";           // Phase 76: FL 네이티브 테스트 러너
import { createMaybeModule } from "./maybe-type";           // Phase 91: 불확실성 타입
import { createCompileModule } from "./stdlib-compile";    // Phase 6: .fl → .js 컴파일러
import { createRegistryModule } from "./stdlib-registry";  // Phase 7: npm 호환 패키지 레지스트리
import { createOciModule } from "./stdlib-oci";             // Phase 8: OCI 자동 빌드
import { createOrmModule } from "./stdlib-orm";             // Phase 9: ORM (Model CRUD)
import { createValidationModule } from "./stdlib-validation"; // Phase 9: 스키마 검증
import { createMiddlewareModule } from "./stdlib-middleware";   // Phase 9: 미들웨어 체인

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
    (n: string, a: any[]) => interp.callUserFunction(n, a),
    (fnValue: any, a: any[]) => interp.callFunctionValue(fnValue, a)
  ));
  interp.registerModule(createDbModule());
  interp.registerModule(createAuthModule());
  interp.registerModule(createCacheModule());
  interp.registerModule(createPubSubModule((n, a) => interp.callUserFunction(n, a)));
  interp.registerModule(createProcessModule());  // Phase 22: env_load, on_sigterm
  interp.registerModule(createAsyncModule((n, a) => interp.callUserFunction(n, a))); // Phase 23: async_call, promise_*
  interp.registerModule(createModuleSystem());   // Phase 24: module_*, namespace_*
  interp.registerModule(createChannelModule());  // Phase 67: chan, chan-send, chan-recv
  interp.registerModule(createImmutableModule()); // Phase 70: imm-map, imm-vec, ...
  interp.registerModule(createAiNativeModule());  // Phase 71: ai-call, rag-search, embed, similarity
  interp.registerModule(createTestModule(         // Phase 76: deftest, describe, assert-eq, ...
    (fnValue, args) => interp.callFunctionValue(fnValue, args)
  ));
  interp.registerModule(createMaybeModule(         // Phase 91: 불확실성 타입 (maybe/none/confident)
    (fnValue, args) => interp.callFunctionValue(fnValue, args),
    (name, args) => interp.callUserFunction(name, args)
  ));
  interp.registerModule(createCompileModule());   // Phase 6: fl_compile, fl_compile_file (tsc 제거)
  interp.registerModule(createRegistryModule());  // Phase 7: registry_publish, registry_search, registry_info, registry_delete, registry_start
  interp.registerModule(createOciModule());       // Phase 8: oci_create_manifest, oci_create_layer, oci_build, oci_push, oci_sign, oci_list, oci_inspect, oci_remove
  interp.registerModule(createOrmModule());       // Phase 9: orm_define_model, orm_create, orm_find, orm_update, orm_delete, orm_all, orm_count
  interp.registerModule(createValidationModule()); // Phase 9: schema_define, schema_validate, schema_is_valid, validate_email, validate_string, validate_number, validate_regex
  interp.registerModule(createMiddlewareModule()); // Phase 9: middleware_define, middleware_create_chain, middleware_apply_chain, middleware_auth_check, middleware_logging, middleware_rate_limit, middleware_cors
}
