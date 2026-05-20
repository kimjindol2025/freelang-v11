// C5: runtime-events 연동 검증
//
// 핵심:
//   1. EffectViolation throw 시 recordEvent("effect-violation") 1건 기록
//   2. event payload 가 design §8-B 명세와 일치
//   3. non-violation 경우 effect-violation 이벤트 없음
//   4. fire-and-forget — recordEvent 실패해도 본 throw 는 진행 (현재는 try/catch 가드)

import {
  pushFrame,
  popFrame,
  enforceCall,
  _resetForTesting,
} from "../effect-enforcer";
import {
  getEvents,
  clearEvents,
  RuntimeEvent,
} from "../runtime-events";
import { EffectViolation, EffectTag } from "../effect-types";

function effectViolations(): RuntimeEvent[] {
  return getEvents().filter((e) => e.type === "effect-violation");
}

beforeEach(() => {
  _resetForTesting();
  clearEvents();
});

describe("C5: runtime-events effect-violation 연동", () => {
  test("EffectViolation throw 시 effect-violation 이벤트 1건 기록", () => {
    pushFrame("pure-caller", new Set<EffectTag>());
    expect(() => enforceCall("file-write")).toThrow(EffectViolation);
    popFrame();

    const evs = effectViolations();
    expect(evs.length).toBe(1);
  });

  test("event payload 가 §8-B 와 일치 (fn/target_effect/allowed/chain)", () => {
    pushFrame("outer", new Set<EffectTag>(["net"]));
    pushFrame("inner", new Set<EffectTag>());  // pure
    expect(() => enforceCall("file-write")).toThrow(EffectViolation);

    const ev = effectViolations()[0];
    expect(ev.fn).toBe("file-write");
    expect(ev.target_effect).toBe("io");
    expect(ev.allowed).toEqual([]);
    expect(ev.chain).toEqual(["outer", "inner"]);
    expect(ev.severity).toBe("error");
    expect(typeof ev.eventId).toBe("number");
    expect(typeof ev.timestamp).toBe("number");
    expect(typeof ev.message).toBe("string");
    expect(ev.message).toContain("file-write");

    popFrame();
    popFrame();
  });

  test("event span — file/line 매핑", () => {
    pushFrame("pure", new Set<EffectTag>());
    expect(() =>
      enforceCall("file-write", { file: "app/report.fl", line: 82, col: 4 })
    ).toThrow(EffectViolation);

    const ev = effectViolations()[0];
    expect(ev.file).toBe("app/report.fl");
    expect(ev.line).toBe(82);

    popFrame();
  });

  test("io→io PASS — effect-violation 이벤트 없음", () => {
    pushFrame("io-ctx", new Set<EffectTag>(["io"]));
    expect(() => enforceCall("file-write")).not.toThrow();
    popFrame();

    expect(effectViolations().length).toBe(0);
  });

  test("legacy frame — effect-violation 이벤트 없음", () => {
    pushFrame("legacy", null);
    expect(() => enforceCall("file-write")).not.toThrow();
    popFrame();

    expect(effectViolations().length).toBe(0);
  });

  test("연속 동일 violation 은 collapse (fingerprint dedup)", () => {
    pushFrame("pure", new Set<EffectTag>());
    expect(() => enforceCall("file-write")).toThrow();
    expect(() => enforceCall("file-write")).toThrow();
    expect(() => enforceCall("file-write")).toThrow();
    popFrame();

    const evs = effectViolations();
    expect(evs.length).toBe(1);  // collapse 됨
    expect(evs[0].count).toBeGreaterThanOrEqual(2);
    expect(evs[0].collapsed).toBe(true);
  });

  test("서로 다른 violation 은 별도 이벤트", () => {
    pushFrame("pure", new Set<EffectTag>());
    expect(() => enforceCall("file-write")).toThrow();
    expect(() => enforceCall("http-post")).toThrow();
    popFrame();

    const evs = effectViolations();
    expect(evs.length).toBe(2);
    expect(evs[0].target_effect).toBe("io");
    expect(evs[1].target_effect).toBe("net");
  });

  test("deterministic message format — eventId/timestamp 외 payload 안정성", () => {
    pushFrame("test-pure", new Set<EffectTag>());
    expect(() =>
      enforceCall("file-write", { file: "x.fl", line: 1, col: 1 })
    ).toThrow();
    popFrame();

    const ev = effectViolations()[0];
    // payload 핵심 필드는 결정적 (입력만 의존)
    expect({
      type: ev.type,
      severity: ev.severity,
      fn: ev.fn,
      target_effect: ev.target_effect,
      allowed: ev.allowed,
      chain: ev.chain,
      file: ev.file,
      line: ev.line,
    }).toEqual({
      type: "effect-violation",
      severity: "error",
      fn: "file-write",
      target_effect: "io",
      allowed: [],
      chain: ["test-pure"],
      file: "x.fl",
      line: 1,
    });
  });
});
