// Runtime Effect Enforcement — builtin registry (C2)
// 설계: docs/DESIGN-EFFECT-ENFORCEMENT.md §7
// hook 미연결 단계.
//
// 3상태 의미론:
//   undefined  — registry miss (legacy compat, skip)
//   null       — explicit-legacy untyped (등록은 됐으나 분류 보류, skip)
//   ReadonlySet<EffectTag>  — typed (enforce 대상)

import type { EffectTag } from "./effect-types";

type BuiltinEntry = ReadonlySet<EffectTag> | null;

function tagged(...tags: EffectTag[]): ReadonlySet<EffectTag> {
  return Object.freeze(new Set<EffectTag>(tags)) as ReadonlySet<EffectTag>;
}

const _entries: ReadonlyArray<readonly [string, BuiltinEntry]> = [
  // :io — 파일·콘솔·DB
  ["file-write", tagged("io")],
  ["file-read", tagged("io")],
  ["file-append", tagged("io")],
  ["file-delete", tagged("io")],
  ["file-append-line", tagged("io")],
  ["file-exists", tagged("io")],
  ["db-exec", tagged("io")],
  ["db-query", tagged("io")],
  ["db-transaction", tagged("io")],
  ["println", tagged("io")],
  ["print", tagged("io")],

  // :net
  ["http-get", tagged("net")],
  ["http-post", tagged("net")],
  ["ws-send", tagged("net")],
  ["server-start", tagged("net")],

  // :process
  ["shell-exec", tagged("process")],
  ["process-spawn", tagged("process")],

  // :time
  ["now", tagged("time")],
  ["now-ms", tagged("time")],
  ["sleep", tagged("time")],

  // :random
  ["rand", tagged("random")],
  ["rand-int", tagged("random")],
  ["uuid", tagged("random")],
];

const _map: Map<string, BuiltinEntry> = new Map(_entries);

export const BUILTIN_EFFECTS: ReadonlyMap<string, BuiltinEntry> = _map;

export function lookupBuiltinEffects(
  name: string
): BuiltinEntry | undefined {
  return _map.get(name);
}

export function isBuiltinRegistered(name: string): boolean {
  return _map.has(name);
}
