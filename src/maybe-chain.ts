// FreeLang v9 Phase 112: Maybe Chain — 확률 자동 전파
// (maybe-chain $a $b (fn [x y] (+ x y))) → maybe(0.8*0.9, x+y)
// (maybe-map $m fn) → maybe(same-confidence, fn(value))
// (maybe-bind $m fn) → fn(value) 가 maybe를 반환하면 확률 곱

import { Maybe, None, Uncertain, maybe, none, isMaybe, isNone } from './maybe-type';

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function makeMaybe<T>(confidence: number, value: T): Maybe<T> {
  return maybe(clamp(confidence), value);
}

function makeNone<T>(reason?: string): None {
  return none(reason);
}

// ── map: 값 변환, 확률 유지 ───────────────────────────────────────────────

export function maybeMap<T, U>(m: Uncertain<T>, fn: (v: T) => U): Uncertain<U> {
  if (isNone(m)) return makeNone<U>('none 입력');
  return makeMaybe(m.confidence, fn(m.value));
}

// ── bind (flatMap): fn이 maybe를 반환 → 확률 곱 ──────────────────────────

export function maybeBind<T, U>(m: Uncertain<T>, fn: (v: T) => Uncertain<U>): Uncertain<U> {
  if (isNone(m)) return makeNone<U>('none 입력');
  const result = fn(m.value);
  if (isNone(result)) return makeNone<U>('fn이 none 반환');
  return makeMaybe(m.confidence * result.confidence, result.value);
}

// ── chain: 여러 maybe 값을 결합 (확률은 곱, 값은 fn으로 합성) ─────────────

export function maybeChain<T>(maybes: Uncertain<T>[], fn: (...values: T[]) => T): Uncertain<T> {
  if (maybes.some(m => isNone(m))) return makeNone<T>('하나 이상이 none');
  const somes = maybes as Maybe<T>[];
  const confidence = somes.reduce((acc, m) => acc * m.confidence, 1);
  const values = somes.map(m => m.value);
  return makeMaybe(confidence, fn(...values));
}

// ── filter: 조건 불만족 시 none ───────────────────────────────────────────

export function maybeFilter<T>(m: Uncertain<T>, pred: (v: T) => boolean): Uncertain<T> {
  if (isNone(m)) return makeNone<T>('none 입력');
  if (!pred(m.value)) return makeNone<T>('조건 불만족');
  return m;
}

// ── combine: 두 maybe 값 합성 — 확률 곱, 값 합성 ────────────────────────

export function maybeCombine<A, B, C>(
  a: Uncertain<A>,
  b: Uncertain<B>,
  fn: (a: A, b: B) => C
): Uncertain<C> {
  if (isNone(a) || isNone(b)) return makeNone<C>('하나 이상이 none');
  return makeMaybe((a as Maybe<A>).confidence * (b as Maybe<B>).confidence,
    fn((a as Maybe<A>).value, (b as Maybe<B>).value));
}

// ── select: 가장 신뢰도 높은 maybe 선택 ──────────────────────────────────

export function maybeSelect<T>(maybes: Uncertain<T>[]): Uncertain<T> {
  const valid = maybes.filter(m => isMaybe(m)) as Maybe<T>[];
  if (valid.length === 0) return makeNone<T>('후보 없음');
  return valid.reduce((best, curr) => curr.confidence > best.confidence ? curr : best);
}

// ── eval-builtins.ts에서 등록할 함수 맵 ──────────────────────────────────

type CallFnValue = (fnValue: any, args: any[]) => any;

export function createMaybeChainModule(callFunctionValue?: CallFnValue): Record<string, Function> {
  function callFn(fn: any, args: any[]): any {
    if (typeof fn === 'function') return fn(...args);
    if (fn && fn.kind === 'function-value' && callFunctionValue) {
      return callFunctionValue(fn, args);
    }
    throw new Error('fn은 함수가 아닙니다');
  }

  return {
    'maybe-map': (m: Uncertain<any>, fn: any) =>
      maybeMap(m, (v) => callFn(fn, [v])),

    'maybe-bind': (m: Uncertain<any>, fn: any) =>
      maybeBind(m, (v) => callFn(fn, [v])),

    'maybe-chain': (maybes: Uncertain<any>[], fn: any) =>
      maybeChain(maybes, (...vals) => callFn(fn, vals)),

    'maybe-filter': (m: Uncertain<any>, pred: any) =>
      maybeFilter(m, (v) => callFn(pred, [v])),

    'maybe-combine': (a: Uncertain<any>, b: Uncertain<any>, fn: any) =>
      maybeCombine(a, b, (x, y) => callFn(fn, [x, y])),

    'maybe-select': (maybes: Uncertain<any>[]) =>
      maybeSelect(maybes),
  };
}
