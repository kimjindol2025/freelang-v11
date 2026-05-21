// C8-4: L0/L1 taxonomy consistency — drift 회귀 차단 (SPEC.airc dec-011 LOCK)
//
// 본 테스트는 BUILTIN_EFFECTS (L1 canonical truth) 와 EFFECT_CATALOG (L0
// compatibility) 사이의 정합성을 자동 검증한다. 신규 builtin 추가 시 L0 등록을
// 잊거나 alias_table 이 SPEC.airc 와 어긋나면 이 테스트가 fail 하여 drift 를
// 차단한다.

import { BUILTIN_EFFECTS } from "../builtin-effects";
import { EFFECT_CATALOG } from "../eval-special-forms";
import { toCanonical, L0_TO_L1 } from "../effect-aliases";
import type { EffectTag } from "../effect-types";

describe("C8-4: L0/L1 taxonomy consistency (dec-011)", () => {
  describe("(1) hole — BUILTIN_EFFECTS 전 키가 EFFECT_CATALOG 에 등록", () => {
    const builtinKeys = [...BUILTIN_EFFECTS.keys()];

    it("BUILTIN_EFFECTS 가 비어있지 않다", () => {
      expect(builtinKeys.length).toBeGreaterThan(0);
    });

    it.each(builtinKeys)(
      "EFFECT_CATALOG has key '%s'",
      (key) => {
        expect(EFFECT_CATALOG.has(key)).toBe(true);
      }
    );
  });

  describe("(2) mismatch — toCanonical(EFFECT_CATALOG[k]) ∈ BUILTIN_EFFECTS[k]", () => {
    type Row = readonly [string, ReadonlySet<EffectTag> | null, string];
    const rows: Row[] = [];
    for (const [k, l1] of BUILTIN_EFFECTS) {
      const l0 = EFFECT_CATALOG.get(k);
      if (l0 === undefined) continue; // (1) 에서 잡힘
      rows.push([k, l1, l0]);
    }

    it("검사 대상이 비어있지 않다", () => {
      expect(rows.length).toBeGreaterThan(0);
    });

    it.each(rows)(
      "%s — L0='%s' (canonical) 가 L1 effect set 에 포함",
      (key, l1, l0) => {
        if (l1 === null) return; // explicit-legacy untyped — skip
        const canonical = toCanonical(l0);
        expect(canonical).toBeDefined();
        if (canonical !== undefined) {
          expect(l1.has(canonical)).toBe(true);
        }
      }
    );
  });

  describe("(3) L0 어휘 폭발 차단 — EFFECT_CATALOG 의 모든 L0 value 는 alias_table 안", () => {
    const uniq = new Set<string>();
    for (const v of EFFECT_CATALOG.values()) uniq.add(v);
    const cases = [...uniq].sort();

    it("L0 어휘 종류 === 10 (dec-005 6종 어휘 lock 의 운영 메커니즘)", () => {
      // L0 vocabulary 는 alias_table 정의역과 정확히 일치해야 한다.
      // 신규 L0 어휘 등장 = enforce dilution 신호 → fail
      expect(cases.length).toBe(10);
    });

    it.each(cases)("L0 어휘 '%s' 가 alias_table 정의역", (l0) => {
      expect(L0_TO_L1.has(l0)).toBe(true);
    });
  });

  describe("(4) SPEC.airc dec-011 alias_table === effect-aliases.L0_TO_L1 (drift 차단)", () => {
    it("L0_TO_L1.size === 10", () => {
      expect(L0_TO_L1.size).toBe(10);
    });

    // SPEC.airc dec-011 alias_table 의 코드 사본 — SPEC 변경 시 본 배열도 동시 수정 필수
    const specAliasTable: ReadonlyArray<readonly [string, EffectTag]> = [
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

    it.each(specAliasTable)(
      "SPEC dec-011: %s → %s",
      (l0, l1) => {
        expect(L0_TO_L1.get(l0)).toBe(l1);
      }
    );

    it("코드의 L0_TO_L1 키 집합 === SPEC alias_table 키 집합 (양방향)", () => {
      const codeKeys = [...L0_TO_L1.keys()].sort();
      const specKeys = specAliasTable.map(([k]) => k).sort();
      expect(codeKeys).toEqual(specKeys);
    });
  });

  describe("(5) 운영 invariant — L1 codomain 은 EffectTag 6종 중 io/net/process/time/random 5종 한정", () => {
    it("toCanonical 결과는 pure 가 될 수 없다 (L0 는 effect 발생 함수만 등록)", () => {
      const codomain = new Set<EffectTag>();
      for (const [, l1] of L0_TO_L1) codomain.add(l1);
      expect(codomain.has("pure" as EffectTag)).toBe(false);
      expect([...codomain].sort()).toEqual(["io", "net", "process", "random", "time"]);
    });
  });
});
