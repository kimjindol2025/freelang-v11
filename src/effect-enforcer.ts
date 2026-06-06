// Runtime Effect Enforcement — enforcer engine (C3)
// 설계: docs/DESIGN-EFFECT-ENFORCEMENT.md
// hook 미연결 단계. interpreter는 아직 이 모듈을 import 하지 않음.
//
// 사용 패턴 (try/finally invariant 필수):
//
//   pushFrame(fnName, allowed, span);
//   try {
//     enforceCall(callee, callSpan);
//     ...body...
//   } finally {
//     popFrame();
//   }
//
// invariant 깨지면 stack leak가 가장 위험한 failure mode다.

import {
  EffectTag,
  EffectFrame,
  EffectSpan,
  EffectViolation,
  EFFECT_TAGS,
} from "./effect-types";
import { lookupBuiltinEffects } from "./builtin-effects";
import { fnMetaRegistry } from "./eval-special-forms";
import { recordEvent } from "./runtime-events";

const _validTags: ReadonlySet<string> = new Set(EFFECT_TAGS);

/**
 * 메타에서 추출된 string[] 을 EffectTag Set 으로 변환.
 *
 * design §4-D (lock): parse failure → throw 금지, null 반환 (legacy fallback).
 * 초기 rollout 에서 metadata strictness 는 bootstrap destabilizer.
 */
function parseEffectTags(
  raw: readonly string[] | undefined
): ReadonlySet<EffectTag> | null {
  if (!raw) return null;
  if (!Array.isArray(raw)) return null;
  const out = new Set<EffectTag>();
  for (const r of raw) {
    if (typeof r !== "string") return null;
    const s = r.startsWith(":") ? r.slice(1) : r;
    if (!_validTags.has(s)) return null;
    out.add(s as EffectTag);
  }
  return Object.freeze(out) as ReadonlySet<EffectTag>;
}

/**
 * 함수 진입 시 frame 의 allowed set 결정.
 *   메타 부재         → null (legacy unrestricted, design §4-C)
 *   메타 있고 parse OK → ReadonlySet<EffectTag>
 *   메타 있으나 parse 실패 → null (legacy fallback, design §4-D)
 */
export function resolveFnAllowed(
  name: string
): ReadonlySet<EffectTag> | null {
  const meta = fnMetaRegistry.get(name);
  if (!meta || meta.effects === undefined) return null;
  return parseEffectTags(meta.effects);
}

/**
 * 호출 대상 effect 조회 (enforceCall 내부용).
 * builtin registry 우선, 없으면 user fn meta.
 *
 *   undefined  registry/메타 모두 없음 → unknown (skip)
 *   null       explicit-legacy or parse fail → skip
 *   Set        typed → enforce
 */
function resolveCalleeEffects(
  name: string
): ReadonlySet<EffectTag> | null | undefined {
  const b = lookupBuiltinEffects(name);
  if (b !== undefined) return b;
  const meta = fnMetaRegistry.get(name);
  if (!meta || meta.effects === undefined) return undefined;
  return parseEffectTags(meta.effects);
}

const TRACE = process.env.EFFECT_STACK_TRACE === "1";
const TRACE_PREFIX = "[effect-stack]";

const _stack: EffectFrame[] = [];

function trace(...parts: unknown[]): void {
  if (!TRACE) return;
  // eslint-disable-next-line no-console
  console.error(TRACE_PREFIX, ...parts);
}

export function pushFrame(
  fnName: string,
  allowed: ReadonlySet<EffectTag> | null,
  span?: EffectSpan
): void {
  const frame: EffectFrame = Object.freeze({ fnName, allowed, span });
  _stack.push(frame);
  trace(
    "push",
    fnName,
    "depth=" + _stack.length,
    "allowed=",
    allowed === null ? "null" : "[" + [...allowed].join(",") + "]"
  );
}

export function popFrame(): void {
  if (_stack.length === 0) {
    throw new Error(
      "[effect-stack] popFrame underflow — stack already empty (push/pop pairing 깨짐)"
    );
  }
  const frame = _stack.pop()!;
  trace("pop", frame.fnName, "depth=" + _stack.length);
}

export function getDepth(): number {
  return _stack.length;
}

export function getCurrentFrame(): EffectFrame | undefined {
  return _stack[_stack.length - 1];
}

export function getChainNames(): string[] {
  return _stack.map((f) => f.fnName);
}

export function _resetForTesting(): void {
  _stack.length = 0;
}

export type Callee = {
  readonly name: string;
  readonly effects?: ReadonlySet<EffectTag> | null;
};

/**
 * 3상태 의미론 (dec-006 / dec-007):
 *   registry.get(name) === undefined  → unknown builtin → allow (compat)
 *   registry.get(name) === null       → explicit-legacy → allow (compat)
 *   registry.get(name) instanceof Set → typed → enforce
 *
 * 현재 frame.allowed === null (legacy frame) 도 skip.
 */
export function enforceCall(
  callee: Callee | string,
  span?: EffectSpan
): void {
  const cur = _stack[_stack.length - 1];
  if (cur === undefined) {
    trace("skip", "no-frame");
    return;
  }
  if (cur.allowed === null) {
    trace("skip", "legacy-frame", cur.fnName);
    return;
  }

  let calleeName: string;
  let effects: ReadonlySet<EffectTag> | null | undefined;
  if (typeof callee === "string") {
    calleeName = callee;
    effects = resolveCalleeEffects(callee);
  } else {
    calleeName = callee.name;
    effects = callee.effects;
  }

  if (effects === undefined) {
    trace("skip", "unknown-builtin", calleeName);
    return;
  }
  if (effects === null) {
    trace("skip", "explicit-legacy", calleeName);
    return;
  }

  for (const e of effects) {
    if (!cur.allowed.has(e)) {
      const allowedArr = Array.from(cur.allowed);
      const chainArr = getChainNames();
      const violation = new EffectViolation({
        fn: calleeName,
        target_effect: e,
        allowed: allowedArr,
        chain: chainArr,
        span,
      });

      // C5: emit runtime event (fire-and-forget — record 실패해도 throw 진행)
      // label=calleeName / expr=:target_effect 로 fingerprint 차별화
      // (동일 violation 반복은 collapse, 다른 violation 은 별도 이벤트)
      try {
        recordEvent({
          type: "effect-violation",
          timestamp: Date.now(),
          message: violation.message,
          label: calleeName,
          expr: ":" + e,
          fn: calleeName,
          target_effect: e,
          allowed: allowedArr,
          chain: chainArr,
          file: span?.file,
          line: span?.line,
        });
      } catch {
        // fire-and-forget — record 실패는 본 enforcement 막지 않음
      }

      trace(
        "violation",
        calleeName,
        "target=:" + e,
        "allowed=[" + [...cur.allowed].join(",") + "]"
      );
      throw violation;
    }
  }
  trace("ok", calleeName);
}
