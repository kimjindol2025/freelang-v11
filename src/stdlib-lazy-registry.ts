// FreeLang v11: Lazy Module Registry
// (require "audit") 호출 시 해당 모듈만 로드 — 번들 크기 무관하게 시작 빠름

import { createWsModule }           from "./stdlib-ws";
import { createWscModule }          from "./stdlib-wsc";
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
import { createOrmModule }          from "./stdlib-orm";
import { createValidationModule }   from "./stdlib-validation";
import { createMiddlewareModule }   from "./stdlib-middleware";
import { createTableModule }        from "./stdlib-table";
import { createServiceModule }      from "./stdlib-service";
import { createMarkdownModule }     from "./stdlib-markdown";
import { createBlogModule }         from "./stdlib-blog";
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
  "ws":          (interp?: any) => createWsModule(interp ? (n: string, a: any[]) => interp.callUserFunction(n, a) : () => null),
  "wsc":         (interp?: any) => createWscModule(interp ? (n: string, a: any[]) => interp.callUserFunction(n, a) : () => null),
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
  "oci":         () => { throw new Error("oci 모듈은 별도 패키지가 필요합니다. 표준 배포에 포함되지 않습니다."); },
  "orm":         () => createOrmModule(),
  "validation":  () => createValidationModule(),
  "middleware":  () => createMiddlewareModule(),
  "table":       () => createTableModule(),
  "stats":       () => { throw new Error("stats 모듈은 별도 패키지가 필요합니다. 표준 배포에 포함되지 않습니다."); },
  "plot":        () => { throw new Error("plot 모듈은 별도 패키지가 필요합니다. 표준 배포에 포함되지 않습니다."); },
  "service":     () => createServiceModule(),
  "markdown":    () => createMarkdownModule(),
  "feed":        () => { throw new Error("feed 모듈은 별도 패키지가 필요합니다. 표준 배포에 포함되지 않습니다."); },
  "blog":        () => createBlogModule(),
  "cloud":       () => { throw new Error("cloud 모듈은 별도 패키지가 필요합니다. 표준 배포에 포함되지 않습니다."); },
  "matrix":      () => { throw new Error("matrix 모듈은 별도 패키지가 필요합니다. 표준 배포에 포함되지 않습니다."); },
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
