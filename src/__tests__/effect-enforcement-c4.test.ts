// C4-1: effect enforcement unit (fnMetaRegistry 통합 + frame stack)
//
// 목적: hook 연결된 enforcer 동작 검증.
// 전체 통합 시나리오(.fl 코드 실행)는 C5/C6 에서 다룸.

import {
  pushFrame,
  popFrame,
  enforceCall,
  resolveFnAllowed,
  _resetForTesting,
  getDepth,
} from "../effect-enforcer";
import { fnMetaRegistry } from "../eval-special-forms";
import { EffectViolation, EffectTag } from "../effect-types";

beforeEach(() => {
  _resetForTesting();
});

describe("C4-1 enforcement — fnMetaRegistry 통합", () => {
  test("builtin :io 호출은 pure caller 에서 throw", () => {
    pushFrame("pure-caller", new Set<EffectTag>());
    expect(() => enforceCall("file-write")).toThrow(EffectViolation);
    popFrame();
    expect(getDepth()).toBe(0);
  });

  test("builtin :io 호출은 io caller 에서 통과", () => {
    pushFrame("io-caller", new Set<EffectTag>(["io"]));
    expect(() => enforceCall("file-write")).not.toThrow();
    popFrame();
  });

  test("user fn (meta=:io) 도 pure caller 에서 throw", () => {
    fnMetaRegistry.set("io-user-fn", { effects: ["io"] });
    try {
      pushFrame("pure-caller", new Set<EffectTag>());
      expect(() => enforceCall("io-user-fn")).toThrow(EffectViolation);
      popFrame();
    } finally {
      fnMetaRegistry.delete("io-user-fn");
    }
  });

  test("user fn (meta=[]) → pure 컨텍스트, pure caller 에서 통과", () => {
    fnMetaRegistry.set("my-pure-fn", { effects: [] });
    try {
      pushFrame("pure-caller", new Set<EffectTag>());
      expect(() => enforceCall("my-pure-fn")).not.toThrow();
      popFrame();
    } finally {
      fnMetaRegistry.delete("my-pure-fn");
    }
  });

  test("user fn (meta=:io) 의 allowed set 정확히 추출", () => {
    fnMetaRegistry.set("io-fn", { effects: ["io"] });
    try {
      const allowed = resolveFnAllowed("io-fn");
      expect(allowed).not.toBeNull();
      expect([...allowed!]).toEqual(["io"]);
    } finally {
      fnMetaRegistry.delete("io-fn");
    }
  });

  test("메타 부재 → null (legacy unrestricted, dec-006)", () => {
    expect(resolveFnAllowed("never-registered-fn")).toBeNull();
  });

  test("parse failure → null (legacy fallback, design §4-D)", () => {
    fnMetaRegistry.set("bad-meta-fn", { effects: ["bogus-tag-xyz"] as any });
    try {
      expect(resolveFnAllowed("bad-meta-fn")).toBeNull();
    } finally {
      fnMetaRegistry.delete("bad-meta-fn");
    }
  });

  test("`:io` 형태(colon prefix) 메타도 파싱", () => {
    fnMetaRegistry.set("colon-fn", { effects: [":io"] });
    try {
      const allowed = resolveFnAllowed("colon-fn");
      expect(allowed).not.toBeNull();
      expect([...allowed!]).toEqual(["io"]);
    } finally {
      fnMetaRegistry.delete("colon-fn");
    }
  });

  test("legacy frame (allowed=null) 안에서는 io builtin 도 허용", () => {
    pushFrame("legacy-fn", null);
    expect(() => enforceCall("file-write")).not.toThrow();
    popFrame();
  });

  test("popFrame underflow 즉시 throw (stack leak 방지)", () => {
    expect(() => popFrame()).toThrow(/underflow/);
  });

  test("EffectViolation throw 시 frame depth 유지(=enforce는 push 전에 호출)", () => {
    pushFrame("pure", new Set<EffectTag>());
    expect(() => enforceCall("file-write")).toThrow(EffectViolation);
    // enforce 가 push 전이라면 caller frame 그대로 (depth=1)
    expect(getDepth()).toBe(1);
    popFrame();
    expect(getDepth()).toBe(0);
  });
});
