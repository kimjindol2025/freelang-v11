// FreeLang v9: Phase 91 — 불확실성 타입 (Uncertain<T>)
// AI의 확률적 사고를 언어의 퍼스트 클래스 값으로

// ── 타입 정의 ─────────────────────────────────────────────────────────────

export interface Maybe<T> {
  readonly _tag: 'Maybe';
  readonly value: T;
  readonly confidence: number;  // 0.0 ~ 1.0
  readonly reason?: string;     // 왜 이 확률인지
}

export interface None {
  readonly _tag: 'None';
  readonly reason?: string;
}

export type Uncertain<T> = Maybe<T> | None;

// ── 생성자 ────────────────────────────────────────────────────────────────

export function maybe<T>(confidence: number, value: T, reason?: string): Maybe<T> {
  if (confidence < 0 || confidence > 1) {
    throw new RangeError(`confidence는 0.0~1.0 사이여야 합니다: ${confidence}`);
  }
  return reason !== undefined
    ? { _tag: 'Maybe', value, confidence, reason }
    : { _tag: 'Maybe', value, confidence };
}

export function none(reason?: string): None {
  return reason !== undefined
    ? { _tag: 'None', reason }
    : { _tag: 'None' };
}

// ── 판별자 ────────────────────────────────────────────────────────────────

export function isMaybe(v: any): v is Maybe<any> {
  return v !== null && typeof v === 'object' && v._tag === 'Maybe';
}

export function isNone(v: any): v is None {
  return v !== null && typeof v === 'object' && v._tag === 'None';
}

// ── 값 추출 ───────────────────────────────────────────────────────────────

/**
 * threshold 이상이면 값 반환, 아니면 null
 * default threshold = 0.5
 */
export function confident<T>(v: Uncertain<T>, threshold: number = 0.5): T | null {
  if (isNone(v)) return null;
  return v.confidence >= threshold ? v.value : null;
}

/**
 * 가장 높은 confidence를 가진 Maybe 선택
 * 빈 배열이면 none() 반환
 */
export function mostLikely<T>(options: Maybe<T>[]): Maybe<T> | None {
  if (options.length === 0) return none('후보 없음');
  return options.reduce((best, cur) =>
    cur.confidence > best.confidence ? cur : best
  );
}

/**
 * confidence >= threshold일 때만 fn 실행, 아니면 null
 */
export function whenConfident<T, R>(
  v: Uncertain<T>,
  threshold: number,
  fn: (value: T) => R
): R | null {
  if (isNone(v)) return null;
  if (v.confidence < threshold) return null;
  return fn(v.value);
}

/**
 * 두 Uncertain 값을 fn으로 조합
 * 확률은 곱셈 (독립 사건 가정)
 */
export function combine<T>(
  a: Uncertain<T>,
  b: Uncertain<T>,
  fn: (a: T, b: T) => T
): Uncertain<T> {
  if (isNone(a) || isNone(b)) return none('하나 이상이 None');
  const combinedConfidence = a.confidence * b.confidence;
  const combinedValue = fn(a.value, b.value);
  const reason = [a.reason, b.reason].filter(Boolean).join(' + ') || undefined;
  return reason !== undefined
    ? maybe(combinedConfidence, combinedValue, reason)
    : maybe(combinedConfidence, combinedValue);
}

// ── FL 인터프리터 모듈 등록용 ─────────────────────────────────────────────

type CallFnValue = (fnValue: any, args: any[]) => any;
type CallUserFn = (name: string, args: any[]) => any;

/**
 * stdlib-loader.ts에서 registerModule()로 등록할 함수 맵
 * callFunctionValue: FL function-value (fn [...] ...) 호출 콜백
 * callUserFunction: FL 이름 기반 함수 호출 콜백 ("+", "concat" 등)
 */
export function createMaybeModule(callFunctionValue?: CallFnValue, callUserFunction?: CallUserFn): Record<string, Function> {
  // FL function-value / JS 함수 / 문자열 이름 모두 호출하는 헬퍼
  function callFn(fn: any, args: any[]): any {
    if (typeof fn === 'function') return fn(...args);
    if (fn && fn.kind === 'function-value' && callFunctionValue) {
      return callFunctionValue(fn, args);
    }
    if (typeof fn === 'string' && callUserFunction) {
      return callUserFunction(fn, args);
    }
    throw new Error(`fn is not a function`);
  }

  return {
    // 생성
    "maybe": (confidence: number, value: any, reason?: string) =>
      maybe(confidence, value, reason),

    // NOTE: "none" 이름은 FL 내장 Option.None과 충돌 — "uncertain-none"으로 제공
    // 단, "none"도 override 등록 (eval-builtins보다 functions map 우선)
    "uncertain-none": (reason?: string) => none(reason),

    // 판별
    "is-maybe?": (v: any) => isMaybe(v),
    "is-none?": (v: any) => isNone(v),

    // 값 추출
    "confident": (v: Uncertain<any>, threshold: number = 0.5) =>
      confident(v, threshold),

    "most-likely": (options: any[]) => {
      if (!Array.isArray(options)) return none('입력이 배열이 아님');
      const maybes = options.filter(isMaybe);
      return mostLikely(maybes);
    },

    "when-confident": (v: Uncertain<any>, threshold: number, fn: any) =>
      whenConfident(v, threshold, (val) => callFn(fn, [val])),

    // 조합
    "combine": (a: Uncertain<any>, b: Uncertain<any>, fn: any) =>
      combine(a, b, (x, y) => callFn(fn, [x, y])),

    // 속성 접근
    "maybe-confidence": (v: any): number | null =>
      isMaybe(v) ? v.confidence : null,

    "maybe-value": (v: any): any =>
      isMaybe(v) ? v.value : null,

    "maybe-reason": (v: any): string | null =>
      isMaybe(v) && v.reason !== undefined ? v.reason : null,
  };
}
