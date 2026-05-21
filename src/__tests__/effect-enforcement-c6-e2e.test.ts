// C6 E2E: .fl integration sanity — L0 정적 layer 우회 + L1 runtime layer 검증
//
// 구조 인식 (architecture):
//   L0 (static, eval-special-forms.ts:checkEffects + EFFECT_CATALOG)
//     - defn 처리 시점에 builtin name 직접 매칭으로 pre-filter
//     - 직접 (println …) 호출은 L0 가 잡음 → FLRuntimeError(E_PURE_VIOLATION)
//   L1 (runtime, effect-enforcer.ts + 8 entry hooks + evalBuiltin C4-4)
//     - 호출 시점 frame stack 기반 검증 → EffectViolation
//
// L1 검증 = L0 가 못 잡는 간접 호출 시나리오로 격리:
//   user 정의 io fn → pure fn 이 호출 (EFFECT_CATALOG 에 없는 이름)

import { lex } from "../lexer";
import { Parser } from "../parser";
import { Interpreter } from "../interpreter";
import { _resetForTesting } from "../effect-enforcer";
import {
  getEvents,
  clearEvents,
  RuntimeEvent,
} from "../runtime-events";
import { fnMetaRegistry } from "../eval-special-forms";

function run(source: string): any {
  const tokens = lex(source);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter();
  return interp.interpret(ast).lastValue;
}

function effectEvents(): RuntimeEvent[] {
  return getEvents().filter((e) => e.type === "effect-violation");
}

beforeEach(() => {
  _resetForTesting();
  clearEvents();
  fnMetaRegistry.clear();
});

describe("C6 E2E L1: L0 우회 시나리오 (runtime layer 격리 검증)", () => {
  test("E2E-1: {:effects [:io]} fn 이 println 호출 → success + 이벤트 0건 (L0/L1 둘 다 통과)", () => {
    expect(() =>
      run(`
        (defn say-hello []
          {:effects ["io"]}
          (println "e2e-ok"))
        (say-hello)
      `)
    ).not.toThrow();
    expect(effectEvents().length).toBe(0);
  });

  test("E2E-2: user 정의 io fn 을 pure fn 이 호출 (L0 우회, L1 catch)", () => {
    let caught: unknown = null;
    try {
      run(`
        (defn io-helper []
          {:effects ["io"]}
          42)
        (defn pure-caller []
          {:effects []}
          (io-helper))
        (pure-caller)
      `);
    } catch (e) {
      caught = e;
    }

    expect(caught).not.toBeNull();

    const evs = effectEvents();
    expect(evs.length).toBeGreaterThanOrEqual(1);
    const helperViolation = evs.find((e) => e.fn === "io-helper");
    expect(helperViolation).toBeDefined();
    expect(helperViolation!.target_effect).toBe("io");
    expect(helperViolation!.chain).toContain("pure-caller");
  });
});

describe("C6 E2E L0: 정적 layer 정상 동작 (별도 보존 검증)", () => {
  test("E2E-L0: pure fn 이 println 직접 호출 → L0 차단 (FLRuntimeError E_PURE_VIOLATION)", () => {
    let caught: any = null;
    try {
      run(`
        (defn direct-pure []
          {:effects []}
          (println "should-not-reach"))
      `);
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(String(caught.message ?? caught)).toMatch(
      /E_PURE_VIOLATION|side effect|pure/i
    );
  });
});
