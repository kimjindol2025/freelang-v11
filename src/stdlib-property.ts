// FreeLang v11: AI-Native Phase 4 — Property-Based Testing
// defprop + 타입 생성기 + 자동 검증

export interface PropDef {
  name: string;
  fn: string;          // 대상 함수명
  args: string[];      // 타입 배열 e.g. ["int", "int"]
  check: any;          // fn value (FL function) — (args...) → bool
  samples: number;     // 실행 횟수 (기본 100)
  line?: number;
  file?: string;
}

export const propRegistry = new Map<string, PropDef>();

// ── 타입별 랜덤 생성기 ──────────────────────────────────────────────

const RAND_STRINGS = "abcdefghijklmnopqrstuvwxyz0123456789 _-";

function genValue(type: string): any {
  const t = type.replace(/^:/, "").toLowerCase();
  switch (t) {
    case "int":
    case "integer":
      return Math.floor(Math.random() * 2001) - 1000;
    case "pos-int":
    case "positive-int":
      return Math.floor(Math.random() * 1000) + 1;
    case "neg-int":
    case "negative-int":
      return -(Math.floor(Math.random() * 1000) + 1);
    case "nat":
    case "natural":
      return Math.floor(Math.random() * 1000);
    case "float":
    case "double":
      return (Math.random() * 2000) - 1000;
    case "number":
      return Math.random() < 0.5
        ? Math.floor(Math.random() * 2001) - 1000
        : (Math.random() * 2000) - 1000;
    case "string":
    case "str": {
      const len = Math.floor(Math.random() * 20);
      return Array.from({ length: len }, () =>
        RAND_STRINGS[Math.floor(Math.random() * RAND_STRINGS.length)]).join("");
    }
    case "nonempty-string":
    case "ne-string": {
      const len = Math.floor(Math.random() * 19) + 1;
      return Array.from({ length: len }, () =>
        RAND_STRINGS[Math.floor(Math.random() * RAND_STRINGS.length)]).join("");
    }
    case "bool":
    case "boolean":
      return Math.random() < 0.5;
    case "list":
    case "array": {
      const len = Math.floor(Math.random() * 10);
      return Array.from({ length: len }, () => genValue("int"));
    }
    case "any":
    default: {
      const pick = Math.floor(Math.random() * 4);
      if (pick === 0) return genValue("int");
      if (pick === 1) return genValue("string");
      if (pick === 2) return genValue("bool");
      return null;
    }
  }
}

function generateSample(argTypes: string[]): any[] {
  return argTypes.map(t => genValue(t));
}

// ── 결과 타입 ────────────────────────────────────────────────────────

export interface PropResult {
  name: string;
  fn: string;
  samples: number;
  passed: number;
  failed: number;
  firstFailure: { args: any[]; result: any; error?: string } | null;
  durationMs: number;
}

// ── 러너 ─────────────────────────────────────────────────────────────

export function runProp(
  prop: PropDef,
  callFn: (name: string, args: any[]) => any,
  callCheck: (checkFn: any, args: any[]) => any
): PropResult {
  const start = Date.now();
  let passed = 0;
  let failed = 0;
  let firstFailure: PropResult["firstFailure"] = null;

  for (let i = 0; i < prop.samples; i++) {
    const args = generateSample(prop.args);
    try {
      // 대상 함수 호출
      const result = callFn(prop.fn, args);
      // check 함수 호출: check(args..., result) 또는 check(args...)
      let checkArgs: any[];
      try {
        // check arity 감지: args.length+1 이면 result 포함
        const fnParams: string[] = prop.check?.params ?? [];
        checkArgs = fnParams.length === args.length + 1
          ? [...args, result]
          : args;
      } catch {
        checkArgs = [...args, result];
      }
      const ok = callCheck(prop.check, checkArgs);
      if (ok || ok === null) {
        passed++;
      } else {
        failed++;
        if (!firstFailure) firstFailure = { args, result };
      }
    } catch (err: any) {
      failed++;
      if (!firstFailure) firstFailure = { args, result: null, error: err?.message ?? String(err) };
    }
    if (failed > 0 && firstFailure) break; // 첫 실패 후 중단
  }

  return {
    name: prop.name,
    fn: prop.fn,
    samples: prop.samples,
    passed,
    failed,
    firstFailure,
    durationMs: Date.now() - start,
  };
}

export function createPropertyModule(): Record<string, Function> {
  return {
    // 런타임에서 property 결과 조회
    "prop-registry-list": (): string[] => [...propRegistry.keys()],
    "prop-get":           (name: string): any => {
      const p = propRegistry.get(name);
      if (!p) return null;
      const m = new Map<string, any>();
      m.set("name", p.name);
      m.set("fn", p.fn);
      m.set("args", p.args);
      m.set("samples", p.samples);
      return m;
    },
  };
}
