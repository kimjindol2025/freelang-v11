// FreeLang v9: In-Memory Cache Standard Library
// Phase 21: TTL cache with global namespace and prefix support

interface CacheEntry {
  value: any;
  expiresAt: number | null; // null = no expiry
}

// Global cache — shared across all interpreter instances in the process
const _cache = new Map<string, CacheEntry>();

// Auto-cleanup: remove expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache) {
    if (v.expiresAt !== null && now > v.expiresAt) _cache.delete(k);
  }
}, 60_000).unref(); // unref so it doesn't prevent process exit

export function createCacheModule() {
  return {
    // cache_set key value ttl_ms → null  (ttl=0 means forever)
    "cache_set": (key: string, value: any, ttlMs: number = 0): null => {
      _cache.set(key, {
        value,
        expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
      });
      return null;
    },

    // cache_get key → value or null (null if missing or expired)
    "cache_get": (key: string): any => {
      const e = _cache.get(key);
      if (!e) return null;
      if (e.expiresAt !== null && Date.now() > e.expiresAt) { _cache.delete(key); return null; }
      return e.value;
    },

    // cache_has key → boolean
    "cache_has": (key: string): boolean => {
      const e = _cache.get(key);
      if (!e) return false;
      if (e.expiresAt !== null && Date.now() > e.expiresAt) { _cache.delete(key); return false; }
      return true;
    },

    // cache_del key → boolean (true if existed)
    "cache_del": (key: string): boolean => _cache.delete(key),

    // cache_clear prefix? → deleted count  (no prefix = clear all)
    "cache_clear": (prefix: string = ""): number => {
      if (!prefix) { const n = _cache.size; _cache.clear(); return n; }
      let n = 0;
      for (const k of _cache.keys()) { if (k.startsWith(prefix)) { _cache.delete(k); n++; } }
      return n;
    },

    // cache_size → total entry count (including expired not yet cleaned)
    "cache_size": (): number => _cache.size,

    // cache_keys prefix? → non-expired key list
    "cache_keys": (prefix: string = ""): string[] => {
      const now = Date.now();
      const keys: string[] = [];
      for (const [k, v] of _cache) {
        if (v.expiresAt !== null && now > v.expiresAt) continue;
        if (!prefix || k.startsWith(prefix)) keys.push(k);
      }
      return keys;
    },

    // cache_ttl key → remaining ms, -1 (no expiry), or null (not found)
    "cache_ttl": (key: string): number | null => {
      const e = _cache.get(key);
      if (!e) return null;
      if (e.expiresAt === null) return -1;
      const rem = e.expiresAt - Date.now();
      if (rem <= 0) { _cache.delete(key); return null; }
      return rem;
    },

    // cache_incr key amount → new numeric value
    "cache_incr": (key: string, amount: number = 1): number => {
      const e = _cache.get(key);
      const next = Number(e?.value ?? 0) + amount;
      _cache.set(key, { value: next, expiresAt: e?.expiresAt ?? null });
      return next;
    },

    // cache_get_or_set key producer_fn ttl → value
    // If key exists, return it. Otherwise call callFn(producer_fn, []) and cache+return result.
    // Note: producer_fn is a FreeLang function name string — needs callFn.
    // This version just returns null if missing (no callFn reference here).
    // Use cache_get + cache_set in FreeLang code for the full pattern.
    "cache_mget": (keys: string[]): Record<string, any> => {
      const result: Record<string, any> = {};
      const now = Date.now();
      for (const k of keys) {
        const e = _cache.get(k);
        if (!e) { result[k] = null; continue; }
        if (e.expiresAt !== null && now > e.expiresAt) { _cache.delete(k); result[k] = null; continue; }
        result[k] = e.value;
      }
      return result;
    },

    // cache_mset entries ttl → null  (entries = {key: value, ...})
    "cache_mset": (entries: Record<string, any>, ttlMs: number = 0): null => {
      const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
      for (const [k, v] of Object.entries(entries)) {
        _cache.set(k, { value: v, expiresAt });
      }
      return null;
    },

    // Phase F: wait_for_cache key timeoutMs intervalMs → Promise<value or null>
    // 캐시에 값이 생길 때까지 비동기 대기 (이벤트 루프 비블로킹)
    "wait_for_cache": (key: string, timeoutMs: number = 30000, intervalMs: number = 50): Promise<any> => {
      return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          const entry = _cache.get(key);
          if (entry && (!entry.expiresAt || Date.now() <= entry.expiresAt)) {
            _cache.delete(key); // 소비형 (1회 사용 후 삭제)
            resolve(entry.value);
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            resolve(null);
            return;
          }
          setTimeout(check, intervalMs);
        };
        check();
      });
    },
  };
}
