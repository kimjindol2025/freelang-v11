// FreeLang v11: Lazy Module Registry
// (require "audit") 호출 시 해당 모듈만 로드 — 번들 크기 무관하게 시작 빠름

import { createCryptoRsaModule }    from "./stdlib-crypto-rsa";
import { createTotpModule }         from "./stdlib-totp";
import { createMailModule }         from "./stdlib-mail";
import { createWebauthnModule }     from "./stdlib-webauthn";
import { createQueueHelpersModule } from "./stdlib-queue-helpers";
import { createWorkflowModule }     from "./stdlib-workflow";
import { createResourceModule }     from "./stdlib-resource";
import { createMariadbModule }      from "./stdlib-mariadb";
import { createMongodbModule }      from "./stdlib-mongodb";
import { createAsyncModule }        from "./stdlib-async";
import { createChannelModule }      from "./stdlib-channel";
import { createImmutableModule }    from "./immutable";
import { createAiNativeModule }     from "./stdlib-ai-native";
import { createCompileModule }      from "./stdlib-compile";
import { createRegistryModule }     from "./stdlib-registry";
import { createOciModule }          from "./stdlib-oci";
import { createOrmModule }          from "./stdlib-orm";
import { createValidationModule }   from "./stdlib-validation";
import { createMiddlewareModule }   from "./stdlib-middleware";
import { createTableModule }        from "./stdlib-table";
import { createStatsModule }        from "./stdlib-stats";
import { createPlotModule }         from "./stdlib-plot";
import { createServiceModule }      from "./stdlib-service";
import { createMarkdownModule }     from "./stdlib-markdown";
import { createFeedModule }         from "./stdlib-feed";
import { createBlogModule }         from "./stdlib-blog";
import { createCloudModule }        from "./stdlib-cloud";
import { createMatrixModule }       from "./stdlib-matrix";
import { createAuditModule }        from "./stdlib-audit";

type ModuleFactory = () => Record<string, unknown>;

interface InterpreterLike {
  registerModule(module: Record<string, unknown>): void;
  callUserFunction(name: string, args: any[]): any;
  callFunctionValue(fnValue: any, args: any[]): any;
}

// 모듈명 → 팩토리 함수 매핑
// 새 stdlib 추가 시 여기에만 한 줄 추가하면 됨
const LAZY_REGISTRY: Record<string, ModuleFactory> = {
  "crypto-rsa":  () => createCryptoRsaModule(),
  "totp":        () => createTotpModule(),
  "mail":        () => createMailModule(),
  "webauthn":    () => createWebauthnModule(),
  "queue":       () => createQueueHelpersModule(),
  "workflow":    () => createWorkflowModule(),
  "resource":    () => createResourceModule(),
  "mariadb":     () => createMariadbModule(),
  "mongodb":     () => createMongodbModule(),
  "async":       (interp?: any) => createAsyncModule(interp ? (n: string, a: any[]) => interp.callUserFunction(n, a) : () => null),
  "channel":     () => createChannelModule(),
  "immutable":   () => createImmutableModule(),
  "ai":          () => createAiNativeModule(),
  "compile":     () => createCompileModule(),
  "registry":    () => createRegistryModule(),
  "oci":         () => createOciModule(),
  "orm":         () => createOrmModule(),
  "validation":  () => createValidationModule(),
  "middleware":  () => createMiddlewareModule(),
  "table":       () => createTableModule(),
  "stats":       () => createStatsModule(),
  "plot":        () => createPlotModule(),
  "service":     () => createServiceModule(),
  "markdown":    () => createMarkdownModule(),
  "feed":        () => createFeedModule(),
  "blog":        () => createBlogModule(),
  "cloud":       () => createCloudModule(),
  "matrix":      () => createMatrixModule(),
  "audit":       () => createAuditModule(),
};

// 이미 로드된 모듈 캐시 (중복 로드 방지)
const loaded = new Set<string>();

export function getAvailableModules(): string[] {
  return Object.keys(LAZY_REGISTRY);
}

export function isModuleLoaded(name: string): boolean {
  return loaded.has(name);
}

// (require "audit") 호출 시 실행
export function requireModule(name: string, interp: InterpreterLike): boolean {
  const normalized = name.replace(/_/g, "-");

  if (loaded.has(normalized)) return true; // 이미 로드됨

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
