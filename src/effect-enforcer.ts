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
} from "./effect-types";
import { lookupBuiltinEffects } from "./builtin-effects";

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
    effects = lookupBuiltinEffects(callee);
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
      const violation = new EffectViolation({
        fn: calleeName,
        target_effect: e,
        allowed: Array.from(cur.allowed),
        chain: getChainNames(),
        span,
      });
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
