// C4-2: TCO/Raw frame swap per-iteration invariant (semantic boundary)
//
// 핵심 검증:
//   - per-iteration push/pop pairing 정확성
//   - frame swap 시 effect chain trace 정확
//   - TailCall 전환 시 frame leak 없음
//   - throw path 에서도 finally 로 frame 정리

import {
  pushFrame,
  popFrame,
  enforceCall,
  getDepth,
  getChainNames,
  getCurrentFrame,
  _resetForTesting,
} from "../effect-enforcer";
import { fnMetaRegistry } from "../eval-special-forms";
import { EffectViolation, EffectTag } from "../effect-types";

beforeEach(() => {
  _resetForTesting();
});

describe("C4-2: TCO/Raw per-iteration frame invariant (의미론 검증)", () => {
  test("simulated TCO loop — 매 iteration pop+push 정확성", () => {
    // outer caller frame
    pushFrame("outer-caller", new Set<EffectTag>(["io"]));

    // simulate: TCO loop with 3 swaps
    let _haveFrame = false;
    try {
      for (const fnName of ["fn-a", "fn-b", "fn-c"]) {
        if (_haveFrame) popFrame();
        enforceCall(fnName);  // outer-caller frame 기준
        pushFrame(fnName, null);  // legacy frame (메타 없음 가정)
        _haveFrame = true;
        // simulate body — getDepth = 2 (outer + current iter)
        expect(getDepth()).toBe(2);
        expect(getCurrentFrame()?.fnName).toBe(fnName);
      }
    } finally {
      if (_haveFrame) popFrame();
    }
    expect(getDepth()).toBe(1);  // outer-caller frame 유지
    popFrame();
    expect(getDepth()).toBe(0);
  });

  test("TCO throw path — 마지막 iteration 에서 throw 해도 frame 정확히 정리", () => {
    pushFrame("pure-outer", new Set<EffectTag>());  // pure caller

    let _haveFrame = false;
    let _err: unknown = null;
    try {
      for (const fnName of ["safe-fn", "another-safe-fn"]) {
        if (_haveFrame) popFrame();
        enforceCall(fnName);
        pushFrame(fnName, new Set<EffectTag>());  // pure inner
        _haveFrame = true;
      }
      // 마지막 iteration 안에서 io 호출 → throw
      enforceCall("file-write");  // pure 컨텍스트에서 :io → throw
    } catch (e) {
      _err = e;
    } finally {
      if (_haveFrame) popFrame();
    }

    expect(_err).toBeInstanceOf(EffectViolation);
    expect(getDepth()).toBe(1);  // outer 만 남음
    popFrame();
    expect(getDepth()).toBe(0);
  });

  test("anonymous function-value TCO — name 없으면 <anonymous>", () => {
    pushFrame("caller", null);
    pushFrame("<anonymous>", null);
    expect(getCurrentFrame()?.fnName).toBe("<anonymous>");
    expect(getChainNames()).toEqual(["caller", "<anonymous>"]);
    popFrame();
    popFrame();
  });

  test("chain trace — 매 iteration 마다 갱신", () => {
    pushFrame("root", null);

    let _haveFrame = false;
    try {
      for (const fnName of ["step-1", "step-2", "step-3"]) {
        if (_haveFrame) popFrame();
        enforceCall(fnName);
        pushFrame(fnName, null);
        _haveFrame = true;

        const chain = getChainNames();
        // chain 길이는 항상 2 (root + current iter)
        expect(chain.length).toBe(2);
        expect(chain[0]).toBe("root");
        expect(chain[1]).toBe(fnName);
      }
    } finally {
      if (_haveFrame) popFrame();
    }
    popFrame();
  });

  test("Raw 경로 — 단일 push/pop (loop 없음)", () => {
    fnMetaRegistry.set("raw-fn", { effects: [] });
    try {
      pushFrame("outer", null);

      // simulate Raw 경로
      enforceCall("raw-fn");
      pushFrame("raw-fn", new Set<EffectTag>());
      try {
        // body
        expect(getDepth()).toBe(2);
        expect(getCurrentFrame()?.fnName).toBe("raw-fn");
        // 내부에서 io builtin 호출 → throw
        expect(() => enforceCall("file-write")).toThrow(EffectViolation);
      } finally {
        popFrame();
      }
      expect(getDepth()).toBe(1);
      popFrame();
    } finally {
      fnMetaRegistry.delete("raw-fn");
    }
  });

  test("TCO 위임 (string→function-value) — 위임 전 frame 정리", () => {
    // callFunctionValueTCO 가 callUserFunctionTCO 로 위임할 때
    // 위임 전 _haveFrame 정리해야 callUserFunctionTCO 가 자체 frame 관리
    pushFrame("outer", null);

    let _haveFrame = false;
    // first iteration
    enforceCall("step-1");
    pushFrame("step-1", null);
    _haveFrame = true;

    expect(getDepth()).toBe(2);

    // 위임 시뮬레이션
    if (_haveFrame) {
      popFrame();
      _haveFrame = false;
    }

    expect(getDepth()).toBe(1);  // outer 만 남음 — 위임 받은 쪽이 자체 push
    popFrame();
  });

  test("2,000,000 iteration 시뮬레이션 (작은 규모 1만으로 검증)", () => {
    // 실제로는 2M loop 인데 jest 시간상 1만으로
    pushFrame("driver", null);
    let _haveFrame = false;
    try {
      for (let i = 0; i < 10_000; i++) {
        if (_haveFrame) popFrame();
        enforceCall("tight-loop-fn");
        pushFrame("tight-loop-fn", null);
        _haveFrame = true;
      }
    } finally {
      if (_haveFrame) popFrame();
    }
    expect(getDepth()).toBe(1);
    popFrame();
    expect(getDepth()).toBe(0);
  });
});
