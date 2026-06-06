// C8-2 unit test — SPEC.airc dec-011 alias_table 망라

import {
  toCanonical,
  isKnownL0,
  L0_VOCABULARY,
  L0_TO_L1,
} from "../effect-aliases";

describe("C8-2: L0 → L1 canonical alias (dec-011)", () => {
  describe("alias_table 10 entries 망라", () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["http", "net"],
      ["file-read", "io"],
      ["file-write", "io"],
      ["db-read", "io"],
      ["db-write", "io"],
      ["shell", "process"],
      ["server", "net"],
      ["io", "io"],
      ["time", "time"],
      ["random", "random"],
    ];
    it.each(cases)("toCanonical(%s) === %s", (l0, l1) => {
      expect(toCanonical(l0)).toBe(l1);
    });
  });

  describe("정의 경계", () => {
    it("L0_VOCABULARY size === 10 (어휘 폭발 차단)", () => {
      expect(L0_VOCABULARY.size).toBe(10);
    });

    it("L0_TO_L1 size === 10", () => {
      expect(L0_TO_L1.size).toBe(10);
    });

    it("L0 에는 'pure' 가 없다 — pure 는 L1-only (effect 발생 함수만 L0 등록)", () => {
      expect(isKnownL0("pure")).toBe(false);
      expect(toCanonical("pure")).toBeUndefined();
    });

    it("unknown 이름은 undefined", () => {
      expect(toCanonical("unknown-effect")).toBeUndefined();
      expect(toCanonical("")).toBeUndefined();
    });

    it("L1 어휘를 L0 로 오인하지 않는다 (net/process 는 L0 미등록)", () => {
      expect(isKnownL0("net")).toBe(false);
      expect(isKnownL0("process")).toBe(false);
    });
  });

  describe("isKnownL0", () => {
    it("등록된 L0 이름은 true", () => {
      expect(isKnownL0("http")).toBe(true);
      expect(isKnownL0("file-read")).toBe(true);
      expect(isKnownL0("server")).toBe(true);
    });

    it("미등록 이름은 false", () => {
      expect(isKnownL0("xyz")).toBe(false);
    });
  });

  describe("매핑 결과 EffectTag 집합", () => {
    it("alias 결과는 io/net/process/time/random 5종에 한정 (pure 제외)", () => {
      const codomain = new Set<string>();
      for (const [, l1] of L0_TO_L1) codomain.add(l1);
      expect([...codomain].sort()).toEqual([
        "io",
        "net",
        "process",
        "random",
        "time",
      ]);
    });
  });
});
