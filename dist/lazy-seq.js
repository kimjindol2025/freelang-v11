"use strict";
// lazy-seq.ts — FreeLang v9 Phase 69: 레이지 시퀀스 (무한 스트림)
// iterate / range / filter-lazy / map-lazy / drop / take
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAZY_SEQ = void 0;
exports.lazySeq = lazySeq;
exports.isLazySeq = isLazySeq;
exports.lazyHead = lazyHead;
exports.lazyTail = lazyTail;
exports.take = take;
exports.drop = drop;
exports.iterate = iterate;
exports.rangeSeq = rangeSeq;
exports.filterLazy = filterLazy;
exports.mapLazy = mapLazy;
exports.zipWithLazy = zipWithLazy;
exports.takeWhile = takeWhile;
exports.LAZY_SEQ = Symbol("LAZY_SEQ");
function lazySeq(head, tail) {
    return { [exports.LAZY_SEQ]: true, head, tail };
}
function isLazySeq(v) {
    return v != null && typeof v === "object" && v[exports.LAZY_SEQ] === true;
}
// 메모이제이션된 head 접근
function lazyHead(seq) {
    if (!seq._headEvaluated) {
        seq._headCache = seq.head();
        seq._headEvaluated = true;
    }
    return seq._headCache;
}
// 메모이제이션된 tail 접근
function lazyTail(seq) {
    if (!seq._tailEvaluated) {
        seq._tailCache = seq.tail();
        seq._tailEvaluated = true;
    }
    return seq._tailCache ?? null;
}
// take: 앞에서 n개만 꺼내어 배열로 반환 (무한 시퀀스 안전)
function take(n, seq) {
    if (Array.isArray(seq))
        return seq.slice(0, n);
    const result = [];
    let current = seq;
    while (current && result.length < n) {
        result.push(lazyHead(current));
        current = lazyTail(current);
    }
    return result;
}
// drop: 앞에서 n개 버리고 나머지 반환
function drop(n, seq) {
    let current = seq;
    let remaining = n;
    while (remaining > 0 && current) {
        current = lazyTail(current);
        remaining--;
    }
    return current;
}
// iterate: f를 반복 적용하는 무한 시퀀스 (init, f(init), f(f(init)), ...)
function iterate(f, init) {
    return lazySeq(() => init, () => iterate(f, f(init)));
}
// rangeSeq: start부터 시작하는 레이지 정수 시퀀스
// end가 undefined이면 무한, end가 지정되면 start < end까지
function rangeSeq(start, end) {
    if (end !== undefined && start >= end)
        return null;
    return lazySeq(() => start, () => rangeSeq(start + 1, end));
}
// filterLazy: 조건을 만족하는 원소만 통과시키는 레이지 시퀀스
function filterLazy(pred, seq) {
    // pred가 false인 앞부분을 건너뜀
    let current = seq;
    while (current && !pred(lazyHead(current))) {
        current = lazyTail(current);
    }
    if (!current)
        return null;
    const h = lazyHead(current);
    const t = lazyTail(current);
    return lazySeq(() => h, () => filterLazy(pred, t));
}
// mapLazy: 각 원소에 f를 적용한 레이지 시퀀스
function mapLazy(f, seq) {
    if (!seq)
        return null;
    return lazySeq(() => f(lazyHead(seq)), () => mapLazy(f, lazyTail(seq)));
}
// zipLazy: 두 레이지 시퀀스를 zip (f(a, b) 조합)
function zipWithLazy(f, seqA, seqB) {
    if (!seqA || !seqB)
        return null;
    const a = lazyHead(seqA);
    const b = lazyHead(seqB);
    return lazySeq(() => f(a, b), () => zipWithLazy(f, lazyTail(seqA), lazyTail(seqB)));
}
// takeWhile: pred가 true인 동안만 꺼냄
function takeWhile(pred, seq) {
    const result = [];
    let current = seq;
    while (current) {
        const h = lazyHead(current);
        if (!pred(h))
            break;
        result.push(h);
        current = lazyTail(current);
    }
    return result;
}
//# sourceMappingURL=lazy-seq.js.map