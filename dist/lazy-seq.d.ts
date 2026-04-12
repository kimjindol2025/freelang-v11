export declare const LAZY_SEQ: unique symbol;
export interface LazySeq {
    [LAZY_SEQ]: true;
    head: () => any;
    tail: () => LazySeq | null;
    _headCache?: any;
    _tailCache?: LazySeq | null;
    _headEvaluated?: boolean;
    _tailEvaluated?: boolean;
}
export declare function lazySeq(head: () => any, tail: () => LazySeq | null): LazySeq;
export declare function isLazySeq(v: any): v is LazySeq;
export declare function lazyHead(seq: LazySeq): any;
export declare function lazyTail(seq: LazySeq): LazySeq | null;
export declare function take(n: number, seq: LazySeq | any[] | null): any[];
export declare function drop(n: number, seq: LazySeq | null): LazySeq | null;
export declare function iterate(f: (x: any) => any, init: any): LazySeq;
export declare function rangeSeq(start: number, end?: number): LazySeq | null;
export declare function filterLazy(pred: (x: any) => boolean, seq: LazySeq | null): LazySeq | null;
export declare function mapLazy(f: (x: any) => any, seq: LazySeq | null): LazySeq | null;
export declare function zipWithLazy(f: (a: any, b: any) => any, seqA: LazySeq | null, seqB: LazySeq | null): LazySeq | null;
export declare function takeWhile(pred: (x: any) => boolean, seq: LazySeq | null): any[];
//# sourceMappingURL=lazy-seq.d.ts.map