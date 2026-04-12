"use strict";
// FreeLang v9: Phase 70 — Immutable Collections
// 구조 공유(structural sharing) 기반 이뮤터블 맵/벡터
// Object.freeze + spread copy 방식으로 영속성 보장
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImmutableModule = createImmutableModule;
function stripColon(key) {
    return typeof key === "string" && key.startsWith(":") ? key.slice(1) : key;
}
function createImmutableModule() {
    return {
        // ── 맵 함수 ──────────────────────────────────────────
        /** 이뮤터블 맵 생성 */
        "imm-map": (obj) => {
            if (!obj || typeof obj !== "object" || Array.isArray(obj))
                return Object.freeze({});
            const normalized = {};
            for (const k of Object.keys(obj)) {
                normalized[stripColon(k)] = obj[k];
            }
            return Object.freeze(normalized);
        },
        /** 키-값 추가/업데이트 → 새 맵 반환 (원본 불변) */
        "imm-assoc": (m, key, val) => {
            const base = m && typeof m === "object" && !Array.isArray(m) ? m : {};
            return Object.freeze({ ...base, [stripColon(key)]: val });
        },
        /** 키 제거 → 새 맵 반환 */
        "imm-dissoc": (m, key) => {
            if (!m || typeof m !== "object")
                return Object.freeze({});
            const k = stripColon(key);
            const { [k]: _removed, ...rest } = m;
            return Object.freeze(rest);
        },
        /** 키로 값 조회 */
        "imm-get": (m, key, defaultVal) => {
            if (!m || typeof m !== "object")
                return defaultVal ?? null;
            const k = stripColon(key);
            const val = m[k];
            return val !== undefined ? val : (defaultVal ?? null);
        },
        /** 모든 키 목록 */
        "imm-keys": (m) => {
            if (!m || typeof m !== "object" || Array.isArray(m))
                return Object.freeze([]);
            return Object.freeze(Object.keys(m));
        },
        /** 모든 값 목록 */
        "imm-vals": (m) => {
            if (!m || typeof m !== "object" || Array.isArray(m))
                return Object.freeze([]);
            return Object.freeze(Object.values(m));
        },
        /** 두 맵 병합 → 새 맵 (m2가 우선) */
        "imm-merge": (m1, m2) => {
            const base = m1 && typeof m1 === "object" && !Array.isArray(m1) ? m1 : {};
            const overlay = m2 && typeof m2 === "object" && !Array.isArray(m2) ? m2 : {};
            return Object.freeze({ ...base, ...overlay });
        },
        // ── 벡터 함수 ─────────────────────────────────────────
        /** 이뮤터블 벡터 생성 */
        "imm-vec": (arr) => {
            if (!Array.isArray(arr))
                return Object.freeze([]);
            return Object.freeze([...arr]);
        },
        /** 끝에 값 추가 → 새 벡터 (원본 불변) */
        "imm-conj": (v, val) => {
            if (!Array.isArray(v))
                return Object.freeze([val]);
            return Object.freeze([...v, val]);
        },
        /** 인덱스로 값 조회 */
        "imm-nth": (v, idx) => {
            if (!Array.isArray(v))
                return null;
            const val = v[idx];
            return val !== undefined ? val : null;
        },
        /** 슬라이스 → 새 벡터 */
        "imm-slice": (v, start, end) => {
            if (!Array.isArray(v))
                return Object.freeze([]);
            return Object.freeze(v.slice(start, end));
        },
        /** 특정 인덱스 값 교체 → 새 벡터 */
        "imm-update": (v, idx, val) => {
            if (!Array.isArray(v))
                return Object.freeze([]);
            const copy = [...v];
            copy[idx] = val;
            return Object.freeze(copy);
        },
        /** 마지막 원소 제거 → 새 벡터 */
        "imm-pop": (v) => {
            if (!Array.isArray(v) || v.length === 0)
                return Object.freeze([]);
            return Object.freeze(v.slice(0, -1));
        },
        // ── 공통 함수 ─────────────────────────────────────────
        /** 원소 수 */
        "imm-count": (c) => {
            if (Array.isArray(c))
                return c.length;
            if (c && typeof c === "object")
                return Object.keys(c).length;
            return 0;
        },
        /** 이뮤터블 여부 확인 */
        "imm?": (v) => Object.isFrozen(v),
        /** 비어있는지 확인 */
        "imm-empty?": (c) => {
            if (Array.isArray(c))
                return c.length === 0;
            if (c && typeof c === "object")
                return Object.keys(c).length === 0;
            return true;
        },
        /** 소스를 타겟에 합치기 → 새 컬렉션 */
        "imm-into": (target, source) => {
            if (Array.isArray(target)) {
                const extra = Array.isArray(source)
                    ? source
                    : source && typeof source === "object"
                        ? Object.values(source)
                        : [];
                return Object.freeze([...target, ...extra]);
            }
            // 맵 타겟
            const base = target && typeof target === "object" ? target : {};
            const overlay = source && typeof source === "object" && !Array.isArray(source) ? source : {};
            return Object.freeze({ ...base, ...overlay });
        },
    };
}
//# sourceMappingURL=immutable.js.map