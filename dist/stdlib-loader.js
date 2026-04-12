"use strict";
// FreeLang v9: Stdlib Loader
// Phase 58: interpreter.ts constructor에서 분리된 stdlib 모듈 등록 로직
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAllStdlib = loadAllStdlib;
const stdlib_file_1 = require("./stdlib-file"); // Phase 10: File I/O
const stdlib_error_1 = require("./stdlib-error"); // Phase 11: Error handling
const stdlib_http_1 = require("./stdlib-http"); // Phase 12: HTTP Client
const stdlib_shell_1 = require("./stdlib-shell"); // Phase 12: Shell execution
const stdlib_data_1 = require("./stdlib-data"); // Phase 13: Data Transform
const stdlib_collection_1 = require("./stdlib-collection"); // Phase 14: Collection + Control
const stdlib_agent_1 = require("./stdlib-agent"); // Phase 15: AI Agent State Machine
const stdlib_time_1 = require("./stdlib-time"); // Phase 16: Time + Logging + Monitoring
const stdlib_crypto_1 = require("./stdlib-crypto"); // Phase 17: Crypto + UUID + Regex
const stdlib_workflow_1 = require("./stdlib-workflow"); // Phase 18: Workflow Engine
const stdlib_resource_1 = require("./stdlib-resource"); // Phase 19: Server Resource Search
const stdlib_http_server_1 = require("./stdlib-http-server"); // Phase 4a: Pure HTTP Server (Express-free)
const stdlib_db_1 = require("./stdlib-db"); // Phase 20: DB Driver
const stdlib_ws_1 = require("./stdlib-ws"); // Phase 21: WebSocket
const stdlib_wsc_1 = require("./stdlib-wsc"); // Phase 57: WebSocket Client (Tunnel)
const stdlib_auth_1 = require("./stdlib-auth"); // Phase 21: Auth (JWT, API key, hash)
const stdlib_cache_1 = require("./stdlib-cache"); // Phase 21: In-memory TTL cache
const stdlib_pubsub_1 = require("./stdlib-pubsub"); // Phase 21: Pub/Sub events
const stdlib_process_1 = require("./stdlib-process"); // Phase 22: Process (env + SIGTERM)
const stdlib_async_1 = require("./stdlib-async"); // Phase 23: Async/await primitives
const stdlib_module_1 = require("./stdlib-module"); // Phase 24: Module system
const stdlib_pg_1 = require("./stdlib-pg"); // PostgreSQL + JWT + AI
const stdlib_channel_1 = require("./stdlib-channel"); // Phase 67: 채널 기반 동시성
const immutable_1 = require("./immutable"); // Phase 70: 이뮤터블 데이터 구조
const stdlib_ai_native_1 = require("./stdlib-ai-native"); // Phase 71: AI 네이티브 블록
const stdlib_test_1 = require("./stdlib-test"); // Phase 76: FL 네이티브 테스트 러너
const maybe_type_1 = require("./maybe-type"); // Phase 91: 불확실성 타입
/**
 * 20개 stdlib 모듈을 interpreter에 등록
 * interpreter.ts constructor 대신 이 함수 한 줄로 호출
 */
function loadAllStdlib(interp) {
    interp.registerModule((0, stdlib_file_1.createFileModule)());
    interp.registerModule((0, stdlib_error_1.createErrorModule)());
    interp.registerModule((0, stdlib_http_1.createHttpModule)());
    interp.registerModule((0, stdlib_shell_1.createShellModule)());
    interp.registerModule((0, stdlib_data_1.createDataModule)());
    interp.registerModule((0, stdlib_collection_1.createCollectionModule)());
    interp.registerModule((0, stdlib_agent_1.createAgentModule)());
    interp.registerModule((0, stdlib_time_1.createTimeModule)());
    interp.registerModule((0, stdlib_crypto_1.createCryptoModule)());
    interp.registerModule((0, stdlib_workflow_1.createWorkflowModule)());
    interp.registerModule((0, stdlib_resource_1.createResourceModule)());
    // Phase 4a: Pure HTTP Server — callUserFunction/callFunctionValue 콜백 필요
    interp.registerModule((0, stdlib_http_server_1.createHttpServerModule)((n, a) => interp.callUserFunction(n, a), (fnValue, a) => interp.callFunctionValue(fnValue, a)));
    interp.registerModule((0, stdlib_db_1.createDbModule)());
    interp.registerModule((0, stdlib_ws_1.createWsModule)((n, a) => interp.callUserFunction(n, a)));
    interp.registerModule((0, stdlib_wsc_1.createWscModule)((n, a) => interp.callUserFunction(n, a))); // Phase 57: WebSocket Client
    interp.registerModule((0, stdlib_auth_1.createAuthModule)());
    interp.registerModule((0, stdlib_cache_1.createCacheModule)());
    interp.registerModule((0, stdlib_pubsub_1.createPubSubModule)((n, a) => interp.callUserFunction(n, a)));
    interp.registerModule((0, stdlib_process_1.createProcessModule)()); // Phase 22: env_load, on_sigterm
    interp.registerModule((0, stdlib_async_1.createAsyncModule)((n, a) => interp.callUserFunction(n, a))); // Phase 23: async_call, promise_*
    interp.registerModule((0, stdlib_module_1.createModuleSystem)()); // Phase 24: module_*, namespace_*
    interp.registerModule(stdlib_pg_1.pgBuiltins); // PostgreSQL + JWT + AI
    interp.registerModule((0, stdlib_channel_1.createChannelModule)()); // Phase 67: chan, chan-send, chan-recv
    interp.registerModule((0, immutable_1.createImmutableModule)()); // Phase 70: imm-map, imm-vec, ...
    interp.registerModule((0, stdlib_ai_native_1.createAiNativeModule)()); // Phase 71: ai-call, rag-search, embed, similarity
    interp.registerModule((0, stdlib_test_1.createTestModule)(// Phase 76: deftest, describe, assert-eq, ...
    (fnValue, args) => interp.callFunctionValue(fnValue, args)));
    interp.registerModule((0, maybe_type_1.createMaybeModule)(// Phase 91: 불확실성 타입 (maybe/none/confident)
    (fnValue, args) => interp.callFunctionValue(fnValue, args), (name, args) => interp.callUserFunction(name, args)));
}
//# sourceMappingURL=stdlib-loader.js.map