/**
 * Create the collection + control module for FreeLang v9
 */
export declare function createCollectionModule(): {
    arr_flatten: (arr: any[]) => any[];
    arr_flatten_deep: (arr: any[]) => any[];
    arr_zip: (arr1: any[], arr2: any[]) => any[][];
    arr_unique: (arr: any[]) => any[];
    arr_chunk: (arr: any[], size: number) => any[][];
    arr_take: (arr: any[], n: number) => any[];
    arr_drop: (arr: any[], n: number) => any[];
    arr_sum: (arr: number[]) => number;
    arr_avg: (arr: number[]) => number;
    arr_min: (arr: number[]) => number;
    arr_max: (arr: number[]) => number;
    arr_group_by: (arr: Record<string, any>[], key: string) => Record<string, any[]>;
    arr_sort_by: (arr: Record<string, any>[], key: string) => any[];
    arr_sort_by_desc: (arr: Record<string, any>[], key: string) => any[];
    arr_count_by: (arr: Record<string, any>[], key: string) => Record<string, number>;
    arr_pluck: (arr: Record<string, any>[], key: string) => any[];
    arr_index_by: (arr: Record<string, any>[], key: string) => Record<string, any>;
    retry: (n: number, fn: () => any) => any;
    retry_silent: (n: number, fn: () => any) => any;
    pipeline_run: (initial: any, steps: Array<(x: any) => any>) => any;
    memoize: (fn: (...args: any[]) => any) => (...args: any[]) => any;
    once: (fn: (...args: any[]) => any) => (...args: any[]) => any;
    tap: (value: any, fn: (x: any) => void) => any;
    range: (start: number, end: number) => number[];
    range_step: (start: number, end: number, step: number) => number[];
    repeat: (n: number, value: any) => any[];
};
//# sourceMappingURL=stdlib-collection.d.ts.map