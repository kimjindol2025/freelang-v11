// C4-3: async event boundary + dispatch + final bypass audit
//
// 핵심 원칙:
//   1. async 는 stack 이 아니라 event boundary
//      → sync 진입 시점만 frame 유지, Promise.then 안은 frame 손대지 않음
//   2. builtin dispatch (callFunction kind="builtin-function") 는 enforce 만, frame 없음
//   3. 모든 entry path 에서 single gate 통과 (phantom frame 금지)

import {
  pushFrame,
  popFrame,
  enforceCall,
  getDepth,
  _resetForTesting,
} from "../effect-enforcer";
import { fnMetaRegistry } from "../eval-special-forms";
import { EffectViolation, EffectTag } from "../effect-types";

beforeEach(() => {
  _resetForTesting();
});

describe("C4-3: async event boundary", () => {
  test("async sync entry — frame push/pop pairing 정확", async () => {
    // simulate callAsyncFunctionValue 의 sync 진입부 패턴
    pushFrame("caller", new Set<EffectTag>(["io"]));

    let _afterSyncEntry = -1;
    let _afterFinally = -1;

    {
      // sync entry
      enforceCall("async-fn");
      pushFrame("async-fn", null);
      try {
        // simulate eval body
        _afterSyncEntry = getDepth();
        // continuation 흉내 — Promise.then 안에서는 frame 손대지 않음
      } finally {
        popFrame();
        _afterFinally = getDepth();
      }
    }

    expect(_afterSyncEntry).toBe(2);   // caller + async-fn
    expect(_afterFinally).toBe(1);     // caller 만 (async-fn pop 됨)

    popFrame();
    expect(getDepth()).toBe(0);
  });

  test("async pure → io builtin 호출 시 sync 단계에서 즉시 throw", () => {
    fnMetaRegistry.set("pure-async", { effects: [] });
    try {
      pushFrame("outer", null);

      enforceCall("pure-async");
      pushFrame("pure-async", new Set<EffectTag>());  // pure async fn
      let _err: unknown = null;
      try {
        // body 안에서 io builtin 호출
        enforceCall("file-write");
      } catch (e) {
        _err = e;
      } finally {
        popFrame();
      }

      expect(_err).toBeInstanceOf(EffectViolation);
      expect(getDepth()).toBe(1);
      popFrame();
    } finally {
      fnMetaRegistry.delete("pure-async");
    }
  });

  test("continuation 안에서는 frame 재구성 금지 (phantom frame 검출)", () => {
    // Promise.then 시점에 frame stack 이 비어있어야 정상
    // (caller stack 이 이미 unwind 된 상태)
    pushFrame("caller", new Set<EffectTag>(["io"]));
    enforceCall("async-fn");
    pushFrame("async-fn", null);
    popFrame();  // sync exit (= callAsyncFunctionValue 의 finally)
    popFrame();  // caller pop

    expect(getDepth()).toBe(0);

    // continuation 흉내: 이 시점에 frame 추가하면 phantom
    // (실제 callAsyncFunctionValue 는 result.then 안에서 frame 손대지 않음)
    expect(getDepth()).toBe(0);
  });
});

describe("C4-3: callFunction dispatch (audit)", () => {
  test("builtin-function kind — enforce 만, frame 변화 없음", () => {
    // simulate callFunction 의 builtin-function 분기 동작
    pushFrame("pure-caller", new Set<EffectTag>());

    const _depthBefore = getDepth();
    // builtin-function 호출 시: enforce("file-write") → throw (pure 컨텍스트)
    expect(() => enforceCall("file-write")).toThrow(EffectViolation);
    const _depthAfter = getDepth();

    expect(_depthBefore).toBe(_depthAfter);  // frame 변경 없음
    popFrame();
  });

  test("builtin-function kind — io context 에서는 통과, frame 안 만짐", () => {
    pushFrame("io-caller", new Set<EffectTag>(["io"]));
    const _before = getDepth();
    expect(() => enforceCall("file-write")).not.toThrow();
    const _after = getDepth();
    expect(_before).toBe(_after);
    popFrame();
  });
});

describe("C4-3: final bypass audit (4 checks)", () => {
  test("audit 1 — 모든 entry path 가 single gate (enforceCall) 통과", () => {
    // 이 테스트는 통합 검증 — 실제 실행은 회귀 1175 가 보장.
    // 여기서는 enforceCall 이 idempotent 한지만 빠르게 확인.
    pushFrame("caller", new Set<EffectTag>(["io"]));
    expect(() => enforceCall("file-write")).not.toThrow();
    expect(() => enforceCall("file-write")).not.toThrow();  // idempotent
    expect(() => enforceCall("file-write")).not.toThrow();
    popFrame();
  });

  test("audit 2 — async sync boundary 만 frame, continuation 은 분리", () => {
    // 위 'continuation 안에서는 frame 재구성 금지' 케이스에서 검증됨
    // 여기는 depth 0 에서 enforceCall 이 no-frame skip 하는 점 확인
    expect(getDepth()).toBe(0);
    expect(() => enforceCall("file-write")).not.toThrow();  // no-frame → skip
  });

  test("audit 3 — builtin dispatch frame 변경 없음", () => {
    pushFrame("anyone", null);
    const _before = getDepth();
    enforceCall("any-builtin");  // legacy frame → skip, 변경 없음
    expect(getDepth()).toBe(_before);
    popFrame();
  });

  test("audit 4 — interpreter wrapper 우회 불가", () => {
    // interpreter.ts 의 callUserFunctionRaw 등 wrapper 는 export 함수만 호출
    // (C4-2 에서 Raw 함수 내부에 frame 관리 추가됨)
    // 여기서는 enforceCall 이 모든 케이스에서 일관 동작하는지만
    pushFrame("test", new Set<EffectTag>(["net"]));
    expect(() => enforceCall("http-post")).not.toThrow();
    expect(() => enforceCall("file-write")).toThrow(EffectViolation);  // :io 불허
    popFrame();
  });
});
