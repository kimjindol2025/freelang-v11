// C6: T1~T5 success criteria + hidden invariants + unauthorized builtin matrix
//
// 이 단계가 끝나면 "effect system = fully closed loop" 상태.
//
// 핵심 검증:
//   T1~T5: 설계 §11 success criteria
//   invariants: registry miss fallback, builtin+user fn 혼합, async path,
//               "violation throw → push NEVER" (가장 위험한 invariant)
//   matrix: BUILTIN_EFFECTS 의 typed builtin 전수 → pure context = throw

import {
  pushFrame,
  popFrame,
  enforceCall,
  getDepth,
  _resetForTesting,
} from "../effect-enforcer";
import { fnMetaRegistry } from "../eval-special-forms";
import { EffectViolation, EffectTag } from "../effect-types";
import { BUILTIN_EFFECTS } from "../builtin-effects";
import { getEvents, clearEvents, RuntimeEvent } from "../runtime-events";

beforeEach(() => {
  _resetForTesting();
  clearEvents();
});

function effectEvents(): RuntimeEvent[] {
  return getEvents().filter((e) => e.type === "effect-violation");
}

// ───────────────────────────────────────────────────────────────
// T1~T5 success criteria (design §11)
// ───────────────────────────────────────────────────────────────

describe("C6 T1~T5: success criteria (design §11)", () => {
  test("T1: pure → :io builtin = FAIL", () => {
    fnMetaRegistry.set("save-report", { effects: [] });
    try {
      pushFrame("save-report", new Set<EffectTag>());
      expect(() => enforceCall("file-write")).toThrow(EffectViolation);
      popFrame();
    } finally {
      fnMetaRegistry.delete("save-report");
    }
  });

  test("T2: :io → :io builtin = PASS", () => {
    fnMetaRegistry.set("write-log", { effects: ["io"] });
    try {
      pushFrame("write-log", new Set<EffectTag>(["io"]));
      expect(() => enforceCall("file-write")).not.toThrow();
      popFrame();
    } finally {
      fnMetaRegistry.delete("write-log");
    }
  });

  test("T3: pure → pure (user fn) = PASS", () => {
    fnMetaRegistry.set("pure-caller", { effects: [] });
    fnMetaRegistry.set("pure-callee", { effects: [] });
    try {
      pushFrame("pure-caller", new Set<EffectTag>());
      expect(() => enforceCall("pure-callee")).not.toThrow();
      popFrame();
    } finally {
      fnMetaRegistry.delete("pure-caller");
      fnMetaRegistry.delete("pure-callee");
    }
  });

  test("T4: pure → :net builtin = FAIL", () => {
    fnMetaRegistry.set("analyze", { effects: [] });
    try {
      pushFrame("analyze", new Set<EffectTag>());
      expect(() => enforceCall("http-post")).toThrow(EffectViolation);
      popFrame();
    } finally {
      fnMetaRegistry.delete("analyze");
    }
  });

  test("T5: T1 위반 시 runtime-events 에 effect-violation 1건 기록", () => {
    fnMetaRegistry.set("save-report", { effects: [] });
    try {
      pushFrame("save-report", new Set<EffectTag>());
      expect(() => enforceCall("file-write")).toThrow();
      popFrame();

      const evs = effectEvents();
      expect(evs.length).toBe(1);
      expect(evs[0].fn).toBe("file-write");
      expect(evs[0].target_effect).toBe("io");
      expect(evs[0].allowed).toEqual([]);
      expect(evs[0].chain).toEqual(["save-report"]);
      expect(evs[0].severity).toBe("error");
    } finally {
      fnMetaRegistry.delete("save-report");
    }
  });
});

// ───────────────────────────────────────────────────────────────
// Hidden invariants (가장 위험한 검증)
// ───────────────────────────────────────────────────────────────

