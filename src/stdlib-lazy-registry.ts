// FreeLang v11: Lazy Module Registry
// (require "http-server") 등 호출 시 해당 번들만 로드
//
// 번들 구조:
//   bootstrap.js          — core 전용
//   stdlib-ext-http.js    — HTTP 서버 (http-server)
//   stdlib-ext-db.js      — DB 드라이버 (mariadb, mongodb, db, orm)
//   stdlib-ext-workflow.js — 워크플로우 (workflow, resource, service)
//   stdlib-ext-ws.js      — WebSocket (ws, wsc)
//   stdlib-ext-misc.js    — 기타 (mail, webauthn, totp, crypto-rsa, etc.)
//
// 앱별 배포 조합:
//   core 전용 앱:    bootstrap.js
//   HTTP API 앱:    bootstrap.js + stdlib-ext-http.js
//   DB 앱:          bootstrap.js + stdlib-ext-db.js
//   풀스택 앱:       bootstrap.js + 필요한 ext-*.js 모두

/* eslint-disable @typescript-eslint/no-var-requires */

interface InterpreterLike {
  registerModule(module: Record<string, unknown>): void;
  callUserFunction(name: string, args: any[]): any;
  callFunctionValue(fnValue: any, args: any[]): any;
}

type ModuleFactory = (interp?: InterpreterLike) => Record<string, unknown>;

// 모듈명 → (번들파일, 팩토리함수명) 매핑
const BUNDLE_MAP: Record<string, { bundle: string; factory: string; needsInterp?: boolean }> = {
  // HTTP
  "http-server": { bundle: "./stdlib-ext-http.js",     factory: "createHttpServerModule", needsInterp: true },
  // DB
  "mariadb":     { bundle: "./stdlib-ext-db.js",       factory: "createMariadbModule" },
  "mongodb":     { bundle: "./stdlib-ext-db.js",       factory: "createMongodbModule" },
  "db":          { bundle: "./stdlib-ext-db.js",       factory: "createDbModule" },
  "orm":         { bundle: "./stdlib-ext-db.js",       factory: "createOrmModule" },
  // Workflow
  "workflow":    { bundle: "./stdlib-ext-workflow.js", factory: "createWorkflowModule" },
  "resource":    { bundle: "./stdlib-ext-workflow.js", factory: "createResourceModule" },
  "service":     { bundle: "./stdlib-ext-workflow.js", factory: "createServiceModule" },
  // WebSocket
  "ws":          { bundle: "./stdlib-ext-ws.js",       factory: "createWsModule",  needsInterp: true },
  "wsc":         { bundle: "./stdlib-ext-ws.js",       factory: "createWscModule", needsInterp: true },
  // Auth / security
  "webauthn":    { bundle: "./stdlib-ext-auth.js",     factory: "createWebauthnModule" },
  "totp":        { bundle: "./stdlib-ext-auth.js",     factory: "createTotpModule" },
  "crypto-rsa":  { bundle: "./stdlib-ext-auth.js",     factory: "createCryptoRsaModule" },
  "mail":        { bundle: "./stdlib-ext-auth.js",     factory: "createMailModule" },
  // AI / observability
  "ai":          { bundle: "./stdlib-ext-ai.js",       factory: "createAiNativeModule" },
  "audit":       { bundle: "./stdlib-ext-ai.js",       factory: "createAuditModule" },
  // Content
  "markdown":    { bundle: "./stdlib-ext-content.js",  factory: "createMarkdownModule" },
  "blog":        { bundle: "./stdlib-ext-content.js",  factory: "createBlogModule" },
  "table":       { bundle: "./stdlib-ext-content.js",  factory: "createTableModule" },
  "validation":  { bundle: "./stdlib-ext-content.js",  factory: "createValidationModule" },
  "middleware":  { bundle: "./stdlib-ext-content.js",  factory: "createMiddlewareModule" },
  // Compile (parser+AST 포함 — ~139KB, 구조적 비용)
  "compile":     { bundle: "./stdlib-ext-compile.js",  factory: "createCompileModule" },
  // Registry (http만 의존 — 3KB)
  "registry":    { bundle: "./stdlib-ext-registry.js", factory: "createRegistryModule" },
  // Async / concurrency
  "async":       { bundle: "./stdlib-ext-async.js",    factory: "createAsyncModule", needsInterp: true },
  "channel":     { bundle: "./stdlib-ext-async.js",    factory: "createChannelModule" },
  "queue":       { bundle: "./stdlib-ext-async.js",    factory: "createQueueHelpersModule" },
  "immutable":   { bundle: "./stdlib-ext-async.js",    factory: "createImmutableModule" },
};

// misc 번들은 더 이상 사용 안 함 (모두 전용 번들로 이동)
const MISC_MODULES: Record<string, string> = {};

const NOT_AVAILABLE = new Set(["oci", "stats", "plot", "feed", "cloud", "matrix"]);

const loaded = new Set<string>();

export function getAvailableModules(): string[] {
  return [...Object.keys(BUNDLE_MAP), ...Object.keys(MISC_MODULES)];
}

export function isModuleLoaded(name: string): boolean {
  return loaded.has(name);
}

function resolveBundlePath(bundleFile: string): string {
  // __dirname은 빌드된 파일 기준이므로 require.resolve 대신 path.resolve 사용
  return require("path").resolve(__dirname, bundleFile);
}

export function requireModule(name: string, interp: InterpreterLike): boolean {
  const normalized = name.replace(/_/g, "-");
  if (loaded.has(normalized)) return true;

  if (NOT_AVAILABLE.has(normalized)) {
    throw new Error(`${normalized} 모듈은 별도 패키지가 필요합니다.`);
  }

  try {
    // 전용 번들 확인
    const entry = BUNDLE_MAP[normalized];
    if (entry) {
      const mod = require(resolveBundlePath(entry.bundle));
      const factory = mod[entry.factory];
      if (!factory) throw new Error(`${entry.factory} not found in ${entry.bundle}`);

      let result: Record<string, unknown>;
      if (entry.needsInterp) {
        result = factory(
          (n: string, a: any[]) => interp.callUserFunction(n, a),
          (fn: any, a: any[]) => interp.callFunctionValue(fn, a),
        );
      } else {
        result = factory();
      }
      interp.registerModule(result);
      loaded.add(normalized);
      return true;
    }

    // misc 번들
    if (MISC_MODULES[normalized]) {
      const mod = require(resolveBundlePath("./stdlib-ext-misc.js"));
      const factory = mod[MISC_MODULES[normalized]];
      if (!factory) throw new Error(`${MISC_MODULES[normalized]} not found in stdlib-ext-misc.js`);
      const result = factory(interp ? (n: string, a: any[]) => interp.callUserFunction(n, a) : () => null);
      interp.registerModule(result);
      loaded.add(normalized);
      return true;
    }

    console.warn(`⚠️  [FreeLang] require: 알 수 없는 모듈 "${name}". 사용 가능: ${getAvailableModules().join(", ")}`);
    return false;
  } catch (e: any) {
    // 번들 파일 없으면 graceful fallback
    if (e.code === "MODULE_NOT_FOUND") {
      console.warn(`⚠️  [FreeLang] require "${name}": 번들 파일 없음 (${e.message})`);
      return false;
    }
    console.error(`❌ [FreeLang] require "${name}" 로드 실패:`, e);
    return false;
  }
}
