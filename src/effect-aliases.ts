// C8-2: L0 → L1 canonical alias mapping (SPEC.airc dec-011 LOCK)
//
// L0 (EFFECT_CATALOG, eval-special-forms.ts) 는 compatibility-only taxonomy.
// L1 (BUILTIN_EFFECTS + EffectTag, effect-types.ts/builtin-effects.ts) 가
// canonical effect enforcement source of truth.
//
// 본 모듈은 단방향 매핑 (L0 → L1) 만 제공. 양방향 bridge 금지 (C 안 거부).
// alias_table 은 SPEC.airc dec-011 노드와 1:1 일치해야 한다.

import type { EffectTag } from "./effect-types";

const _entries: ReadonlyArray<readonly [string, EffectTag]> = [
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

const _map: ReadonlyMap<string, EffectTag> = new Map(_entries);

export const L0_TO_L1: ReadonlyMap<string, EffectTag> = _map;

export const L0_VOCABULARY: ReadonlySet<string> = Object.freeze(
  new Set(_map.keys())
) as ReadonlySet<string>;

export function toCanonical(l0: string): EffectTag | undefined {
  return _map.get(l0);
}

export function isKnownL0(name: string): boolean {
  return _map.has(name);
}
