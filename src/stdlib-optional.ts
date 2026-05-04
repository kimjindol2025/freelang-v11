// FreeLang v11: Optional Module Bridge
// Phase F-4: 선택적 npm 모듈 — 없으면 graceful fallback, 있으면 바인딩

type Fallback = (...args: any[]) => any;

function tryRequire(name: string): any {
  try { return require(name); } catch { return null; }
}

function notAvailable(modName: string, fnName: string): Fallback {
  return (..._args: any[]) => {
    throw new Error(`${fnName} 사용 불가: npm install ${modName} 필요`);
  };
}

export function createOptionalModule() {
  return {
    // require_optional modName -> true/false (설치 여부)
    "require_optional": (modName: string): boolean => {
      return tryRequire(modName) !== null;
    },

    // optional_fn modName fnPath fallback -> fn
    // (optional_fn "sharp" "default" (fn [p] (throw "sharp 없음")))
    // fnPath: "." → 모듈 자체, "default" → module.default, "fn_name" → module.fn_name
    "optional_fn": (modName: string, fnPath: string, fallback?: any): any => {
      const mod = tryRequire(modName);
      if (!mod) return fallback ?? notAvailable(modName, fnPath);
      if (fnPath === "." || fnPath === "") return mod;
      if (fnPath === "default") return mod.default ?? mod;
      return mod[fnPath] ?? notAvailable(modName, fnPath);
    },

    // optional_call modName fnPath args -> result or throws
    "optional_call": (modName: string, fnPath: string, ...args: any[]): any => {
      const mod = tryRequire(modName);
      if (!mod) throw new Error(`${modName} 미설치. npm install ${modName} 필요`);
      const fn = fnPath === "default" ? (mod.default ?? mod) : (mod[fnPath] ?? mod);
      if (typeof fn !== "function") throw new Error(`${modName}.${fnPath}는 함수가 아님`);
      return fn(...args);
    },

    // optional_has? modName -> boolean
    "optional_has?": (modName: string): boolean => tryRequire(modName) !== null,

    // optional_version modName -> string or nil
    "optional_version": (modName: string): string | null => {
      try {
        const pkg = require(`${modName}/package.json`);
        return pkg.version ?? null;
      } catch {
        return null;
      }
    },
  };
}
