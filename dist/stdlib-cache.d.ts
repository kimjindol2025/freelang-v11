export declare function createCacheModule(): {
    cache_set: (key: string, value: any, ttlMs?: number) => null;
    cache_get: (key: string) => any;
    cache_has: (key: string) => boolean;
    cache_del: (key: string) => boolean;
    cache_clear: (prefix?: string) => number;
    cache_size: () => number;
    cache_keys: (prefix?: string) => string[];
    cache_ttl: (key: string) => number | null;
    cache_incr: (key: string, amount?: number) => number;
    cache_mget: (keys: string[]) => Record<string, any>;
    cache_mset: (entries: Record<string, any>, ttlMs?: number) => null;
};
//# sourceMappingURL=stdlib-cache.d.ts.map