export interface FreeLangError {
    message: string;
    file?: string;
    line?: number;
    col?: number;
    source?: string;
    hint?: string;
}
/**
 * 레벤슈타인 거리 계산 (간단 구현, npm 패키지 불필요)
 */
export declare function levenshtein(a: string, b: string): number;
/**
 * 유사 이름 추천
 * - 짧은 이름(≤4자): 거리 ≤ 2
 * - 긴 이름(>4자): 거리 ≤ 3 (예: compute-tax vs compute-rate = 3)
 * @param name 찾지 못한 이름
 * @param candidates 후보 목록
 * @returns 가장 가까운 후보 또는 null
 */
export declare function suggestSimilar(name: string, candidates: string[]): string | null;
/**
 * 에러 포매팅 — 파일:줄:컬럼 헤더 + 소스 강조 (±2줄) + 힌트
 */
export declare function formatError(err: FreeLangError): string;
//# sourceMappingURL=error-formatter.d.ts.map