describe("C6 invariants: 숨은 위험 포인트", () => {
  test("INV-1: violation throw 시 frame push NEVER (depth 무변화)", () => {
    // 이 invariant 가 깨지면 C5 event 오염 + C7 SHA 흔들림
    pushFrame("outer", new Set<EffectTag>());
    const depthBefore = getDepth();
    expect(() => enforceCall("file-write")).toThrow(EffectViolation);
    const depthAfter = getDepth();
    expect(depthAfter).toBe(depthBefore);
    expect(depthAfter).toBe(1);  // outer 만 존재
    popFrame();
    expect(getDepth()).toBe(0);
  });

  test("INV-2: registry miss → legacy allow (undefined fallback)", () => {
    pushFrame("pure", new Set<EffectTag>());
    expect(() =>
      enforceCall("never-registered-builtin-xyz")
    ).not.toThrow();
    popFrame();
  });

  test("INV-3: builtin + user fn 혼합 path — 동일 enforceCall 통과", () => {
    fnMetaRegistry.set("io-user-fn", { effects: ["io"] });
    try {
      pushFrame("pure", new Set<EffectTag>());
      // builtin
      expect(() => enforceCall("file-write")).toThrow(EffectViolation);
      // user fn (메타 :io)
      expect(() => enforceCall("io-user-fn")).toThrow(EffectViolation);
      popFrame();

      // 두 violation 모두 별도 event 로 기록됨
      const evs = effectEvents();
      expect(evs.length).toBe(2);
      expect(new Set(evs.map((e) => e.fn))).toEqual(
        new Set(["file-write", "io-user-fn"])
      );
    } finally {
      fnMetaRegistry.delete("io-user-fn");
    }
  });

  test("INV-4: async path — sync entry phase 에서 violation 즉시 throw", () => {
    fnMetaRegistry.set("async-pure", { effects: [] });
    try {
      // simulate callAsyncFunctionValue 의 sync entry
      pushFrame("caller", null);
      enforceCall("async-pure");
      pushFrame("async-pure", new Set<EffectTag>());  // sync push
      try {
        // body 안에서 io call → throw (Promise 진입 전)
        expect(() => enforceCall("file-write")).toThrow(EffectViolation);
      } finally {
        popFrame();  // sync exit (callAsyncFunctionValue 의 finally)
      }
      popFrame();
      expect(getDepth()).toBe(0);
    } finally {
      fnMetaRegistry.delete("async-pure");
    }
  });

  test("INV-5: legacy frame 안에서 effect-violation 이벤트 미발생", () => {
    pushFrame("legacy", null);
    enforceCall("file-write");
    enforceCall("http-post");
    popFrame();

    // legacy frame 은 skip — 이벤트 없음
    expect(effectEvents().length).toBe(0);
  });

  test("INV-6: dedup 경계 — T5(같은 violation 반복) collapse + T1/T4(다른 violation) 별도", () => {
    pushFrame("pure", new Set<EffectTag>());

    // 같은 violation 3회 → 1 이벤트 (collapsed count=3)
    for (let i = 0; i < 3; i++) {
      try { enforceCall("file-write"); } catch {}
    }
    // 다른 violation → 별도 이벤트
    try { enforceCall("http-post"); } catch {}

    popFrame();

    const evs = effectEvents();
    expect(evs.length).toBe(2);
    const fileWrite = evs.find((e) => e.fn === "file-write")!;
    const httpPost = evs.find((e) => e.fn === "http-post")!;
    expect(fileWrite.collapsed).toBe(true);
    expect(fileWrite.count).toBeGreaterThanOrEqual(2);
    expect(httpPost.fn).toBe("http-post");
  });
});

// ───────────────────────────────────────────────────────────────
// Unauthorized builtin matrix (registry 전수 검증)
// ───────────────────────────────────────────────────────────────

describe("C6 matrix: BUILTIN_EFFECTS 전수 — pure context = throw", () => {
  // 신규 builtin 추가 시 case 자동 생성.
  // registry 누락 (등록 안 한 io 함수) 는 이 matrix 에 안 나타나므로 검출 불가 —
  // 그건 review/PR 단계에서 catch (별도 lint 후보).

  for (const [name, effects] of BUILTIN_EFFECTS) {
    if (!effects || effects.size === 0) continue;  // pure builtin skip
    const tagStr = [...effects].join(",");
    test(`${name} (:${tagStr}) — pure context = THROW`, () => {
      pushFrame("pure-ctx", new Set<EffectTag>());
      try {
        let caught: unknown = null;
        try { enforceCall(name); } catch (e) { caught = e; }
        expect(caught).toBeInstanceOf(EffectViolation);
        expect((caught as EffectViolation).fn).toBe(name);
      } finally {
        popFrame();
      }
    });
  }
});

// ───────────────────────────────────────────────────────────────
// Closed-loop sanity: enforceCall → throw → recordEvent payload 전 흐름
// ───────────────────────────────────────────────────────────────

describe("C6 closed-loop: enforce → throw → event 전 사이클", () => {
  test("정확한 payload 가 단일 사이클로 흐름", () => {
    fnMetaRegistry.set("outer", { effects: [] });
    fnMetaRegistry.set("inner", { effects: [] });
    try {
      pushFrame("outer", new Set<EffectTag>());
      pushFrame("inner", new Set<EffectTag>());
      try {
        enforceCall("file-write", { file: "x.fl", line: 42, col: 7 });
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(EffectViolation);
        const v = e as EffectViolation;
        expect(v.fn).toBe("file-write");
        expect(v.target_effect).toBe("io");
        expect(v.chain).toEqual(["outer", "inner"]);
        expect(v.span).toEqual({ file: "x.fl", line: 42, col: 7 });
      }
      popFrame();
      popFrame();

      // event 동시 발생
      const ev = effectEvents()[0];
      expect(ev.fn).toBe("file-write");
      expect(ev.chain).toEqual(["outer", "inner"]);
      expect(ev.file).toBe("x.fl");
      expect(ev.line).toBe(42);
    } finally {
      fnMetaRegistry.delete("outer");
      fnMetaRegistry.delete("inner");
    }
  });
});
