// lazy-seq.ts — FreeLang v9 Phase 69: 레이지 시퀀스 (무한 스트림)
// iterate / range / filter-lazy / map-lazy / drop / take

export const LAZY_SEQ = Symbol("LAZY_SEQ");

export interface LazySeq {
  [LAZY_SEQ]: true;
  head: () => any;            // 첫 번째 값 (thunk)
  tail: () => LazySeq | null; // 나머지 (thunk)
  _headCache?: any;
  _tailCache?: LazySeq | null;
  _headEvaluated?: boolean;
  _tailEvaluated?: boolean;
}

export function lazySeq(head: () => any, tail: () => LazySeq | null): LazySeq {
  return { [LAZY_SEQ]: true, head, tail };
}

export function isLazySeq(v: any): v is LazySeq {
  return v != null && typeof v === "object" && v[LAZY_SEQ] === true;
}

// 메모이제이션된 head 접근
export function lazyHead(seq: LazySeq): any {
  if (!seq._headEvaluated) {
    seq._headCache = seq.head();
    seq._headEvaluated = true;
  }
  return seq._headCache;
}

// 메모이제이션된 tail 접근
export function lazyTail(seq: LazySeq): LazySeq | null {
  if (!seq._tailEvaluated) {
    seq._tailCache = seq.tail();
    seq._tailEvaluated = true;
  }
  return seq._tailCache ?? null;
}

// take: 앞에서 n개만 꺼내어 배열로 반환 (무한 시퀀스 안전)
export function take(n: number, seq: LazySeq | any[] | null): any[] {
  if (Array.isArray(seq)) return seq.slice(0, n);
  const result: any[] = [];
  let current: LazySeq | null = seq;
  while (current && result.length < n) {
    result.push(lazyHead(current));
    current = lazyTail(current);
  }
  return result;
}

// drop: 앞에서 n개 버리고 나머지 반환
export function drop(n: number, seq: LazySeq | null): LazySeq | null {
  let current = seq;
  let remaining = n;
  while (remaining > 0 && current) {
    current = lazyTail(current);
    remaining--;
  }
  return current;
}

// iterate: f를 반복 적용하는 무한 시퀀스 (init, f(init), f(f(init)), ...)
export function iterate(f: (x: any) => any, init: any): LazySeq {
  return lazySeq(
    () => init,
    () => iterate(f, f(init))
  );
}

// rangeSeq: start부터 시작하는 레이지 정수 시퀀스
// end가 undefined이면 무한, end가 지정되면 start < end까지
export function rangeSeq(start: number, end?: number): LazySeq | null {
  if (end !== undefined && start >= end) return null;
  return lazySeq(
    () => start,
    () => rangeSeq(start + 1, end)
  );
}

// filterLazy: 조건을 만족하는 원소만 통과시키는 레이지 시퀀스
export function filterLazy(pred: (x: any) => boolean, seq: LazySeq | null): LazySeq | null {
  // pred가 false인 앞부분을 건너뜀
  let current = seq;
  while (current && !pred(lazyHead(current))) {
    current = lazyTail(current);
  }
  if (!current) return null;
  const h = lazyHead(current);
  const t = lazyTail(current);
  return lazySeq(
    () => h,
    () => filterLazy(pred, t)
  );
}

// mapLazy: 각 원소에 f를 적용한 레이지 시퀀스
export function mapLazy(f: (x: any) => any, seq: LazySeq | null): LazySeq | null {
  if (!seq) return null;
  return lazySeq(
    () => f(lazyHead(seq!)),
    () => mapLazy(f, lazyTail(seq!))
  );
}

// zipLazy: 두 레이지 시퀀스를 zip (f(a, b) 조합)
export function zipWithLazy(
  f: (a: any, b: any) => any,
  seqA: LazySeq | null,
  seqB: LazySeq | null
): LazySeq | null {
  if (!seqA || !seqB) return null;
  const a = lazyHead(seqA);
  const b = lazyHead(seqB);
  return lazySeq(
    () => f(a, b),
    () => zipWithLazy(f, lazyTail(seqA!), lazyTail(seqB!))
  );
}

// takeWhile: pred가 true인 동안만 꺼냄
export function takeWhile(pred: (x: any) => boolean, seq: LazySeq | null): any[] {
  const result: any[] = [];
  let current = seq;
  while (current) {
    const h = lazyHead(current);
    if (!pred(h)) break;
    result.push(h);
    current = lazyTail(current);
  }
  return result;
}
