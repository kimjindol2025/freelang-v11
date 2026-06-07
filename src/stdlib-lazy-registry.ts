// FreeLang v11: Lazy Module Registry
// (require "http-server") 등 호출 시 해당 모듈만 로드
//
// 번들 크기 최적화:
//   정적 import 대신 factory 내에서 require() 동적 호출 사용
//   → esbuild가 정적 분석 시 이 파일의 의존성을 추적하지 않음
//   → 실제 호출 시점까지 모듈 코드가 번들에 포함되지 않음
//   → bootstrap.js 크기 감소

/* eslint-disable @typescript-eslint/no-var-requires */

interface InterpreterLike {
  registerModule(module: Record<string, unknown>): void;
  callUserFunction(name: string, args: any[]): any;
  callFunctionValue(fnValue: any, args: any[]): any;
}

type ModuleFactory = (interp?: InterpreterLike) => Record<string, unknown>;

// 모듈명 → 동적 factory 매핑
// factory 내에서 require()를 호출해야 esbuild가 번들에서 제외함
const LAZY_REGISTRY: Record<string, ModuleFactory> = {
  "ws":          (interp?) => {
    const { createWsModule } = require("./stdlib-ws");
    return createWsModule(interp ? (n: string, a: any[]) => interp.callUserFunction(n, a) : () => null);
  },
  "wsc":         (interp?) => {
    const { createWscModule } = require("./stdlib-wsc");
    return createWscModule(interp ? (n: string, a: any[]) => interp.callUserFunction(n, a) : () => null);
  },
  "crypto-rsa":  () => {
    const { createCryptoRsaModule } = require("./stdlib-crypto-rsa");
    return createCryptoRsaModule();
  },
  "totp":        () => {
    const { createTotpModule } = require("./stdlib-totp");
    return createTotpModule();
  },
  "mail":        () => {
    const { createMailModule } = require("./stdlib-mail");
    return createMailModule();
  },
  "webauthn":    () => {
    const { createWebauthnModule } = require("./stdlib-webauthn");
    return createWebauthnModule();
  },
  "queue":       () => {
    const { createQueueHelpersModule } = require("./stdlib-queue-helpers");
    return createQueueHelpersModule();
  },
  "workflow":    () => {
    const { createWorkflowModule } = require("./stdlib-workflow");
    return createWorkflowModule();
  },
  "resource":    () => {
    const { createResourceModule } = require("./stdlib-resource");
    return createResourceModule();
  },
  "mariadb":     () => {
    const { createMariadbModule } = require("./stdlib-mariadb");
    return createMariadbModule();
  },
  "mongodb":     () => {
    const { createMongodbModule } = require("./stdlib-mongodb");
    return createMongodbModule();
  },
  "async":       (interp?) => {
    const { createAsyncModule } = require("./stdlib-async");
    return createAsyncModule(interp ? (n: string, a: any[]) => interp.callUserFunction(n, a) : () => null);
  },
  "channel":     () => {
    const { createChannelModule } = require("./stdlib-channel");
    return createChannelModule();
  },
  "immutable":   () => {
    const { createImmutableModule } = require("./immutable");
    return createImmutableModule();
  },
  "ai":          () => {
    const { createAiNativeModule } = require("./stdlib-ai-native");
    return createAiNativeModule();
  },
  "compile":     () => {
    const { createCompileModule } = require("./stdlib-compile");
    return createCompileModule();
  },
  "registry":    () => {
    const { createRegistryModule } = require("./stdlib-registry");
    return createRegistryModule();
  },
  "oci":         () => { throw new Error("oci 모듈은 별도 패키지가 필요합니다."); },
  "orm":         () => {
    const { createOrmModule } = require("./stdlib-orm");
    return createOrmModule();
  },
  "validation":  () => {
    const { createValidationModule } = require("./stdlib-validation");
    return createValidationModule();
  },
  "middleware":  () => {
    const { createMiddlewareModule } = require("./stdlib-middleware");
    return createMiddlewareModule();
  },
  "table":       () => {
    const { createTableModule } = require("./stdlib-table");
    return createTableModule();
  },
  "stats":       () => { throw new Error("stats 모듈은 별도 패키지가 필요합니다."); },
  "plot":        () => { throw new Error("plot 모듈은 별도 패키지가 필요합니다."); },
  "service":     () => {
    const { createServiceModule } = require("./stdlib-service");
    return createServiceModule();
  },
  "markdown":    () => {
    const { createMarkdownModule } = require("./stdlib-markdown");
    return createMarkdownModule();
  },
  "feed":        () => { throw new Error("feed 모듈은 별도 패키지가 필요합니다."); },
  "blog":        () => {
    const { createBlogModule } = require("./stdlib-blog");
    return createBlogModule();
  },
  "cloud":       () => { throw new Error("cloud 모듈은 별도 패키지가 필요합니다."); },
  "matrix":      () => { throw new Error("matrix 모듈은 별도 패키지가 필요합니다."); },
  "audit":       () => {
    const { createAuditModule } = require("./stdlib-audit");
    return createAuditModule();
  },
  "http-server": (interp?) => {
    const { createHttpServerModule } = require("./stdlib-http-server");
    return createHttpServerModule(
      interp ? (n: string, a: any[]) => interp.callUserFunction(n, a) : () => null,
      interp ? (fn: any, a: any[]) => interp.callFunctionValue(fn, a) : () => null,
    );
  },
};

const loaded = new Set<string>();

export function getAvailableModules(): string[] {
  return Object.keys(LAZY_REGISTRY);
}

export function isModuleLoaded(name: string): boolean {
  return loaded.has(name);
}

export function requireModule(name: string, interp: InterpreterLike): boolean {
  const normalized = name.replace(/_/g, "-");
  if (loaded.has(normalized)) return true;

  const factory = LAZY_REGISTRY[normalized];
  if (!factory) {
    console.warn(`⚠️  [FreeLang] require: 알 수 없는 모듈 "${name}". 사용 가능: ${Object.keys(LAZY_REGISTRY).join(", ")}`);
    return false;
  }

  try {
    const mod = factory(interp);
    interp.registerModule(mod);
    loaded.add(normalized);
    return true;
  } catch (e) {
    console.error(`❌ [FreeLang] require "${name}" 로드 실패:`, e);
    return false;
  }
}
